// Sample records only. This store never connects to Supabase.
export const DEMO_STORE_KEY='myinvox.design.drafts.v1'

export function loadDemoStore(storage){
  const raw=storage.getItem(DEMO_STORE_KEY)
  if(!raw)return {documents:[],config:null}
  const data=JSON.parse(raw)
  if(data.version!==1||!Array.isArray(data.documents))throw new Error('Unrecognised sample storage')
  if(!data.documents.every(d=>typeof d.id==='string'&&typeof d.name==='string'&&Number.isFinite(d.amount)&&d.amount>0&&d.status==='Draft'&&d.demoSaved===true))throw new Error('Invalid sample drafts')
  return data
}

export function saveDemoDraft(storage,record,config){
  if(!record.name?.trim()||!Number.isFinite(record.amount)||record.amount<=0)throw new Error('Enter a customer and a valid amount')
  const existing=loadDemoStore(storage)
  const saved={...record,name:record.name.trim(),status:'Draft',demoSaved:true,workspace:record.workspace||{...config},currency:record.currency||'ZAR',updatedAt:new Date().toISOString()}
  const documents=[saved,...existing.documents.filter(d=>d.id!==saved.id)]
  // Set storage before reporting success; private browsing/quota errors must surface.
  storage.setItem(DEMO_STORE_KEY,JSON.stringify({version:1,documents,config}))
  return {saved,documents}
}

export function saveDemoConfig(storage,config){
  const existing=loadDemoStore(storage)
  storage.setItem(DEMO_STORE_KEY,JSON.stringify({version:1,documents:existing.documents,config}))
}
