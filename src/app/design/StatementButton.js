'use client'
import {useState} from 'react'
import {buildStatementPdf} from './documentPdf'

export default function StatementButton({customer,documents,payments,config}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const download=async()=>{if(busy)return;setBusy(true);setError('');try{const file=await buildStatementPdf(customer,documents,payments,config),url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(e){setError('Statement preparation failed. Please try again.')}finally{setBusy(false)}}
 return <><button className="secondary" disabled={busy||!documents.length} onClick={download}>{busy?'Preparing statement…':'Download statement PDF'}</button>{error&&<p role="alert" className="status">{error}</p>}</>
}
