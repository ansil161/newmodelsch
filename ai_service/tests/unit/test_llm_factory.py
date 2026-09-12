"""Building the LLM chain from configuration.

REGRESSION. `build_llm_provider` once called `settings.provider_settings(...)`
on an `LLMSettings`, where that method did not exist — it is defined on the
top-level `Settings`. Every one of the other tests passed, because they all
inject a fake provider and none of them builds the real chain. The service
could not start at all.

So these tests exercise the factory against real configuration and assert
nothing about generation. What they defend is the wiring, which is exactly
the part that has no other coverage.
"""

from __future__ import annotations

import pytest
from pydantic import SecretStr

from app.core.config import LLMProviderName, LLMSettings, Settings
from app.modules.llm.factory import build_llm_provider
from app.modules.llm.fallback import FallbackLLMProvider

# `_providers` is read directly. These are tests of how the factory wires
# the chain, and that ordering is the thing under test; exposing it as
# public API purely so a test can read it would be the tail wagging the dog.


def _settings(**overrides: object) -> LLMSettings:
    settings = LLMSettings(**overrides)  # type: ignore[arg-type]
    # Keys are what decide whether a fallback is usable, so they have to be
    # present for the chain to be built at all.
    settings.gemini.api_key = SecretStr("test-gemini-key")
    settings.groq.api_key = SecretStr("test-groq-key")
    settings.xai.api_key = SecretStr("test-xai-key")
    return settings


@pytest.mark.parametrize("name", ["gemini", "groq", "xai"])
def test_provider_settings_resolves_every_supported_provider(name: str) -> None:
    settings = _settings()
    resolved = settings.provider_settings(name)  # type: ignore[arg-type]
    assert resolved is getattr(settings, name)
    assert resolved.model


def test_provider_settings_rejects_an_unknown_name() -> None:
    with pytest.raises(ValueError, match="Unknown LLM provider"):
        LLMSettings().provider_settings("anthropic")  # type: ignore[arg-type]


def test_settings_delegates_to_the_llm_block() -> None:
    """The top-level accessor and the nested one must not diverge."""
    settings = Settings(_env_file=None)
    for name in ("gemini", "groq", "xai"):
        assert settings.provider_settings(name) is settings.llm.provider_settings(name)  # type: ignore[arg-type]


def test_builds_a_chain_with_primary_and_fallback() -> None:
    provider = build_llm_provider(_settings(primary="gemini", fallback="groq"))

    assert isinstance(provider, FallbackLLMProvider)
    assert [one.name for one in provider._providers] == ["gemini", "groq"]


def test_builds_a_chain_with_no_fallback_configured() -> None:
    provider = build_llm_provider(_settings(primary="groq", fallback=None))

    assert isinstance(provider, FallbackLLMProvider)
    assert [one.name for one in provider._providers] == ["groq"]


def test_a_fallback_without_a_key_is_dropped_rather_than_fatal() -> None:
    """A missing fallback key means no fallback, not a refusal to start.

    Discovering it at startup in a log line is more useful than discovering
    it during the first outage of the primary.
    """
    settings = _settings(primary="gemini", fallback="groq")
    settings.groq.api_key = None

    provider = build_llm_provider(settings)

    assert [one.name for one in provider._providers] == ["gemini"]


def test_the_default_configuration_builds() -> None:
    """The shipped defaults must produce a working chain.

    This is the case the original bug broke: no overrides, no fakes, exactly
    what `AppResources.build` does at startup.
    """
    settings = Settings(_env_file=None)
    provider = build_llm_provider(settings.llm)

    assert isinstance(provider, FallbackLLMProvider)
    assert provider._providers
    assert provider.model


@pytest.mark.parametrize("primary", ["gemini", "groq", "xai"])
def test_every_provider_can_be_primary(primary: LLMProviderName) -> None:
    provider = build_llm_provider(_settings(primary=primary, fallback=None))
    assert provider._providers[0].name == primary


@pytest.mark.parametrize("name", ["gemini", "groq", "xai"])
def test_a_provider_given_only_a_key_keeps_its_endpoint(name: str) -> None:
    """Configuring one field must not blank the others.

    REGRESSION. The endpoint and model used to live in a default
    `LLMProviderSettings(...)` instance on each field. Supplying any nested
    environment variable for a provider — `LLM__GEMINI__API_KEY`, which
    .env.example instructs — made pydantic build a fresh instance from the
    environment, and every field the environment did not mention fell back to
    the *field* default of `""` rather than the default instance's value.

    So setting an API key silently emptied `base_url`, and generation failed
    with "Request URL is missing an 'http://' or 'https://' protocol". Only
    ever in a deployment that had configured a key — which is to say, only in
    production. Health checks did not catch it: they verify configuration, not
    reachability.
    """
    settings = LLMSettings(**{name: {"api_key": "only-a-key"}})  # type: ignore[arg-type]
    provider = settings.provider_settings(name)  # type: ignore[arg-type]

    assert provider.base_url.startswith("https://"), (
        f"{name} lost its endpoint when only an api_key was supplied"
    )
    assert provider.model, f"{name} lost its model when only an api_key was supplied"


def test_an_explicit_endpoint_still_wins() -> None:
    """The defaults fill gaps; they never override what was asked for."""
    settings = LLMSettings(gemini={"base_url": "https://proxy.internal/v1"})  # type: ignore[arg-type]
    assert settings.gemini.base_url == "https://proxy.internal/v1"
    # ...and the field it did not mention is still filled in.
    assert settings.gemini.model


def test_every_provider_has_a_usable_endpoint_by_default() -> None:
    for name in ("gemini", "groq", "xai"):
        provider = LLMSettings().provider_settings(name)  # type: ignore[arg-type]
        assert provider.base_url.startswith("https://")
        assert provider.model
