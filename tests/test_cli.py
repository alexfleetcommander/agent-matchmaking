"""Tests for CLI entry point."""

import tempfile
import os

from agent_matchmaking.cli import main


def _temp_store():
    return os.path.join(tempfile.mkdtemp(prefix="amp_cli_"), ".amp")


def test_cli_no_args():
    assert main([]) == 0


def test_cli_status_empty():
    store = _temp_store()
    assert main(["--store", store, "status"]) == 0


def test_cli_register_and_search():
    store = _temp_store()

    # Register an agent
    rc = main([
        "--store", store,
        "register",
        "--domain", "security",
        "--description", "Python security code review specialist",
        "--price", "0.05",
        "--arp-score", "85.0",
    ])
    assert rc == 0

    # Search for it
    rc = main(["--store", store, "search", "security"])
    assert rc == 0


def test_cli_register_and_match():
    store = _temp_store()

    # Register agents
    for i in range(3):
        main([
            "--store", store,
            "register",
            "--domain", "security",
            "--description", f"Security agent {i} for code review",
            "--price", str(0.05 * (i + 1)),
            "--arp-score", str(70 + i * 10),
        ])

    # Match
    rc = main([
        "--store", store,
        "match",
        "security code review for Python microservice",
        "--domain", "security",
        "--budget", "1.0",
        "--max-results", "5",
    ])
    assert rc == 0


def test_cli_register_with_identity():
    store = _temp_store()
    rc = main([
        "--store", store,
        "register",
        "--agent-id", "amp:agent:custom-id",
        "--domain", "research",
        "--description", "Research agent with full identity",
        "--a2a-card", "https://example.com/.well-known/agent.json",
        "--did", "did:web:example.com",
        "--coc-chain", "coc:chain:sha256:abc123",
    ])
    assert rc == 0


def test_cli_json_output():
    store = _temp_store()
    main([
        "--store", store,
        "register",
        "--domain", "analysis",
        "--description", "Data analysis agent",
    ])
    rc = main(["--store", store, "--json", "status"])
    assert rc == 0
