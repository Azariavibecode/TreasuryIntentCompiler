# Architecture

## Authority split

- Source authority: immutable Git commit/tree/blob binding establishes exact fixture bytes.
- Judgment authority: validators decide one bounded compilation code describing envelope fidelity.
- Execution authority: deterministic code alone evaluates calls and changes permit state.

AI cannot issue or consume a permit. A positive compilation requires exact `FAITHFUL` consensus. Unknown, malformed, missing or conflicting evidence becomes `COMPILATION_BLOCKED`.

## Deterministic critical path

`evaluate_bundle` independently checks chain, Safe, recipient, asset, selector, forbidden approvals, forbidden delegatecall and cumulative amount. The bundle hash is indexed globally and can authorize at most one permit. Only the authenticated preparer may consume it once.

## Originality

The persistent object is a compiled execution envelope plus consumable permit. There is no court, appeal, challenge window, escrow, lineage, registry publication or administrator override.
