"""The RAG pipeline.

    question
      → validate
      → resolve against conversation history (rewrite, if it helps)
      → hybrid retrieval  (dense ∥ sparse → RRF → rerank)
      → build context     (sanitise, deduplicate, fit the budget)
      → construct a grounded prompt
      → generate          (primary LLM, fallback on the right failures)
      → resolve citations against what was actually retrieved

Split into `prepare` and `generate` rather than one call. Everything up to
the prompt is identical for streaming and non-streaming answers, and the
split is what lets the chat service send source cards to the browser the
moment retrieval finishes — before the first token, which is a second or two
earlier than the alternative.

WHY THIS IS NOT A LANGGRAPH GRAPH
---------------------------------
The brief invites an explanation if LangGraph is skipped, so: this pipeline
has two conditional branches (rewrite-or-not, context-or-no-context), one
parallel step (`asyncio.gather` over the two searches, one line), and a state
object that is a dataclass. LangGraph earns its complexity on workflows with
cycles, human-in-the-loop interrupts, checkpointed resumption or a dozen
interacting nodes. Here it would add a dependency, a second control-flow
vocabulary, and real friction where token streaming has to cross a node
boundary and interleave with provider fallback — for a graph that reads
perfectly well as a function.

If graph-level tooling is wanted later — visualisation, per-node
checkpointing, interrupts — this file is the only one that changes. Every
stage below is already an injected collaborator with its own tests.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass, field

from app.core.config import (
    ConversationSettings,
    LLMProviderSettings,
    RetrievalSettings,
    Settings,
)
from app.core.logging import Stopwatch, get_logger
from app.modules.llm.base import (
    ChatMessage,
    GenerationRequest,
    LLMProvider,
    StreamChunk,
)
from app.modules.retrieval.models import (
    RetrievalOverrides,
    RetrievalQuery,
    RetrievalResult,
)
from app.modules.retrieval.query_rewrite import QueryRewriter
from app.modules.retrieval.service import RetrievalService
from app.modules.vector_store.filters import SearchFilter
from app.shared.types import (
    ChatRole,
    GenerationMetadata,
    RetrievedChunk,
    Source,
    TokenUsage,
)

from . import citations, grounding, prompts
from .context import BuiltContext, ContextBuilder

logger = get_logger(__name__)


@dataclass
class PreparedAnswer:
    """Everything decided before the model is called."""

    question: str
    search_query: str
    rewritten: bool
    retrieval: RetrievalResult
    context: BuiltContext
    request: GenerationRequest
    # Sources in prompt order, so the UI can render cards before generation
    # finishes. Their citation_number is the marker the model was told to use.
    provisional_sources: list[Source] = field(default_factory=list)
    # Why the query was or was not rewritten, and what deciding cost.
    rewrite_reason: str = ""
    rewrite_ms: int = 0

    @property
    def grounded(self) -> bool:
        return not self.context.is_empty


@dataclass
class RagAnswer:
    answer: str
    sources: list[Source]
    metadata: GenerationMetadata


class RagPipeline:
    def __init__(
        self,
        retrieval: RetrievalService,
        llm: LLMProvider,
        rewriter: QueryRewriter,
        settings: Settings,
    ) -> None:
        self._retrieval = retrieval
        self._llm = llm
        self._rewriter = rewriter
        self._settings = settings
        self._context_builder = ContextBuilder(
            max_characters=settings.retrieval.max_context_characters,
            max_chunks=settings.retrieval.final_context_chunks,
        )
        # Rendered once: they depend only on the deployment's settings.
        self._system_prompt = prompts.system_prompt(settings.assistant)
        self._no_context_prompt = prompts.no_context_system_prompt(settings.assistant)

    # -- stage 1: everything up to the prompt ----------------------------

    async def prepare(
        self,
        question: str,
        history: Sequence[ChatMessage],
        filters: SearchFilter,
        *,
        trace: bool = False,
        overrides: RetrievalOverrides | None = None,
    ) -> PreparedAnswer:
        """Rewrite, retrieve and build the prompt.

        `trace` and `overrides` exist for the diagnostics endpoint: the Test
        RAG page runs this exact method, with every intermediate ranking
        recorded and, optionally, different stage sizes. Chat never sets them.
        """
        question = question.strip()
        tuning = overrides or RetrievalOverrides()

        with Stopwatch() as rewrite_timer:
            decision = await self._rewriter.rewrite(question, list(history))
        retrieval = await self._retrieval.retrieve(
            RetrievalQuery(
                text=decision.query,
                filters=filters,
                dense_top_k=tuning.dense_top_k,
                sparse_top_k=tuning.sparse_top_k,
                rerank_top_k=tuning.rerank_top_k,
                final_k=tuning.final_k,
                trace=trace,
            )
        )
        builder = (
            self._context_builder if tuning.final_k is None
            else ContextBuilder(
                max_characters=self._settings.retrieval.max_context_characters,
                max_chunks=tuning.final_k,
            )
        )
        context = builder.build(retrieval.chunks)

        request = (
            self._grounded_request(question, history, context.chunks)
            if context.chunks
            else self._no_context_request(question, history)
        )

        return PreparedAnswer(
            question=question,
            search_query=decision.query,
            rewritten=decision.rewritten,
            retrieval=retrieval,
            context=context,
            request=request,
            provisional_sources=citations.provisional_sources(context.chunks),
            rewrite_reason=decision.reason,
            rewrite_ms=rewrite_timer.milliseconds,
        )

    # -- stage 2a: complete answer ---------------------------------------

    async def generate(self, prepared: PreparedAnswer) -> RagAnswer:
        with Stopwatch() as timer:
            result = await self._llm.generate(prepared.request)

        resolved = citations.build(result.text, prepared.context.chunks)
        metadata = self._metadata(
            prepared,
            provider=result.provider,
            model=result.model,
            usage=result.usage,
            generation_ms=timer.milliseconds,
            resolved=resolved,
        )

        logger.info("Answer generated", extra=_log_fields(metadata))
        return RagAnswer(
            answer=resolved.answer, sources=resolved.sources, metadata=metadata
        )

    # -- stage 2b: streamed answer ---------------------------------------

    async def generate_stream(
        self, prepared: PreparedAnswer
    ) -> AsyncIterator[StreamChunk | RagAnswer]:
        """Yield StreamChunks, then one RagAnswer as the final item.

        Citations can only be resolved once the whole answer exists — the
        markers are in the text. So tokens stream first and the resolved
        result arrives last, carrying the cleaned answer (with any fabricated
        markers removed) for the client to reconcile against what it
        rendered.
        """
        buffer: list[str] = []
        usage: TokenUsage | None = None
        # Where the answer came from is reported by the chunks themselves —
        # the fallback wrapper stamps each one with the provider that served
        # it. Reading `name` off `self._llm` instead would label every
        # streamed answer "fallback", even when the primary answered.
        # These stay as the fallback for a provider that does not stamp.
        provider = getattr(self._llm, "name", "unknown")
        model = self._llm.model
        finish_reason = ""

        with Stopwatch() as timer:
            async for chunk in self._llm.stream(prepared.request):
                if chunk.delta:
                    buffer.append(chunk.delta)
                if chunk.usage:
                    usage = chunk.usage
                if chunk.provider:
                    provider = chunk.provider
                if chunk.model:
                    model = chunk.model
                if chunk.finish_reason:
                    finish_reason = chunk.finish_reason
                yield chunk

        if _is_truncated(finish_reason):
            # A cut-off answer is worse than a failed one: it looks finished.
            # Reasoning models spend part of the same budget on internal
            # thinking, so this fires long before the visible text approaches
            # the limit — which is exactly why it is worth saying out loud
            # rather than leaving someone to notice a sentence ending
            # mid-word.
            logger.warning(
                "The answer was cut off by the output token limit",
                extra={
                    "provider": provider,
                    "model": model,
                    "finish_reason": finish_reason,
                    "max_output_tokens": prepared.request.max_output_tokens,
                },
            )

        text = "".join(buffer)
        resolved = citations.build(text, prepared.context.chunks)
        metadata = self._metadata(
            prepared,
            provider=provider,
            model=model,
            usage=usage,
            generation_ms=timer.milliseconds,
            resolved=resolved,
        )

        logger.info("Answer streamed", extra=_log_fields(metadata))
        yield RagAnswer(
            answer=resolved.answer, sources=resolved.sources, metadata=metadata
        )

    # -- prompt construction ---------------------------------------------

    def _grounded_request(
        self, question: str, history: Sequence[ChatMessage],
        chunks: list[RetrievedChunk],
    ) -> GenerationRequest:
        messages = [ChatMessage(role=ChatRole.SYSTEM, content=self._system_prompt)]
        messages.extend(self._trim_history(history))
        messages.append(
            ChatMessage(
                role=ChatRole.USER,
                content=prompts.build_user_message(question, chunks),
            )
        )
        limits = self._primary_limits()
        return GenerationRequest(
            messages=messages,
            temperature=limits.temperature,
            max_output_tokens=limits.max_output_tokens,
        )

    def _no_context_request(
        self, question: str, history: Sequence[ChatMessage]
    ) -> GenerationRequest:
        """Retrieval found nothing.

        Still a model call, not a canned string: the reply should be phrased
        for the question that was asked and in the language it was asked in.
        The prompt forbids answering from general knowledge, which is the
        part that matters.
        """
        messages = [
            ChatMessage(role=ChatRole.SYSTEM, content=self._no_context_prompt)
        ]
        messages.extend(self._trim_history(history))
        messages.append(ChatMessage(role=ChatRole.USER, content=question))
        return GenerationRequest(
            messages=messages,
            temperature=0.1,
            # The configured budget, not a small hand-picked one.
            #
            # A refusal is two sentences, so 256 tokens looked generous. It is
            # not: a reasoning model spends part of the SAME budget on
            # internal thinking before it writes anything — a trivial question
            # measured here burned 74 thinking tokens against 8 of answer — and
            # the budget runs out mid-sentence. The refusal then arrives
            # truncated, which reads as a broken assistant rather than an
            # honest one. Thinking cannot be turned off on these models; the
            # only safe move is to leave it room.
            max_output_tokens=self._primary_limits().max_output_tokens,
        )

    def _primary_limits(self) -> LLMProviderSettings:
        """Temperature and token budget for whichever provider leads.

        Read from the configured primary rather than hard-coded to Gemini.
        Setting LLM__PRIMARY=groq previously still sent Gemini's temperature
        and token budget, which is the kind of thing nobody notices until
        answers are subtly different from what the configuration says.
        """
        return self._settings.llm.provider_settings(self._settings.llm.primary)

    def _trim_history(
        self, history: Sequence[ChatMessage]
    ) -> list[ChatMessage]:
        """Recent turns only, each capped.

        Unbounded history is how a chat endpoint's cost grows with the square
        of the conversation length: every turn re-sends every previous turn.
        """
        conversation: ConversationSettings = self._settings.conversation
        recent = list(history)[-conversation.max_history_messages:]

        trimmed = []
        for message in recent:
            content = message.content
            if len(content) > conversation.max_history_message_characters:
                content = (
                    content[: conversation.max_history_message_characters].rstrip()
                    + "…"
                )
            trimmed.append(ChatMessage(role=message.role, content=content))
        return trimmed

    # -- metadata ---------------------------------------------------------

    def _metadata(
        self, prepared: PreparedAnswer, *, provider: str, model: str,
        usage: TokenUsage | None, generation_ms: int,
        resolved: citations.CitationResult,
    ) -> GenerationMetadata:
        retrieval = prepared.retrieval
        settings: RetrievalSettings = self._settings.retrieval
        support = grounding.assess(
            resolved.answer, grounded=prepared.grounded, cited=resolved.cited
        )

        return GenerationMetadata(
            provider=provider,
            model=model,
            query_rewritten=prepared.rewritten,
            rewritten_query=prepared.search_query if prepared.rewritten else None,
            retrieval_count=retrieval.fused_count,
            context_chunk_count=len(prepared.context.chunks),
            retrieval_ms=retrieval.retrieval_ms,
            rerank_ms=retrieval.rerank_ms,
            generation_ms=generation_ms,
            total_ms=(prepared.rewrite_ms + retrieval.retrieval_ms
                      + retrieval.rerank_ms + generation_ms),
            usage=usage,
            support=support.value,
            extra={
                "grounded": prepared.grounded,
                "dense_count": retrieval.dense_count,
                "sparse_count": retrieval.sparse_count,
                "duplicates_dropped": prepared.context.dropped_duplicates,
                "invalid_citations": len(resolved.invalid_markers),
                "rewrite_ms": prepared.rewrite_ms,
                "embedding_ms": retrieval.embedding_ms,
                "final_context_chunks_setting": settings.final_context_chunks,
            },
        )


# Providers spell it differently; all of them mean the same thing.
_TRUNCATED = frozenset({"MAX_TOKENS", "LENGTH", "MAX_OUTPUT_TOKENS"})


def _is_truncated(finish_reason: str) -> bool:
    return finish_reason.upper() in _TRUNCATED


def _log_fields(metadata: GenerationMetadata) -> dict[str, object]:
    """Log the shape of the answer, never its content."""
    return {
        "provider": metadata.provider,
        "model": metadata.model,
        "query_rewritten": metadata.query_rewritten,
        "retrieval_count": metadata.retrieval_count,
        "context_chunks": metadata.context_chunk_count,
        "retrieval_ms": metadata.retrieval_ms,
        "rerank_ms": metadata.rerank_ms,
        "generation_ms": metadata.generation_ms,
        "total_ms": metadata.total_ms,
        "prompt_tokens": metadata.usage.prompt_tokens if metadata.usage else None,
        "completion_tokens": (
            metadata.usage.completion_tokens if metadata.usage else None
        ),
        "grounded": metadata.extra.get("grounded"),
        "support": metadata.support,
        "invalid_citations": metadata.extra.get("invalid_citations"),
    }


__all__ = ["PreparedAnswer", "RagAnswer", "RagPipeline"]
