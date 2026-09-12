"""Every tunable value in the service, in one typed object.

Pydantic Settings, so a malformed number or a missing required secret fails at
import with a message naming the variable — not at 3am inside a retrieval call.

Nothing outside this module reads `os.environ`. The retrieval pipeline reads
`settings.retrieval.dense_top_k`; it never sees a string, never applies a
default of its own, and can be handed a different Settings in a test.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import BaseModel, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "testing", "production"]
LLMProviderName = Literal["gemini", "groq", "xai"]


class QdrantSettings(BaseModel):
    url: str = "http://localhost:6333"
    api_key: SecretStr | None = None
    collection: str = "jaaz_knowledge_base"
    # BAAI/bge-base-en-v1.5 emits 768 dimensions. The collection is created
    # with this width, and a mismatch between it and the embedding model is
    # rejected at startup rather than producing silent garbage.
    vector_size: int = 768
    # Cosine. The embedding provider normalises to unit length, so cosine and
    # dot product agree — cosine is stated explicitly so the collection is
    # still correct if a future provider forgets to normalise.
    distance: Literal["Cosine", "Dot", "Euclid"] = "Cosine"
    timeout_seconds: float = 20.0
    prefer_grpc: bool = False
    # A directory for an embedded, on-disk Qdrant instead of a server — for
    # development and end-to-end tests without a Qdrant to point at. `url` and
    # `api_key` are ignored when it is set. Refused in production: embedded
    # mode is single-process and has no replication or snapshots.
    local_path: str | None = None


class EmbeddingSettings(BaseModel):
    """The embedding model, and where it runs.

    Both providers use the same model and produce interchangeable vectors —
    same 768 dimensions, same L2 normalisation — so switching does not
    require reindexing.

      huggingface_api        Hugging Face hosted inference. No weights on
                             disk, no torch. Costs a network round trip per
                             call and is subject to cold starts and rate
                             limits, and document text leaves the machine.
      sentence_transformers  SentenceTransformer("BAAI/bge-base-en-v1.5") in
                             this process. ~440MB of weights plus ~1GB of
                             torch, and needs requirements-local-models.txt.
                             Faster, private, no rate limit.
    """

    provider: Literal["huggingface_api", "sentence_transformers"] = "huggingface_api"
    model: str = "BAAI/bge-base-en-v1.5"
    dimensions: int = 768

    # BGE was trained with an instruction prefix on the *query* side only.
    # Omitting it costs several points of retrieval quality; applying it to
    # passages as well costs about as much in the other direction.
    query_instruction: str = (
        "Represent this sentence for searching relevant passages: "
    )
    batch_size: int = 32
    # Sequences longer than this are truncated by the model anyway; stating it
    # lets the chunker's output be checked against it.
    max_sequence_length: int = 512

    # -- hosted inference --
    api_key: SecretStr | None = None
    api_base: str = "https://router.huggingface.co/hf-inference/models"
    timeout_seconds: float = 60.0
    # The serverless API answers 503 with an "estimated_time" while it loads
    # a cold model. That is worth waiting out, not failing on.
    max_retries: int = 3
    cold_start_wait_seconds: float = 20.0

    # -- local inference --
    device: str | None = None  # None → let torch decide (cuda if present)
    cache_dir: str | None = None

    # Query embeddings repeat constantly — the same question asked twice, a
    # regenerate, a follow-up that rewrites to the same string.
    query_cache_size: int = 512


class RerankerSettings(BaseModel):
    """The cross-encoder stage.

    "none" passes the fused ranking straight through. That is a legitimate
    configuration, not a broken one: RRF over dense and sparse is already a
    decent ranking, and the reranker is the most expensive stage in the
    pipeline.
    """

    provider: Literal["huggingface_api", "cross_encoder", "none"] = "huggingface_api"
    model: str = "BAAI/bge-reranker-base"
    batch_size: int = 16
    device: str | None = None
    api_key: SecretStr | None = None
    api_base: str = "https://router.huggingface.co/hf-inference/models"
    timeout_seconds: float = 30.0
    max_retries: int = 2


class RetrievalSettings(BaseModel):
    """The accuracy dials. Every one of these is a tuning knob, not a constant.

    They live together because they are tuned together: raising `dense_top_k`
    without raising `rerank_top_k` just gives the reranker more to discard.
    """

    dense_top_k: int = 30
    sparse_top_k: int = 30
    # Reciprocal Rank Fusion's smoothing constant. 60 is the value from the
    # original paper and is a sane default; lowering it sharpens the influence
    # of top ranks.
    fusion_k: int = 60
    dense_weight: float = 1.0
    sparse_weight: float = 1.0
    # How many fused candidates the reranker scores. The cross-encoder is the
    # expensive stage — this is the main latency/quality dial.
    rerank_top_k: int = 20
    # How many chunks reach the prompt.
    final_context_chunks: int = 6
    # Dense cosine floor. Applied before fusion; a chunk below this is noise
    # and only dilutes the ranking.
    similarity_threshold: float = 0.30
    # Reranker score floor. Cross-encoder logits are unbounded, so this is
    # deliberately permissive by default.
    rerank_score_threshold: float = 0.0
    # Total characters of context. Guards the prompt against a handful of
    # very long chunks blowing the model's window and the bill.
    max_context_characters: int = 12_000


class LLMProviderSettings(BaseModel):
    api_key: SecretStr | None = None
    model: str = ""
    base_url: str = ""
    timeout_seconds: float = 60.0
    max_output_tokens: int = 1024
    temperature: float = 0.2


# The endpoint and default model for each provider, in one place.
#
# WHY THIS IS A TABLE AND NOT A DEFAULT ARGUMENT. These values used to live in
# a default `LLMProviderSettings(...)` instance on each field below. That is a
# trap with pydantic-settings: supplying ANY nested variable for a provider —
# `LLM__GEMINI__API_KEY`, which .env.example tells you to set — makes it build
# a fresh `LLMProviderSettings` from the environment, and every field the
# environment did not mention falls back to the *field* default (`""`), not to
# the default instance. Configuring an API key therefore silently blanked
# `base_url`, and every generation failed with "Request URL is missing an
# 'http://' or 'https://' protocol" — but only once someone configured a key,
# which is to say only in production.
#
# Filling them in a validator instead means a partially-specified provider
# keeps the defaults for whatever it left out.
#
# xAI speaks the same OpenAI-compatible dialect as Groq and shares its
# implementation. It is listed separately because the key, host and model
# names differ, and because "grok" and "Groq" are two different companies
# whose keys are easy to mix up (xai-… versus gsk_…).
_PROVIDER_DEFAULTS: dict[str, tuple[str, str]] = {
    "gemini": (
        "gemini-3.6-flash",
        "https://generativelanguage.googleapis.com/v1beta",
    ),
    "groq": (
        "groq/compound",
        "https://api.groq.com/openai/v1",
    ),
    "xai": (
        "grok-3-mini",
        "https://api.x.ai/v1",
    ),
}


class LLMSettings(BaseModel):
    primary: LLMProviderName = "gemini"
    # None disables fallback entirely.
    fallback: LLMProviderName | None = "groq"

    # Empty by default and filled by the validator below — see the table.
    gemini: LLMProviderSettings = Field(default_factory=LLMProviderSettings)
    groq: LLMProviderSettings = Field(default_factory=LLMProviderSettings)
    xai: LLMProviderSettings = Field(default_factory=LLMProviderSettings)

    # Retries inside one provider before falling over to the next. Kept low:
    # a fallback provider is usually faster than a third retry.
    max_attempts_per_provider: int = 2

    @model_validator(mode="after")
    def _fill_provider_defaults(self) -> LLMSettings:
        """Supply the endpoint and model any provider did not specify.

        Runs after the environment has been read, so an explicit
        `LLM__GEMINI__BASE_URL` still wins. What it prevents is a provider
        that mentioned one field ending up with nothing in the others.
        """
        for name, (model, base_url) in _PROVIDER_DEFAULTS.items():
            provider: LLMProviderSettings = getattr(self, name)
            if not provider.model:
                provider.model = model
            if not provider.base_url:
                provider.base_url = base_url
        return self

    def provider_settings(self, name: LLMProviderName) -> LLMProviderSettings:
        """The configuration block for one provider.

        An explicit match rather than `getattr(self, name)`. The dynamic
        version type-checks as `Any`, which is how a caller reaching for an
        attribute that does not exist gets all the way to a runtime
        AttributeError at startup instead of being caught statically.
        """
        match name:
            case "gemini":
                return self.gemini
            case "groq":
                return self.groq
            case "xai":
                return self.xai
        raise ValueError(f"Unknown LLM provider {name!r}")


class ConversationSettings(BaseModel):
    """Context-window management.

    Unbounded history is the most common way a chat endpoint becomes
    expensive — every turn re-sends every previous turn, so cost grows with
    the square of the conversation length.
    """

    # Turns of verbatim history sent to the model.
    max_history_messages: int = 8
    # Characters per historical message before it is truncated.
    max_history_message_characters: int = 2_000
    # Turns of history considered when deciding whether a query needs
    # rewriting. Shorter than the above: a pronoun refers to something recent.
    rewrite_context_messages: int = 4


class QueryRewriteSettings(BaseModel):
    enabled: bool = True
    # A question with no pronouns and enough words to stand alone is not
    # rewritten — an extra LLM round trip per turn is real latency and real
    # money for no gain. See retrieval/query_rewrite.py.
    min_words_to_skip_rewrite: int = 6
    max_rewritten_characters: int = 400
    timeout_seconds: float = 12.0


class AssistantSettings(BaseModel):
    """Who the assistant says it is, and what it says it answers from.

    Only these two phrases are configurable. The rules in rag/prompts.py —
    cite everything, prefer "I don't know", treat documents as data — are
    not, because a rule a deployment can edit is a rule a deployment can
    delete by accident.
    """

    name: str = "the JAAZ assistant"
    corpus_description: str = "an internal knowledge base of company documents"


class IngestionSettings(BaseModel):
    """Turning uploaded bytes into chunks: parsing, cleaning, chunking.

    Every ceiling here is a defence as well as a dial. A document is
    attacker-controlled input — an administrator's account can be phished and
    a PDF can be crafted — so these bound what one upload can cost in memory,
    CPU and embedding calls before anything expensive starts.
    """

    max_file_bytes: int = 25 * 1024 * 1024
    max_pages: int = 1_500
    # Extracted text, after cleaning. Stops a small, highly compressed file
    # from expanding into something the embedder would spend an hour on.
    max_extracted_characters: int = 4_000_000
    # DOCX is a zip. These bound the decompressed size and the per-member
    # ratio — the zip-bomb guard — before python-docx ever opens it.
    max_uncompressed_bytes: int = 150 * 1024 * 1024
    max_compression_ratio: float = 120.0
    # CSV rows, or JSON records. Each becomes at least one line of a chunk.
    max_table_rows: int = 50_000
    # Extraction is CPU-bound and runs in a thread. More than a couple at
    # once only makes each slower and the API less responsive.
    max_concurrent_extractions: int = 2

    # Chunk sizes are in *estimated* tokens — see ingestion/tokens.py. The
    # ceiling sits below the embedding model's 512-token window with margin
    # for the estimate running low, because text past the window is silently
    # truncated by the model: stored, cited, and never actually embedded.
    chunk_target_tokens: int = 300
    chunk_max_tokens: int = 420
    chunk_overlap_tokens: int = 45
    # A section's tail smaller than this is folded into the chunk before it.
    chunk_min_tokens: int = 24
    # The index endpoint accepts at most 5,000 chunks per document.
    max_chunks: int = 5_000
    # Prefix each chunk with its heading path ("Admissions › Fees"). A
    # passage saying "The deadline is 31 March" means nothing to an embedding
    # model without the heading that says what the deadline is for.
    include_section_path: bool = True


class UrlFetchSettings(BaseModel):
    """Fetching a web page for ingestion.

    This is the one outbound request whose destination a user chooses, which
    makes it the service's SSRF surface: a URL is a request from inside the
    network to wherever the URL says. The controls are in
    ingestion/url_fetcher.py; these are their parameters.
    """

    allowed_schemes: list[str] = Field(default_factory=lambda: ["https", "http"])
    # Web ports only. A link to :6333 or :5432 is not a document.
    allowed_ports: list[int] = Field(default_factory=lambda: [80, 443])
    timeout_seconds: float = 20.0
    connect_timeout_seconds: float = 8.0
    max_bytes: int = 10 * 1024 * 1024
    max_redirects: int = 5
    user_agent: str = "KnowledgeBaseFetcher/1.0 (+document ingestion)"
    # For tests and for local development against a page on this machine.
    # Refused in production by the validator on Settings.
    allow_private_networks: bool = False


class SecuritySettings(BaseModel):
    """Trust between the main backend and this service.

    The service is internal. It is not on the public internet by design, but
    "nobody knows the URL" is not a control, so every request carries a shared
    secret and is compared in constant time.
    """

    service_token: SecretStr | None = None
    # Only meaningful in development, where a browser might hit the docs.
    cors_allow_origins: list[str] = Field(default_factory=list)


class RateLimitSettings(BaseModel):
    """Per-user ceilings on the expensive endpoints.

    In-process counters. Correct for a single instance and an honest
    approximation for two; a shared store is the production upgrade, and the
    limiter is behind an interface for that reason.
    """

    enabled: bool = True
    chat_requests_per_minute: int = 20
    chat_requests_per_hour: int = 200
    index_requests_per_minute: int = 60


class ObservabilitySettings(BaseModel):
    log_level: str = "INFO"
    # JSON in production so a log shipper can parse it; human-readable
    # locally, where the reader is a person.
    log_format: Literal["json", "console"] = "console"
    # Reserved: intended to log the first N characters of a question at
    # DEBUG. Nothing reads it yet. Kept rather than dropped because it is
    # documented in .env.example and an operator may already have set it;
    # removing it would silently change what a deployment's .env means.
    log_query_text: bool = False


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore",
        case_sensitive=False,
    )

    environment: Environment = "development"
    service_name: str = "jaaz-ai-service"
    debug: bool = False

    qdrant: QdrantSettings = QdrantSettings()
    embedding: EmbeddingSettings = EmbeddingSettings()
    reranker: RerankerSettings = RerankerSettings()
    retrieval: RetrievalSettings = RetrievalSettings()
    llm: LLMSettings = LLMSettings()
    conversation: ConversationSettings = ConversationSettings()
    query_rewrite: QueryRewriteSettings = QueryRewriteSettings()
    assistant: AssistantSettings = AssistantSettings()
    ingestion: IngestionSettings = IngestionSettings()
    url_fetch: UrlFetchSettings = UrlFetchSettings()
    security: SecuritySettings = SecuritySettings()
    rate_limit: RateLimitSettings = RateLimitSettings()
    observability: ObservabilitySettings = ObservabilitySettings()

    # -- cross-field checks ---------------------------------------------

    @model_validator(mode="after")
    def _check_consistency(self) -> Settings:
        if self.qdrant.vector_size != self.embedding.dimensions:
            raise ValueError(
                f"QDRANT__VECTOR_SIZE ({self.qdrant.vector_size}) must equal "
                f"EMBEDDING__DIMENSIONS ({self.embedding.dimensions}). A "
                f"collection whose width disagrees with the model accepts "
                f"nothing and explains nothing."
            )

        if self.llm.fallback == self.llm.primary:
            raise ValueError(
                "LLM__FALLBACK must differ from LLM__PRIMARY, or set it empty "
                "to disable fallback. Falling back to the provider that just "
                "failed is not a fallback."
            )

        if self.retrieval.final_context_chunks > self.retrieval.rerank_top_k:
            raise ValueError(
                "RETRIEVAL__FINAL_CONTEXT_CHUNKS cannot exceed "
                "RETRIEVAL__RERANK_TOP_K — the reranker cannot return more "
                "results than it was given."
            )

        ingestion = self.ingestion
        if not (0 < ingestion.chunk_min_tokens < ingestion.chunk_target_tokens
                <= ingestion.chunk_max_tokens):
            raise ValueError(
                "Chunk sizes must satisfy 0 < INGESTION__CHUNK_MIN_TOKENS < "
                "INGESTION__CHUNK_TARGET_TOKENS <= INGESTION__CHUNK_MAX_TOKENS."
            )
        if ingestion.chunk_overlap_tokens >= ingestion.chunk_target_tokens:
            raise ValueError(
                "INGESTION__CHUNK_OVERLAP_TOKENS must be smaller than "
                "INGESTION__CHUNK_TARGET_TOKENS, or every chunk would be mostly "
                "a copy of the one before it."
            )
        if ingestion.chunk_max_tokens > self.embedding.max_sequence_length:
            raise ValueError(
                f"INGESTION__CHUNK_MAX_TOKENS ({ingestion.chunk_max_tokens}) "
                f"exceeds the embedding model's window "
                f"({self.embedding.max_sequence_length}). The excess would be "
                f"stored and cited but never embedded."
            )
        if ingestion.max_chunks > 5_000:
            raise ValueError(
                "INGESTION__MAX_CHUNKS cannot exceed 5000, the most the index "
                "endpoint accepts for one document."
            )

        if self.environment == "production" and self.url_fetch.allow_private_networks:
            raise ValueError(
                "URL_FETCH__ALLOW_PRIVATE_NETWORKS cannot be enabled in "
                "production. It turns URL ingestion into a way to read "
                "internal services."
            )

        if self.environment == "production" and self.qdrant.local_path:
            raise ValueError(
                "QDRANT__LOCAL_PATH is for development only. Embedded Qdrant "
                "is single-process, with no replication or snapshots; point "
                "QDRANT__URL at a Qdrant server in production."
            )

        if self.environment == "production":
            if self.security.service_token is None:
                raise ValueError(
                    "SECURITY__SERVICE_TOKEN is required in production. "
                    "Refusing to start an unauthenticated AI service."
                )
            if not self.provider_settings(self.llm.primary).api_key:
                raise ValueError(
                    f"No API key configured for the primary LLM provider "
                    f"{self.llm.primary!r}."
                )
        return self

    # -- accessors -------------------------------------------------------

    def provider_settings(self, name: LLMProviderName) -> LLMProviderSettings:
        return self.llm.provider_settings(name)

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """The process-wide settings object.

    Cached because reading and validating the environment on every request is
    waste, and because a settings object that could differ between two reads
    in the same request is a bug waiting to happen. Tests override it through
    FastAPI's dependency system rather than by mutating this.
    """
    return Settings()
