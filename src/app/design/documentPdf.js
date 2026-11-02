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
 pdf.setFontSize(9);pdf.setTextColor('#68776e');pdf.text(`SAMPLE DOCUMENT - ${(record.status||'Draft').toUpperCase()}`,14,16)
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
 block('DOCUMENT DETAILS',[record.sourceQuote?`Quotation reference: ${record.sourceQuote}`:'',record.rentalPeriod?`Rental period: ${record.rentalPeriod}`:'',record.date?`Issued: ${record.date}`:'',record.due?`${quote?'Valid until':'Due'}: ${record.due}`:'',co.vat_registered?`Supplier VAT: ${co.vat}`:''].filter(Boolean).join('\n'))
 const headers=['Description','Qty','Unit price','Disc %',...(co.vat_registered?['VAT %']:[]),'Amount excl. VAT']
 autoTable(pdf,{startY:y,margin:{left:14,right:14,bottom:20},head:[headers],body:totals.rows.map(i=>[i.desc,String(i.qty),money(i.rate),`${i.discount||0}%`,...(co.vat_registered?[`${i.vatRate||0}%`]:[]),money(i.net)]),showHead:'everyPage',rowPageBreak:'avoid',styles:{font:co.theme==='classic'?'times':'helvetica',fontSize:9,cellPadding:3,overflow:'linebreak'},headStyles:{fillColor:accent},columnStyles:{0:{cellWidth:'auto'}}})
 y=pdf.lastAutoTable.finalY+10
 block('TOTALS',`${totals.discount?`Discount: ${money(totals.discount)}\n`:''}Subtotal: ${money(totals.subtotal)}${co.vat_registered?`\nVAT: ${money(totals.vat)}`:''}\nTotal: ${money(totals.total)}`)
 if(record.demoSaved&&!quote&&record.status!=='Draft')block('PAYMENT SUMMARY',`Received: ${money(record.paid||0)}\nBalance outstanding: ${money(record.balance??record.amount)}`)
 if(record.paymentHistory?.length)block('PAYMENT HISTORY',record.paymentHistory.map(payment=>`${payment.date} - ${payment.method} - ${money(payment.amount)}${payment.reference?` - ${payment.reference}`:''}`).join('\n'))
 if(co.banking?.bank){const labels={bank:'Bank',accountName:'Account holder',accountNo:'Account number',accountType:'Account type',branchCode:'Branch code',swift:'SWIFT / BIC',reference:'Reference'};block('BANKING DETAILS',Object.entries(co.banking).filter(([,v])=>v).map(([k,v])=>`${labels[k]||k}: ${v}`).join('\n'))}
 block('PAYMENT TERMS',record.terms??co.terms);block('NOTES',record.notes);block('',co.footer)
 const pages=pdf.getNumberOfPages()
 for(let page=1;page<=pages;page++){pdf.setPage(page);pdf.setFontSize(8);pdf.setTextColor('#68776e');pdf.text('Fictional sample. No payment is due.',14,288);pdf.text(`Page ${page} of ${pages}`,195,288,{align:'right'})}
 return new File([pdf.output('blob')],`${record.id}-SAMPLE.pdf`,{type:'application/pdf'})
}

export async function buildReceiptPdf(invoice,payment,config){
 const {jsPDF}=await import('jspdf')
 const co=invoice.workspace||config,region=REGIONS.find(r=>r[0]===co.region)||REGIONS[0]
 const money=n=>new Intl.NumberFormat(region[3],{style:'currency',currency:payment.currency||invoice.currency||region[2]}).format(n)
 const pdf=new jsPDF(),accent=co.accent||'#146e60'
 pdf.setFillColor(accent);pdf.rect(0,0,210,6,'F')
 pdf.setFont(co.theme==='classic'?'times':'helvetica');pdf.setTextColor(accent);pdf.setFontSize(20);pdf.text(co.name||'Your company',14,28)
 pdf.setTextColor('#17231e');pdf.setFontSize(15);pdf.text('PAYMENT RECEIPT',14,43)
 pdf.setFontSize(9);pdf.setTextColor('#68776e');pdf.text(`SAMPLE RECEIPT · ${payment.id.slice(0,12).toUpperCase()}`,14,51)
 const rows=[['Received from',invoice.name],['Payment date',payment.date],['Amount received',money(payment.amount)],['Payment method',payment.method],['Reference',payment.reference||'—'],['Applied to invoice',invoice.id],['Invoice total',money(invoice.amount)],['Balance outstanding',money(invoice.balance??0)]]
 let y=68
 for(const [label,value] of rows){pdf.setTextColor('#68776e');pdf.text(label,14,y);pdf.setTextColor('#17231e');pdf.setFontSize(label==='Amount received'?14:10);pdf.text(String(value),70,y);pdf.setFontSize(9);y+=14;pdf.setDrawColor('#e2e8e4');pdf.line(14,y-8,196,y-8)}
 if(co.vat_registered&&co.vat){pdf.setTextColor('#68776e');pdf.text(`Supplier VAT number: ${co.vat}`,14,y+4)}
 pdf.setFontSize(9);pdf.setTextColor('#68776e');pdf.text('This receipt confirms that a payment was recorded against the invoice shown above.',14,260)
 pdf.text('Fictional preview receipt · No bank transaction was performed.',14,288)
 return new File([pdf.output('blob')],`${invoice.id}-${payment.date}-RECEIPT-SAMPLE.pdf`,{type:'application/pdf'})
}

