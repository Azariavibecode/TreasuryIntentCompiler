# Threat model

| Threat | Control |
|---|---|
| Sponsor supplies mutable or forged content | Commit/tree/blob authentication plus recomputed SHA-256 |
| Faithful-looking envelope widens authority | Bounded semantic compilation and positive-only `FAITHFUL` gate |
| Sponsor self-prepares favorable bundle | Sender-bound sponsor/preparer role separation |
| Multiple calls individually pass but exceed cap | Cumulative deterministic amount check |
| Hidden approval or delegatecall | Selector and operation deny gates |
| Reuse exact bundle | Global canonical bundle-hash index |
| Wrong actor consumes permit | Preparer-bound consumption |
| Replay consumption | Terminal `CONSUMED` state |
| Source/LLM failure | No positive state mutation |
