import React, {useEffect, useMemo, useState} from "react";
import {createRoot} from "react-dom/client";
import {createClient} from "genlayer-js";
import {studionet} from "genlayer-js/chains";
import {ArrowUpRight, Check, Copy, ExternalLink, RefreshCw, ShieldCheck, WalletCards} from "lucide-react";
import "./styles.css";
import "./form.css";

const DEFAULT_CONTRACT = import.meta.env.VITE_CONTRACT_ADDRESS || "0x6414e50a09AB5d1cfF6fAa6bDcA96F40100f3186";
const EXPLORER = "https://explorer-studio.genlayer.com";
const envelope = {allow_approval:false,allow_delegatecall:false,allowed_selectors:["0xa9059cbb"],asset:"0x2222222222222222222222222222222222222222",chain_id:1,max_total_raw:"8000000000",recipient:"0x3333333333333333333333333333333333333333",safe:"0x1111111111111111111111111111111111111111"};
const demoMandateSource={owner:"Azariavibecode",repo:"TreasuryIntentCompiler",commit:"2ac7804b294f407d4d7e94a453e33b83a3864a71",path:"/fixtures/mandates/approved-transfer.md",digest:"f0fb4708fef9a6e3d27bc1522b7d8bcfa3f4176baef0718b3281c5ed0485b5ed",marker:"## MANDATE AUDIT-PAYMENT-001"};
const demoBundleSource={owner:"Azariavibecode",repo:"TreasuryIntentCompiler",commit:"2ac7804b294f407d4d7e94a453e33b83a3864a71",path:"/fixtures/bundles/exact-match.json",digest:"ac4762ad6e4410e5060bc703b0b43e7a16f134ef104f13aa09d1f5ff5a00db9b",marker:'"schema":"treasury-bundle-v1"'};
const emptyCounts = {mandate_count:0,bundle_count:0,permit_count:0,consumed_count:0};

function short(v=""){return v ? `${v.slice(0,7)}…${v.slice(-5)}` : "Not configured"}
function parse(v){try{return JSON.parse(v)}catch{return null}}
function normalizeTx(value){if(typeof value==="string")return value;if(value&&typeof value.txId==="string")return value.txId;throw Error("INVALID_TRANSACTION_ID")}

