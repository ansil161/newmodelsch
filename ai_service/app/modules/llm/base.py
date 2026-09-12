"""The language-model contract.

Two methods: `generate` for a complete answer, `stream` for tokens as they
arrive. Everything above this line — the RAG pipeline, query rewriting, the
chat service — calls only these and never sees a provider SDK, an HTTP
request or a model-specific message format.

That is what makes `fallback.py` possible: it is itself an LLMProvider that
happens to delegate, so nothing has to know whether it is talking to Gemini,
to Groq, or to something that will try both.

The error classification is the load-bearing part. `LLMError.retryable`
decides whether a failure is worth sending to the second provider. A 429 or a
503 is; a 400 because the prompt was malformed is not — the second provider
will reject it just as fast, and trying only doubles the time to fail.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass, field

from app.shared.types import ChatRole, TokenUsage


@dataclass(frozen=True)
class ChatMessage:
    role: ChatRole
    content: str


@dataclass(frozen=True)
class GenerationRequest:
    messages: Sequence[ChatMessage]
    temperature: float | None = None
    max_output_tokens: int | None = None
    timeout_seconds: float | None = None
    # Sequences that end generation early. Used by the RAG prompt to stop the
    # model inventing a second turn of dialogue.
    stop: Sequence[str] = field(default_factory=tuple)

    @property
    def system_prompt(self) -> str | None:
        for message in self.messages:
            if message.role is ChatRole.SYSTEM:
                return message.content
        return None

    @property
    def conversation(self) -> list[ChatMessage]:
        """Messages excluding the system prompt.

        Gemini carries the system instruction in a separate top-level field
        rather than as a message, so the two have to be separable.
        """
        return [m for m in self.messages if m.role is not ChatRole.SYSTEM]


@dataclass(frozen=True)
class GenerationResult:
    text: str
    provider: str
    model: str
    usage: TokenUsage | None = None
    finish_reason: str = ""


@dataclass(frozen=True)
class StreamChunk:
    """One increment of a streaming response.

    `delta` is new text only, never the accumulated answer — the frontend
    appends. Sending cumulative text would make every chunk larger than the
    last and quadruple the bytes over a long answer.
    """

    delta: str = ""
    done: bool = False
    usage: TokenUsage | None = None
    finish_reason: str = ""

    # Which provider and model actually produced this increment.
    #
    # Stamped by FallbackLLMProvider as chunks pass through, because only the
    # wrapper knows which member of the chain ended up serving the request.
    # Carried on the chunk rather than read off the provider afterwards: the
    # provider object is shared by every concurrent request, so a "who
    # answered last" attribute on it would report whichever request happened
    # to finish most recently.
    provider: str = ""
    model: str = ""


class LLMProvider(ABC):
    name: str = "unknown"

    @property
    @abstractmethod
    def model(self) -> str: ...

    @abstractmethod
    async def generate(self, request: GenerationRequest) -> GenerationResult: ...

    @abstractmethod
    def stream(self, request: GenerationRequest) -> AsyncIterator[StreamChunk]:
        """Yield chunks until `done`.

        Implementations must be cancellation-safe: when the consumer stops
        iterating — because the browser closed the connection — the
        underlying HTTP response must be released rather than left draining
        a provider we are paying for.
        """

    async def health(self) -> bool:
        """Whether the provider looks configured and reachable.

        Deliberately does not call the model: a readiness probe that costs a
        token on every poll is a readiness probe nobody can afford to run
        often.
        """
        return True

    # An optional hook, deliberately concrete: a provider that holds no
    # sockets and no model memory should not have to write an empty
    # override just to satisfy the ABC.
    async def aclose(self) -> None:  # noqa: B027
        ...
