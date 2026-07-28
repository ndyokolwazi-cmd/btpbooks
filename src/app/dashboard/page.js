'use client'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
export default function Dashboard() {
  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}}) => {
      if (!session?.user) window.location.href = '/'
    })
  }, [])
  return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',fontFamily:'system-ui',flexDirection:'column',gap:12}}>
    <div style={{width:32,height:32,border:'3px solid #E2E8F0',borderTopColor:'#1E6FD9',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <p style={{color:'#475569',fontSize:14}}>Loading your account...</p>
  </div>
}
