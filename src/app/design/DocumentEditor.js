'use client'
import {useState} from 'react'
import {REGIONS} from './BusinessSetup'
import {calculateItems,documentError,localDate} from './documentModel'

export default function DocumentEditor({initial,config,client,documentType='Invoice',onClose,onReview,onSave,message}){
 const workspace=initial?.workspace||config
 const region=REGIONS.find(r=>r[0]===workspace.region)||REGIONS[0]
 const [kind,setKind]=useState(initial?.id?.startsWith('QUO')?'Quotation':documentType)
 const [id]=useState(initial?.id||crypto.randomUUID().slice(0,8).toUpperCase())
 const [name,setName]=useState(initial?.name||client?.name||'')
 const [contact,setContact]=useState(initial?.customer||client||{email:'',phone:'',address:'',vat:''})
 const [date,setDate]=useState(initial?.date||localDate()),[due,setDue]=useState(initial?.due||localDate())
 const [terms,setTerms]=useState(initial?.terms??workspace.terms??''),[notes,setNotes]=useState(initial?.notes||'')
 const [vatRegistered,setVatRegistered]=useState(!!workspace.vat_registered),[vatNumber,setVatNumber]=useState(workspace.vat||'')
 const [items,setItems]=useState(initial?.items||[{id:crypto.randomUUID(),desc:initial?.detail||'',qty:1,rate:initial?.amount||'',discount:0,vatRate:15}])
 const [error,setError]=useState('')
 const totals=calculateItems(items,vatRegistered)
 const money=n=>new Intl.NumberFormat(region[3],{style:'currency',currency:region[2]}).format(n)
 const update=(id,key,value)=>setItems(all=>all.map(item=>item.id===id?{...item,[key]:value}:item))
 const submit=review=>{
  const snapshot={...workspace,vat_registered:vatRegistered,vat:vatNumber}
  const record={...initial,id:initial?.id||`${kind==='Quotation'?'QUO':'INV'}-DEMO-${id}`,name:name.trim(),customer:{...contact,name:name.trim()},date,due,terms,notes,items:items.map(i=>({...i,qty:Number(i.qty),rate:Number(i.rate),discount:Number(i.discount),vatRate:Number(i.vatRate)})),amount:totals.total,totals,workspace:snapshot,currency:region[2],detail:`${items[0]?.desc||'Services'} · ${kind}`,status:'Draft',editable:true}
  const problem=documentError(record)
  if(problem){setError(problem);return}
  setError('');review?onReview(record):onSave(record)
 }
 return <div className="overlay"><section className="sheet" role="dialog" aria-modal="true" aria-label="Document editor"><div className="sheethead"><h2>{initial?'Edit draft':'New document'}</h2><button className="iconbtn" aria-label="Close editor" onClick={onClose}>×</button></div><p className="sub">Sample draft · Prices exclude VAT · Saved on this device</p>
 <label className="formfield">Document type<select value={kind} disabled={!!initial} onChange={e=>setKind(e.target.value)}><option>Invoice</option><option>Quotation</option></select></label>
 <label className="formfield">Customer / tenant name<input value={name} onChange={e=>setName(e.target.value)} maxLength={120}/></label>
 {['email','phone','address','vat'].map(key=><label className="formfield" key={key}>{({email:'Customer email',phone:'Phone',address:'Billing address',vat:'Customer VAT number (optional)'})[key]}<input type={key==='email'?'email':key==='phone'?'tel':'text'} value={contact[key]||''} maxLength={key==='address'?300:120} onChange={e=>setContact(c=>({...c,[key]:e.target.value}))}/></label>)}
 <div className="sectiongrid"><label className="formfield">Issue date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label className="formfield">{kind==='Quotation'?'Valid until':'Due date'}<input type="date" value={due} min={date} onChange={e=>setDue(e.target.value)}/></label></div>
 {region[0]==='ZA'&&<label style={{display:'flex',gap:10,alignItems:'center',margin:'16px 0'}}><input type="checkbox" checked={vatRegistered} onChange={e=>setVatRegistered(e.target.checked)}/>Supplier is VAT registered (sample)</label>}
 {vatRegistered&&<label className="formfield">Supplier VAT registration number<input value={vatNumber} onChange={e=>setVatNumber(e.target.value)} maxLength={30}/></label>}
 <h3 style={{fontSize:16,marginTop:20}}>Line items · {region[2]}</h3>
 {items.map((item,index)=><section className="panel person" key={item.id} style={{marginTop:12}}><div className="sheethead"><strong>Item {index+1}</strong><button className="textbtn" disabled={items.length===1} onClick={()=>setItems(all=>all.filter(i=>i.id!==item.id))}>Remove</button></div><label className="formfield">Description<input value={item.desc} maxLength={500} onChange={e=>update(item.id,'desc',e.target.value)}/></label><div className="sectiongrid">{[['qty','Quantity'],['rate','Unit price'],['discount','Discount %'],...(vatRegistered?[['vatRate','VAT %']]:[])].map(([key,label])=><label key={key} className="formfield">{label}<input type="number" inputMode="decimal" min="0" max={key==='discount'||key==='vatRate'?100:undefined} step="any" value={item[key]} onChange={e=>update(item.id,key,e.target.value)}/></label>)}</div><strong>Line total: {money((totals.rows[index]?.net||0)+(totals.rows[index]?.tax||0))}</strong></section>)}
 <button className="secondary" onClick={()=>setItems(all=>[...all,{id:crypto.randomUUID(),desc:'',qty:1,rate:'',discount:0,vatRate:15}])}>+ Add line item</button>
 <div className="paperline"><span>Discount</span><strong>{money(totals.discount)}</strong></div><div className="paperline"><span>Subtotal after discount</span><strong>{money(totals.subtotal)}</strong></div>{vatRegistered&&<div className="paperline"><span>VAT</span><strong>{money(totals.vat)}</strong></div>}<div className="papertotal"><span>Total</span><strong>{money(totals.total)}</strong></div>
 <label className="formfield">Payment terms<textarea rows={3} style={{font:'inherit',padding:12,border:'1px solid #e1e8e3',borderRadius:8}} value={terms} maxLength={2000} onChange={e=>setTerms(e.target.value)}/></label><label className="formfield">Notes<input value={notes} maxLength={1000} onChange={e=>setNotes(e.target.value)}/></label>
 {(error||message)&&<p role="status" className="status">{error||message}</p>}<div className="sheetactions"><button className="secondary" onClick={()=>submit(true)}>Review document</button><button className="primary" onClick={()=>submit(false)}>Save draft</button></div></section></div>
}
