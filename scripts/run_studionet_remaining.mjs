import { createClient } from "../frontend/node_modules/genlayer-js/dist/index.js";
import { studionet } from "../frontend/node_modules/genlayer-js/dist/chains/index.js";
import { TransactionStatus } from "../frontend/node_modules/genlayer-js/dist/types/index.js";
import { privateKeyToAccount } from "../frontend/node_modules/viem/_esm/accounts/index.js";
import { writeFileSync } from "node:fs";

const contract = "0x6414e50a09AB5d1cfF6fAa6bDcA96F40100f3186";
const commit = "2ac7804b294f407d4d7e94a453e33b83a3864a71";
const keys = [process.env.TEST_WALLET_A_PRIVATE_KEY, process.env.TEST_WALLET_B_PRIVATE_KEY];
if (keys.some((key) => !/^(0x)?[0-9a-fA-F]{64}$/.test(key || ""))) throw new Error("Set both test wallet private keys");
const wallets = keys.map((key) => privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`));
if (wallets[0].address.toLowerCase() === wallets[1].address.toLowerCase()) throw new Error("Test wallets must differ");

const reader = createClient({ chain: studionet });
const writer = (wallet) => createClient({ chain: studionet, account: wallet });
const parse = async (name, args = []) => JSON.parse(await reader.readContract({ address: contract, functionName: name, args }));
const transactions = [
  { label: "happy_create_mandate", hash: "0xf830b041708dd5ac1fa77a3cc0bd3027cad572665b2339e91fd07546d89f9054", actor: wallets[0].address, status: "FINALIZED", result_name: "MAJORITY_AGREE" },
  { label: "happy_authenticate_mandate", hash: "0x3710eb4247ff8b651842e46c43285fd7d906a300dba1a3cc36b34d7c3547816f", actor: wallets[0].address, status: "FINALIZED", result_name: "MAJORITY_AGREE" },
  { label: "happy_compile_mandate", hash: "0x615c11f941dc63f25f7a03d247f7d3be1f171a4c8ed2e59685b2fb155b3aa362", actor: wallets[0].address, status: "FINALIZED", result_name: "MAJORITY_AGREE" },
  { label: "exact_submit", hash: "0x0927fec917cf4bedb35910018dc5d9af3a8bfa4ba04ace0f72afd93050317abc", actor: wallets[1].address, status: "FINALIZED", result_name: "MAJORITY_AGREE" },
  { label: "exact_authenticate_transient_fail_closed", hash: "0x5ef5302776bbf48fd9c7c6965a717dd29d37bca689fb5ea464bdd38555c38bed", actor: wallets[1].address, status: "FINALIZED", result_name: "MAJORITY_AGREE" },
  { label: "exact_evaluate_before_source_bound", hash: "0x968999b0f52001a2f4f0837b13b12c709c2260dbc1ad8ba07b260149fb28c2f8", actor: wallets[1].address, status: "FINALIZED", result_name: "MAJORITY_AGREE" },
  { label: "exact_authenticate_retry", hash: "0x2b9c96ca7cc204599ad0800a13e4c6cfcd50f62f69a70db81fe8ab1c80b023b8", actor: wallets[1].address, status: "FINALIZED", result_name: "MAJORITY_AGREE" },
];
async function write(wallet, functionName, args, label) {
  const hash = await writer(wallet).writeContract({ address: contract, functionName, args });
  const receipt = await reader.waitForTransactionReceipt({ hash, status: TransactionStatus.FINALIZED, interval: 3000, retries: 120 });
  const status = receipt.status_name || receipt.status;
  const transaction = await reader.getTransaction({ hash });
  const resultName = transaction?.result_name || transaction?.resultName || transaction?.result?.name || "";
  if (status !== TransactionStatus.FINALIZED || (resultName && resultName !== "MAJORITY_AGREE")) throw new Error(`${label} failed: ${status}/${resultName}`);
  transactions.push({ label, hash, actor: wallet.address, status, result_name: resultName || "FINALIZED" });
  console.log(`${label}: ${hash}`);
  return hash;
}

const source = (path, digest, marker) => JSON.stringify({ owner: "Azariavibecode", repo: "TreasuryIntentCompiler", commit, path, digest, marker });
const sources = {
  mandate: source("/fixtures/mandates/approved-transfer.md", "f0fb4708fef9a6e3d27bc1522b7d8bcfa3f4176baef0718b3281c5ed0485b5ed", "## MANDATE AUDIT-PAYMENT-001"),
  exact: source("/fixtures/bundles/exact-match.json", "ac4762ad6e4410e5060bc703b0b43e7a16f134ef104f13aa09d1f5ff5a00db9b", "\"schema\":\"treasury-bundle-v1\""),
  over: source("/fixtures/bundles/over-limit.json", "9241ed6224ff4e49c22390dcc85dc79ae80b534d95afdffddf0855c60348f1d3", "\"schema\":\"treasury-bundle-v1\""),
  approval: source("/fixtures/bundles/hidden-approval.json", "d441f980de2d3b9b40a1b5edd00161c5ceff50581ede31afdd5c33b462a3d3f8", "\"schema\":\"treasury-bundle-v1\""),
  delegate: source("/fixtures/bundles/delegatecall.json", "6365a53a04c36c848ad2fc1406ea6e62efbcee85e75e89279fcb7f36c6552855", "\"schema\":\"treasury-bundle-v1\""),
  target: source("/fixtures/bundles/target-mismatch.json", "7940ec9d64e5ee7e0415abe42bea653cf0b8950464baba4644443dba62423611", "\"schema\":\"treasury-bundle-v1\""),
};
const envelope = (updates = {}) => JSON.stringify({ allow_approval: false, allow_delegatecall: false, allowed_selectors: ["0xa9059cbb"], asset: "0x2222222222222222222222222222222222222222", chain_id: 1, max_total_raw: "8000000000", recipient: "0x3333333333333333333333333333333333333333", safe: "0x1111111111111111111111111111111111111111", ...updates });

const before = { bundle_count: 0, consumed_count: 0, mandate_count: 0, permit_count: 0 };
const mandateId = 1n;
let mandate = await parse("get_mandate", [mandateId]);
if (mandate.state !== "COMPILED" || mandate.compile_code !== "FAITHFUL") throw new Error(`Mandate did not compile faithfully: ${JSON.stringify(mandate)}`);

async function authenticateWithRetry(bundleId, kind) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await write(wallets[1], "authenticate_bundle", [bundleId], `${kind}_authenticate_${attempt}`);
    const bundle = await parse("get_bundle", [bundleId]);
    if (bundle.state === "SOURCE_BOUND") return bundle;
    if (bundle.state !== "PROPOSED") throw new Error(`${kind} unexpected authentication state: ${bundle.state}`);
  }
  throw new Error(`${kind} source remained unavailable after retries`);
}

async function bundleCase(kind, expectedState, expectedReason, consume = false) {
  const counts = await parse("get_counts");
  const bundleId = BigInt(counts.bundle_count);
  await write(wallets[1], "submit_bundle", [mandateId, sources[kind]], `${kind}_submit`);
  await authenticateWithRetry(bundleId, kind);
  await write(wallets[1], "evaluate_bundle", [bundleId], `${kind}_evaluate`);
  let bundle = await parse("get_bundle", [bundleId]);
  if (bundle.state !== expectedState || bundle.reason_code !== expectedReason) throw new Error(`${kind} mismatch: ${JSON.stringify(bundle)}`);
  if (consume) {
    await write(wallets[0], "consume_permit", [bundleId], "failure_wrong_consumer");
    bundle = await parse("get_bundle", [bundleId]);
    if (bundle.state !== "PERMIT_READY") throw new Error("Wrong consumer mutated permit");
    await write(wallets[1], "consume_permit", [bundleId], "happy_consume_permit");
    await write(wallets[1], "consume_permit", [bundleId], "failure_double_consume");
    bundle = await parse("get_bundle", [bundleId]);
    if (bundle.state !== "CONSUMED") throw new Error("Permit was not consumed exactly once");
  }
  return { id: Number(bundleId), kind, state: bundle.state, reason_code: bundle.reason_code, hash: bundle.bundle_hash };
}

const cases = [];
await write(wallets[1], "evaluate_bundle", [0n], "exact_evaluate_after_retry");
let exact = await parse("get_bundle", [0n]);
if (exact.state !== "PERMIT_READY" || exact.reason_code !== "PERMITTED") throw new Error(`exact mismatch: ${JSON.stringify(exact)}`);
await write(wallets[0], "consume_permit", [0n], "failure_wrong_consumer");
if ((await parse("get_bundle", [0n])).state !== "PERMIT_READY") throw new Error("Wrong consumer mutated permit");
await write(wallets[1], "consume_permit", [0n], "happy_consume_permit");
await write(wallets[1], "consume_permit", [0n], "failure_double_consume");
exact = await parse("get_bundle", [0n]);
if (exact.state !== "CONSUMED") throw new Error("Permit was not consumed exactly once");
cases.push({ id: 0, kind: "exact", state: exact.state, reason_code: exact.reason_code, hash: exact.bundle_hash });
cases.push(await bundleCase("over", "REJECTED", "AMOUNT_EXCEEDED"));
cases.push(await bundleCase("approval", "REJECTED", "SELECTOR_NOT_ALLOWED"));
cases.push(await bundleCase("delegate", "REJECTED", "DELEGATECALL_FORBIDDEN"));
cases.push(await bundleCase("target", "REJECTED", "TARGET_MISMATCH"));

const countBeforeConflict = await parse("get_counts");
await write(wallets[0], "submit_bundle", [mandateId, sources.exact], "failure_role_separation");
const countAfterRole = await parse("get_counts");
if (countAfterRole.bundle_count !== countBeforeConflict.bundle_count) throw new Error("Sponsor self-submission changed bundle count");
const foreign = JSON.parse(sources.exact); foreign.repo = "LookalikeTreasuryIntentCompiler";
await write(wallets[1], "submit_bundle", [mandateId, JSON.stringify(foreign)], "conflict_source_authority");
const countAfterForeign = await parse("get_counts");
if (countAfterForeign.bundle_count !== countBeforeConflict.bundle_count) throw new Error("Foreign source authority changed bundle count");

const poisonId = BigInt(countAfterForeign.mandate_count);
const poison = JSON.parse(sources.mandate); poison.digest = "0".repeat(64);
await write(wallets[0], "create_mandate", ["poisoned-source", JSON.stringify(poison), envelope()], "failure_create_poisoned_source");
await write(wallets[0], "authenticate_mandate", [poisonId], "failure_authenticate_poisoned_source");
const poisoned = await parse("get_mandate", [poisonId]);
if (poisoned.state !== "DRAFT") throw new Error("Poisoned source escaped DRAFT");

const after = await parse("get_counts");
const result = { generated_at: new Date().toISOString(), network: "StudioNet", chain_id: 61999, contract, explorer: `https://explorer-studio.genlayer.com/address/${contract}`, source_commit: commit, wallets: wallets.map((wallet) => wallet.address), before, after, mandate, cases, poisoned_source_state: poisoned.state, transactions };
writeFileSync("verification/studionet-e2e.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
