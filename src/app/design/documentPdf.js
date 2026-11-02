import {calculateItems} from './documentModel'
import {REGIONS} from './BusinessSetup'

export async function buildDocumentPdf(record,config){
 const [{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')])
 const co=record.workspace||config,region=REGIONS.find(r=>r[0]===co.region)||REGIONS[0]
 const money=n=>new Intl.NumberFormat(region[3],{style:'currency',currency:record.currency||region[2]}).format(n)
 const quote=record.id.startsWith('QUO'),label=quote?'QUOTATION':co.vat_registered?'TAX INVOICE':'INVOICE'
 const items=record.items?.length?record.items:[{desc:record.detail,qty:1,rate:record.amount,discount:0,vatRate:0}]
 const totals=calculateItems(items,co.vat_registered)
 const pdf=new jsPDF();pdf.setFont(co.theme==='classic'?'times':'helvetica')
 const accent=co.accent||'#146e60'
 if(co.theme==='modern'){pdf.setFillColor(accent);pdf.rect(0,0,210,5,'F')}
 if(co.theme==='bold'){pdf.setFillColor(accent);pdf.rect(0,0,5,297,'F')}
 pdf.setFontSize(9);pdf.setTextColor('#68776e');pdf.text('SAMPLE DOCUMENT - DRAFT / PREVIEW',14,16)
 pdf.setFontSize(18);pdf.setTextColor(accent);pdf.text(pdf.splitTextToSize(co.name,180),14,28)
 pdf.setFontSize(11);pdf.text(`${label}  ${record.id}`,14,43)
 let y=52
 const block=(heading,text)=>{
  if(!text)return
  if(y>255){pdf.addPage();y=18}
  pdf.setFontSize(9);pdf.setTextColor('#334155');pdf.text(heading,14,y);y+=5
  pdf.setFontSize(9)
  for(const line of pdf.splitTextToSize(String(text),180)){
   if(y>274){pdf.addPage();y=18}
   pdf.text(line,14,y);y+=4.5
  }
  y+=5
 }
 block('CUSTOMER',[record.name,record.customer?.address,record.customer?.email,record.customer?.phone,record.customer?.vat?`Customer VAT: ${record.customer.vat}`:''].filter(Boolean).join('\n'))
 block('DOCUMENT DETAILS',[record.rentalPeriod?`Rental period: ${record.rentalPeriod}`:'',record.date?`Issued: ${record.date}`:'',record.due?`${quote?'Valid until':'Due'}: ${record.due}`:'',co.vat_registered?`Supplier VAT: ${co.vat}`:''].filter(Boolean).join('\n'))
 const headers=['Description','Qty','Unit price','Disc %',...(co.vat_registered?['VAT %']:[]),'Amount excl. VAT']
 autoTable(pdf,{startY:y,margin:{left:14,right:14,bottom:20},head:[headers],body:totals.rows.map(i=>[i.desc,String(i.qty),money(i.rate),`${i.discount||0}%`,...(co.vat_registered?[`${i.vatRate||0}%`]:[]),money(i.net)]),showHead:'everyPage',rowPageBreak:'avoid',styles:{font:co.theme==='classic'?'times':'helvetica',fontSize:9,cellPadding:3,overflow:'linebreak'},headStyles:{fillColor:accent},columnStyles:{0:{cellWidth:'auto'}}})
 y=pdf.lastAutoTable.finalY+10
 block('TOTALS',`${totals.discount?`Discount: ${money(totals.discount)}\n`:''}Subtotal: ${money(totals.subtotal)}${co.vat_registered?`\nVAT: ${money(totals.vat)}`:''}\nTotal: ${money(totals.total)}`)
 if(co.banking?.bank){const labels={bank:'Bank',accountName:'Account holder',accountNo:'Account number',accountType:'Account type',branchCode:'Branch code',swift:'SWIFT / BIC',reference:'Reference'};block('BANKING DETAILS',Object.entries(co.banking).filter(([,v])=>v).map(([k,v])=>`${labels[k]||k}: ${v}`).join('\n'))}
 block('PAYMENT TERMS',record.terms??co.terms);block('NOTES',record.notes);block('',co.footer)
 const pages=pdf.getNumberOfPages()
 for(let page=1;page<=pages;page++){pdf.setPage(page);pdf.setFontSize(8);pdf.setTextColor('#68776e');pdf.text('Fictional sample. No payment is due.',14,288);pdf.text(`Page ${page} of ${pages}`,195,288,{align:'right'})}
 return new File([pdf.output('blob')],`${record.id}-SAMPLE.pdf`,{type:'application/pdf'})
}
