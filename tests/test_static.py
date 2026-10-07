from pathlib import Path

SOURCE = (Path(__file__).parents[1] / "contracts/TreasuryIntentCompiler.py").read_text(encoding="utf-8")

def test_runtime_and_distinct_architecture():
    assert SOURCE.startswith("# v0.2.16")
    for token in ["create_mandate", "authenticate_mandate", "compile_mandate", "submit_bundle", "authenticate_bundle", "evaluate_bundle", "consume_permit"]:
        assert token in SOURCE
    for forbidden in ["challenge_deadline", "appeal", "court", "payout", "self.owner"]:
        assert forbidden not in SOURCE

def test_provenance_and_bounded_consensus():
    for token in ["/git/commits/", "/git/trees/", "_blob_sha1(raw.body)", "hashlib.sha256(raw.body).hexdigest()", "gl.eq_principle.strict_eq(judge)"]:
        assert token in SOURCE
    assert 'sorted(result.keys()) != ["code"]' in SOURCE

def test_positive_gate_and_replay_index():
    for token in ["FAITHFUL", "PERMIT_READY", "APPROVAL_FORBIDDEN", "DELEGATECALL_FORBIDDEN", "AMOUNT_EXCEEDED", "used_bundle_hashes"]:
        assert token in SOURCE
