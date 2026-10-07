# Requirement traceability

| Requirement | Contract mechanism | Test |
|---|---|---|
| Deployer has no lifecycle privilege | No owner/admin storage | static architecture test |
| Two independent roles | sender-bound sponsor/preparer inequality | sponsor self-prepare rejection |
| Fetched bytes bind commitment | commit/tree/blob and SHA-256 recomputation | poisoned digest test |
| Positive state requires semantic fidelity | `FAITHFUL` only | unfaithful compilation test |
| Bundle source remains under the mandate authority | owner/repository equality gate | source-authority mismatch test |
| Calls cannot bypass constraints | deterministic ordered loop including actual call target | amount/approval/delegatecall/target tests |
| One bundle, one permit | `used_bundle_hashes` | replay test |
| Permit consumed once by preparer | state + sender gate | double/wrong consumer tests |
