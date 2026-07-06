"""
Tests for the demo activity log and its seeding gate.

Regression coverage for a real bug: demo activity seeding was nested
inside `if count > 0: return` in main.py's _load_demo_data(), guarded by
whether SOPs already existed in the (persisted) SQLite DB. Since the
activity log itself is in-memory and resets on every process restart,
this meant the seed only ever ran the very first time the DB was
populated - every subsequent backend restart returned early before
seeding activity, silently leaving the audit trail empty.
"""

import app.services.activity as activity_module
from app.services.activity import log_activity, get_activity_log, has_any_activity
from app.main import _seed_demo_activity_if_empty


def _reset_activity_log(monkeypatch):
    monkeypatch.setattr(activity_module, "_activity_log", [])


def test_has_any_activity_false_when_empty(monkeypatch):
    _reset_activity_log(monkeypatch)
    assert has_any_activity() is False


def test_has_any_activity_true_after_logging(monkeypatch):
    _reset_activity_log(monkeypatch)
    log_activity("sop_viewed", sop_id="SOP-1", sop_title="Test SOP")
    assert has_any_activity() is True


async def test_seed_demo_activity_seeds_when_log_is_empty(monkeypatch):
    _reset_activity_log(monkeypatch)
    await _seed_demo_activity_if_empty()
    assert has_any_activity() is True
    assert len(get_activity_log(50)) > 0


async def test_seed_demo_activity_is_noop_when_already_populated(monkeypatch):
    _reset_activity_log(monkeypatch)
    log_activity("query_submitted", sop_id="SOP-1", sop_title="Test SOP", query="real query")
    before = get_activity_log(50)

    await _seed_demo_activity_if_empty()

    after = get_activity_log(50)
    assert after == before, "seeding must not run (or append) when activity already exists"
