# Test resource manifest

All bundled sources are synthetic and test only the proof mechanism.

| Resource | Purpose | Expected branch |
|---|---|---|
| `fixtures/mandates/approved-transfer.md` | Explicit mandate constraints | `FAITHFUL` |
| `fixtures/bundles/exact-match.json` | Two-call cumulative exact cap | `PERMIT_READY` |
| `fixtures/bundles/over-limit.json` | One raw unit over cumulative cap | `AMOUNT_EXCEEDED` |
| `fixtures/bundles/hidden-approval.json` | Approval selector injection | `APPROVAL_FORBIDDEN` |
| `fixtures/bundles/delegatecall.json` | Unsafe operation | `DELEGATECALL_FORBIDDEN` |

Before live testing, these paths must be published in immutable commits and their exact SHA-256 values recorded in the StudioNet evidence report. Happy and adversarial source revisions should be separated where the scenario requires source mutation.
