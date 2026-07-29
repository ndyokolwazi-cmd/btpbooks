'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const T = {
  navy:'#0D1F3C',blue:'#1E6FD9',blueLt:'#E8F1FB',
  teal:'#0BA89A',green:'#16A34A',greenLt:'#DCFCE7',
  red:'#DC2626',redLt:'#FEE2E2',amber:'#D97706',amberLt:'#FEF3C7',
  grey50:'#F8FAFC',grey100:'#F1F4F8',grey200:'#E2E8F0',
  grey400:'#94A3B8',grey600:'#475569',grey800:'#1E293B',white:'#FFFFFF',
}

const DOC_TYPES = [
  {key:'invoice',label:'Tax Invoice',prefix:'INV',color:T.navy},
  {key:'quote',label:'Quotation',prefix:'QUO',color:T.teal},
  {key:'delivery',label:'Delivery Note',prefix:'DN',color:T.blue},
  {key:'credit',label:'Credit Note',prefix:'CN',color:T.red},
  {key:'receipt',label:'Receipt',prefix:'REC',color:T.green},
]
const DT = Object.fromEntries(DOC_TYPES.map(t=>[t.key,t]))
const SM = {
  Draft:{bg:T.grey100,fg:T.grey600},Sent:{bg:T.blueLt,fg:T.blue},
  Accepted:{bg:T.greenLt,fg:T.green},Paid:{bg:T.greenLt,fg:T.green},
  Overdue:{bg:T.redLt,fg:T.red},Cancelled:{bg:T.redLt,fg:T.red},Issued:{bg:T.amberLt,fg:T.amber},
}
const DST = {
  invoice:['Draft','Sent','Paid','Overdue','Cancelled'],
  quote:['Draft','Sent','Accepted','Cancelled'],
  delivery:['Draft','Issued','Cancelled'],
  credit:['Draft','Issued','Cancelled'],
  receipt:['Draft','Issued'],
}

const uid=()=>Math.random().toString(36).slice(2,10)
const today=()=>new Date().toISOString().slice(0,10)
const addDays=(d,n)=>{const dt=new Date(d);dt.setDate(dt.getDate()+n);return dt.toISOString().slice(0,10)}
const fmtDate=d=>d?new Date(d+'T00:00:00').toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'}):''
const fmtMoney=(n,sym='R')=>`${sym} ${Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')}`
const calcTotals=(items,vr)=>{let s=0,v=0;items.forEach(it=>{const n=it.qty*it.rate*(1-(it.discount||0)/100);s+=n;if(vr)v+=n*(it.vatRate||0)/100});return{subtotal:s,vat:v,total:s+v}}

