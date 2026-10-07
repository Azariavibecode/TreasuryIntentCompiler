import crypto from "node:crypto";

const commit = "2ac7804b294f407d4d7e94a453e33b83a3864a71";
const path = "fixtures/bundles/exact-match.json";
const api = "https://api.github.com/repos/Azariavibecode/TreasuryIntentCompiler";
const commitData = await (await fetch(`${api}/git/commits/${commit}`)).json();
const treeData = await (await fetch(`${api}/git/trees/${commitData.tree.sha}?recursive=1`)).json();
const entry = treeData.tree.find((item) => item.path === path);
const bytes = Buffer.from(await (await fetch(`https://raw.githubusercontent.com/Azariavibecode/TreasuryIntentCompiler/${commit}/${path}`)).arrayBuffer());
const marker = '"schema":"treasury-bundle-v1"';
const text = bytes.toString("utf8");
const blob = Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]);
console.log({ commit: commitData.sha, tree: commitData.tree.sha, truncated: treeData.truncated, entry,
  raw_size: bytes.length, sha1: crypto.createHash("sha1").update(blob).digest("hex"),
  sha256: crypto.createHash("sha256").update(bytes).digest("hex"), marker_count: text.split(marker).length - 1,
  top_keys: Object.keys(JSON.parse(text)).sort(), call_keys: Object.keys(JSON.parse(text).calls[0]).sort() });
