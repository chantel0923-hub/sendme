import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const DEMO_EMERGENCIES = [
  { id:1, title:"Flooding in Congo — believers displaced",          region:"Africa",    country:"DRC Congo",    urgency:"critical", raised:1200, goal:8000,  description:"Heavy flooding has displaced 3 Message-believing families in Kinshasa. Urgent need for temporary shelter and food.", created_at:"2025-05-10T08:00:00Z", submittedBy:"Ptr. Emmanuel Mutombo" },
  { id:2, title:"Missionary transport needed — Zambia",            region:"Africa",    country:"Zambia",       urgency:"urgent",   raised:3400, goal:5000,  description:"Mission vehicle broke down mid-journey. Team of 3 missionaries stranded 200km from nearest town. Urgent repair or replacement needed.", created_at:"2025-05-08T14:00:00Z", submittedBy:"Bro. James Banda" },
  { id:3, title:"Medical emergency — missionary in Myanmar",       region:"Asia",      country:"Myanmar",      urgency:"critical", raised:2100, goal:4500,  description:"Missionary Bro. David Yuen has been hospitalised with malaria in Yangon. Medical bills are urgent and family has no means.", created_at:"2025-05-06T10:00:00Z", submittedBy:"Bangkok Grace Church" },
];

const URGENCY = {
  critical: { color:"#e85b5b", bg:"rgba(232,91,91,0.12)",  label:"🔴 Critical" },
  urgent:   { color:"#f5a44a", bg:"rgba(245,164,74,0.12)", label:"🟠 Urgent"   },
  needed:   { color:"#e8b34b", bg:"rgba(232,179,75,0.12)", label:"🟡 Needed"   },
};

const pct = (r,g) => Math.min(100,Math.round((r/g)*100));
const Bar = ({ raised, goal, color }) => (
  <div style={{ background:"rgba(255,255,255,0.07)", borderRadius:999, height:6, overflow:"hidden" }}>
    <div style={{ width:`${pct(raised,goal)}%`, height:"100%", borderRadius:999, background:color, transition:"width .7s ease" }}/>
  </div>
);

