import hashlib, json
from pathlib import Path
import pytest

ROOT = Path(__file__).parents[1]
OWNER, REPO = "FixtureOrg", "TreasuryFixtures"
COMMIT = "1" * 40
TREE = "a" * 40
MANDATE_PATH = "/fixtures/mandates/approved-transfer.md"
BUNDLE_PATHS = {
    "exact": "/fixtures/bundles/exact-match.json",
    "over": "/fixtures/bundles/over-limit.json",
    "approval": "/fixtures/bundles/hidden-approval.json",
    "delegate": "/fixtures/bundles/delegatecall.json",
    "target": "/fixtures/bundles/target-mismatch.json",
}

def body(path): return (ROOT / path[1:]).read_bytes()
def sha256(path): return hashlib.sha256(body(path)).hexdigest()
def blob(path):
    raw = body(path)
    return hashlib.sha1((f"blob {len(raw)}\0").encode() + raw).hexdigest()

def source(path, marker, digest=None):
    return json.dumps({"owner": OWNER, "repo": REPO, "commit": COMMIT, "path": path,
                       "digest": digest or sha256(path), "marker": marker})

def envelope(**updates):
    data = {"allow_approval": False, "allow_delegatecall": False, "allowed_selectors": ["0xa9059cbb"],
            "asset": "0x" + "2" * 40, "chain_id": 1, "max_total_raw": "8000000000",
            "recipient": "0x" + "3" * 40, "safe": "0x" + "1" * 40}
    data.update(updates)
    return json.dumps(data)

def mock_repo(vm):
    paths = [MANDATE_PATH] + list(BUNDLE_PATHS.values())
    api = f"https://api.github.com/repos/{OWNER}/{REPO}"
    entries = [{"path": p[1:], "type": "blob", "mode": "100644", "size": len(body(p)), "sha": blob(p)} for p in paths]
    vm.mock_web((api + "/git/commits/" + COMMIT).replace(".", r"\.") + "$",
                {"status": 200, "body": json.dumps({"sha": COMMIT, "tree": {"sha": TREE}}).encode()})
    vm.mock_web((api + "/git/trees/" + TREE + r"\?recursive=1$").replace(".", r"\."),
                {"status": 200, "body": json.dumps({"truncated": False, "tree": entries}).encode()})
    for p in paths:
        url = f"https://raw.githubusercontent.com/{OWNER}/{REPO}/{COMMIT}{p}"
        vm.mock_web(url.replace(".", r"\.") + "$", {"status": 200, "body": body(p)})

@pytest.fixture
def setup(direct_vm, direct_deploy, direct_alice):
    direct_vm.strict_mocks = True
    direct_vm.check_pickling = True
    contract = direct_deploy("contracts/TreasuryIntentCompiler.py")
    mock_repo(direct_vm)
    return direct_vm, contract, direct_alice

def compile_mandate(vm, contract, sponsor, code="FAITHFUL", env=None):
    with vm.prank(sponsor):
        assert contract.create_mandate("audit-payment", source(MANDATE_PATH, "## MANDATE AUDIT-PAYMENT-001"), env or envelope()) == 0
        assert contract.authenticate_mandate(0) == "MANDATE_AUTHENTICATED"
    vm.mock_llm(r"Validate whether a declared treasury constraint envelope.*", json.dumps({"code": code}))
    assert contract.compile_mandate(0) == ("COMPILED" if code == "FAITHFUL" else "COMPILATION_BLOCKED")

def submit(vm, contract, preparer, kind, bundle_id=0):
    path = BUNDLE_PATHS[kind]
    with vm.prank(preparer):
        assert contract.submit_bundle(0, source(path, '"schema":"treasury-bundle-v1"', sha256(path))) == bundle_id
        assert contract.authenticate_bundle(bundle_id) == "BUNDLE_AUTHENTICATED"

def test_happy_two_wallet_permit_and_consume(setup, direct_bob):
    vm, c, sponsor = setup
    compile_mandate(vm, c, sponsor)
    submit(vm, c, direct_bob, "exact")
    assert c.evaluate_bundle(0) == "PERMIT_READY"
    with vm.prank(direct_bob): assert c.consume_permit(0) == "CONSUMED"
    counts = json.loads(c.get_counts())
    assert counts == {"bundle_count": 1, "consumed_count": 1, "mandate_count": 1, "permit_count": 1}

