"""
Unit and Integration Tests for Exa Neural Search & AI Test Grounding.
Canonical conformance to build-with-exa agent skill.
"""

import pytest
import asyncio
from backend.integrations.exa_client import ExaClient, ExaHighlightResult, GroundedTestRequirement


def test_exa_local_mock_fallback():
    """Verify local deterministic fallback when mode is local or without key."""
    client = ExaClient(api_key="mock_key")
    # Synchronous helper method
    results = client._local_mock_search("OAuth 2.0 PKCE")
    assert len(results) >= 2
    assert "RFC 9700" in results[0].title
    assert results[0].url.startswith("https://")
    assert len(results[0].highlights) > 0


def test_exa_ground_ai_test_spec():
    """Verify AI test case generation and grounded RFC standards synthesis."""
    client = ExaClient()
    grounded = asyncio.run(client.ground_ai_test_spec("Google Workspace SSO"))
    assert isinstance(grounded, GroundedTestRequirement)
    assert grounded.topic == "Google Workspace SSO"
    assert "RFC 9700" in grounded.rfc_or_standard
    assert len(grounded.test_scenarios) >= 3
    assert any("PKCE" in s for s in grounded.test_scenarios)


def test_exa_live_api_call():
    """Live integration test against official Exa Search endpoint."""
    client = ExaClient()
    if not client.api_key:
        pytest.skip("No EXA_API_KEY set")
    
    # Run actual live search
    results = asyncio.run(client.search("RFC 7636 OAuth PKCE best practices", num_results=2))
    assert len(results) > 0
    first = results[0]
    assert first.title is not None
    assert first.url.startswith("http")
    print(f"\n[Exa Live Test] Found: {first.title} -> {first.url}")


if __name__ == "__main__":
    test_exa_local_mock_fallback()
    test_exa_ground_ai_test_spec()
    test_exa_live_api_call()
    print("All Exa tests passed successfully!")
