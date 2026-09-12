"""Query rewriting: the gate, and the rewriter's failure behaviour.

The gate carries most of the value here. Rewriting every question costs a
round trip and a billable call on every turn, so the tests that matter are
the ones asserting it does *not* fire.
"""

from __future__ import annotations

import pytest

from app.core.config import ConversationSettings, QueryRewriteSettings
from app.core.exceptions import LLMTimeoutError
from app.modules.llm.base import ChatMessage
from app.modules.retrieval.query_rewrite import QueryRewriter, needs_rewrite
from app.shared.types import ChatRole
from tests.conftest import FakeLLM

SETTINGS = QueryRewriteSettings()
CONVERSATION = ConversationSettings()


def history() -> list[ChatMessage]:
    return [
        ChatMessage(role=ChatRole.USER, content="What is Product X?"),
        ChatMessage(role=ChatRole.ASSISTANT, content="Product X is a speaker."),
    ]


# -- the gate --------------------------------------------------------------

def test_a_first_question_is_never_rewritten():
    # Nothing to resolve against, whatever it looks like.
    should, reason = needs_rewrite("What about it?", [], SETTINGS)
    assert should is False
    assert reason == "no_history"


@pytest.mark.parametrize(
    "question",
    ["What is its warranty?", "How much do they cost?",
     "Is that included?", "Tell me about those."],
)
def test_a_pronoun_triggers_a_rewrite(question: str):
    should, reason = needs_rewrite(question, history(), SETTINGS)
    assert should is True
    assert reason == "anaphora"


@pytest.mark.parametrize(
    "question",
    ["What about shipping", "And the warranty", "How about returns"],
)
def test_an_elliptical_opener_triggers_a_rewrite(question: str):
    should, reason = needs_rewrite(question, history(), SETTINGS)
    assert should is True
    assert reason == "elliptical_opener"


def test_a_very_short_follow_up_is_rewritten():
    should, reason = needs_rewrite("warranty?", history(), SETTINGS)
    assert should is True
    assert reason == "too_short"


def test_a_standalone_question_is_left_alone():
    """The case that saves an LLM call on most turns."""
    should, reason = needs_rewrite(
        "What is the warranty period for the Product X speaker?",
        history(), SETTINGS,
    )
    assert should is False
    assert reason == "already_standalone"


def test_rewriting_can_be_disabled_entirely():
    disabled = QueryRewriteSettings(enabled=False)
    should, reason = needs_rewrite("What is its price?", history(), disabled)
    assert should is False
    assert reason == "disabled"


# -- the rewriter ----------------------------------------------------------

async def test_a_follow_up_is_rewritten_using_the_conversation():
    llm = FakeLLM(response="What is the warranty for Product X?")
    rewriter = QueryRewriter(llm, SETTINGS, CONVERSATION)

    decision = await rewriter.rewrite("What is its warranty?", history())

    assert decision.rewritten is True
    assert decision.query == "What is the warranty for Product X?"


async def test_a_standalone_question_never_reaches_the_model():
    llm = FakeLLM(response="should not be used")
    rewriter = QueryRewriter(llm, SETTINGS, CONVERSATION)

    decision = await rewriter.rewrite(
        "What is the warranty period for Product X?", history()
    )

    assert decision.rewritten is False
    assert llm.requests == []


async def test_a_rewriter_failure_falls_back_to_the_original_question():
    """A rewriter that breaks must not stop the user getting an answer."""
    llm = FakeLLM(error=LLMTimeoutError())
    rewriter = QueryRewriter(llm, SETTINGS, CONVERSATION)

    decision = await rewriter.rewrite("What is its warranty?", history())

    assert decision.rewritten is False
    assert decision.query == "What is its warranty?"
    assert decision.reason == "failed"


async def test_a_multi_line_answer_is_rejected_as_implausible():
    # Models sometimes answer the question or explain their reasoning.
    # Either, used as a search query, retrieves nothing useful.
    llm = FakeLLM(response="Here is my reasoning:\nThe user means Product X.")
    rewriter = QueryRewriter(llm, SETTINGS, CONVERSATION)

    decision = await rewriter.rewrite("What is its warranty?", history())

    assert decision.rewritten is False
    assert decision.reason == "implausible"


async def test_an_overlong_rewrite_is_rejected():
    llm = FakeLLM(response="x" * 5_000)
    rewriter = QueryRewriter(llm, SETTINGS, CONVERSATION)

    decision = await rewriter.rewrite("What is its warranty?", history())

    assert decision.rewritten is False


async def test_decorations_are_stripped_from_the_rewrite():
    llm = FakeLLM(response='Standalone query: "What is the Product X warranty?"')
    rewriter = QueryRewriter(llm, SETTINGS, CONVERSATION)

    decision = await rewriter.rewrite("What is its warranty?", history())

    assert decision.query == "What is the Product X warranty?"


async def test_only_recent_turns_are_sent_to_the_rewriter():
    """Cost control: a pronoun refers to something recent."""
    llm = FakeLLM(response="What is the Product X warranty?")
    rewriter = QueryRewriter(
        llm, SETTINGS, ConversationSettings(rewrite_context_messages=2)
    )
    long_history = [
        ChatMessage(role=ChatRole.USER, content=f"Question {i}")
        for i in range(20)
    ]

    await rewriter.rewrite("What is its warranty?", long_history)

    prompt = llm.requests[0].messages[-1].content
    assert "Question 19" in prompt
    assert "Question 5" not in prompt
