import { createClient } from "../frontend/node_modules/genlayer-js/dist/index.js";
import { studionet } from "../frontend/node_modules/genlayer-js/dist/chains/index.js";
import { TransactionStatus } from "../frontend/node_modules/genlayer-js/dist/types/index.js";
import { privateKeyToAccount } from "../frontend/node_modules/viem/_esm/accounts/index.js";
import { readFileSync, writeFileSync } from "node:fs";

const address = "0x6414e50a09AB5d1cfF6fAa6bDcA96F40100f3186";
const keys = [process.env.TEST_WALLET_A_PRIVATE_KEY, process.env.TEST_WALLET_B_PRIVATE_KEY];
if (keys.some((key) => !/^(0x)?[0-9a-fA-F]{64}$/.test(key || ""))) throw Error("Set test keys");
const wallets = keys.map((key) => privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`));
const reader = createClient({ chain: studionet });
const writer = (wallet) => createClient({ chain: studionet, account: wallet });
const parse = async (fn, args = []) => JSON.parse(await reader.readContract({ address, functionName: fn, args }));
const newTransactions = [];
async function write(wallet, fn, args, label) {
  const hash = await writer(wallet).writeContract({ address, functionName: fn, args });
  const receipt = await reader.waitForTransactionReceipt({ hash, status: TransactionStatus.FINALIZED, interval: 3000, retries: 120 });
  const transaction = await reader.getTransaction({ hash });
  const status = receipt.status_name || receipt.status;
  const result = transaction?.result_name || transaction?.resultName || "";
  if (status !== "FINALIZED" || (result && result !== "MAJORITY_AGREE")) throw Error(`${label}: ${status}/${result}`);
  newTransactions.push({ label, hash, actor: wallet.address, status, result_name: result || "FINALIZED" });
  console.log(`${label}: ${hash}`);
}

const commit = "2ac7804b294f407d4d7e94a453e33b83a3864a71";
const source = (path, digest, marker) => JSON.stringify({ owner: "Azariavibecode", repo: "TreasuryIntentCompiler", commit, path, digest, marker });
const exact = source("/fixtures/bundles/exact-match.json", "ac4762ad6e4410e5060bc703b0b43e7a16f134ef104f13aa09d1f5ff5a00db9b", '"schema":"treasury-bundle-v1"');
const mandateSource = source("/fixtures/mandates/approved-transfer.md", "f0fb4708fef9a6e3d27bc1522b7d8bcfa3f4176baef0718b3281c5ed0485b5ed", "## MANDATE AUDIT-PAYMENT-001");
const envelope = JSON.stringify({ allow_approval: false, allow_delegatecall: false, allowed_selectors: ["0xa9059cbb"], asset: "0x2222222222222222222222222222222222222222", chain_id: 1, max_total_raw: "8000000000", recipient: "0x3333333333333333333333333333333333333333", safe: "0x1111111111111111111111111111111111111111" });

let target = await parse("get_bundle", [4n]);
for (let attempt = 5; target.state === "PROPOSED" && attempt <= 10; attempt++) {
  await write(wallets[1], "authenticate_bundle", [4n], `target_authenticate_${attempt}`);
  target = await parse("get_bundle", [4n]);
}
if (target.state === "SOURCE_BOUND") {
  await write(wallets[1], "evaluate_bundle", [4n], "target_evaluate");
  target = await parse("get_bundle", [4n]);
}
if (target.state !== "REJECTED" || target.reason_code !== "TARGET_MISMATCH") throw Error(`Target case incomplete: ${JSON.stringify(target)}`);

const mandateId = 1n;
const beforeConflict = await parse("get_counts");
await write(wallets[0], "submit_bundle", [mandateId, exact], "failure_role_separation");
if ((await parse("get_counts")).bundle_count !== beforeConflict.bundle_count) throw Error("Role conflict mutated count");
const foreign = JSON.parse(exact); foreign.repo = "LookalikeTreasuryIntentCompiler";
await write(wallets[1], "submit_bundle", [mandateId, JSON.stringify(foreign)], "conflict_source_authority");
if ((await parse("get_counts")).bundle_count !== beforeConflict.bundle_count) throw Error("Source conflict mutated count");

const poisonId = BigInt((await parse("get_counts")).mandate_count);
const poison = JSON.parse(mandateSource); poison.digest = "0".repeat(64);
await write(wallets[0], "create_mandate", ["poisoned-source", JSON.stringify(poison), envelope], "failure_create_poisoned_source");
await write(wallets[0], "authenticate_mandate", [poisonId], "failure_authenticate_poisoned_source");
const poisoned = await parse("get_mandate", [poisonId]);
if (poisoned.state !== "DRAFT") throw Error("Poisoned source escaped DRAFT");

const cases = [];
for (const [id, kind] of [[0, "exact"], [1, "over"], [2, "approval"], [3, "delegate"], [4, "target"]]) {
  const bundle = await parse("get_bundle", [BigInt(id)]);
  cases.push({ id, kind, state: bundle.state, reason_code: bundle.reason_code, hash: bundle.bundle_hash });
}
const txHashes = [
  "f830b041708dd5ac1fa77a3cc0bd3027cad572665b2339e91fd07546d89f9054","3710eb4247ff8b651842e46c43285fd7d906a300dba1a3cc36b34d7c3547816f","615c11f941dc63f25f7a03d247f7d3be1f171a4c8ed2e59685b2fb155b3aa362","0927fec917cf4bedb35910018dc5d9af3a8bfa4ba04ace0f72afd93050317abc","5ef5302776bbf48fd9c7c6965a717dd29d37bca689fb5ea464bdd38555c38bed","968999b0f52001a2f4f0837b13b12c709c2260dbc1ad8ba07b260149fb28c2f8","2b9c96ca7cc204599ad0800a13e4c6cfcd50f62f69a70db81fe8ab1c80b023b8","7169278491c4ab71495cefb867483f7a1734c3dd51225532c42f1fd870db35f0","4614fbe653e2c228b099f60e1d5783ad32cb74e5e5071ce237e70729658af826","395cca69bd2c37dfcab4531b611082bd3e6e80e7a3e9aa48eb7a1c3490078531","23bb442a6a2924dd7095a2be445aa98073e21d72b61cf2fccd67880389ebe0d1"
].map((hash) => `0x${hash}`);
const result = { generated_at: new Date().toISOString(), network: "StudioNet", chain_id: 61999, contract: address, explorer: `https://explorer-studio.genlayer.com/address/${address}`, source_commit: commit, wallets: wallets.map((w) => w.address), after: await parse("get_counts"), mandate: await parse("get_mandate", [1n]), cases, poisoned_source_state: poisoned.state, transaction_hashes: [...txHashes, ...newTransactions.map((x) => x.hash)], new_transactions: newTransactions };
writeFileSync("verification/studionet-e2e.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
