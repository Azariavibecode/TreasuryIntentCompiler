# Local test report

Run date: 2026-10-07

This report records deterministic local `gltest` evidence only. It is not presented as StudioNet transaction evidence.

## Commands and results

| Check | Result |
|---|---|
| `python -m py_compile contracts/TreasuryIntentCompiler.py` | PASS |
| `python -m pytest -q` | PASS — 14 tests |
| `npm run build` | PASS — Vite production bundle |
| Browser render at 127.0.0.1 | PASS — logo, contract selector, lifecycle and reviewer inputs visible |

## Covered paths

- Happy path: sponsor creates and compiles a faithful mandate; a second wallet submits a matching bundle and consumes its one-time permit.
- Semantic failure: a non-faithful envelope is blocked at compilation.
- Source failure: bad digest fails closed without replacing the prior state.
- Source-authority conflict: a lookalike repository cannot supply the bundle for a registered mandate.
- Deterministic conflicts: total amount, approval selector, delegatecall and actual call target are independently rejected.
- Adversarial lifecycle: sponsor/preparer separation, wrong consumer, bundle replay and double consume.

## Evidence boundary

Fixtures are synthetic test resources. After publication, StudioNet evidence must use the repository's real commit SHA and recomputed SHA-256 values. Only finalized Explorer transactions from the deployed contract should be cited as on-chain evidence.
