// Sample records only. This store never connects to Supabase.
import {calculateItems,documentError,localDate,documentBalance} from './documentModel'
export const DEMO_STORE_KEY='myinvox.design.drafts.v1'

export function loadDemoStore(storage){
  const raw=storage.getItem(DEMO_STORE_KEY)
  if(!raw)return {documents:[],config:null,customers:[],payments:[]}
  const data=JSON.parse(raw)
  if(data.version!==1||!Array.isArray(data.documents))throw new Error('Unrecognised sample storage')
  if(!data.documents.every(d=>typeof d.id==='string'&&typeof d.name==='string'&&Number.isFinite(d.amount)&&d.amount>0&&['Draft','Finalised','Accepted','Issued','Sent','Declined'].includes(d.status)&&d.demoSaved===true))throw new Error('Invalid sample documents')
  if(data.payments&&!Array.isArray(data.payments))throw new Error('Invalid sample payments')
  if(!(data.payments||[]).every(p=>typeof p.id==='string'&&typeof p.invoiceId==='string'&&Number.isFinite(p.amount)&&p.amount>0))throw new Error('Invalid sample payments')
  return {...data,customers:data.customers||[],payments:data.payments||[]}
}

export function saveDemoDraft(storage,record,config){
  const {baseStatus,paid,balance,overdue,paymentHistory,...source}=record
  record=source
  if(record.items){const error=documentError(record);if(error)throw new Error(error);const totals=calculateItems(record.items,record.workspace?.vat_registered);record={...record,totals,amount:totals.total}}
  if(!record.name?.trim()||!Number.isFinite(record.amount)||record.amount<=0)throw new Error('Enter a customer and a valid amount')
  const existing=loadDemoStore(storage)
  const previous=existing.documents.find(d=>d.id===record.id)
  if(previous&&previous.status!=='Draft')throw new Error('Only drafts can be edited. Repeat this document to prepare a new version.')
  const saved={...record,name:record.name.trim(),status:'Draft',demoSaved:true,workspace:record.workspace||{...config},currency:record.currency||'ZAR',updatedAt:new Date().toISOString()}
  const documents=[saved,...existing.documents.filter(d=>d.id!==saved.id)]
  // Set storage before reporting success; private browsing/quota errors must surface.
  storage.setItem(DEMO_STORE_KEY,JSON.stringify({...existing,version:1,documents,config}))
  return {saved,documents}
}

export function saveDemoConfig(storage,config){
  const existing=loadDemoStore(storage)
  storage.setItem(DEMO_STORE_KEY,JSON.stringify({...existing,version:1,config}))
}

export function saveDemoCustomer(storage,customer){
 if(!customer.name?.trim())throw new Error('Customer name required')
 const existing=loadDemoStore(storage)
 const match=existing.customers.find(c=>c.id===customer.id||c.name.toLowerCase()===customer.name.trim().toLowerCase())
 const previousNames=Array.from(new Set([...(match?.previousNames||[]),...(match&&match.name!==customer.name.trim()?[match.name]:[])]))
 const saved={...customer,name:customer.name.trim(),id:match?.id||customer.id,previousNames}
 const customers=[saved,...existing.customers.filter(c=>c.id!==saved.id)]
 storage.setItem(DEMO_STORE_KEY,JSON.stringify({...existing,version:1,customers}))
 return {saved,customers}
}

export function transitionDemoDocument(storage,id,nextStatus){
 const existing=loadDemoStore(storage),record=existing.documents.find(d=>d.id===id)
 if(!record)throw new Error('Save the draft before changing its status.')
 const allowed=record.id.startsWith('QUO')?{Draft:['Finalised'],Finalised:['Sent','Accepted','Declined'],Sent:['Accepted','Declined']}:{Draft:['Issued'],Issued:['Sent']}
 if(!allowed[record.status]?.includes(nextStatus))throw new Error('This status change is not available.')
 if(nextStatus==='Accepted'&&record.due<localDate())throw new Error('This quotation has expired. Repeat it with a new validity date.')
 const error=documentError(record);if(error)throw new Error(error)
 const {baseStatus,paid,balance,overdue,paymentHistory,...source}=record
 const saved={...source,status:nextStatus,updatedAt:new Date().toISOString(),[nextStatus==='Issued'?'issuedAt':nextStatus==='Accepted'?'acceptedAt':nextStatus==='Sent'?'sentAt':nextStatus==='Declined'?'declinedAt':'finalisedAt']:new Date().toISOString()}
 const documents=existing.documents.map(d=>d.id===id?saved:d)
 storage.setItem(DEMO_STORE_KEY,JSON.stringify({...existing,documents}))
 return {saved,documents}
}

