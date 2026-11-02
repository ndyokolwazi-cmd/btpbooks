export const localDate=()=>new Date().toLocaleDateString('en-CA')
const cents=n=>Math.round((n+Number.EPSILON)*100)
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
