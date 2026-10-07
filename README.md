# TreasuryIntentCompiler

TreasuryIntentCompiler is a GenLayer dApp that authenticates an immutable natural-language treasury mandate, verifies a sponsor-declared constraint envelope through bounded AI consensus, and deterministically evaluates an ordered transaction bundle before issuing a one-time permit.

## Why GenLayer

Ordinary contracts can check addresses and amounts, but cannot establish whether a complete constraint envelope faithfully captures a natural-language governance mandate. GenLayer handles only that semantic boundary. Bundle evaluation, replay protection, role separation and permit consumption remain deterministic.

## Lifecycle

```text
DRAFT → SOURCE_BOUND → COMPILED → bundle PROPOSED → SOURCE_BOUND
      → PERMIT_READY → CONSUMED
      ↘ COMPILATION_BLOCKED / REJECTED
```

The deployer has no owner role. Any wallet may sponsor a mandate. A different wallet must prepare its bundle, so reviewers can execute a fresh lifecycle without deployer access.

## Evidence boundary

Fixtures under `fixtures/` are synthetic public test material. They demonstrate contract behavior only. They do not prove a real DAO vote, Safe authorization, signature threshold, or target-chain execution.

Every accepted source binds GitHub owner, repository, full commit SHA, canonical path, exact blob identity, SHA-256 digest and marker. The contract resolves the commit/tree/blob and recomputes both Git blob SHA-1 and SHA-256 over fetched bytes.

## Local verification

```bash
python -m py_compile contracts/TreasuryIntentCompiler.py
python -m pytest -q
cd frontend
npm install
npm run build
```

## Deployment

Deploy `contracts/TreasuryIntentCompiler.py` on StudioNet, then set `VITE_CONTRACT_ADDRESS`. The UI also permits a reviewer to override the active address locally and always displays a direct Explorer link.

## Reviewer-owned test flow

1. Fork or commit a mandate document and bundle JSON to one public GitHub repository.
2. Build each source descriptor from the exact owner, repository, 40-character commit SHA, absolute path, SHA-256 digest and unique marker.
3. Connect wallet A and create, authenticate and compile the mandate.
4. Connect a different wallet B and submit, authenticate and evaluate the bundle.
5. If the bundle is permitted, wallet B consumes the permit. Refresh after every finalized transaction and inspect its Explorer link.

The deployer is not required for any of these lifecycle actions. The bundle must come from the same GitHub owner/repository authority as its mandate, but the reviewer may register their own public repository and sources.

## Scope not claimed

- No custody or treasury transfer occurs in this contract.
- A permit is not a Safe signature and does not prove downstream execution.
- GitHub fixtures are not authoritative DAO governance records.
- The consumer must verify the exact mandate ID, bundle hash and `PERMIT_READY`/`CONSUMED` lifecycle appropriate to its integration.