export function recordDemoPayment(storage,invoiceId,payment){
 const existing=loadDemoStore(storage),invoice=existing.documents.find(d=>d.id===invoiceId)
 if(!invoice||invoice.id.startsWith('QUO')||!['Issued','Sent'].includes(invoice.status))throw new Error('Payments can only be recorded against an issued invoice.')
 const duplicate=existing.payments.find(p=>p.id===payment.id)
 if(duplicate){if(duplicate.invoiceId!==invoiceId)throw new Error('Payment identifier already used');return {...existing,saved:documentBalance(invoice,existing.payments),payment:duplicate}}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(payment.date||'')||!Number.isFinite(Date.parse(payment.date+'T00:00:00Z'))||new Date(payment.date+'T00:00:00Z').toISOString().slice(0,10)!==payment.date||payment.date>localDate())throw new Error('Choose a valid payment date that is not in the future.')
 if(!['EFT','Cash','Card','Mobile money','Other'].includes(payment.method))throw new Error('Choose a payment method.')
 if(!payment.id)throw new Error('Payment identifier required')
 const amount=Number(payment.amount),amountCents=Math.round(amount*100)
 if(!Number.isFinite(amount)||amountCents<=0||Math.abs(amount*100-amountCents)>0.000001)throw new Error('Enter a positive amount with no more than two decimal places.')
 const balance=documentBalance(invoice,existing.payments)
 if(amountCents>Math.round(balance.balance*100))throw new Error('Payment exceeds the outstanding balance. Record only the amount allocated to this invoice.')
 const savedPayment={id:payment.id,invoiceId,amount:amountCents/100,date:payment.date,method:payment.method,reference:String(payment.reference||'').trim().slice(0,150),currency:invoice.currency||'ZAR',customerName:invoice.name,recordedAt:new Date().toISOString()}
 const payments=[savedPayment,...existing.payments]
 storage.setItem(DEMO_STORE_KEY,JSON.stringify({...existing,payments}))
 return {...existing,payments,payment:savedPayment,saved:documentBalance(invoice,payments)}
}

export function convertDemoQuote(storage,id){
 const existing=loadDemoStore(storage),quote=existing.documents.find(d=>d.id===id)
 if(!quote||!quote.id.startsWith('QUO')||quote.status!=='Accepted')throw new Error('Accept the saved quotation before creating its invoice.')
 const duplicate=existing.documents.find(d=>d.sourceQuote===id)
 if(duplicate)return {saved:duplicate,documents:existing.documents,alreadyExists:true}
 const date=localDate(),due=new Date(new Date(date+'T00:00:00Z').getTime()+30*86400000).toISOString().slice(0,10)
 const saved={id:`INV-DEMO-${crypto.randomUUID().slice(0,8).toUpperCase()}`,name:quote.name,customer:{...quote.customer},workspace:{...quote.workspace},currency:quote.currency,items:quote.items.map(i=>({...i,id:crypto.randomUUID()})),amount:quote.amount,totals:quote.totals,date,due,rentalPeriod:quote.rentalPeriod||'',terms:quote.terms,notes:quote.notes||'',detail:quote.detail.replace(/Quotation$/,'Invoice'),status:'Draft',editable:true,demoSaved:true,sourceQuote:id,updatedAt:new Date().toISOString()}
 const documents=[saved,...existing.documents.map(d=>d.id===id?{...d,convertedTo:saved.id}:d)]
 storage.setItem(DEMO_STORE_KEY,JSON.stringify({...existing,documents}))
 return {saved,documents,alreadyExists:false}
}
