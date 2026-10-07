# StudioNet verification

- Network: StudioNet (`61999`)
- Contract: [`0x6414e50a09AB5d1cfF6fAa6bDcA96F40100f3186`](https://explorer-studio.genlayer.com/address/0x6414e50a09AB5d1cfF6fAa6bDcA96F40100f3186)
- Registered source commit: [`2ac7804`](https://github.com/Azariavibecode/TreasuryIntentCompiler/tree/2ac7804b294f407d4d7e94a453e33b83a3864a71)
- Sponsor/test wallet A: `0x67A1A08Fc4cf7D05c859d0d3D8398a3A30B1677e`
- Preparer/test wallet B: `0x7C87B10a3d43F3b3551414401F8b26B9F662bAB5`

The deployment wallet performed no test-lifecycle role.

## Final canonical state

`mandate_count=3`, `bundle_count=5`, `permit_count=1`, `consumed_count=1`.

| Bundle | Scenario | Final state | Reason |
|---:|---|---|---|
| 0 | Exact-match happy path | `CONSUMED` | `PERMITTED` |
| 1 | Cumulative amount exceeds ceiling | `REJECTED` | `AMOUNT_EXCEEDED` |
| 2 | Hidden approval selector | `REJECTED` | `SELECTOR_NOT_ALLOWED` |
| 3 | Delegatecall | `REJECTED` | `DELEGATECALL_FORBIDDEN` |
| 4 | Declared asset but different call target | `REJECTED` | `TARGET_MISMATCH` |

## Key finalized transactions

| Evidence | Explorer |
|---|---|
| Create faithful mandate | [`0xf830…9054`](https://explorer-studio.genlayer.com/transactions/0xf830b041708dd5ac1fa77a3cc0bd3027cad572665b2339e91fd07546d89f9054) |
| Authenticate mandate source | [`0x3710…816f`](https://explorer-studio.genlayer.com/transactions/0x3710eb4247ff8b651842e46c43285fd7d906a300dba1a3cc36b34d7c3547816f) |
| Compile mandate as `FAITHFUL` | [`0x615c…a362`](https://explorer-studio.genlayer.com/transactions/0x615c11f941dc63f25f7a03d247f7d3be1f171a4c8ed2e59685b2fb155b3aa362) |
| Exact bundle becomes `PERMIT_READY` | [`0x7169…35f0`](https://explorer-studio.genlayer.com/transactions/0x7169278491c4ab71495cefb867483f7a1734c3dd51225532c42f1fd870db35f0) |
| Wrong consumer rejected; permit preserved | [`0x4614…f826`](https://explorer-studio.genlayer.com/transactions/0x4614fbe653e2c228b099f60e1d5783ad32cb74e5e5071ce237e70729658af826) |
| Correct preparer consumes permit | [`0x395c…8531`](https://explorer-studio.genlayer.com/transactions/0x395cca69bd2c37dfcab4531b611082bd3e6e80e7a3e9aa48eb7a1c3490078531) |
| Double consume rejected | [`0x23bb…0d1`](https://explorer-studio.genlayer.com/transactions/0x23bb442a6a2924dd7095a2be445aa98073e21d72b61cf2fccd67880389ebe0d1) |
| Over-limit bundle rejected | [`0xfdd8…cdf1`](https://explorer-studio.genlayer.com/transactions/0xfdd8e646bf5d7cd10c03fde806f83260a6bef64faac4b9c04bb2efce50aacdf1) |
| Approval bundle rejected | [`0x4790…31b1`](https://explorer-studio.genlayer.com/transactions/0x4790a9a70f1e185e40d697868bbe2bba6e5c723da5a32a5564859da37c2031b1) |
| Delegatecall bundle rejected | [`0xc990…da67`](https://explorer-studio.genlayer.com/transactions/0xc990df6005a4e00a13885bb1ff57d91d9adecce208eab909ff77aacec9c5da67) |
| Target mismatch rejected | [`0x0480…f5f9`](https://explorer-studio.genlayer.com/transactions/0x0480f3dee26d5d16017bc03a65b90eda8198bca8b80ca476f00396c7b084f5f9) |
| Sponsor/preparer separation enforced | [`0xb5ef…3cd9`](https://explorer-studio.genlayer.com/transactions/0xb5efc24408f643b7006982e70de935bc73b5c903b83e4d1b8dca979b49a53cd9) |
| Foreign source authority rejected | [`0x9364…e81`](https://explorer-studio.genlayer.com/transactions/0x936494c722ab46ad8dd9dcdeff80389eb69729bbabdd86f15f0a88c167451e81) |
| Poisoned digest fails closed | [`0x324f…420b`](https://explorer-studio.genlayer.com/transactions/0x324f192bce7e91c2be6260d42b69acd67781ffcb8f172d74946156d65d66420b) |

Some GitHub fetches temporarily returned `SOURCE_UNVERIFIED`. The contract retained `PROPOSED`/`DRAFT` state and later bounded retries succeeded, demonstrating recovery without replacing valid state with fabricated zero records.

Machine-readable evidence is in [`studionet-e2e.json`](./studionet-e2e.json).
