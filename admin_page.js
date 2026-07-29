'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_EMAIL = 'lwazi@betheproject.co.za'

const T = {
  navy:'#0D1F3C', blue:'#1E6FD9', blueLt:'#E8F1FB',
  green:'#16A34A', greenLt:'#DCFCE7', red:'#DC2626', redLt:'#FEE2E2',
  amber:'#D97706', amberLt:'#FEF3C7', grey50:'#F8FAFC', grey100:'#F1F4F8',
  grey200:'#E2E8F0', grey400:'#94A3B8', grey600:'#475569', white:'#FFFFFF',
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F8FAFC;color:#1E293B;font-size:14px;}
button{cursor:pointer;font-family:inherit;}
input,select,textarea{font-family:inherit;}
.topbar{background:#0D1F3C;padding:14px 28px;display:flex;align-items:center;justify-content:space-between;}
.topbar h1{font-size:18px;font-weight:900;color:#fff;letter-spacing:-.5px;}
.topbar h1 span{color:#1E6FD9;}
.content{padding:28px;max-width:1200px;margin:0 auto;}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:28px;}
.stat{background:#fff;border-radius:10px;border:1px solid #E2E8F0;padding:16px;border-left:4px solid #1E6FD9;}
.stat-label{font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.5px;}
.stat-val{font-size:26px;font-weight:900;margin-top:6px;}
.card{background:#fff;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;margin-bottom:24px;}
.card-hd{padding:14px 20px;border-bottom:1px solid #E2E8F0;display:flex;justify-content:space-between;align-items:center;}
.card-hd h2{font-size:14px;font-weight:800;color:#0D1F3C;text-transform:uppercase;letter-spacing:.5px;}
.tbl{width:100%;border-collapse:collapse;}
.tbl th{padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.4px;background:#F8FAFC;border-bottom:2px solid #E2E8F0;}
.tbl td{padding:12px 16px;font-size:13px;border-top:1px solid #F1F4F8;}
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;}
.badge-trial{background:#FEF3C7;color:#D97706;}
.badge-active{background:#DCFCE7;color:#16A34A;}
.badge-expired{background:#FEE2E2;color:#DC2626;}
.btn{border:none;border-radius:7px;font-weight:600;font-size:12px;padding:6px 14px;cursor:pointer;}
.btn-p{background:#1E6FD9;color:#fff;}
.btn-s{background:#fff;color:#1E293B;border:1.5px solid #E2E8F0;}
.btn-d{background:#DC2626;color:#fff;}
.btn-ok{background:#16A34A;color:#fff;}
.btn-amber{background:#D97706;color:#fff;}
.inp{width:100%;padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:7px;font-size:13px;outline:none;}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;}
.modal{background:#fff;border-radius:14px;width:100%;max-width:500px;box-shadow:0 20px 60px rgba(0,0,0,.25);}
.modal-hd{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #E2E8F0;}
.modal-hd h2{font-size:15px;font-weight:800;color:#0D1F3C;}
.modal-bd{padding:20px;}
.field{margin-bottom:12px;}
.flbl{display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px;}
.loading{display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:12px;}
.spinner{width:28px;height:28px;border:3px solid #E2E8F0;border-top-color:#1E6FD9;border-radius:50%;animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.access-denied{display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:12px;text-align:center;padding:40px;}
`

export default function AdminPage() {
  const [user, setUser] = useState(undefined)
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.appendChild(style)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      if (session?.user?.email === ADMIN_EMAIL) loadSubs()
      else setLoading(false)
    })
    return () => document.head.removeChild(style)
  }, [])

  const loadSubs = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false })
    setSubs(data || [])
    setLoading(false)
  }

  const notify = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  const saveEdit = async () => {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: editing.status,
        subscription_ends_at: editing.subscription_ends_at || null,
        trial_ends_at: editing.trial_ends_at,
        notes: editing.notes || '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', editing.id)
    if (error) { notify('Error: ' + error.message); return }
    setSubs(s => s.map(x => x.id === editing.id ? { ...x, ...editing } : x))
    setEditing(null)
    notify('Subscription updated')
  }

  const activateMonthly = (sub) => {
    const ends = new Date()
    ends.setMonth(ends.getMonth() + 1)
    setEditing({ ...sub, status: 'active', subscription_ends_at: ends.toISOString().slice(0, 10) })
  }

  const extendTrial = (sub) => {
    const ends = new Date()
    ends.setDate(ends.getDate() + 14)
    setEditing({ ...sub, trial_ends_at: ends.toISOString().slice(0, 10) })
  }

  const getStatus = (sub) => {
    if (sub.status === 'active') {
      if (!sub.subscription_ends_at) return 'active'
      return new Date(sub.subscription_ends_at) > new Date() ? 'active' : 'expired'
    }
    if (sub.status === 'trial') {
      return new Date(sub.trial_ends_at) > new Date() ? 'trial' : 'expired'
    }
    return sub.status || 'expired'
  }

  if (loading) return <div className="loading"><div className="spinner"/><span style={{color:T.grey400}}>Loading admin…</span></div>
  if (!user || user.email !== ADMIN_EMAIL) return (
    <div className="access-denied">
      <div style={{fontSize:48}}>🔒</div>
      <h1 style={{fontSize:24,fontWeight:900,color:T.navy}}>Access Denied</h1>
      <p style={{color:T.grey600}}>This page is restricted to Invoxa administrators.</p>
      <a href="/" style={{color:T.blue,fontWeight:600}}>← Back to app</a>
    </div>
  )

  const filtered = subs.filter(s =>
    !search || s.email.toLowerCase().includes(search.toLowerCase())
  )

  const counts = {
    total: subs.length,
    active: subs.filter(s => getStatus(s) === 'active').length,
    trial: subs.filter(s => getStatus(s) === 'trial').length,
    expired: subs.filter(s => getStatus(s) === 'expired').length,
    revenue: subs.filter(s => getStatus(s) === 'active').length * 149,
  }

  return (
    <div>
      {toast && <div style={{position:'fixed',bottom:20,right:20,zIndex:999,background:T.navy,color:'#fff',padding:'11px 20px',borderRadius:10,fontWeight:600,fontSize:13,boxShadow:'0 8px 28px rgba(0,0,0,.3)'}}>✓ {toast}</div>}

      {editing && (
        <div className="modal-bg" onClick={e => e.target.className === 'modal-bg' && setEditing(null)}>
          <div className="modal">
            <div className="modal-hd">
              <h2>Manage Subscription</h2>
              <button onClick={() => setEditing(null)} style={{background:'none',border:'none',fontSize:20,color:T.grey400,cursor:'pointer'}}>✕</button>
            </div>
            <div className="modal-bd">
              <div style={{fontWeight:700,color:T.navy,marginBottom:4}}>{editing.email}</div>
              <div style={{fontSize:12,color:T.grey600,marginBottom:16}}>User ID: {editing.user_id}</div>

              <div className="field">
                <label className="flbl">Status</label>
                <select value={editing.status} onChange={e => setEditing(s => ({...s, status: e.target.value}))} className="inp">
                  <option value="trial">Trial</option>
                  <option value="active">Active (Paid)</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="field">
                <label className="flbl">Trial Ends</label>
                <input type="date" value={editing.trial_ends_at?.slice(0,10)||''} onChange={e => setEditing(s => ({...s, trial_ends_at: e.target.value}))} className="inp"/>
              </div>

              <div className="field">
                <label className="flbl">Subscription Ends (leave blank = no expiry)</label>
                <input type="date" value={editing.subscription_ends_at?.slice(0,10)||''} onChange={e => setEditing(s => ({...s, subscription_ends_at: e.target.value}))} className="inp"/>
              </div>

              <div className="field">
                <label className="flbl">Notes</label>
                <textarea value={editing.notes||''} onChange={e => setEditing(s => ({...s, notes: e.target.value}))} className="inp" rows={2} style={{resize:'vertical'}} placeholder="Payment reference, date paid, etc."/>
              </div>

              <div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:12,borderTop:`1px solid ${T.grey200}`}}>
                <button className="btn btn-s" onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn btn-ok" onClick={saveEdit}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="topbar">
        <h1>Inv<span>o</span>xa <span style={{fontSize:12,fontWeight:500,color:'rgba(255,255,255,.5)',letterSpacing:'normal'}}>Admin</span></h1>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontSize:12,color:'rgba(255,255,255,.5)'}}>{user.email}</span>
          <a href="/dashboard" style={{background:'rgba(255,255,255,.1)',color:'#fff',padding:'6px 14px',borderRadius:7,fontSize:12,fontWeight:600,textDecoration:'none'}}>← App</a>
          <button className="btn btn-s btn-sm" style={{fontSize:12}} onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}>Sign Out</button>
        </div>
      </div>

      <div className="content">
        <div className="stats">
          {[
            {l:'Total Users', v:counts.total, c:T.navy},
            {l:'Active (Paid)', v:counts.active, c:T.green},
            {l:'On Trial', v:counts.trial, c:T.amber},
            {l:'Expired', v:counts.expired, c:T.red},
            {l:'Monthly Revenue', v:`R ${counts.revenue.toLocaleString()}`, c:T.blue},
          ].map(s => (
            <div key={s.l} className="stat" style={{borderLeftColor:s.c}}>
              <div className="stat-label">{s.l}</div>
              <div className="stat-val" style={{color:s.c}}>{s.v}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-hd">
            <h2>All Users</h2>
            <input type="text" placeholder="Search by email…" value={search} onChange={e => setSearch(e.target.value)}
              style={{padding:'6px 11px',border:`1.5px solid ${T.grey200}`,borderRadius:7,fontSize:12,width:220,outline:'none'}}/>
          </div>
          <div style={{overflowX:'auto'}}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Trial Ends</th>
                  <th>Sub Ends</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!filtered.length && (
                  <tr><td colSpan={6} style={{textAlign:'center',color:T.grey400,padding:32}}>No users found</td></tr>
                )}
                {filtered.map(sub => {
                  const st = getStatus(sub)
                  return (
                    <tr key={sub.id}>
                      <td style={{fontWeight:600,color:T.navy}}>{sub.email}</td>
                      <td>
                        <span className={`badge badge-${st==='active'?'active':st==='trial'?'trial':'expired'}`}>
                          {st.charAt(0).toUpperCase()+st.slice(1)}
                        </span>
                      </td>
                      <td style={{fontSize:12,color:T.grey600}}>{sub.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString('en-ZA') : '—'}</td>
                      <td style={{fontSize:12,color:T.grey600}}>{sub.subscription_ends_at ? new Date(sub.subscription_ends_at).toLocaleDateString('en-ZA') : '—'}</td>
                      <td style={{fontSize:12,color:T.grey600,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sub.notes||'—'}</td>
                      <td>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                          <button className="btn btn-ok" onClick={() => activateMonthly(sub)}>✓ Activate</button>
                          <button className="btn btn-amber" onClick={() => extendTrial(sub)}>+14 Days</button>
                          <button className="btn btn-s" onClick={() => setEditing({...sub})}>Edit</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{fontSize:12,color:T.grey400,textAlign:'center',paddingBottom:24}}>
          Invoxa Admin · Only accessible to {ADMIN_EMAIL}
        </div>
      </div>
    </div>
  )
}
