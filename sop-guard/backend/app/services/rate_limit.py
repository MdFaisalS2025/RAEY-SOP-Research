"""
Login attempt rate-limiting (brute-force lockout).
------------------------------------------------------
In-process, in-memory sliding window keyed by staff_id. Deliberately NOT
persisted to the database - unlike activity logs or settings (flagged
elsewhere in this codebase as real data-loss bugs because that state needs
to survive a restart), a failed-login counter is *supposed* to reset when
the process restarts. The one real limitation worth stating plainly: this
resets on every `--reload` and doesn't share state across multiple worker
processes, so it protects a single-process dev/demo deployment but not a
horizontally-scaled production one - that would need a shared store (Redis,
or a DB table) keyed the same way. Also staff_id-keyed rather than IP-keyed:
simpler, and sufficient to stop the account-specific case (repeated guesses
against one login) this exists to close; an attacker spraying many
different staff_ids from one IP is a different threat this does not cover.

Research prototype. Not for clinical use.
"""

import time

_MAX_ATTEMPTS = 5
_WINDOW_SECONDS = 10 * 60  # failures older than this don't count
_LOCKOUT_SECONDS = 10 * 60

_failures: dict[str, list[float]] = {}
_locked_until: dict[str, float] = {}


def _prune(key: str, now: float) -> None:
    attempts = _failures.get(key)
    if not attempts:
        return
    cutoff = now - _WINDOW_SECONDS
    kept = [t for t in attempts if t >= cutoff]
    if kept:
        _failures[key] = kept
    else:
        _failures.pop(key, None)


def seconds_until_unlocked(key: str) -> float:
    """0.0 if not locked out; otherwise how many seconds remain."""
    until = _locked_until.get(key)
    if until is None:
        return 0.0
    remaining = until - time.monotonic()
    if remaining <= 0:
        _locked_until.pop(key, None)
        return 0.0
    return remaining


def record_failure(key: str) -> None:
    now = time.monotonic()
    _prune(key, now)
    _failures.setdefault(key, []).append(now)
    if len(_failures[key]) >= _MAX_ATTEMPTS:
        _locked_until[key] = now + _LOCKOUT_SECONDS
        _failures.pop(key, None)


def record_success(key: str) -> None:
    _failures.pop(key, None)
    _locked_until.pop(key, None)


def reset(key: str) -> None:
    """Test-only escape hatch - clears state for one key without waiting out
    the window. Module-level state is shared process-wide, so a test that
    deliberately triggers a lockout must use a key no other test touches, or
    clean up after itself with this."""
    _failures.pop(key, None)
    _locked_until.pop(key, None)
