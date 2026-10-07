import React, {useEffect, useMemo, useState} from "react";
import {createRoot} from "react-dom/client";
import {createClient} from "genlayer-js";
import {studionet} from "genlayer-js/chains";
import {ArrowUpRight, Check, Copy, ExternalLink, RefreshCw, ShieldCheck, WalletCards} from "lucide-react";
import "./styles.css";

const DEFAULT_CONTRACT = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const EXPLORER = "https://explorer-studio.genlayer.com";
const envelope = {allow_approval:false,allow_delegatecall:false,allowed_selectors:["0xa9059cbb"],asset:"0x2222222222222222222222222222222222222222",chain_id:1,max_total_raw:"8000000000",recipient:"0x3333333333333333333333333333333333333333",safe:"0x1111111111111111111111111111111111111111"};
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
  const [mandateSource,setMandateSource]=useState(""); const [bundleSource,setBundleSource]=useState("");
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
  async function refresh(){
    if(!valid)return; setBusy("refresh");
    try{
      setCounts(parse(await reader.readContract({address:contract,functionName:"get_counts",args:[]}))||emptyCounts);
      const nextMandate=parse(await reader.readContract({address:contract,functionName:"get_mandate",args:[BigInt(mandateId||0)]}));
      const nextBundle=parse(await reader.readContract({address:contract,functionName:"get_bundle",args:[BigInt(bundleId||0)]}));
      setMandate(nextMandate?.error?null:nextMandate);
      setBundle(nextBundle?.error?null:nextBundle);
      setNotice("State synchronized from StudioNet.");
    }catch(e){setNotice(`Read unavailable: ${e.message}`)}finally{setBusy("")}
  }
  async function write(method,args){
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
      await refresh(); setNotice("Finalized successfully; UI reconciled from canonical contract state.");
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
      <article className="panel"><p className="eyebrow">LIVE PROTOCOL</p><h3>Current objects</h3><div className="ids"><label>Mandate ID<input value={mandateId} onChange={e=>setMandateId(e.target.value.replace(/\D/g,""))}/></label><label>Bundle ID<input value={bundleId} onChange={e=>setBundleId(e.target.value.replace(/\D/g,""))}/></label></div>
        <div className="object"><span>Mandate</span><strong className={`pill ${mandate?.state||""}`}>{mandate?.state||"NOT FOUND"}</strong><dl><dt>Sponsor</dt><dd>{short(mandate?.sponsor)}</dd><dt>Compile code</dt><dd>{mandate?.compile_code||"—"}</dd></dl></div>
        <div className="object"><span>Bundle</span><strong className={`pill ${bundle?.state||""}`}>{bundle?.state||"NOT FOUND"}</strong><dl><dt>Preparer</dt><dd>{short(bundle?.preparer)}</dd><dt>Decision</dt><dd>{bundle?.reason_code||"—"}</dd></dl></div>
      </article>
      <article className="panel action"><p className="eyebrow">STATE-DRIVEN ACTION</p><h3>{!mandate?"Create a mandate":mandate.state==="DRAFT"?"Authenticate source":mandate.state==="SOURCE_BOUND"?"Compile constraints":!bundle?"Submit a bundle":bundle.state==="PROPOSED"?"Authenticate bundle":bundle.state==="SOURCE_BOUND"?"Evaluate calls":bundle.state==="PERMIT_READY"?"Consume permit":"Inspect final state"}</h3><p className="muted">The connected wallet determines the role. Sponsor and preparer must be different addresses.</p>
        {!mandate&&<><input className="wide" value={label} onChange={e=>setLabel(e.target.value)} placeholder="Mandate label"/><textarea value={mandateSource} onChange={e=>setMandateSource(e.target.value)} placeholder='Mandate source JSON'/><textarea value={envelopeText} onChange={e=>setEnvelopeText(e.target.value)}/></>}
        {mandate?.state==="COMPILED"&&!bundle&&<textarea value={bundleSource} onChange={e=>setBundleSource(e.target.value)} placeholder="Bundle source JSON"/>}
        {mandate&&mandate.state!=="COMPILED"&&<textarea readOnly value={JSON.stringify(mandate.envelope||envelope,null,2)}/>}<div className="actions">
          {!mandate&&<button className="primary" disabled={!!busy} onClick={()=>{if(!parse(mandateSource)||!parse(envelopeText))return setNotice("Source and envelope must be valid JSON.");write("create_mandate",[label,mandateSource,envelopeText])}}>Create mandate <ArrowUpRight size={16}/></button>}
          {mandate?.state==="DRAFT"&&<button className="primary" onClick={()=>write("authenticate_mandate",[BigInt(mandateId)])}>Authenticate mandate</button>}
          {mandate?.state==="SOURCE_BOUND"&&<button className="primary" onClick={()=>write("compile_mandate",[BigInt(mandateId)])}>Compile mandate</button>}
          {mandate?.state==="COMPILED"&&!bundle&&<button className="primary" onClick={()=>{if(!parse(bundleSource))return setNotice("Bundle source must be valid JSON.");write("submit_bundle",[BigInt(mandateId),bundleSource])}}>Submit bundle source</button>}
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
