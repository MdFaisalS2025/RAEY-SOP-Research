"""
Meridian Signature Hash Chain
--------------------------------
Tamper-evidence for AttestationRecord, styled after 21 CFR Part 11's
requirement that electronic records be protected against undetected
alteration. There is no UPDATE/DELETE endpoint for attestations (append-
only by design), so the only way to alter a signed record after the fact
is to bypass the app and edit the database directly - this hash chain
makes that detectable.

Each record's content_hash = SHA-256(canonical field values + prev_hash),
where prev_hash is the content_hash of the immediately preceding
attestation record (by id order), or the fixed GENESIS_HASH for the
first record ever created. Recomputing the chain from stored field
values and comparing to the stored hashes reveals any row whose fields
were edited after signing, or any row deleted/reordered out of sequence
(which breaks the chain for every subsequent record).

This is real, verifiable tamper-evidence for direct DB edits - it is not
a cryptographic signature of the *user's* identity (there is no PKI or
per-user private key in this research prototype), so it does not replace
a full Part 11-compliant e-signature system. That distinction is kept
explicit rather than overclaiming compliance.

Research prototype. Not for clinical use.
"""

import hashlib
from typing import Any

GENESIS_HASH = "0" * 64


def _canonical_fields(record: dict[str, Any]) -> str:
    """Deterministic string representation of the fields that must not
    change after signing. Field order is fixed so the same record always
    hashes the same way regardless of dict ordering."""
    parts = [
        str(record.get("sop_id", "")),
        str(record.get("sop_version", "")),
        str(record.get("user_id", "")),
        str(record.get("user_name", "")),
        str(record.get("user_role", "")),
        str(record.get("department", "")),
        str(record.get("legal_text", "")),
        str(record.get("signature_meaning", "")),
        str(record.get("second_factor_confirmation", "")),
        str(record.get("ip_address", "")),
        str(record.get("attested_at", "")),
    ]
    return "|".join(parts)


def compute_content_hash(record: dict[str, Any], prev_hash: str) -> str:
    """SHA-256 hash of this record's fields chained to the previous
    record's hash. Changing any field, or splicing in/out a record
    anywhere in the chain, changes this hash and every hash after it."""
    payload = f"{prev_hash}|{_canonical_fields(record)}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def verify_chain(records: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Recompute the hash chain over `records` (must be in ascending id
    order - the order they were signed in) and compare to each record's
    stored content_hash/prev_hash.

    Returns {"intact": bool, "checked": int, "broken_at": list[int]} -
    broken_at lists the ids of any record whose stored hash doesn't match
    what the chain recomputes, i.e. where tampering (or a missing/
    reordered record) was detected.
    """
    expected_prev = GENESIS_HASH
    broken: list[int] = []

    for record in records:
        recomputed = compute_content_hash(record, expected_prev)
        stored_prev = record.get("prev_hash", "")
        stored_hash = record.get("content_hash", "")
        if stored_prev != expected_prev or stored_hash != recomputed:
            broken.append(record.get("id"))
        # Continue the chain from the *stored* hash, not the recomputed
        # one, so a single tampered record is reported once rather than
        # cascading a false "broken" verdict onto every legitimate record
        # signed after it.
        expected_prev = stored_hash or recomputed

    return {
        "intact": len(broken) == 0,
        "checked": len(records),
        "broken_at": broken,
    }