function App(){
  const [contract,setContract]=useState(localStorage.getItem("tic-contract")||DEFAULT_CONTRACT);
  const [account,setAccount]=useState(""); const [counts,setCounts]=useState(emptyCounts);
  const [mandateId,setMandateId]=useState("0"); const [bundleId,setBundleId]=useState("0");
  const [mandate,setMandate]=useState(null); const [bundle,setBundle]=useState(null);
  const [label,setLabel]=useState("audit-payment"); const [envelopeText,setEnvelopeText]=useState(JSON.stringify(envelope,null,2));
  const [mandateSource,setMandateSource]=useState(JSON.stringify(demoMandateSource,null,2)); const [bundleSource,setBundleSource]=useState(JSON.stringify(demoBundleSource,null,2));
  const [newMandate,setNewMandate]=useState(false); const [newBundle,setNewBundle]=useState(false);
  const [busy,setBusy]=useState(""); const [notice,setNotice]=useState("Connect a wallet to begin."); const [tx,setTx]=useState("");
  const [chainId,setChainId]=useState("");
  const reader=useMemo(()=>createClient({chain:studionet}),[]);
  const valid=/^0x[0-9a-fA-F]{40}$/.test(contract);

  async function connect(){
    if(!window.ethereum) return setNotice("Browser wallet not found.");
    const [address]=await window.ethereum.request({method:"eth_requestAccounts"});
    const chain=await window.ethereum.request({method:"eth_chainId"});
    setAccount(address); setChainId(chain||"");
    setNotice(chain?.toLowerCase()==="0xf22f"?"Wallet connected to StudioNet.":"Connected. Switch wallet to StudioNet (61999) before writing.");
  }
  async function refresh(ids={}){
    if(!valid)return; setBusy("refresh");
    try{
      const activeMandate=ids.mandateId??mandateId; const activeBundle=ids.bundleId??bundleId;
      setCounts(parse(await reader.readContract({address:contract,functionName:"get_counts",args:[]}))||emptyCounts);
      const nextMandate=parse(await reader.readContract({address:contract,functionName:"get_mandate",args:[BigInt(activeMandate||0)]}));
      const nextBundle=parse(await reader.readContract({address:contract,functionName:"get_bundle",args:[BigInt(activeBundle||0)]}));
      setMandate(nextMandate?.error?null:nextMandate);
      setBundle(nextBundle?.error?null:nextBundle);
      setNotice("State synchronized from StudioNet.");
    }catch(e){setNotice(`Read unavailable: ${e.message}`)}finally{setBusy("")}
  }
  async function write(method,args,readIds={}){
    if(!account)return setNotice("Connect wallet first."); if(!valid)return setNotice("Set a valid contract address.");
    setBusy(method); setTx("");
    try{
      const liveAccounts=await window.ethereum.request({method:"eth_accounts"});
      const liveChain=await window.ethereum.request({method:"eth_chainId"});
      if(!liveAccounts?.[0]||liveAccounts[0].toLowerCase()!==account.toLowerCase())throw Error("Wallet account changed. Reconnect before writing.");
      if(liveChain?.toLowerCase()!=="0xf22f")throw Error("Wrong network. Switch wallet to StudioNet (61999).");
      const wallet=createClient({chain:studionet,provider:window.ethereum,account});
      const hash=normalizeTx(await wallet.writeContract({address:contract,functionName:method,args}));
      setTx(hash); setNotice("Transaction submitted. Waiting for finalized consensus…");
      const receipt=await reader.waitForTransactionReceipt({hash,status:"FINALIZED",interval:3000,retries:60});
      const status=receipt.status_name||receipt.status||"FINALIZED";
      if(status!=="FINALIZED")throw Error(`Transaction ended with ${status}`);
      await refresh(readIds); setNotice("Finalized successfully; UI reconciled from canonical contract state.");
    }catch(e){setNotice(`Transaction failed: ${e.message}`)}finally{setBusy("")}
  }
  useEffect(()=>{const provider=window.ethereum;if(!provider)return;const restore=async()=>{try{const [a,c]=await Promise.all([provider.request({method:"eth_accounts"}),provider.request({method:"eth_chainId"})]);setAccount(a?.[0]||"");setChainId(c||"")}catch{setNotice("Wallet reconnection is required.")}};const accountsChanged=a=>{setAccount(a?.[0]||"");setNotice(a?.[0]?"Wallet account changed.":"Wallet disconnected.")};const chainChanged=c=>{setChainId(c||"");setNotice(c?.toLowerCase()==="0xf22f"?"StudioNet detected.":"Wrong network. Switch to StudioNet (61999).");refresh()};restore();provider.on?.("accountsChanged",accountsChanged);provider.on?.("chainChanged",chainChanged);return()=>{provider.removeListener?.("accountsChanged",accountsChanged);provider.removeListener?.("chainChanged",chainChanged)}},[]);
  useEffect(()=>{if(valid){localStorage.setItem("tic-contract",contract);refresh()}},[contract]);
  const stage=bundle?.state==="PERMIT_READY"?4:bundle?3:mandate?.state==="COMPILED"?2:mandate?1:0;
  return <main>
    <header><div className="brand"><img src="/treasury-intent-logo.png"/><div><span>GENLAYER · STUDIONET</span><h1>Treasury Intent Compiler</h1></div></div><button className="wallet" onClick={connect}><WalletCards size={17}/>{account?short(account):"Connect wallet"}</button></header>
    <section className="hero"><div><p className="eyebrow">MANDATE → CONSTRAINTS → PERMIT</p><h2>A semantic firewall for treasury transactions.</h2><p>Bind an immutable mandate, verify its constraints with GenLayer, then evaluate every call deterministically before a one-time execution permit exists.</p></div><img src="/treasury-intent-logo.png"/></section>
    <section className="contractbar"><div><small>ACTIVE CONTRACT</small><strong>{contract||"Paste deployment address"}</strong></div><input value={contract} onChange={e=>setContract(e.target.value.trim())} placeholder="0x…"/><a className={!valid?"disabled":""} href={valid?`${EXPLORER}/address/${contract}`:"#"} target="_blank">Explorer <ExternalLink size={14}/></a><button onClick={refresh}><RefreshCw size={15}/></button></section>
    <nav className="steps">{["Bind mandate","Compile intent","Inspect bundle","Consume permit"].map((s,i)=><div className={i<=stage?"active":""} key={s}><b>{i<stage?<Check size={14}/>:i+1}</b><span>{s}</span></div>)}</nav>
    <section className="grid">
      <article className="panel"><p className="eyebrow">LIVE PROTOCOL</p><h3>Current objects</h3><div className="modebar"><button className={!newMandate?"selected":""} onClick={()=>{setNewMandate(false);setNewBundle(false);refresh()}}>Existing records</button><button className={newMandate?"selected":""} onClick={()=>{setNewMandate(true);setNewBundle(false)}}>+ New mandate</button></div><div className="ids"><label>Mandate ID<input value={mandateId} onChange={e=>{setNewMandate(false);setMandateId(e.target.value.replace(/\D/g,""))}}/></label><label>Bundle ID<input value={bundleId} onChange={e=>{setNewBundle(false);setBundleId(e.target.value.replace(/\D/g,""))}}/></label></div>
        <div className="object"><span>Mandate</span><strong className={`pill ${mandate?.state||""}`}>{mandate?.state||"NOT FOUND"}</strong><dl><dt>Sponsor</dt><dd>{short(mandate?.sponsor)}</dd><dt>Compile code</dt><dd>{mandate?.compile_code||"—"}</dd></dl></div>
        <div className="object"><span>Bundle</span><strong className={`pill ${bundle?.state||""}`}>{bundle?.state||"NOT FOUND"}</strong><dl><dt>Preparer</dt><dd>{short(bundle?.preparer)}</dd><dt>Decision</dt><dd>{bundle?.reason_code||"—"}</dd></dl></div>
      </article>
      <article className="panel action"><p className="eyebrow">STATE-DRIVEN ACTION</p><h3>{newMandate?"Create a new mandate":newBundle?"Submit a new bundle":!mandate?"Record not found":mandate.state==="DRAFT"?"Authenticate source":mandate.state==="SOURCE_BOUND"?"Compile constraints":mandate.state==="COMPILED"&&!bundle?"Submit a bundle":bundle?.state==="PROPOSED"?"Authenticate bundle":bundle?.state==="SOURCE_BOUND"?"Evaluate calls":bundle?.state==="PERMIT_READY"?"Consume permit":"Inspect final state"}</h3><p className="muted">The connected wallet determines the role. Sponsor and preparer must be different addresses.</p>
        {newMandate&&<><input className="wide" value={label} onChange={e=>setLabel(e.target.value)} placeholder="Mandate label"/><div className="fieldrow"><label className="fieldtitle">Mandate source descriptor</label><button onClick={()=>{setMandateSource(JSON.stringify(demoMandateSource,null,2));setEnvelopeText(JSON.stringify(envelope,null,2));setNotice("Verified demo mandate loaded.")}}>Load verified demo</button></div><textarea value={mandateSource} onChange={e=>setMandateSource(e.target.value)} placeholder='Paste valid source JSON'/><label className="fieldtitle">Constraint envelope</label><textarea value={envelopeText} onChange={e=>setEnvelopeText(e.target.value)}/><p className="hint">The demo points to immutable public GitHub bytes. Replace every source field together when testing your own mandate.</p></>}
        {!newMandate&&mandate?.state==="COMPILED"&&<div className="bundlehead"><span>Bundle action</span><button onClick={()=>setNewBundle(value=>!value)}>{newBundle?"Cancel":"+ New bundle"}</button></div>}
        {newBundle&&<><div className="fieldrow"><label className="fieldtitle">Bundle source descriptor</label><button onClick={()=>{setBundleSource(JSON.stringify(demoBundleSource,null,2));setNotice("Verified demo bundle loaded.")}}>Load verified demo</button></div><textarea value={bundleSource} onChange={e=>setBundleSource(e.target.value)} placeholder="Paste valid source JSON"/></>}
        {!newMandate&&!newBundle&&mandate&&mandate.state!=="COMPILED"&&<textarea readOnly value={JSON.stringify(mandate.envelope||envelope,null,2)}/>}<div className="actions">
          {newMandate&&<button className="primary" disabled={!!busy} onClick={()=>{if(!parse(mandateSource)||!parse(envelopeText))return setNotice("Source and envelope must be valid JSON.");const id=String(counts.mandate_count);setMandateId(id);setNewMandate(false);write("create_mandate",[label,mandateSource,envelopeText],{mandateId:id})}}>Create mandate <ArrowUpRight size={16}/></button>}
          {mandate?.state==="DRAFT"&&<button className="primary" onClick={()=>write("authenticate_mandate",[BigInt(mandateId)])}>Authenticate mandate</button>}
          {mandate?.state==="SOURCE_BOUND"&&<button className="primary" onClick={()=>write("compile_mandate",[BigInt(mandateId)])}>Compile mandate</button>}
          {newBundle&&<button className="primary" onClick={()=>{if(!parse(bundleSource))return setNotice("Bundle source must be valid JSON.");const id=String(counts.bundle_count);setBundleId(id);setNewBundle(false);write("submit_bundle",[BigInt(mandateId),bundleSource],{bundleId:id})}}>Submit bundle source</button>}
          {bundle?.state==="PROPOSED"&&<button className="primary" onClick={()=>write("authenticate_bundle",[BigInt(bundleId)])}>Authenticate bundle</button>}
          {bundle?.state==="SOURCE_BOUND"&&<button className="primary" onClick={()=>write("evaluate_bundle",[BigInt(bundleId)])}>Evaluate bundle</button>}
          {bundle?.state==="PERMIT_READY"&&<button className="primary" onClick={()=>write("consume_permit",[BigInt(bundleId)])}>Consume one-time permit</button>}
        </div>{tx&&<a className="tx" href={`${EXPLORER}/transactions/${tx}`} target="_blank">{short(tx)} <ExternalLink size={13}/></a>}<p className="notice">{notice}</p>
      </article>
    </section>
    <section className="stats">{Object.entries(counts).map(([k,v])=><div key={k}><strong>{v}</strong><span>{k.replace("_"," ")}</span></div>)}</section>
    <footer><ShieldCheck size={17}/> This interface reads canonical state from the displayed contract. GitHub fixtures demonstrate behavior; they do not prove a real DAO authorization.</footer>
  </main>
}
createRoot(document.getElementById("root")).render(<App/>);