// Subscription-based access check
const checkAccess = (sub) => {
  if (!sub) return {active:false, trial:false, daysLeft:0}
  if (sub.status === 'active') {
    const ends = sub.subscription_ends_at ? new Date(sub.subscription_ends_at) : null
    if (!ends || ends > new Date()) return {active:true, trial:false, daysLeft:0}
  }
  if (sub.status === 'trial') {
    const trialEnds = new Date(sub.trial_ends_at)
    const now = new Date()
    const daysLeft = Math.max(0, Math.ceil((trialEnds - now) / (1000*60*60*24)))
    if (daysLeft > 0) return {active:true, trial:true, daysLeft}
  }
  return {active:false, trial:false, daysLeft:0}
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F8FAFC;color:#1E293B;font-size:14px;}
button{cursor:pointer;font-family:inherit;}
input,select,textarea{font-family:inherit;font-size:13px;}
::-webkit-scrollbar{width:5px;height:5px;}
::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px;}
.layout{display:flex;min-height:100vh;}
.sidebar{width:230px;background:#0D1F3C;display:flex;flex-direction:column;flex-shrink:0;position:fixed;top:0;left:0;bottom:0;z-index:50;overflow-y:auto;transition:transform .2s;}
.main{flex:1;margin-left:230px;display:flex;flex-direction:column;}
.topbar{background:#fff;border-bottom:1px solid #E2E8F0;padding:11px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:40;flex-wrap:wrap;gap:8px;}
.content{flex:1;padding:28px;max-width:1160px;width:100%;margin:0 auto;}
.sb-brand{padding:20px 16px 14px;border-bottom:1px solid rgba(255,255,255,.1);}
.sb-brand h1{font-size:18px;font-weight:900;color:#fff;letter-spacing:-.5px;}
.sb-brand h1 span{color:#1E6FD9;}
.sb-brand p{font-size:11px;color:rgba(255,255,255,.4);margin-top:2px;}
.sb-sec{padding:12px 10px;border-bottom:1px solid rgba(255,255,255,.1);}
.sb-lbl{font-size:10px;font-weight:700;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;}
.co-btn{display:flex;align-items:center;gap:9px;width:100%;padding:7px 9px;border-radius:8px;border:none;background:transparent;cursor:pointer;margin-bottom:3px;text-align:left;}
.co-btn.act{background:rgba(255,255,255,.12);}
.co-icon{width:28px;height:28px;border-radius:6px;background:#1E6FD9;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#fff;flex-shrink:0;overflow:hidden;}
.co-icon img{width:100%;height:100%;object-fit:contain;background:#fff;}
.co-nm{font-size:12px;font-weight:600;color:rgba(255,255,255,.55);line-height:1.3;}
.co-btn.act .co-nm{color:#fff;}
.sb-nav{flex:1;padding:10px;}
.nav-btn{display:flex;align-items:center;gap:11px;width:100%;padding:9px 11px;border:none;border-radius:8px;margin-bottom:2px;cursor:pointer;background:transparent;color:rgba(255,255,255,.55);font-weight:500;font-size:13px;text-align:left;}
.nav-btn.act{background:rgba(255,255,255,.12);color:#fff;font-weight:700;}
.nav-btn:hover:not(.act){background:rgba(255,255,255,.07);}
.sb-foot{padding:14px 16px;border-top:1px solid rgba(255,255,255,.08);font-size:11px;color:rgba(255,255,255,.3);}
.card{background:#fff;border-radius:12px;border:1px solid #E2E8F0;padding:20px;}
.card0{background:#fff;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;}
.btn{border:none;border-radius:8px;font-weight:600;font-size:13px;padding:9px 18px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:opacity .1s;}
.btn:hover{opacity:.88;}
.btn-p{background:#1E6FD9;color:#fff;}
.btn-s{background:#fff;color:#1E293B;border:1.5px solid #E2E8F0;}
.btn-d{background:#DC2626;color:#fff;}
.btn-ok{background:#16A34A;color:#fff;}
.btn-gh{background:transparent;color:#1E6FD9;}
.btn-tl{background:#0BA89A;color:#fff;}
.btn-sm{padding:5px 12px;font-size:12px;}
.btn-fw{width:100%;justify-content:center;}
.field{margin-bottom:13px;}
.flbl{display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px;}
.inp{width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;outline:none;background:#fff;color:#1E293B;}
.inp:focus{border-color:#1E6FD9;}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.s2{grid-column:span 2;}
.tbl{width:100%;border-collapse:collapse;}
.tbl th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.4px;background:#F8FAFC;white-space:nowrap;border-bottom:2px solid #E2E8F0;}
.tbl td{padding:11px 14px;font-size:13px;border-top:1px solid #F1F4F8;}
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow-y:auto;}
.modal{background:#fff;border-radius:14px;width:100%;max-width:660px;box-shadow:0 20px 70px rgba(0,0,0,.25);margin-bottom:24px;}
.modal-lg{max-width:860px;}
.modal-hd{display:flex;justify-content:space-between;align-items:center;padding:16px 22px;border-bottom:1px solid #E2E8F0;}
.modal-hd h2{font-size:16px;font-weight:800;color:#0D1F3C;}
.modal-x{background:none;border:none;font-size:20px;color:#94A3B8;cursor:pointer;}
.modal-bd{padding:22px;}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:26px;}
.stat-card{background:#fff;border-radius:12px;border:1px solid #E2E8F0;padding:18px;border-left-width:4px;}
.vat-row{display:flex;align-items:center;gap:10px;padding:12px 0;border-top:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0;margin:4px 0 14px;}
.vat-row input[type=checkbox]{width:18px;height:18px;cursor:pointer;}
.vat-row label{font-size:14px;font-weight:700;color:#0D1F3C;cursor:pointer;}
.bank-blk{background:#F8FAFC;border-radius:10px;padding:14px;margin-bottom:10px;border:1px solid #E2E8F0;}
.filter-bar{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center;}
.filter-bar input,.filter-bar select{padding:7px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:12px;background:#fff;}
.cl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;}
.co-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px;}
.toast{position:fixed;bottom:20px;right:20px;z-index:9999;background:#0D1F3C;color:#fff;padding:11px 20px;border-radius:10px;font-weight:600;font-size:13px;box-shadow:0 8px 28px rgba(0,0,0,.3);animation:fadeIn .2s;}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.trial-bar{background:linear-gradient(90deg,#D97706,#F59E0B);color:#fff;padding:10px 24px;text-align:center;font-size:13px;font-weight:600;}
.trial-bar a{color:#fff;text-decoration:underline;margin-left:8px;cursor:pointer;}
.expired-wall{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F8FAFC;flex-direction:column;gap:16px;padding:40px;text-align:center;}
.loading{display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:12px;}
.spinner{width:32px;height:32px;border:3px solid #E2E8F0;border-top-color:#1E6FD9;border-radius:50%;animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.mob-toggle{display:none;background:none;border:none;font-size:22px;color:#0D1F3C;cursor:pointer;}
.sb-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:49;}
.print-doc{background:#fff;max-width:750px;margin:0 auto;padding:36px 44px;border:1px solid #E2E8F0;border-radius:8px;}
.quick-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;}
@media print{.no-print{display:none!important;}.sidebar,.modal-bg{display:none!important;}.main{margin-left:0!important;}body{background:#fff;}@page{margin:12mm;size:A4;}html{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
@media(max-width:768px){
  .sidebar{transform:translateX(-230px);}
  .sidebar.open{transform:translateX(0);}
  .main{margin-left:0;}
  .mob-toggle{display:block;}
  .sb-overlay.show{display:block;}
  .g2{grid-template-columns:1fr;}
  .s2{grid-column:span 1;}
  .content{padding:12px;}
  .quick-actions{grid-template-columns:1fr;}
  .stat-grid{grid-template-columns:1fr 1fr;}
  .tbl th,.tbl td{padding:8px 10px;font-size:12px;}
  .modal{max-width:100%;margin:0;}
  .modal-bg{padding:8px;align-items:flex-end;}
  .modal{border-radius:14px 14px 0 0;max-height:90vh;overflow-y:auto;}
  .print-doc{padding:20px 16px;}
  .topbar{padding:10px 14px;}
  .card,.card0{border-radius:10px;}
  .btn{font-size:12px;padding:8px 14px;}
  .btn-sm{padding:5px 10px;font-size:11px;}
  h1{font-size:20px!important;}
  .stat-grid .stat{padding:14px;}
  .stat-grid .stat-val{font-size:18px!important;}
  table{font-size:12px;}
  .cl-grid,.co-grid{grid-template-columns:1fr;}
}
@media(max-width:400px){
  .stat-grid{grid-template-columns:1fr;}
}
`

// ── UI Primitives ─────────────────────────────────────────────────────────────
function Btn({children,onClick,v='p',sz='',fw,disabled,style:xs}){
  return <button className={`btn btn-${v}${sz?' btn-'+sz:''}${fw?' btn-fw':''}`} onClick={onClick} disabled={disabled} style={xs}>{children}</button>
}
function Inp({value,onChange,type='text',placeholder,rows,disabled,style:xs}){
  return rows
    ?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} className="inp" style={{resize:'vertical',...(xs||{})}}/>
    :<input value={value} onChange={e=>onChange(e.target.value)} type={type} placeholder={placeholder} disabled={disabled} className="inp" style={xs}/>
}
function Sel({value,onChange,options,style:xs}){
  return <select value={value} onChange={e=>onChange(e.target.value)} className="inp" style={xs}>
    {options.map(o=><option key={o.v??o} value={o.v??o}>{o.l??o}</option>)}
  </select>
}
function Lbl({text,req}){return <span className="flbl">{text}{req&&<span style={{color:T.red}}> *</span>}</span>}
function Badge({status}){const c=SM[status]||SM.Draft;return <span className="badge" style={{background:c.bg,color:c.fg}}>{status}</span>}
function Modal({title,onClose,children,lg}){
  return <div className="modal-bg" onClick={e=>e.target.className==='modal-bg'&&onClose()}>
    <div className={`modal${lg?' modal-lg':''}`}>
      <div className="modal-hd"><h2>{title}</h2><button className="modal-x" onClick={onClose}>✕</button></div>
      <div className="modal-bd">{children}</div>
    </div>
  </div>
}
function Toast({msg,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,2600);return()=>clearTimeout(t)},[])
  return <div className="toast">✓ {msg}</div>
}

// Get company accent colour
const coColor=(co)=>co?.accent_color||T.navy

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NAV=[{id:'dashboard',icon:'⊞',label:'Dashboard'},{id:'documents',icon:'📄',label:'Documents'},{id:'clients',icon:'👥',label:'Clients'},{id:'companies',icon:'🏢',label:'Companies'}]

function Sidebar({page,setPage,companies,activeCoId,setActiveCoId,user,onSignOut,mobile,open,setOpen}){
  const close=()=>{if(mobile)setOpen(false)}
  const co=companies.find(c=>c.id===activeCoId)||companies[0]
  return <>
    <div className={`sb-overlay${open?' show':''}`} onClick={()=>setOpen(false)}/>
    <div className={`sidebar${open?' open':''}`}>
      <div className="sb-brand">
        <h1>Inv<span>o</span>xa</h1>
        <p>Business Document Manager</p>
      </div>
      <div className="sb-sec">
        <div className="sb-lbl">Active Company</div>
        {companies.map(c=>(
          <button key={c.id} className={`co-btn${c.id===activeCoId?' act':''}`} onClick={()=>{setActiveCoId(c.id);close()}}>
            <div className="co-icon" style={{background:c.accent_color||T.blue}}>
              {c.logo?<img src={c.logo} alt=""/>:(c.name||'?')[0]}
            </div>
            <span className="co-nm">{c.name}</span>
          </button>
        ))}
      </div>
      <div className="sb-nav">
        {NAV.map(n=>(
          <button key={n.id} className={`nav-btn${page===n.id?' act':''}`} onClick={()=>{setPage(n.id);close()}}>
            <span style={{fontSize:16}}>{n.icon}</span>{n.label}
          </button>
        ))}
      </div>
      <div className="sb-foot">
        <div style={{marginBottom:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.email}</div>
        {co?.vat_registered&&co?.vat&&<div>VAT: {co.vat}</div>}
        <button style={{marginTop:8,background:'rgba(255,255,255,.1)',color:'rgba(255,255,255,.7)',border:'none',padding:'5px 12px',borderRadius:6,fontSize:11,cursor:'pointer'}} onClick={onSignOut}>Sign Out</button>
      </div>
    </div>
  </>
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardView({docs,company,setPage,setNewDocType}){
  const my=docs.filter(d=>d.company_id===company?.id)
  const inv=my.filter(d=>d.type==='invoice')
  const sym=company?.currency_symbol||'R'
  const ac=coColor(company)
  const totalInv=inv.reduce((s,d)=>s+(d.totals?.total||0),0)
  const paid=inv.filter(d=>d.status==='Paid').reduce((s,d)=>s+(d.totals?.total||0),0)
  const outstanding=inv.filter(d=>['Sent','Overdue'].includes(d.status)).reduce((s,d)=>s+(d.totals?.total||0),0)
  const overdue=inv.filter(d=>d.status==='Overdue')
  const recent=[...my].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,6)
  const debtors={}
  inv.filter(d=>['Sent','Overdue'].includes(d.status)).forEach(d=>{
    if(!debtors[d.client_name])debtors[d.client_name]={name:d.client_name,total:0,overdue:false}
    debtors[d.client_name].total+=d.totals?.total||0
    if(d.status==='Overdue')debtors[d.client_name].overdue=true
  })
  const debtorList=Object.values(debtors).sort((a,b)=>b.total-a.total)

  return <div>
    <h1 style={{fontSize:26,fontWeight:900,color:T.navy,marginBottom:4}}>{company?.name||'Dashboard'}</h1>
    <p style={{fontSize:13,color:T.grey600,marginBottom:24}}>{fmtDate(today())}</p>
    <div className="stat-grid">
      {[
        {l:'Total Invoiced',v:fmtMoney(totalInv,sym),c:ac,i:'📊'},
        {l:'Collected',v:fmtMoney(paid,sym),c:T.green,i:'✅'},
        {l:'Outstanding',v:fmtMoney(outstanding,sym),c:T.blue,i:'⏳'},
        {l:'Overdue',v:`${overdue.length} invoice${overdue.length!==1?'s':''}`,c:T.red,i:'⚠️'},
      ].map(s=>(
        <div key={s.l} className="stat-card" style={{borderLeftColor:s.c}}>
          <div style={{fontSize:20,marginBottom:6}}>{s.i}</div>
          <div style={{fontSize:11,fontWeight:700,color:T.grey600,textTransform:'uppercase',letterSpacing:'.5px'}}>{s.l}</div>
          <div style={{fontSize:22,fontWeight:900,color:s.c,marginTop:5}}>{s.v}</div>
        </div>
      ))}
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:20,marginBottom:24}}>
      <div className="card">
        <div style={{fontWeight:800,fontSize:13,color:T.navy,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:14}}>Quick Create</div>
        <div className="quick-actions">
          {DOC_TYPES.map(t=>(
            <button key={t.key} className="btn btn-s" style={{justifyContent:'flex-start',gap:8,fontSize:12}}
              onClick={()=>{setNewDocType(t.key);setPage('documents')}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:t.key==='invoice'?ac:t.color,flexShrink:0,display:'inline-block'}}/>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {debtorList.length>0&&(
        <div className="card">
          <div style={{fontWeight:800,fontSize:13,color:T.navy,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:14}}>Outstanding Debtors</div>
          {debtorList.map(d=>(
            <div key={d.name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${T.grey100}`}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:d.overdue?T.red:T.navy}}>{d.name}</div>
                {d.overdue&&<div style={{fontSize:10,color:T.red,fontWeight:700}}>OVERDUE</div>}
              </div>
              <div style={{fontWeight:700,color:d.overdue?T.red:T.navy}}>{fmtMoney(d.total,sym)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
    <div className="card0">
      <div style={{padding:'14px 18px',borderBottom:`1px solid ${T.grey200}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontWeight:800,fontSize:13,color:T.navy}}>Recent Documents</span>
        <button className="btn btn-gh btn-sm" onClick={()=>setPage('documents')}>View all →</button>
      </div>
      <div style={{overflowX:'auto'}}>
        <table className="tbl">
          <thead><tr><th>#</th><th>Type</th><th>Client</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {!recent.length&&<tr><td colSpan={6} style={{textAlign:'center',color:T.grey400,padding:28}}>No documents yet</td></tr>}
            {recent.map(d=>(
              <tr key={d.id}>
                <td style={{fontWeight:700,color:T.navy}}>{d.number}</td>
                <td><span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:10,background:(d.type==='invoice'?ac:DT[d.type]?.color||T.navy)+'22',color:d.type==='invoice'?ac:DT[d.type]?.color||T.navy}}>{DT[d.type]?.label}</span></td>
                <td>{d.client_name}</td>
                <td style={{color:T.grey600,whiteSpace:'nowrap'}}>{fmtDate(d.date)}</td>
                <td style={{fontWeight:700}}>{fmtMoney(d.totals?.total,sym)}</td>
                <td><Badge status={d.status}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
}

// ── Line Items ─────────────────────────────────────────────────────────────────
function LineItems({items,setItems,vatReg,sym}){
  const add=()=>setItems([...items,{id:uid(),desc:'',qty:1,unit:'',rate:0,vatRate:vatReg?15:0,discount:0}])
  const rm=id=>setItems(items.filter(i=>i.id!==id))
  const upd=(id,k,v)=>setItems(items.map(i=>i.id===id?{...i,[k]:['desc','unit'].includes(k)?v:Number(v)}:i))
  const hasUnit=items.some(i=>i.unit)
  const hasDisc=items.some(i=>i.discount>0)
  const tots=calcTotals(items,vatReg)
  return <div>
    <div style={{overflowX:'auto',marginBottom:8}}>
      <table className="tbl" style={{minWidth:500}}>
        <thead><tr>
          <th style={{textAlign:'left'}}>Description</th>
          {hasUnit&&<th style={{width:65}}>Unit</th>}
          <th style={{width:55,textAlign:'right'}}>Qty</th>
          <th style={{width:90,textAlign:'right'}}>Rate</th>
          {hasDisc&&<th style={{width:60,textAlign:'right'}}>Disc%</th>}
          {vatReg&&<th style={{width:60,textAlign:'right'}}>VAT%</th>}
          <th style={{width:110,textAlign:'right',whiteSpace:'nowrap'}}>Amount</th>
          <th style={{width:28}}></th>
        </tr></thead>
        <tbody>
          {items.map(it=>{
            const net=it.qty*it.rate*(1-(it.discount||0)/100)
            return <tr key={it.id}>
              <td><textarea value={it.desc} onChange={e=>upd(it.id,'desc',e.target.value)} placeholder="Description (press Enter for new line)" className="inp" rows={2} style={{padding:'6px 8px',resize:'vertical',minHeight:36}}/></td>
              {hasUnit&&<td><input type="text" value={it.unit} onChange={e=>upd(it.id,'unit',e.target.value)} className="inp" style={{padding:'6px 6px'}}/></td>}
              <td><input type="number" value={it.qty} onChange={e=>upd(it.id,'qty',e.target.value)} className="inp" style={{padding:'6px 6px',textAlign:'right'}}/></td>
              <td><input type="number" value={it.rate} onChange={e=>upd(it.id,'rate',e.target.value)} className="inp" style={{padding:'6px 6px',textAlign:'right'}}/></td>
              {hasDisc&&<td><input type="number" value={it.discount||0} onChange={e=>upd(it.id,'discount',e.target.value)} className="inp" style={{padding:'6px 6px',textAlign:'right'}}/></td>}
              {vatReg&&<td><select value={it.vatRate} onChange={e=>upd(it.id,'vatRate',e.target.value)} className="inp" style={{padding:'6px 4px'}}><option value={0}>0%</option><option value={15}>15%</option></select></td>}
              <td style={{textAlign:'right',fontWeight:700,fontSize:12,whiteSpace:'nowrap'}}>{fmtMoney(net,sym)}</td>
              <td style={{textAlign:'center'}}><button onClick={()=>rm(it.id)} style={{background:'none',border:'none',color:T.red,fontSize:18,cursor:'pointer'}}>×</button></td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
    <button className="btn btn-gh btn-sm" onClick={add}>＋ Add line</button>
    <div style={{maxWidth:260,marginLeft:'auto',marginTop:14}}>
      {vatReg&&<>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:13}}><span style={{color:T.grey600}}>Subtotal (excl. VAT)</span><span>{fmtMoney(tots.subtotal,sym)}</span></div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:13}}><span style={{color:T.grey600}}>VAT (15%)</span><span>{fmtMoney(tots.vat,sym)}</span></div>
      </>}
      <div style={{height:1,background:T.grey200,margin:'8px 0'}}/>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:13,fontWeight:800,color:T.navy}}>
        <span>TOTAL DUE{vatReg?'':' (VAT Incl.)'}</span><span>{fmtMoney(tots.total,sym)}</span>
      </div>
    </div>
  </div>
}

const QUOTE_TC = `1. VALIDITY: This quotation is valid for 30 days from the date of issue.

2. ACCEPTANCE: Acceptance of this quotation constitutes agreement to these terms. Please confirm acceptance in writing or via email.

3. PAYMENT TERMS: A 50% deposit is required upon acceptance. The balance is due within 30 days of completion/delivery. EFT payment preferred.

4. LATE PAYMENT: Overdue accounts attract interest at 2% per month compounded monthly.

5. CANCELLATION: Cancellation after acceptance forfeits the deposit. Cancellation after commencement of work will be charged at the rate of work completed.

6. INTELLECTUAL PROPERTY: All work product remains the property of ${'{company}'} until payment is received in full.

7. CONFIDENTIALITY: Both parties agree to keep all business information shared during this engagement confidential.

8. GOVERNING LAW: This agreement is governed by the laws of the Republic of South Africa. Any disputes shall be resolved in the jurisdiction of the Western Cape High Court.

9. FORCE MAJEURE: Neither party shall be liable for delays caused by circumstances beyond their reasonable control.`

// ── Doc Form ───────────────────────────────────────────────────────────────────
function DocForm({doc,company,clients,docType,onSave,onClose,onConvertQuote}){
  const dt=DT[docType]||DT.invoice
  const nextNo=company?.next_nos?.[docType]||1
  const defaultTerms = docType==='invoice'
    ? 'Payment due within 30 days. EFT preferred. Overdue accounts attract interest at 2% per month.'
    : docType==='quote'
    ? QUOTE_TC.replace('${\'company\'}', company?.name||'the service provider')
    : ''
  const blank={number:`${dt.prefix}-${nextNo}`,status:'Draft',date:today(),due:docType==='invoice'?addDays(today(),30):docType==='quote'?addDays(today(),30):today(),client_id:'',client_name:'',client_address:'',client_vat:'',po_number:'',ref:'',notes:'',terms:defaultTerms}
  const [f,setF]=useState(doc||blank)
  const [items,setItems]=useState(doc?.items||[{id:uid(),desc:'',qty:1,unit:'',rate:0,vatRate:company?.vat_registered?15:0,discount:0}])
  const set=(k,v)=>setF(p=>({...p,[k]:v}))
  const sym=company?.currency_symbol||'R'
  const vatReg=company?.vat_registered
  const pickClient=cid=>{const cl=clients.find(c=>c.id===cid);if(!cl)return;set('client_id',cid);set('client_name',cl.name);set('client_address',cl.address||'');set('client_vat',cl.vat||'')}
  const save=()=>{
    if(!f.client_name?.trim()){alert('Client name required.');return}
    onSave({...f,items,totals:calcTotals(items,vatReg),type:docType,company_id:company.id})
  }
  const statuses=DST[docType]||['Draft','Sent']
  return <div>
    <div className="g2">
      <div className="field"><Lbl text="Document #"/><Inp value={f.number} onChange={v=>set('number',v)}/></div>
      <div className="field"><Lbl text="Status"/><Sel value={f.status} onChange={v=>set('status',v)} options={statuses.map(s=>({v:s,l:s}))}/></div>
      <div className="field"><Lbl text={docType==='invoice'?'Invoice Date':'Date'}/><Inp value={f.date} onChange={v=>set('date',v)} type="date"/></div>
      {(docType==='invoice'||docType==='quote')&&<div className="field"><Lbl text={docType==='invoice'?'Due Date':'Valid Until'}/><Inp value={f.due||''} onChange={v=>set('due',v)} type="date"/></div>}
      <div className="field"><Lbl text="Select Client"/><Sel value={f.client_id||''} onChange={pickClient} options={[{v:'',l:'— choose client —'},...clients.map(c=>({v:c.id,l:c.name}))]}/></div>
      <div className="field"><Lbl text="Client Name *"/><Inp value={f.client_name||''} onChange={v=>set('client_name',v)} placeholder="Or type manually"/></div>
      <div className="field s2"><Lbl text="Client Address"/><Inp value={f.client_address||''} onChange={v=>set('client_address',v)} rows={2}/></div>
      {vatReg&&<div className="field"><Lbl text="Client VAT No"/><Inp value={f.client_vat||''} onChange={v=>set('client_vat',v)}/></div>}
      <div className="field"><Lbl text="PO Number"/><Inp value={f.po_number||''} onChange={v=>set('po_number',v)} placeholder="Customer PO #"/></div>
      <div className="field"><Lbl text="Your Reference"/><Inp value={f.ref||''} onChange={v=>set('ref',v)}/></div>
    </div>
    <div style={{margin:'16px 0 10px',paddingTop:14,borderTop:`1px solid ${T.grey200}`}}>
      <div style={{fontSize:12,fontWeight:800,color:T.navy,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:10}}>Line Items</div>
      <LineItems items={items} setItems={setItems} vatReg={vatReg} sym={sym}/>
    </div>
    <div className="g2" style={{paddingTop:12,borderTop:`1px solid ${T.grey200}`,marginBottom:16}}>
      <div className="field"><Lbl text="Notes to Client"/><Inp value={f.notes||''} onChange={v=>set('notes',v)} rows={3} placeholder="Additional notes…"/></div>
      <div className="field"><Lbl text="Terms & Conditions"/><Inp value={f.terms||''} onChange={v=>set('terms',v)} rows={docType==='quote'?12:3}/></div>
    </div>
    <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:12,borderTop:`1px solid ${T.grey200}`,flexWrap:'wrap'}}>
      {docType==='quote'&&doc&&<Btn v="tl" onClick={()=>onConvertQuote(doc)}>Convert to Invoice</Btn>}
      <Btn v="s" onClick={onClose}>Cancel</Btn>
      <Btn v="p" onClick={save}>Save {dt.label}</Btn>
    </div>
  </div>
}

// ── Print Preview ─────────────────────────────────────────────────────────────
function DocPrint({doc,company,onBack}){
  const ac=coColor(company)
  const dt={...DT[doc.type]||DT.invoice,color:doc.type==='invoice'?ac:DT[doc.type]?.color||T.navy}
  const sym=company?.currency_symbol||'R'
  const vatReg=company?.vat_registered
  const banking=(company?.banking||[]).filter(b=>b.bank)
  const rows=(doc.items||[]).map(it=>({...it,net:it.qty*it.rate*(1-(it.discount||0)/100)}))
  const hasUnit=rows.some(r=>r.unit)
  const hasDisc=rows.some(r=>r.discount>0)
  const sc=SM[doc.status]||SM.Draft
  const tot=doc.totals||{subtotal:0,vat:0,total:0}

  const whatsapp=()=>{
    const msg=`Hi ${doc.client_name},\n\nPlease see ${dt.label} ${doc.number} from ${company?.name} for *${sym} ${Number(tot.total).toFixed(2)}*${doc.due?` due ${fmtDate(doc.due)}`:''} attached.\n\nReference: ${doc.number}\n\nKind regards,\n${company?.name}${company?.phone?'\n'+company.phone:''}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`)
  }
  const email=()=>{
    const sub=`${dt.label} ${doc.number} - ${company?.name}`
    const body=`Dear ${doc.client_name},\n\nPlease find ${dt.label} ${doc.number} attached.\n\nAmount: ${sym} ${Number(tot.total).toFixed(2)}${doc.due?`\nDue Date: ${fmtDate(doc.due)}`:''}\nReference: ${doc.number}\n\nBanking Details:\n${banking.map(b=>`Bank: ${b.bank}\nAccount Name: ${b.accountName}\nAccount No: ${b.accountNo}\nBranch Code: ${b.branchCode}`).join('\n')}\n\nKind regards,\n${company?.name}`
    window.open(`mailto:?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`)
  }
  const share=async()=>{
    if(navigator.share){
      try{
        await navigator.share({
          title:`${dt.label} ${doc.number}`,
          text:`${dt.label} ${doc.number} from ${company?.name} for ${sym} ${Number(tot.total).toFixed(2)}${doc.due?` due ${fmtDate(doc.due)}`:''}. Ref: ${doc.number}.`,
        })
      }catch(e){}
    } else {
      whatsapp()
    }
  }
  const isMobileDevice=()=>typeof navigator!=='undefined'&&/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent)

  return <div>
    <div className="no-print" style={{marginBottom:18}}>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',marginBottom:10}}>
        <Btn v="p" onClick={()=>window.print()}>🖨 Save as PDF</Btn>
        {isMobileDevice()
          ? <Btn v="tl" onClick={share}>📤 Share Invoice</Btn>
          : <>
              <Btn v="ok" onClick={email}>✉️ Email</Btn>
              <Btn v="tl" onClick={whatsapp}>💬 WhatsApp</Btn>
            </>
        }
        <Btn v="s" onClick={onBack}>← Back</Btn>
      </div>
      <div style={{background:'#FEF3C7',border:'1px solid #FDE68A',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#92400E',lineHeight:1.6}}>
        📎 <strong>To send with the invoice attached:</strong> First tap <strong>Save as PDF</strong> above, then open your WhatsApp or email app and attach the saved PDF from your files.
        {!isMobileDevice() && <span> In the print dialog, set <strong>Headers &amp; Footers to None</strong> to remove the URL and date.</span>}
      </div>
    </div>
    <div className="print-doc">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:26,paddingBottom:18,borderBottom:`3px solid ${dt.color}`}}>
        <div style={{maxWidth:260}}>
          {company?.logo&&<img src={company.logo} alt="" style={{maxHeight:90,maxWidth:220,objectFit:'contain',marginBottom:10,display:'block'}}/>}
          <div style={{fontWeight:800,fontSize:17,color:T.navy}}>{company?.name}</div>
          {company?.trading_as&&<div style={{fontSize:12,color:T.grey600}}>t/a {company.trading_as}</div>}
          <div style={{fontSize:12,color:'#374151',marginTop:4,lineHeight:1.6}}>
            {company?.address&&<div style={{whiteSpace:'pre-line'}}>{company.address}</div>}
            {company?.phone&&<div>{company.phone}</div>}
            {company?.email&&<div>{company.email}</div>}
          </div>
          <div style={{fontSize:11,color:'#374151',marginTop:5}}>
            {company?.reg&&<div>Reg: {company.reg}</div>}
            {vatReg&&company?.vat&&<div style={{fontWeight:700,color:T.navy}}>VAT Reg: {company.vat}</div>}
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:26,fontWeight:900,color:dt.color,textTransform:'uppercase',letterSpacing:'-.5px'}}>{dt.label}</div>
          <div style={{fontSize:16,fontWeight:800,color:T.navy,marginTop:3}}>{doc.number}</div>
          <div style={{fontSize:12,color:'#374151',marginTop:10,lineHeight:1.8}}>
            <div><span style={{color:'#374151'}}>Date: </span><strong>{fmtDate(doc.date)}</strong></div>
            {doc.due&&<div><span style={{color:'#374151'}}>{doc.type==='quote'?'Valid Until: ':'Due: '}</span><strong style={{color:doc.status==='Overdue'?T.red:T.grey800}}>{fmtDate(doc.due)}</strong></div>}
            {doc.po_number&&<div><span style={{color:'#374151'}}>PO #: </span><strong>{doc.po_number}</strong></div>}
            {doc.ref&&<div><span style={{color:'#374151'}}>Ref: </span><strong>{doc.ref}</strong></div>}
          </div>
        </div>
      </div>
      <div style={{marginBottom:22,padding:'12px 14px',background:T.grey50,borderRadius:8,borderLeft:`3px solid ${dt.color}`,maxWidth:270}}>
        <div style={{fontSize:10,fontWeight:800,color:'#374151',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:4}}>{doc.type==='delivery'?'Deliver To':'Bill To'}</div>
        <div style={{fontWeight:800,fontSize:14,color:T.navy}}>{doc.client_name}</div>
        {doc.client_address&&<div style={{fontSize:12,color:T.grey600,marginTop:3,whiteSpace:'pre-line'}}>{doc.client_address}</div>}
        {vatReg&&doc.client_vat&&<div style={{fontSize:11,color:T.grey400,marginTop:3}}>VAT: {doc.client_vat}</div>}
      </div>
      <table style={{width:'100%',borderCollapse:'collapse',marginBottom:16}}>
        <thead><tr style={{background:dt.color}}>
          <th style={{padding:'8px 8px',width:30,textAlign:'center',fontSize:11,fontWeight:700,color:'#fff',textTransform:'uppercase'}}>#</th>
          <th style={{padding:'8px 10px',textAlign:'left',fontSize:11,fontWeight:700,color:'#fff',textTransform:'uppercase'}}>Description</th>
          {hasUnit&&<th style={{padding:'8px 8px',width:55,textAlign:'center',fontSize:11,fontWeight:700,color:'#fff',textTransform:'uppercase'}}>Unit</th>}
          <th style={{padding:'8px 8px',width:45,textAlign:'right',fontSize:11,fontWeight:700,color:'#fff',textTransform:'uppercase'}}>Qty</th>
          <th style={{padding:'8px 8px',width:85,textAlign:'right',fontSize:11,fontWeight:700,color:'#fff',textTransform:'uppercase'}}>Price</th>
          {hasDisc&&<th style={{padding:'8px 8px',width:55,textAlign:'right',fontSize:11,fontWeight:700,color:'#fff',textTransform:'uppercase'}}>Disc</th>}
          {vatReg&&<th style={{padding:'8px 8px',width:50,textAlign:'right',fontSize:11,fontWeight:700,color:'#fff',textTransform:'uppercase'}}>VAT%</th>}
          <th style={{padding:'8px 10px',width:120,textAlign:'right',fontSize:11,fontWeight:700,color:'#fff',textTransform:'uppercase',whiteSpace:'nowrap'}}>Amount</th>
        </tr></thead>
        <tbody>
          {rows.map((it,i)=>(
            <tr key={it.id} style={{background:i%2===0?'#fff':'#EEF4FF',borderBottom:`2px solid ${T.grey200}`}}>
              <td style={{padding:'8px 8px',fontSize:11,textAlign:'center',color:T.grey400,fontWeight:700}}>{i+1}</td>
              <td style={{padding:'8px 10px',fontSize:12,whiteSpace:'pre-line'}}>{it.desc}</td>
              {hasUnit&&<td style={{padding:'8px 8px',fontSize:12,textAlign:'center',color:T.grey600}}>{it.unit}</td>}
              <td style={{padding:'8px 8px',fontSize:12,textAlign:'right'}}>{it.qty}</td>
              <td style={{padding:'8px 8px',fontSize:12,textAlign:'right',whiteSpace:'nowrap'}}>{fmtMoney(it.rate,sym)}</td>
              {hasDisc&&<td style={{padding:'8px 8px',fontSize:12,textAlign:'right',color:T.amber}}>{it.discount>0?`${it.discount}%`:'—'}</td>}
              {vatReg&&<td style={{padding:'8px 8px',fontSize:12,textAlign:'right'}}>{it.vatRate||0}%</td>}
              <td style={{padding:'8px 10px',fontSize:12,fontWeight:700,textAlign:'right',whiteSpace:'nowrap'}}>{fmtMoney(it.net,sym)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:20}}>
        <div style={{width:250}}>
          {vatReg&&<>
            <div style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${T.grey100}`,fontSize:12}}><span style={{color:T.grey600}}>Subtotal (excl. VAT)</span><span>{fmtMoney(tot.subtotal,sym)}</span></div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${T.grey100}`,fontSize:12}}><span style={{color:T.grey600}}>VAT (15%)</span><span>{fmtMoney(tot.vat,sym)}</span></div>
          </>}
          <div style={{display:'flex',justifyContent:'space-between',padding:'9px 10px',marginTop:4,background:dt.color,borderRadius:6}}>
            <span style={{fontSize:13,fontWeight:800,color:'#fff'}}>TOTAL{vatReg?' DUE':' DUE (VAT Incl.)'}</span>
            <span style={{fontSize:13,fontWeight:900,color:'#fff',whiteSpace:'nowrap'}}>{fmtMoney(tot.total,sym)}</span>
          </div>
        </div>
      </div>
      {doc.type!=='delivery'&&banking.length>0&&(
        <div style={{padding:'12px 14px',background:T.blueLt,borderRadius:8,marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:800,color:T.blue,textTransform:'uppercase',letterSpacing:'.8px',marginBottom:8}}>Banking Details</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>
            {banking.map(b=>(
              <div key={b.id} style={{fontSize:11,lineHeight:1.7,color:T.navy}}>
                {b.bank&&<div><b>Bank:</b> {b.bank}</div>}
                {b.accountName&&<div><b>Account Name:</b> {b.accountName}</div>}
                {b.accountNo&&<div><b>Account No:</b> {b.accountNo}</div>}
                {b.accountType&&<div><b>Type:</b> {b.accountType}</div>}
                {b.branchCode&&<div><b>Branch Code:</b> {b.branchCode}</div>}
                {b.swift&&<div><b>SWIFT:</b> {b.swift}</div>}
                {b.reference&&<div><b>Reference:</b> {b.reference}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {(doc.notes||doc.terms)&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:14}}>
          {doc.notes&&<div><div style={{fontSize:10,fontWeight:800,color:'#374151',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:3}}>Notes</div><div style={{fontSize:11,color:T.grey600,lineHeight:1.6}}>{doc.notes}</div></div>}
          {doc.terms&&<div><div style={{fontSize:10,fontWeight:800,color:'#374151',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:3}}>Terms &amp; Conditions</div><div style={{fontSize:11,color:T.grey600,lineHeight:1.7,whiteSpace:'pre-line'}}>{doc.terms}</div></div>}
        </div>
      )}
      <div style={{textAlign:'center',fontSize:10,color:'#374151',paddingTop:12,borderTop:`1px solid ${T.grey100}`}}>
        Thank you for your business · {company?.name}{vatReg&&company?.vat?` · VAT: ${company.vat}`:''}{ company?.reg?` · Reg: ${company.reg}`:''}
      </div>
    </div>
  </div>
}

// ── Documents ──────────────────────────────────────────────────────────────────
function Documents({docs,clients,company,onSave,onDelete,onStatusChange,initDocType,setInitDocType}){
  const [typeF,setTypeF]=useState(initDocType||'all')
  const [statF,setStatF]=useState('all')
  const [search,setSearch]=useState('')
  const [editing,setEditing]=useState(null)
  const [newType,setNewType]=useState(initDocType||null)
  const [preview,setPreview]=useState(null)
  const ac=coColor(company)
  useEffect(()=>{if(initDocType){setNewType(initDocType);setTypeF(initDocType);setInitDocType(null)}},[initDocType])
  const my=docs.filter(d=>d.company_id===company?.id)
  const sym=company?.currency_symbol||'R'
  const filtered=my.filter(d=>{
    if(typeF!=='all'&&d.type!==typeF)return false
    if(statF!=='all'&&d.status!==statF)return false
    if(search){const s=search.toLowerCase();if(!d.number.toLowerCase().includes(s)&&!d.client_name.toLowerCase().includes(s))return false}
    return true
  }).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
  const handleSave=doc=>{onSave(doc);setNewType(null);setEditing(null)}
  const convertQuote=async(quote)=>{
    if(!confirm('Convert this quote to a Tax Invoice?'))return
    const nextNo=company?.next_nos?.invoice||1
    onSave({...quote,id:undefined,type:'invoice',number:`INV-${nextNo}`,status:'Draft',date:today(),due:addDays(today(),30),linked_to:quote.id})
    setEditing(null);setNewType(null)
  }
  if(preview)return <DocPrint doc={preview} company={company} onBack={()=>setPreview(null)}/>
  const chipColor=type=>type==='invoice'?ac:DT[type]?.color||T.navy
  return <div>
    {(newType||editing)&&(
      <Modal title={editing?`Edit ${DT[editing.type]?.label}`:`New ${DT[newType]?.label}`} onClose={()=>{setNewType(null);setEditing(null)}} lg>
        <DocForm doc={editing} company={company} clients={clients} docType={editing?editing.type:newType} onSave={handleSave} onClose={()=>{setNewType(null);setEditing(null)}} onConvertQuote={convertQuote}/>
      </Modal>
    )}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:10}}>
      <div><h1 style={{fontSize:24,fontWeight:900,color:T.navy}}>Documents</h1><p style={{fontSize:13,color:T.grey600}}>{company?.name}</p></div>
      <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
        {DOC_TYPES.map(t=><Btn key={t.key} v="s" sz="sm" onClick={()=>setNewType(t.key)}>+ {t.label}</Btn>)}
      </div>
    </div>
    <div className="filter-bar">
      <input type="text" placeholder="Search # or client…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:180}}/>
      <select value={typeF} onChange={e=>setTypeF(e.target.value)}>
        <option value="all">All Types</option>
        {DOC_TYPES.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}
      </select>
      <select value={statF} onChange={e=>setStatF(e.target.value)}>
        <option value="all">All Statuses</option>
        {Object.keys(SM).map(s=><option key={s} value={s}>{s}</option>)}
      </select>
    </div>
    <div className="card0">
      <div style={{overflowX:'auto'}}>
        <table className="tbl">
          <thead><tr><th>#</th><th>Type</th><th>Client</th><th>Date</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {!filtered.length&&<tr><td colSpan={7} style={{textAlign:'center',color:T.grey400,padding:36}}>No documents found.</td></tr>}
            {filtered.map(d=>{
              const sc=SM[d.status]||SM.Draft;const cc=chipColor(d.type)
              return <tr key={d.id}>
                <td style={{fontWeight:800,color:T.navy}}>{d.number}</td>
                <td><span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:10,background:cc+'18',color:cc}}>{DT[d.type]?.label}</span></td>
                <td>{d.client_name}</td>
                <td style={{color:T.grey600,whiteSpace:'nowrap'}}>{fmtDate(d.date)}</td>
                <td style={{fontWeight:700,whiteSpace:'nowrap'}}>{fmtMoney(d.totals?.total,sym)}</td>
                <td><select value={d.status} onChange={e=>onStatusChange(d.id,e.target.value)} style={{border:'none',background:sc.bg,color:sc.fg,padding:'3px 8px',borderRadius:12,fontWeight:700,fontSize:11,cursor:'pointer'}}>{(DST[d.type]||['Draft','Sent']).map(s=><option key={s} value={s}>{s}</option>)}</select></td>
                <td><div style={{display:'flex',gap:5}}>
                  <Btn v="gh" sz="sm" onClick={()=>setPreview(d)}>👁</Btn>
                  <Btn v="s" sz="sm" onClick={()=>setEditing(d)}>Edit</Btn>
                  <Btn v="d" sz="sm" onClick={()=>confirm('Delete?')&&onDelete(d.id)}>✕</Btn>
                </div></td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
}

// ── Clients ────────────────────────────────────────────────────────────────────
function Clients({clients,docs,company,onSave,onDelete}){
  const blank={name:'',email:'',phone:'',address:'',vat:'',vat_registered:false,notes:''}
  const [form,setForm]=useState(null)
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  const sym=company?.currency_symbol||'R'
  const save=()=>{if(!form.name?.trim()){alert('Client name required.');return}onSave(form);setForm(null)}
  return <div>
    {form&&(
      <Modal title={form.id?'Edit Client':'New Client'} onClose={()=>setForm(null)}>
        <div className="g2">
          <div className="field s2"><Lbl text="Client Name" req/><Inp value={form.name} onChange={v=>set('name',v)}/></div>
          <div className="field"><Lbl text="Email"/><Inp value={form.email||''} onChange={v=>set('email',v)} type="email"/></div>
          <div className="field"><Lbl text="Phone"/><Inp value={form.phone||''} onChange={v=>set('phone',v)}/></div>
          <div className="field s2"><Lbl text="Address"/><Inp value={form.address||''} onChange={v=>set('address',v)} rows={2}/></div>
        </div>
        <div className="vat-row">
          <input type="checkbox" id="clvr" checked={!!form.vat_registered} onChange={e=>set('vat_registered',e.target.checked)}/>
          <label htmlFor="clvr">Client is VAT registered</label>
        </div>
        {form.vat_registered&&<div className="field"><Lbl text="Client VAT Number"/><Inp value={form.vat||''} onChange={v=>set('vat',v)}/></div>}
        <div className="field"><Lbl text="Notes"/><Inp value={form.notes||''} onChange={v=>set('notes',v)} rows={2}/></div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:12,borderTop:`1px solid ${T.grey200}`}}>
          <Btn v="s" onClick={()=>setForm(null)}>Cancel</Btn>
          <Btn v="p" onClick={save}>Save Client</Btn>
        </div>
      </Modal>
    )}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
      <h1 style={{fontSize:24,fontWeight:900,color:T.navy}}>Clients</h1>
      <Btn v="p" onClick={()=>setForm({...blank})}>+ New Client</Btn>
    </div>
    {!clients.length&&<div className="card" style={{textAlign:'center',padding:'44px 0'}}>
      <div style={{fontSize:38,marginBottom:10}}>👥</div>
      <div style={{color:T.grey400,marginBottom:14}}>No clients yet.</div>
      <Btn v="p" onClick={()=>setForm({...blank})}>Add first client</Btn>
    </div>}
    <div className="cl-grid">
      {clients.map(cl=>{
        const invCount=docs.filter(d=>d.client_id===cl.id&&d.type==='invoice').length
        const rev=docs.filter(d=>d.client_id===cl.id&&d.status==='Paid').reduce((s,d)=>s+(d.totals?.total||0),0)
        return <div key={cl.id} className="card">
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
            <div style={{width:40,height:40,borderRadius:'50%',background:T.navy,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:16}}>{(cl.name||'?')[0].toUpperCase()}</div>
            <div style={{display:'flex',gap:6}}><Btn v="s" sz="sm" onClick={()=>setForm({...cl})}>Edit</Btn><Btn v="d" sz="sm" onClick={()=>confirm(`Delete ${cl.name}?`)&&onDelete(cl.id)}>✕</Btn></div>
          </div>
          <div style={{fontWeight:800,fontSize:14,color:T.navy}}>{cl.name}</div>
          {cl.email&&<div style={{fontSize:12,color:T.grey600,marginTop:2}}>{cl.email}</div>}
          {cl.phone&&<div style={{fontSize:12,color:T.grey600}}>{cl.phone}</div>}
          {cl.vat_registered&&cl.vat&&<div style={{fontSize:11,color:T.teal,fontWeight:700,marginTop:3}}>VAT: {cl.vat}</div>}
          <div style={{display:'flex',gap:18,marginTop:12,paddingTop:10,borderTop:`1px solid ${T.grey100}`}}>
            <div><div style={{fontSize:10,color:T.grey400,fontWeight:700,textTransform:'uppercase'}}>Invoices</div><div style={{fontWeight:800,color:T.navy}}>{invCount}</div></div>
            <div><div style={{fontSize:10,color:T.grey400,fontWeight:700,textTransform:'uppercase'}}>Paid Revenue</div><div style={{fontWeight:800,color:T.green}}>{fmtMoney(rev,sym)}</div></div>
          </div>
        </div>
      })}
    </div>
  </div>
}

// ── Companies ──────────────────────────────────────────────────────────────────
function Companies({companies,activeCoId,onSave,onDelete,setActiveCoId}){
  const blank={name:'',trading_as:'',reg:'',vat:'',vat_registered:false,address:'',email:'',phone:'',website:'',logo:null,accent_color:'#0D1F3C',banking:[{id:uid(),bank:'',accountName:'',accountNo:'',accountType:'',branchCode:'',swift:'',reference:''}],currency_symbol:'R',next_nos:{invoice:1001,quote:101,delivery:501,credit:201,receipt:801}}
  const [form,setForm]=useState(null)
  const [banking,setBanking]=useState([])
  const logoRef=useRef()
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  const open=co=>{const f=co?JSON.parse(JSON.stringify(co)):{...blank,id:undefined};setForm(f);setBanking(f.banking?.length?f.banking:[{id:uid(),bank:'',accountName:'',accountNo:'',accountType:'',branchCode:'',swift:'',reference:''}])}
  const updBank=(id,k,v)=>setBanking(b=>b.map(x=>x.id===id?{...x,[k]:v}:x))
  const addBank=()=>setBanking(b=>[...b,{id:uid(),bank:'',accountName:'',accountNo:'',accountType:'',branchCode:'',swift:'',reference:''}])
  const rmBank=id=>setBanking(b=>b.filter(x=>x.id!==id))
  const handleLogo=e=>{const file=e.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=ev=>set('logo',ev.target.result);r.readAsDataURL(file)}
  const save=()=>{if(!form.name?.trim()){alert('Company name required.');return}onSave({...form,banking});setForm(null)}
  const bankFields=[['bank','Bank Name'],['accountName','Account Name'],['accountNo','Account Number'],['accountType','Account Type'],['branchCode','Branch Code'],['swift','SWIFT / BIC'],['reference','Default Reference']]
  const PRESET_COLORS=['#0D1F3C','#1E6FD9','#0BA89A','#16A34A','#DC2626','#D97706','#7C3AED','#DB2777','#0F766E','#1D4ED8']

  return <div>
    {form&&(
      <Modal title={form.id?'Edit Company':'New Company'} onClose={()=>setForm(null)} lg>
        <div className="g2">
          <div className="field s2">
            <Lbl text="Company Logo"/>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              {form.logo?<img src={form.logo} alt="logo" style={{height:56,maxWidth:160,objectFit:'contain',border:`1px solid ${T.grey200}`,borderRadius:8,padding:4}}/>:<div style={{width:56,height:56,borderRadius:8,background:T.grey100,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>🏢</div>}
              <Btn v="s" sz="sm" onClick={()=>logoRef.current.click()}>Upload Logo</Btn>
              {form.logo&&<Btn v="d" sz="sm" onClick={()=>set('logo',null)}>Remove</Btn>}
            </div>
            <input ref={logoRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleLogo}/>
          </div>
          <div className="field s2">
            <Lbl text="Brand / Accent Colour"/>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
              {PRESET_COLORS.map(c=>(
                <button key={c} onClick={()=>set('accent_color',c)}
                  style={{width:28,height:28,borderRadius:'50%',background:c,border:form.accent_color===c?`3px solid ${T.grey800}`:'3px solid transparent',cursor:'pointer'}}/>
              ))}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <input type="color" value={form.accent_color||'#0D1F3C'} onChange={e=>set('accent_color',e.target.value)} style={{width:40,height:36,border:'none',cursor:'pointer',borderRadius:6}}/>
              <span style={{fontSize:12,color:T.grey600}}>Or pick a custom colour</span>
            </div>
          </div>
          <div className="field"><Lbl text="Company Name" req/><Inp value={form.name} onChange={v=>set('name',v)}/></div>
          <div className="field"><Lbl text="Trading As"/><Inp value={form.trading_as||''} onChange={v=>set('trading_as',v)}/></div>
          <div className="field"><Lbl text="Registration No"/><Inp value={form.reg||''} onChange={v=>set('reg',v)}/></div>
          <div className="field"><Lbl text="Currency Symbol"/><Inp value={form.currency_symbol||'R'} onChange={v=>set('currency_symbol',v)}/></div>
          <div className="vat-row s2">
            <input type="checkbox" id="coVat" checked={!!form.vat_registered} onChange={e=>set('vat_registered',e.target.checked)}/>
            <label htmlFor="coVat">This company is VAT registered</label>
          </div>
          {form.vat_registered&&<div className="field"><Lbl text="VAT Registration Number"/><Inp value={form.vat||''} onChange={v=>set('vat',v)} placeholder="4XXXXXXXXXX"/></div>}
          <div className="field s2"><Lbl text="Address"/><Inp value={form.address||''} onChange={v=>set('address',v)} rows={2}/></div>
          <div className="field"><Lbl text="Email"/><Inp value={form.email||''} onChange={v=>set('email',v)} type="email"/></div>
          <div className="field"><Lbl text="Phone"/><Inp value={form.phone||''} onChange={v=>set('phone',v)}/></div>
          <div className="field"><Lbl text="Website"/><Inp value={form.website||''} onChange={v=>set('website',v)}/></div>
        </div>
        <div style={{paddingTop:16,borderTop:`1px solid ${T.grey200}`,marginTop:4}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <span style={{fontSize:12,fontWeight:800,color:T.navy,textTransform:'uppercase',letterSpacing:'.5px'}}>Banking Details</span>
            <Btn v="gh" sz="sm" onClick={addBank}>+ Add account</Btn>
          </div>
          {banking.map((b,i)=>(
            <div key={b.id} className="bank-blk">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <span style={{fontSize:12,fontWeight:700,color:T.grey600}}>Account {i+1}</span>
                {banking.length>1&&<Btn v="d" sz="sm" onClick={()=>rmBank(b.id)}>Remove</Btn>}
              </div>
              <div className="g2">
                {bankFields.map(([k,l])=>(
                  <div key={k} className="field"><Lbl text={l}/><Inp value={b[k]||''} onChange={v=>updBank(b.id,k,v)}/></div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:14,borderTop:`1px solid ${T.grey200}`,marginTop:14}}>
          <Btn v="s" onClick={()=>setForm(null)}>Cancel</Btn>
          <Btn v="p" onClick={save}>Save Company</Btn>
        </div>
      </Modal>
    )}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
      <h1 style={{fontSize:24,fontWeight:900,color:T.navy}}>Companies</h1>
      <Btn v="p" onClick={()=>open(null)}>+ New Company</Btn>
    </div>
    <div className="co-grid">
      {companies.map(co=>(
        <div key={co.id} className="card" style={{border:co.id===activeCoId?`2px solid ${co.accent_color||T.blue}`:`1px solid ${T.grey200}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
            <div style={{width:46,height:46,borderRadius:10,background:co.logo?'transparent':co.accent_color||T.navy,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:18,overflow:'hidden'}}>
              {co.logo?<img src={co.logo} alt="" style={{width:'100%',height:'100%',objectFit:'contain'}}/>:(co.name||'?')[0]}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {co.id===activeCoId&&<span className="badge" style={{background:T.blueLt,color:T.blue,fontSize:10,textTransform:'uppercase'}}>Active</span>}
              <div style={{width:14,height:14,borderRadius:'50%',background:co.accent_color||T.navy}}/>
            </div>
          </div>
          <div style={{fontWeight:800,fontSize:14,color:T.navy}}>{co.name}</div>
          {co.trading_as&&<div style={{fontSize:12,color:T.grey600}}>t/a {co.trading_as}</div>}
          {co.reg&&<div style={{fontSize:11,color:T.grey400,marginTop:3}}>Reg: {co.reg}</div>}
          {co.vat_registered&&co.vat&&<div style={{fontSize:11,color:T.teal,fontWeight:700}}>VAT: {co.vat}</div>}
          {co.banking?.[0]?.bank&&<div style={{fontSize:11,color:T.grey600,marginTop:3}}>🏦 {co.banking[0].bank}</div>}
          <div style={{display:'flex',gap:7,marginTop:12,paddingTop:10,borderTop:`1px solid ${T.grey100}`,flexWrap:'wrap'}}>
            {co.id!==activeCoId&&<Btn v="tl" sz="sm" onClick={()=>setActiveCoId(co.id)}>Set Active</Btn>}
            <Btn v="s" sz="sm" onClick={()=>open(co)}>Edit</Btn>
            {companies.length>1&&<Btn v="d" sz="sm" onClick={()=>confirm(`Delete ${co.name}?`)&&onDelete(co.id)}>Delete</Btn>}
          </div>
        </div>
      ))}
    </div>
  </div>
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function Dashboard(){
  const [user,setUser]=useState(undefined)
  const [page,setPage]=useState('dashboard')
  const [companies,setCompanies]=useState([])
  const [clients,setClients]=useState([])
  const [docs,setDocs]=useState([])
  const [activeCoId,setActiveCoId]=useState(null)
  const [toast,setToast]=useState(null)
  const [loading,setLoading]=useState(true)
  const [sidebarOpen,setSidebarOpen]=useState(false)
  const [isMobile,setIsMobile]=useState(false)
  const [newDocType,setNewDocType]=useState(null)
  const [subscription,setSubscription]=useState(null)

  useEffect(()=>{
    const style=document.createElement('style');style.textContent=CSS;document.head.appendChild(style)
    const mq=window.matchMedia('(max-width:768px)');setIsMobile(mq.matches);mq.addEventListener('change',e=>setIsMobile(e.matches))
    return()=>document.head.removeChild(style)
  },[])

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(!session?.user){window.location.href='/';return}
      setUser(session.user);loadAll(session.user)
    })
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{
      if(!session?.user){window.location.href='/';return}
      setUser(session.user);loadAll(session.user)
    })
    return()=>subscription.unsubscribe()
  },[])

  const loadAll=async(u)=>{
    setLoading(true)
    const [cos,cls,ds,sub]=await Promise.all([
      supabase.from('companies').select('*').eq('user_id',u.id).order('created_at'),
      supabase.from('clients').select('*').eq('user_id',u.id).order('name'),
      supabase.from('documents').select('*').eq('user_id',u.id).order('created_at',{ascending:false}),
      supabase.from('subscriptions').select('*').eq('user_id',u.id).single(),
    ])
    const coList=cos.data||[]
    setCompanies(coList);setClients(cls.data||[]);setDocs(ds.data||[])
    setSubscription(sub.data||null)
    if(coList.length)setActiveCoId(coList[0].id)
    setLoading(false)
  }

  const notify=msg=>setToast(msg)
  const company=companies.find(c=>c.id===activeCoId)||companies[0]
  const signOut=async()=>{await supabase.auth.signOut();window.location.href='/'}

  // CRUD
  const saveDoc=async(doc)=>{
    const co=company;const isNew=!doc.id
    const payload={user_id:user.id,company_id:doc.company_id,type:doc.type,number:doc.number,status:doc.status,date:doc.date,due:doc.due||null,client_id:doc.client_id||null,client_name:doc.client_name,client_address:doc.client_address||'',client_vat:doc.client_vat||'',po_number:doc.po_number||'',ref:doc.ref||'',items:doc.items,notes:doc.notes||'',terms:doc.terms||'',totals:doc.totals,linked_to:doc.linked_to||null}
    if(isNew){
      const {data,error}=await supabase.from('documents').insert(payload).select().single()
      if(error){notify('Error: '+error.message);return}
      setDocs(d=>[data,...d])
      const newNos={...(co.next_nos||{}),[doc.type]:((co.next_nos||{})[doc.type]||1)+1}
      await supabase.from('companies').update({next_nos:newNos}).eq('id',co.id)
      setCompanies(c=>c.map(x=>x.id===co.id?{...x,next_nos:newNos}:x))
    }else{
      const {data,error}=await supabase.from('documents').update(payload).eq('id',doc.id).select().single()
      if(error){notify('Error: '+error.message);return}
      setDocs(d=>d.map(x=>x.id===doc.id?data:x))
    }
    notify('Document saved')
  }
  const deleteDoc=async(id)=>{await supabase.from('documents').delete().eq('id',id);setDocs(d=>d.filter(x=>x.id!==id));notify('Deleted')}
  const changeStatus=async(id,status)=>{await supabase.from('documents').update({status}).eq('id',id);setDocs(d=>d.map(x=>x.id===id?{...x,status}:x))}
  const saveClient=async(cl)=>{
    const isNew=!cl.id
    const payload={user_id:user.id,name:cl.name,email:cl.email||'',phone:cl.phone||'',address:cl.address||'',vat:cl.vat||'',vat_registered:cl.vat_registered||false,notes:cl.notes||''}
    if(isNew){const {data}=await supabase.from('clients').insert(payload).select().single();setClients(c=>[data,...c].sort((a,b)=>a.name.localeCompare(b.name)))}
    else{const {data}=await supabase.from('clients').update(payload).eq('id',cl.id).select().single();setClients(c=>c.map(x=>x.id===cl.id?data:x))}
    notify('Client saved')
  }
  const deleteClient=async(id)=>{await supabase.from('clients').delete().eq('id',id);setClients(c=>c.filter(x=>x.id!==id));notify('Client deleted')}
  const saveCompany=async(co)=>{
    const isNew=!co.id
    const payload={user_id:user.id,name:co.name,trading_as:co.trading_as||'',reg:co.reg||'',vat:co.vat||'',vat_registered:co.vat_registered||false,address:co.address||'',email:co.email||'',phone:co.phone||'',website:co.website||'',logo:co.logo||null,accent_color:co.accent_color||T.navy,currency_symbol:co.currency_symbol||'R',banking:co.banking||[],next_nos:co.next_nos||{invoice:1001,quote:101,delivery:501,credit:201,receipt:801}}
    if(isNew){const {data}=await supabase.from('companies').insert(payload).select().single();setCompanies(c=>[...c,data]);if(!activeCoId)setActiveCoId(data.id)}
    else{const {data}=await supabase.from('companies').update(payload).eq('id',co.id).select().single();setCompanies(c=>c.map(x=>x.id===co.id?data:x))}
    notify('Company saved')
  }
  const deleteCompany=async(id)=>{await supabase.from('companies').delete().eq('id',id);const r=companies.filter(c=>c.id!==id);setCompanies(r);if(activeCoId===id)setActiveCoId(r[0]?.id)}

  if(user===undefined||loading)return <div className="loading"><div className="spinner"/><span style={{color:T.grey400}}>Loading Invoxa…</span></div>

  // Subscription access check
  const access=checkAccess(subscription)

  if(!access.active&&companies.length>0){
    return <div className="expired-wall">
      <div style={{fontSize:48,marginBottom:8}}>⏰</div>
      <h1 style={{fontSize:28,fontWeight:900,color:T.navy,letterSpacing:'-1px'}}>Your trial has ended</h1>
      <p style={{color:T.grey600,fontSize:16,maxWidth:440,lineHeight:1.6}}>Your 14-day free trial of Invoxa has expired. Subscribe to continue accessing your documents and creating new ones.</p>
      <div style={{background:T.white,border:`1px solid ${T.grey200}`,borderRadius:12,padding:'24px 32px',textAlign:'center',marginTop:8}}>
        <div style={{fontSize:36,fontWeight:900,color:T.navy}}>R149<span style={{fontSize:16,fontWeight:500,color:T.grey600}}>/month</span></div>
        <p style={{color:T.grey600,fontSize:13,margin:'8px 0 16px'}}>All features · Unlimited documents · Cloud sync</p>
        <a href={`mailto:ndyoko.lwazi@gmail.com?subject=Invoxa Subscription&body=Hi, I would like to subscribe to Invoxa at R149/month. My account email is: ${user?.email}`}
          style={{display:'inline-block',background:T.blue,color:'#fff',padding:'12px 28px',borderRadius:9,fontWeight:700,fontSize:14,textDecoration:'none'}}>
          Subscribe via Email →
        </a>
      </div>
      <button onClick={signOut} style={{marginTop:16,background:'none',border:'none',color:T.grey400,fontSize:13,cursor:'pointer'}}>Sign out</button>
    </div>
  }

  if(!companies.length&&!loading){
    return <div className="expired-wall">
      <div style={{fontSize:40,marginBottom:16}}>🏢</div>
      <div style={{fontWeight:800,fontSize:20,color:T.navy,marginBottom:8}}>Welcome to Invoxa</div>
      <div style={{color:T.grey600,marginBottom:24,textAlign:'center',maxWidth:380}}>Let's set up your first company to get started.</div>
      <Companies companies={[]} activeCoId={null} onSave={saveCompany} onDelete={()=>{}} setActiveCoId={setActiveCoId}/>
    </div>
  }

  const pages={
    dashboard:<DashboardView docs={docs} company={company} setPage={setPage} setNewDocType={setNewDocType}/>,
    documents:<Documents docs={docs} clients={clients} company={company} onSave={saveDoc} onDelete={deleteDoc} onStatusChange={changeStatus} initDocType={newDocType} setInitDocType={setNewDocType}/>,
    clients:<Clients clients={clients} docs={docs} company={company} onSave={saveClient} onDelete={deleteClient}/>,
    companies:<Companies companies={companies} activeCoId={activeCoId} onSave={saveCompany} onDelete={deleteCompany} setActiveCoId={setActiveCoId}/>,
  }

  return <div className="layout">
    <Sidebar page={page} setPage={setPage} companies={companies} activeCoId={activeCoId} setActiveCoId={setActiveCoId} user={user} onSignOut={signOut} mobile={isMobile} open={sidebarOpen} setOpen={setSidebarOpen}/>
    <div className="main">
      {access.trial&&access.daysLeft<=5&&(
        <div className="trial-bar no-print">
          ⏳ {access.daysLeft} day{access.daysLeft!==1?'s':''} left in your free trial.
          <a href={`mailto:ndyoko.lwazi@gmail.com?subject=Invoxa Subscription&body=Hi, I would like to subscribe to Invoxa. My account email is: ${user?.email}`}>Subscribe now for R149/month →</a>
        </div>
      )}
      <div className="topbar no-print">
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {isMobile&&<button className="mob-toggle" onClick={()=>setSidebarOpen(true)}>☰</button>}
          <div>
            <span style={{fontWeight:700,fontSize:13,color:T.navy}}>{company?.name}</span>
            {company?.vat_registered&&<span style={{fontSize:10,color:T.teal,marginLeft:7,fontWeight:700}}>VAT Registered</span>}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:11,color:T.green,fontWeight:700}}>● Cloud Synced</span>
          {access.trial&&<span style={{fontSize:11,color:T.amber,fontWeight:700}}>Trial: {access.daysLeft}d left</span>}
          {!access.trial&&access.active&&<span style={{fontSize:11,color:T.green,fontWeight:700}}>✓ Active</span>}
        </div>
      </div>
      <div className="content">{pages[page]||pages.dashboard}</div>
    </div>
    {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
  </div>
}
