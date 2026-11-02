export const localDate=()=>new Date().toLocaleDateString('en-CA')
const cents=n=>Math.round((n+Number.EPSILON)*100)
export function nextRentalMonth(period){
 const [year,month]=period.split('-').map(Number)
 const next=new Date(Date.UTC(year,month,1))
 return `${next.getUTCFullYear()}-${String(next.getUTCMonth()+1).padStart(2,'0')}`
}
export function repeatDocument(source,config,client){
 const rental=config.industry==='rental'
 const period=rental?nextRentalMonth(source.rentalPeriod||(source.date||localDate()).slice(0,7)):''
 const date=rental?`${period}-01`:localDate()
 const oldGap=source.date&&source.due?Math.max(0,Math.round((new Date(source.due+'T00:00:00Z')-new Date(source.date+'T00:00:00Z'))/86400000)):0
 let due=date
 if(rental){
  const [year,month]=period.split('-').map(Number)
  const day=Math.min(Number(source.due?.slice(8,10))||1,new Date(Date.UTC(year,month,0)).getUTCDate())
  due=`${period}-${String(day).padStart(2,'0')}`
 }else{due=new Date(new Date(date+'T00:00:00Z').getTime()+oldGap*86400000).toISOString().slice(0,10)}
 return {documentType:source.id?.startsWith('QUO')?'Quotation':'Invoice',name:client?.name||source.name,customer:{...source.customer,...client,name:client?.name||source.name},items:(source.items||[{desc:source.detail||'Monthly rent',qty:1,rate:source.amount,discount:0,vatRate:0}]).map(item=>({...item,id:crypto.randomUUID()})),date,due,rentalPeriod:period,terms:source.terms??config.terms,notes:source.notes||'',workspace:{...source.workspace,...config,region:source.workspace?.region||config.region,vat_registered:source.workspace?.vat_registered||false,vat:source.workspace?.vat||''},currency:source.currency,repeatFrom:source.id}
}
export function calculateItems(items,vatRegistered=false){
 let subtotal=0,vat=0,discount=0
 const rows=items.map(item=>{
  const gross=cents(Number(item.qty)*Number(item.rate))
  const reduction=Math.round(gross*Number(item.discount||0)/100)
  const net=gross-reduction
  const tax=vatRegistered?Math.round(net*Number(item.vatRate||0)/100):0
  subtotal+=net;vat+=tax;discount+=reduction
  return {...item,net:net/100,tax:tax/100}
 })
 return {rows,subtotal:subtotal/100,vat:vat/100,discount:discount/100,total:(subtotal+vat)/100}
}
export function documentError(record){
 if(!record.name?.trim())return 'Enter a customer name.'
 if(record.workspace?.industry==='rental'&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(record.rentalPeriod||''))return 'Choose the rental billing month.'
 if(record.customer?.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.customer.email))return 'Enter a valid customer email address.'
 if(!record.date||!record.due)return 'Choose an issue date and due / valid-until date.'
 if(record.due<record.date)return 'The due / valid-until date cannot precede the issue date.'
 if(record.workspace?.vat_registered&&!record.workspace?.vat?.trim())return 'Enter the supplier VAT registration number.'
 if(!record.items?.length)return 'Add at least one line item.'
 for(const item of record.items){
  if(!item.desc?.trim())return 'Enter a description for every line item.'
  if(!Number.isFinite(Number(item.qty))||Number(item.qty)<=0)return 'Quantities must be greater than zero.'
  if(!Number.isFinite(Number(item.rate))||Number(item.rate)<0)return 'Prices cannot be negative or invalid.'
  if(!Number.isFinite(Number(item.discount))||Number(item.discount)<0||Number(item.discount)>100)return 'Discounts must be between 0 and 100%.'
  if(!Number.isFinite(Number(item.vatRate))||Number(item.vatRate)<0||Number(item.vatRate)>100)return 'VAT rates must be between 0 and 100%.'
 }
 if(calculateItems(record.items,record.workspace?.vat_registered).total<=0)return 'The document total must be greater than zero.'
 return ''
}