export async function buildStatementPdf(customer,documents,payments,config){
 const [{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')])
 const region=REGIONS.find(r=>r[0]===config.region)||REGIONS[0],currency=region[2]
 const money=n=>new Intl.NumberFormat(region[3],{style:'currency',currency}).format(n)
 const invoices=documents.filter(document=>!document.id.startsWith('QUO')&&(document.currency||currency)===currency)
 const invoiceIds=new Set(invoices.map(document=>document.id))
 const allocated=payments.filter(payment=>invoiceIds.has(payment.invoiceId)&&(payment.currency||currency)===currency)
 const outstanding=invoices.reduce((sum,document)=>sum+Number(document.balance??(document.status==='Paid'?0:(document.amount||0))),0)
 const pdf=new jsPDF(),accent=config.accent||'#146e60'
 pdf.setFont(config.theme==='classic'?'times':'helvetica');pdf.setFillColor(accent);pdf.rect(0,0,210,6,'F')
 pdf.setTextColor(accent);pdf.setFontSize(20);pdf.text(config.name||'Your company',14,27)
 pdf.setTextColor('#17231e');pdf.setFontSize(15);pdf.text('CUSTOMER STATEMENT',14,42)
 pdf.setTextColor('#68776e');pdf.setFontSize(9);pdf.text(`Statement date: ${new Date().toLocaleDateString('en-ZA')}`,14,50)
 pdf.setTextColor('#17231e');pdf.setFontSize(11);pdf.text(customer.name,14,64)
 let y=70
 for(const detail of [customer.address,customer.email,customer.phone,customer.vat?`VAT: ${customer.vat}`:''].filter(Boolean)){pdf.setFontSize(9);pdf.text(String(detail),14,y);y+=5}
 autoTable(pdf,{startY:y+5,margin:{left:14,right:14,bottom:20},head:[['Date','Document','Description','Status','Debit','Paid','Balance']],body:invoices.map(document=>[document.date||'—',document.id,document.detail||'Invoice',document.status,money(document.amount),money(document.paid||0),money(document.balance??(document.status==='Paid'?0:document.amount))]),showHead:'everyPage',rowPageBreak:'avoid',styles:{fontSize:8,cellPadding:2.5,overflow:'linebreak'},headStyles:{fillColor:accent}})
 y=pdf.lastAutoTable.finalY+10
 if(y>260){pdf.addPage();y=20}
 pdf.setFontSize(10);pdf.setTextColor('#17231e');pdf.text(`Total invoiced: ${money(invoices.reduce((sum,document)=>sum+document.amount,0))}`,14,y)
 pdf.text(`Payments recorded: ${money(allocated.reduce((sum,payment)=>sum+payment.amount,0))}`,14,y+7)
 pdf.setFontSize(13);pdf.setTextColor(accent);pdf.text(`Balance outstanding: ${money(outstanding)}`,14,y+17)
 if(allocated.length){autoTable(pdf,{startY:y+28,margin:{left:14,right:14,bottom:20},head:[['Payment date','Invoice','Method','Reference','Amount']],body:allocated.map(payment=>[payment.date,payment.invoiceId,payment.method,payment.reference||'—',money(payment.amount)]),showHead:'everyPage',styles:{fontSize:8,cellPadding:2.5},headStyles:{fillColor:accent}})}
 const pages=pdf.getNumberOfPages();for(let page=1;page<=pages;page++){pdf.setPage(page);pdf.setFontSize(8);pdf.setTextColor('#68776e');pdf.text('Fictional preview statement · No payment is due.',14,288);pdf.text(`Page ${page} of ${pages}`,195,288,{align:'right'})}
 return new File([pdf.output('blob')],`${String(customer.name).replace(/[^a-z0-9]+/gi,'-')}-STATEMENT-SAMPLE.pdf`,{type:'application/pdf'})
}
