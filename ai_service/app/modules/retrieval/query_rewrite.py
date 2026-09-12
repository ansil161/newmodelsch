"""Turning a conversational follow-up into a standalone search query.

THE PROBLEM. Retrieval embeds the question on its own. "What is its warranty?"
embeds to something about warranties in general, because nothing in those
four words says *whose* warranty — the answer lives two turns earlier. The
retriever has no memory, so the query has to carry the context.

THE RULE. Rewrite only when it will help. Sending every question through an
LLM before retrieval adds a round trip to every turn — several hundred
milliseconds and a second billable call — and rewriting a question that was
already clear risks making it worse: models given "what is the warranty
period" and a conversation about Product X will happily narrow it to Product
X even when the user meant the general policy.

So a cheap deterministic gate runs first, and the LLM only sees the questions
that actually depend on prior turns. In practice that is a minority of them.

DEGRADATION. Every failure path returns the original query. A rewriter that
times out, errors, or produces something implausible must not stop the user
getting an answer — a slightly worse retrieval is a much better outcome than
none.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.config import ConversationSettings, QueryRewriteSettings
from app.core.logging import Stopwatch, get_logger
from app.modules.llm.base import ChatMessage, GenerationRequest, LLMProvider
from app.shared.types import ChatRole

logger = get_logger(__name__)

# Words that point at something outside the sentence. Their presence is the
# strongest cheap signal that a question cannot stand alone.
_ANAPHORA = frozenset(
    """
    it its it's they them their theirs he him his she her hers this that
    these those there then one ones same other another such
    """.split()
)

# Openers that are grammatically incomplete on their own.
_ELLIPTICAL_OPENERS = (
    "what about", "how about", "and ", "what if", "why not", "which one",
    "the same", "any others", "what else", "tell me more", "go on",
)

_WORD = re.compile(r"[a-z0-9']+")

_SYSTEM_PROMPT = """\
You rewrite a follow-up question into a standalone search query.

Rules:
- Resolve pronouns and references using the conversation.
- Keep the user's own wording and terminology wherever possible.
- Preserve names, product codes, numbers and quoted phrases exactly.
- Do not answer the question.
- Do not add facts, qualifiers or assumptions that are not in the conversation.
- If the question already stands alone, return it unchanged.
- Reply with the rewritten query and nothing else. No quotes, no preamble.\
"""


@dataclass(frozen=True)
class RewriteDecision:
    query: str
    rewritten: bool
    reason: str


def needs_rewrite(
    question: str,
    history: list[ChatMessage],
    settings: QueryRewriteSettings,
) -> tuple[bool, str]:
    """The cheap gate. Pure, so its behaviour is testable without a model."""
    if not settings.enabled:
        return False, "disabled"

    # Nothing to resolve against. A first question is standalone by
    # construction, whatever it looks like.
    if not history:
        return False, "no_history"

    text = question.strip().lower()
    if not text:
        return False, "empty"

    for opener in _ELLIPTICAL_OPENERS:
        if text.startswith(opener):
            return True, "elliptical_opener"

    words = _WORD.findall(text)
    if any(word in _ANAPHORA for word in words):
        return True, "anaphora"

    # Short questions in a conversation are usually continuations, even
    # without an explicit pronoun: "warranty?", "and shipping".
    if len(words) < settings.min_words_to_skip_rewrite:
        return True, "too_short"

    return False, "already_standalone"


class QueryRewriter:
    def __init__(
        self,
        provider: LLMProvider,
        settings: QueryRewriteSettings,
        conversation_settings: ConversationSettings,
    ) -> None:
        self._provider = provider
        self._settings = settings
        self._conversation = conversation_settings

    async def rewrite(
        self, question: str, history: list[ChatMessage]
    ) -> RewriteDecision:
        should, reason = needs_rewrite(question, history, self._settings)
        if not should:
            return RewriteDecision(question, rewritten=False, reason=reason)

        # Only the last few turns. A pronoun refers to something recent, and
        # a longer window costs tokens while adding candidates for the model
        # to resolve against incorrectly.
        recent = history[-self._conversation.rewrite_context_messages:]
        transcript = "\n".join(
            f"{message.role.value}: {message.content.strip()}" for message in recent
        )

        request = GenerationRequest(
            messages=[
                ChatMessage(role=ChatRole.SYSTEM, content=_SYSTEM_PROMPT),
                ChatMessage(
                    role=ChatRole.USER,
                    content=(
                        f"Conversation so far:\n{transcript}\n\n"
                        f"Follow-up question: {question}\n\n"
                        f"Standalone query:"
                    ),
                ),
            ],
            # Deterministic: this is a transformation, not a creative task.
            temperature=0.0,
            max_output_tokens=128,
            timeout_seconds=self._settings.timeout_seconds,
        )

        try:
            with Stopwatch() as timer:
                result = await self._provider.generate(request)
            candidate = _clean(result.text)
        except Exception as exc:
            logger.warning(
                "Query rewriting failed; using the original question",
                extra={"error_type": type(exc).__name__},
            )
            return RewriteDecision(question, rewritten=False, reason="failed")

        if not self._is_plausible(candidate):
            logger.info(
                "Discarded an implausible rewrite",
                extra={"rewrite_ms": timer.milliseconds},
            )
            return RewriteDecision(question, rewritten=False, reason="implausible")

        logger.info(
            "Rewrote query for retrieval",
            extra={"reason": reason, "rewrite_ms": timer.milliseconds},
        )
        return RewriteDecision(candidate, rewritten=True, reason=reason)

    def _is_plausible(self, candidate: str) -> bool:
        """Reject output that is obviously not a search query.

        Models occasionally answer the question, apologise, or emit a
        paragraph of reasoning. Any of those, used as a query, retrieves
        nothing useful — worse than the original.
        """
        if not candidate:
            return False
        if len(candidate) > self._settings.max_rewritten_characters:
            return False
        if "\n" in candidate.strip():
            return False
        return True


def _clean(text: str) -> str:
    """Strip the decorations models add even when told not to."""
    cleaned = text.strip()
    for prefix in ("standalone query:", "query:", "rewritten query:"):
        if cleaned.lower().startswith(prefix):
            cleaned = cleaned[len(prefix):].strip()
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in "\"'":
        cleaned = cleaned[1:-1].strip()
    return cleaned