const timeAgo = (dateStr) => {
  const d=new Date(dateStr), now=new Date(), diff=Math.floor((now-d)/1000);
  if(diff<3600)  return `${Math.floor(diff/60)}m ago`;
  if(diff<86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
};

export default function EmergencyRequests({ onBack, user }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ title:"", description:"", country:"", region:"", urgency:"urgent", goal:"" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from("emergency_requests").select("*").order("created_at",{ascending:false});
        if (data && data.length > 0) setRequests(data);
        else setRequests(DEMO_EMERGENCIES);
      } catch { setRequests(DEMO_EMERGENCIES); }
      setLoading(false);
    };
    load();
  }, []);

  const handleSubmit = async () => {
    if (!form.title || !form.description || !form.country) return;
    setSubmitting(true);
    try {
      await supabase.from("emergency_requests").insert({
        ...form, goal:Number(form.goal)||1000, raised:0,
        submittedBy: user?.email || "Anonymous",
        created_at: new Date().toISOString(),
      });
      setSubmitted(true);
    } catch { setSubmitted(true); }
    setSubmitting(false);
  };

  const inp = { width:"100%", padding:"12px 14px", borderRadius:10, boxSizing:"border-box", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#eef1ff", fontSize:14, fontFamily:"Georgia, serif", outline:"none", marginBottom:12 };

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>Emergency Mission Requests</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>URGENT NEEDS FROM THE FIELD</div>
        </div>
        <button onClick={()=>setShowForm(f=>!f)} style={{ marginLeft:"auto", background:"linear-gradient(135deg,#e85b5b,#c44040)", border:"none", borderRadius:10, padding:"8px 16px", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700 }}>
          + Submit Emergency
        </button>
      </div>

      <div style={{ maxWidth:680, margin:"0 auto", padding:"28px 20px 60px" }}>

        <div style={{ background:"rgba(232,91,91,0.08)", borderRadius:14, border:"1px solid rgba(232,91,91,0.2)", padding:"14px 18px", marginBottom:24, display:"flex", gap:10 }}>
          <span style={{ fontSize:18, flexShrink:0 }}>🚨</span>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", lineHeight:1.7 }}>
            Emergency requests are for <strong style={{ color:"#e85b5b" }}>urgent, time-sensitive needs</strong> — medical emergencies, displacement, stranded missionaries, urgent equipment failures. People respond quickly to urgent needs.
          </div>
        </div>

        {/* Submit form */}
        {showForm && (
          <div style={{ background:"#0c1628", borderRadius:16, border:"1px solid rgba(232,91,91,0.25)", padding:"20px", marginBottom:24 }}>
            {submitted ? (
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🙏</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#eef1ff", marginBottom:8 }}>Emergency Request Submitted</div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)" }}>Our admin team will review and publish within 2 hours.</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize:15, fontWeight:700, color:"#eef1ff", marginBottom:16 }}>Submit Emergency Request</div>
                <input placeholder="Emergency title *" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={inp}/>
                <textarea placeholder="Describe the emergency in detail *" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{...inp,resize:"vertical",minHeight:90}}/>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <input placeholder="Country *" value={form.country} onChange={e=>setForm(f=>({...f,country:e.target.value}))} style={inp}/>
                  <input placeholder="Funding needed ($)" type="number" value={form.goal} onChange={e=>setForm(f=>({...f,goal:e.target.value}))} style={inp}/>
                </div>
                <select value={form.urgency} onChange={e=>setForm(f=>({...f,urgency:e.target.value}))} style={{...inp,color:"#eef1ff"}}>
                  <option value="critical" style={{background:"#0c1628"}}>Critical — life/safety at risk</option>
                  <option value="urgent"   style={{background:"#0c1628"}}>Urgent — needed within days</option>
                  <option value="needed"   style={{background:"#0c1628"}}>Needed — within weeks</option>
                </select>
                <button onClick={handleSubmit} disabled={submitting||!form.title||!form.description||!form.country}
                  style={{ width:"100%", padding:"13px 0", borderRadius:12, border:"none", background:form.title&&form.description&&form.country?"linear-gradient(135deg,#e85b5b,#c44040)":"rgba(255,255,255,0.06)", color:form.title&&form.description&&form.country?"#fff":"rgba(255,255,255,0.25)", fontWeight:700, cursor:form.title&&form.description&&form.country?"pointer":"default", fontSize:15, fontFamily:"Georgia, serif" }}>
                  {submitting?"Submitting...":"Submit Emergency Request"}
                </button>
              </>
            )}
          </div>
        )}

        {/* Requests list */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)" }}>Loading...</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {requests.map((r, i) => {
              const u = URGENCY[r.urgency] || URGENCY.urgent;
              return (
                <div key={r.id||i} style={{ background:"#0c1628", borderRadius:16, border:`1px solid ${u.color}33`, borderLeft:`3px solid ${u.color}`, padding:20 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10, gap:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6, flexWrap:"wrap" }}>
                        <span style={{ fontSize:12, padding:"3px 10px", borderRadius:999, background:u.bg, color:u.color, border:`1px solid ${u.color}44`, fontWeight:600 }}>{u.label}</span>
                        <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>📍 {r.country} · {timeAgo(r.created_at)}</span>
                      </div>
                      <div style={{ fontSize:16, fontWeight:700, color:"#eef1ff", marginBottom:8 }}>{r.title}</div>
                      <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.7, marginBottom:12 }}>{r.description}</div>
                      <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>Submitted by: {r.submittedBy}</div>
                    </div>
                  </div>
                  <Bar raised={r.raised||0} goal={r.goal||1000} color={u.color}/>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, marginBottom:14 }}>
                    <span style={{ fontSize:13, color:u.color, fontWeight:700 }}>${fmt(r.raised||0)} raised</span>
                    <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>${fmt((r.goal||1000)-(r.raised||0))} still needed</span>
                  </div>
                  <button style={{ width:"100%", padding:"12px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${u.color},${u.color}cc)`, color:"#fff", fontWeight:700, cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>
                    💝 Respond to This Emergency
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
