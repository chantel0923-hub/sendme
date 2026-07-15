import { useState, useEffect } from "react";
import { startPayfastEmergencyDonation } from "./payfast";
import { supabase } from "./supabase";
import { notifyAdmin } from "./notifications";

const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

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

export default function EmergencyRequests({ onBack, user, userRole }) {
  // #79: Donor/Supporter role should not see "+ Submit Emergency". Guests
  // never reach this screen at all — App.js already routes them to
  // GuestBlocked before EmergencyRequests renders.
  const canSubmitEmergency = userRole !== "donor";

  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ title:"", description:"", country:"", region:"", urgency:"urgent", goal:"", church_id:"", contact_email:"", contact_phone:"" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [churches, setChurches]     = useState([]);
  const [responding, setResponding] = useState(null);   // emergency being responded to
  const [response, setResponse]     = useState({ name:"", email:"", phone:"", amount:"", note:"" });
  const [respDone, setRespDone]     = useState(false);
  const [respSaving, setRespSaving] = useState(false);
  const [respError, setRespError]   = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: erData }, { data: chData }] = await Promise.all([
          supabase.from("emergency_requests").select("*").eq("status","active").order("created_at",{ascending:false}),
          supabase.from("churches").select("id, name, city, country").eq("verified", true).order("name"),
        ]);
        setRequests(erData || []);
        if (chData) setChurches(chData);
      } catch { setRequests([]); }
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
        church_id: form.church_id || null,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone,
        submittedBy: user?.email || "Anonymous",
        status: "pending",
        created_at: new Date().toISOString(),
      });
      setSubmitted(true);
      const notifyData = {
        title: form.title,
        country: form.country,
        urgency: form.urgency,
        goal: Number(form.goal) || 1000,
      };
      notifyAdmin("emergency_submitted", notifyData);
      // Admin email — separate channel from the WhatsApp notifyAdmin() call
      // above, previously missing entirely for this flow. Fire-and-forget:
      // a slow/failed email must never block the request from completing.
      supabase.functions.invoke("send-notification", {
        body: { type: "emergency_submitted", to: "sendmemissionfund@gmail.com", data: notifyData },
      }).then(({ error }) => {
        if (error) console.error("emergency_submitted admin email failed", error);
      });
    } catch { setSubmitted(true); }
    setSubmitting(false);
  };

  const handleRespond = async () => {
    if (!response.name || !response.email) return;
    setRespSaving(true);
    setRespError("");
    try {
      await supabase.from("emergency_responses").insert({
        emergency_id: responding.id,
        name:         response.name,
        email:        response.email,
        phone:        response.phone,
        amount:       Number(response.amount) || 0,
        note:         response.note,
        created_at:   new Date().toISOString(),
      });
      // Notify admin
      try {
        await supabase.functions.invoke("send-notification", {
          body: {
            type: "emergency_response_notify",
            to:   "sendmemissionfund@gmail.com",
            data: {
              requestTitle:   responding.title,
              responderName:  response.name,
              responderEmail: response.email,
              responderPhone: response.phone,
              amount:         response.amount,
              note:           response.note,
            },
          }
        });
      } catch(e) { console.log("notify error:", e); }
    } catch(e) {
      console.log("respond save error:", e);
      // Pledge record failed to save, but don't block the PayFast redirect
      // if an amount was entered — the payment itself is the priority.
    }

    const amt = Number(response.amount) || 0;
    if (amt > 0) {
      try {
        // Redirect to PayFast to actually collect the pledged amount.
        // The browser navigates away here, so nothing after this line runs
        // on success.
        await startPayfastEmergencyDonation({ emergency: responding, amount: amt, user });
        return;
      } catch (e) {
        console.log("payfast redirect error:", e);
        setRespError("Could not start PayFast checkout. Please try again.");
        setRespSaving(false);
        return;
      }
    }
    setRespDone(true);
    setRespSaving(false);
  };

  const inp = { width:"100%", padding:"12px 14px", borderRadius:10, boxSizing:"border-box", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#eef1ff", fontSize:14, fontFamily:"Georgia, serif", outline:"none", marginBottom:12 };

  // ── Respond view ──────────────────────────────────────────────────
  if (responding) {
    const u = URGENCY[responding.urgency] || URGENCY.urgent;
    return (
      <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
        <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
          <button onClick={()=>{setResponding(null);setRespDone(false);setRespError("");setResponse({name:"",email:"",phone:"",amount:"",note:""});}}
            style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
          <div style={{ fontSize:18, fontWeight:700 }}>Respond to Emergency</div>
        </div>
        <div style={{ maxWidth:600, margin:"0 auto", padding:"28px 20px 60px" }}>
          {respDone ? (
            <div style={{ textAlign:"center", padding:"40px 0" }}>
              <div style={{ fontSize:48, marginBottom:16 }}>🙏</div>
              <div style={{ fontSize:22, fontWeight:700, color:"#eef1ff", marginBottom:10 }}>Response Submitted!</div>
              <div style={{ fontSize:14, color:"rgba(255,255,255,0.5)", lineHeight:1.8, marginBottom:20 }}>
                Thank you, <strong style={{color:"#e8b34b"}}>{response.name}</strong>. Admin and the submitter have been notified. Someone will contact you directly to coordinate.
              </div>
              <div style={{ background:"rgba(232,179,75,0.08)", borderRadius:14, border:"1px solid rgba(232,179,75,0.2)", padding:"16px 20px" }}>
                <div style={{ fontSize:14, color:"#e8b34b", fontStyle:"italic" }}>"Here am I Lord, send me." — Isaiah 6:8</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ background:`${u.color}12`, borderRadius:14, border:`1px solid ${u.color}33`, padding:18, marginBottom:24 }}>
                <div style={{ fontSize:11, color:u.color, letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>{u.label}</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#eef1ff", marginBottom:4 }}>{responding.title}</div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)" }}>📍 {responding.country} · ${fmt(responding.goal||0)} needed</div>
              </div>
              <div style={{ fontSize:15, fontWeight:700, color:"#eef1ff", marginBottom:14 }}>Your Details</div>
              <input placeholder="Your name *" value={response.name} onChange={e=>setResponse(r=>({...r,name:e.target.value}))} style={inp}/>
              <input placeholder="Your email * (we'll contact you here)" type="email" value={response.email} onChange={e=>setResponse(r=>({...r,email:e.target.value}))} style={inp}/>
              <input placeholder="Your phone (optional)" type="tel" value={response.phone} onChange={e=>setResponse(r=>({...r,phone:e.target.value}))} style={inp}/>
              <input placeholder="Amount you can contribute ($) — optional" type="number" value={response.amount} onChange={e=>setResponse(r=>({...r,amount:e.target.value}))} style={inp}/>
              <textarea placeholder="Any message or additional details..." value={response.note} onChange={e=>setResponse(r=>({...r,note:e.target.value}))} style={{...inp,resize:"vertical",minHeight:80}}/>
              {respError && (
                <div style={{ background:"rgba(232,91,91,0.1)", border:"1px solid rgba(232,91,91,0.3)", borderRadius:10, padding:"10px 14px", color:"#e85b5b", fontSize:13, marginBottom:14 }}>
                  {respError}
                </div>
              )}
              <button onClick={handleRespond} disabled={respSaving||!response.name||!response.email}
                style={{ width:"100%", padding:"14px 0", borderRadius:14, border:"none",
                  background:response.name&&response.email?`linear-gradient(135deg,${u.color},${u.color}cc)`:"rgba(255,255,255,0.06)",
                  color:response.name&&response.email?"#fff":"rgba(255,255,255,0.25)",
                  fontWeight:700, cursor:response.name&&response.email?"pointer":"default",
                  fontSize:15, fontFamily:"Georgia, serif" }}>
                {respSaving ? (Number(response.amount)>0 ? "Redirecting to PayFast…" : "Submitting...") : (Number(response.amount)>0 ? `💝 Give $${response.amount} via PayFast` : "💝 Submit Response")}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>Emergency Mission Requests</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>URGENT NEEDS FROM THE FIELD</div>
        </div>
        {canSubmitEmergency && (
          <button onClick={()=>setShowForm(f=>!f)} style={{ marginLeft:"auto", background:"linear-gradient(135deg,#e85b5b,#c44040)", border:"none", borderRadius:10, padding:"8px 16px", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700 }}>
            + Submit Emergency
          </button>
        )}
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
                {churches.length > 0 && (
                  <select value={form.church_id} onChange={e=>setForm(f=>({...f,church_id:e.target.value}))} style={{...inp,color:form.church_id?"#eef1ff":"rgba(255,255,255,0.35)"}}>
                    <option value="" style={{background:"#0c1628"}}>Link a verified church (for payout routing)</option>
                    {churches.map(c => (
                      <option key={c.id} value={c.id} style={{background:"#0c1628"}}>{c.name} — {c.city}, {c.country}</option>
                    ))}
                  </select>
                )}
                <div style={{ height:1, background:"rgba(255,255,255,0.07)", margin:"4px 0 12px" }}/>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>Your Contact Details (so donors can reach you)</div>
                <input placeholder="Contact email * (responses sent here + to admin)" type="email" value={form.contact_email} onChange={e=>setForm(f=>({...f,contact_email:e.target.value}))} style={inp}/>
                <input placeholder="Contact phone (optional)" type="tel" value={form.contact_phone} onChange={e=>setForm(f=>({...f,contact_phone:e.target.value}))} style={inp}/>
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
        ) : requests.length === 0 ? (
          <div style={{ textAlign:"center", padding:"48px 20px", color:"rgba(255,255,255,0.3)", fontSize:14, background:"rgba(255,255,255,0.02)", borderRadius:16, border:"1px solid rgba(255,255,255,0.06)" }}>
            No active emergency requests right now — check back soon, or submit one if you know of an urgent need.
          </div>
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
                      <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginBottom:r.contact_email?4:0 }}>Submitted by: {r.submittedBy}</div>
                      {r.contact_email && <div style={{ fontSize:12, color:"rgba(232,179,75,0.7)" }}>✉ {r.contact_email}{r.contact_phone?" · "+r.contact_phone:""}</div>}
                    </div>
                  </div>
                  <Bar raised={r.raised||0} goal={r.goal||1000} color={u.color}/>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, marginBottom:14 }}>
                    <span style={{ fontSize:13, color:u.color, fontWeight:700 }}>${fmt(r.raised||0)} raised</span>
                    <span style={{ fontSize:12, color:(r.raised||0)>=(r.goal||1000)?"#3ecf8e":"rgba(255,255,255,0.3)" }}>
                      {(r.raised||0)>=(r.goal||1000) ? "✓ Fully Funded" : `$${fmt((r.goal||1000)-(r.raised||0))} still needed`}
                    </span>
                  </div>
                  <button onClick={()=>{setResponding(r);setRespDone(false);setRespError("");setResponse({name:"",email:"",phone:"",amount:"",note:""});}} style={{ width:"100%", padding:"12px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${u.color},${u.color}cc)`, color:"#fff", fontWeight:700, cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>
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