@pytest.mark.parametrize("kind,reason", [("over", "AMOUNT_EXCEEDED"), ("delegate", "DELEGATECALL_FORBIDDEN"), ("target", "TARGET_MISMATCH")])
def test_deterministic_bundle_rejections(setup, direct_bob, kind, reason):
    vm, c, sponsor = setup; compile_mandate(vm, c, sponsor); submit(vm, c, direct_bob, kind)
    assert c.evaluate_bundle(0) == "REJECTED"
    assert json.loads(c.get_bundle(0))["reason_code"] == reason
    with vm.prank(direct_bob): assert c.consume_permit(0) == "PERMIT_NOT_READY"

def test_hidden_approval_cannot_bypass_selector_gate(setup, direct_bob):
    vm, c, sponsor = setup
    compile_mandate(vm, c, sponsor, env=envelope(allowed_selectors=["0xa9059cbb", "0x095ea7b3"]))
    submit(vm, c, direct_bob, "approval")
    assert c.evaluate_bundle(0) == "REJECTED"
    assert json.loads(c.get_bundle(0))["reason_code"] == "APPROVAL_FORBIDDEN"

def test_unfaithful_compilation_blocks_bundle(setup, direct_bob):
    vm, c, sponsor = setup; compile_mandate(vm, c, sponsor, "AMOUNT_MISMATCH")
    with vm.prank(direct_bob): assert c.submit_bundle(0, source(BUNDLE_PATHS["exact"], '"schema":"treasury-bundle-v1"')) == "MANDATE_NOT_COMPILED"

def test_sponsor_cannot_prepare_own_bundle(setup):
    vm, c, sponsor = setup; compile_mandate(vm, c, sponsor)
    with vm.prank(sponsor): assert c.submit_bundle(0, source(BUNDLE_PATHS["exact"], '"schema":"treasury-bundle-v1"')) == "ROLE_SEPARATION_REQUIRED"

def test_bundle_must_share_registered_source_authority(setup, direct_bob):
    vm, c, sponsor = setup; compile_mandate(vm, c, sponsor)
    untrusted = json.loads(source(BUNDLE_PATHS["exact"], '"schema":"treasury-bundle-v1"'))
    untrusted["repo"] = "LookalikeFixtures"
    with vm.prank(direct_bob):
        assert c.submit_bundle(0, json.dumps(untrusted)) == "SOURCE_AUTHORITY_MISMATCH"

def test_poisoned_mandate_digest_fails_closed(setup):
    vm, c, sponsor = setup
    with vm.prank(sponsor):
        c.create_mandate("poison", source(MANDATE_PATH, "## MANDATE AUDIT-PAYMENT-001", "0" * 64), envelope())
        assert c.authenticate_mandate(0) == "SOURCE_UNVERIFIED"
    assert json.loads(c.get_mandate(0))["state"] == "DRAFT"

def test_bundle_replay_and_double_consume(setup, direct_bob):
    vm, c, sponsor = setup; compile_mandate(vm, c, sponsor); submit(vm, c, direct_bob, "exact")
    c.evaluate_bundle(0)
    with vm.prank(direct_bob):
        assert c.consume_permit(0) == "CONSUMED"
        assert c.consume_permit(0) == "PERMIT_NOT_READY"
        assert c.submit_bundle(0, source(BUNDLE_PATHS["exact"], '"schema":"treasury-bundle-v1"')) == 1
        assert c.authenticate_bundle(1) == "BUNDLE_REPLAY"

def test_wrong_consumer_preserves_ready_permit(setup, direct_bob):
    vm, c, sponsor = setup; compile_mandate(vm, c, sponsor); submit(vm, c, direct_bob, "exact"); c.evaluate_bundle(0)
    with vm.prank(sponsor): assert c.consume_permit(0) == "PREPARER_ONLY"
    assert json.loads(c.get_bundle(0))["state"] == "PERMIT_READY"

