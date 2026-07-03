import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { notifyAdmin } from "./notifications";

const REQUEST_TYPES = {
  missionary_team: { label:"Missionary Team",  color:"#e8b34b" },
  bible_teacher:   { label:"Bible Teacher",    color:"#5b9cf6" },
  evangelist:      { label:"Evangelist",       color:"#4caf7d" },
  pastor_visit:    { label:"Pastor Visit",     color:"#b06cf5" },
  other:           { label:"Other",            color:"rgba(255,255,255,0.4)" },
};

const timeAgo = (d) => {
  const diff = Math.floor((new Date() - new Date(d)) / 86400000);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : `${diff}d ago`;
};

export default function SendAWorker({ onBack, user }) {
  const [requests, setRequests]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [responding, setResponding] = useState(null);
  const [form, setForm]             = useState({ title:"", description:"", church:"", city:"", country:"", type:"missionary_team", need1:"", need2:"", need3:"" });
  const [response, setResponse]     = useState({ commitment:"", note:"" });
  const [submitMsg, setSubmitMsg]   = useState("");
  const [responded, setResponded]   = useState(false);

  const inp = { width:"100%", padding:"12px 14px", borderRadius:10, boxSizing:"border-box", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#eef1ff", fontSize:14, fontFamily:"Georgia, serif", outline:"none", marginBottom:12 };

  useEffect(() => { loadRequests(); }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("worker_requests")
        .select("*")
        .neq("status", "closed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRequests(data || []);
    } catch (e) {
      console.error("SendAWorker load error:", e);
      setRequests([]);
    }
    setLoading(false);
  };

  const submitRequest = async () => {
    if (!form.title || !form.church || !form.country) return;
    try {
      const { data, error } = await supabase
        .from("worker_requests")
        .insert({
          title:       form.title,
          description: form.description,
          church:      form.church,
          city:        form.city || null,
          country:     form.country,
          type:        form.type,
          needs:       [form.need1, form.need2, form.need3].filter(Boolean),
          responses:   0,
          status:      "open",
          user_id:     user?.id || null,
          created_at:  new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      setRequests(r => [data, ...r]);
      setForm({ title:"", description:"", church:"", city:"", country:"", type:"missionary_team", need1:"", need2:"", need3:"" });
      setSubmitMsg("✝ Request posted! Other churches can now see and respond to your need.");
      setShowForm(false);
      notifyAdmin("worker_request", {
        title:   form.title,
        church:  form.church,
        city:    form.city,
        country: form.country,
        type:    form.type,
      });
    } catch (e) {
      setSubmitMsg("⚠ Could not post request: " + (e.message || "Please try again."));
    }
  };

  const submitResponse = async (req) => {
    try {
      await supabase.from("worker_responses").insert({
        request_id:      req.id,
        commitment:      response.commitment,
        note:            response.note,
        responder_email: user?.email || null,
        user_id:         user?.id || null,
      });
      await supabase.from("worker_requests").update({ responses: (req.responses || 0) + 1 }).eq("id", req.id);
    } catch (e) {
      console.error("submitResponse error:", e);
    }
    setRequests(r => r.map(x => x.id === req.id ? {...x, responses:(x.responses||0)+1} : x));
    setResponded(true);
  };

  if (responding) {
    const req = responding;
    const t = REQUEST_TYPES[req.type] || REQUEST_TYPES.other;
    return (
      <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
        <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
          <button onClick={()=>{setResponding(null);setResponded(false);}} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
          <div style={{ fontSize:18, fontWeight:700 }}>Respond to Request</div>
        </div>
        <div style={{ maxWidth:600, margin:"0 auto", padding:"28px 20px 60px" }}>
          {responded ? (
            <div style={{ textAlign:"center", padding:"40px 0" }}>
              <div style={{ fontSize:48, marginBottom:16 }}>🙏</div>
              <div style={{ fontSize:22, fontWeight:700, color:"#eef1ff", marginBottom:10 }}>Response Submitted!</div>
              <div style={{ fontSize:14, color:"rgba(255,255,255,0.5)", lineHeight:1.8, marginBottom:20 }}>
                <strong style={{ color:"#e8b34b" }}>{req.church}</strong> in {req.city ? `${req.city}, ` : ""}{req.country} will be notified of your response. They will contact you directly to coordinate.
              </div>
              <div style={{ background:"rgba(232,179,75,0.08)", borderRadius:14, border:"1px solid rgba(232,179,75,0.2)", padding:"16px 20px" }}>
                <div style={{ fontSize:14, color:"#e8b34b", fontStyle:"italic" }}>"Here am I Lord, send me." — Isaiah 6:8</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ background:`${t.color}12`, borderRadius:14, border:`1px solid ${t.color}33`, padding:18, marginBottom:20 }}>
                <div style={{ fontSize:11, color:t.color, letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>{t.label} Needed</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#eef1ff", marginBottom:4 }}>{req.title}</div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)" }}>{req.church}{req.city ? ` · ${req.city}` : ""} · {req.country}</div>
              </div>
              <div style={{ fontSize:15, fontWeight:700, color:"#eef1ff", marginBottom:14 }}>Your Response</div>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>What can you offer?</div>
                {[["We will send workers","send_workers"],["We will support transport","transport"],["We will host them","hosting"],["We will provide funding","funding"]].map(([label,val]) => (
                  <div key={val} onClick={()=>setResponse(r=>({...r,commitment:val}))}
                    style={{ display:"flex", gap:12, alignItems:"center", padding:"12px 14px", borderRadius:10, marginBottom:8, cursor:"pointer", background:response.commitment===val?"rgba(232,179,75,0.1)":"rgba(255,255,255,0.02)", border:`1px solid ${response.commitment===val?"rgba(232,179,75,0.35)":"rgba(255,255,255,0.07)"}`, transition:"all .2s" }}>
                    <div style={{ width:20, height:20, borderRadius:"50%", background:response.commitment===val?"linear-gradient(135deg,#e8b34b,#c8942b)":"rgba(255,255,255,0.08)", border:response.commitment===val?"none":"1px solid rgba(255,255,255,0.2)", flexShrink:0 }}/>
                    <span style={{ fontSize:14, color:response.commitment===val?"#eef1ff":"rgba(255,255,255,0.5)" }}>{label}</span>
                  </div>
                ))}
              </div>
              <textarea value={response.note} onChange={e=>setResponse(r=>({...r,note:e.target.value}))}
                placeholder="Add any additional details about your response..."
                style={{ ...inp, resize:"none", height:80 }}/>
              <button onClick={()=>submitResponse(req)} disabled={!response.commitment}
                style={{ width:"100%", padding:"14px 0", borderRadius:14, border:"none", background:response.commitment?"linear-gradient(135deg,#e8b34b,#c8942b)":"rgba(255,255,255,0.06)", color:response.commitment?"#000":"rgba(255,255,255,0.25)", fontWeight:700, cursor:response.commitment?"pointer":"default", fontSize:15, fontFamily:"Georgia, serif", boxShadow:response.commitment?"0 6px 24px rgba(232,179,75,0.4)":"none" }}>
                Submit Response
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
          <div style={{ fontSize:18, fontWeight:700 }}>Send a Worker</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>CHURCH-TO-CHURCH COORDINATION</div>
        </div>
        <button onClick={()=>{setShowForm(f=>!f);setSubmitMsg("");}} style={{ marginLeft:"auto", background:"linear-gradient(135deg,#e8b34b,#c8942b)", border:"none", borderRadius:10, padding:"8px 16px", color:"#000", cursor:"pointer", fontSize:13, fontWeight:700 }}>
          + Post a Need
        </button>
      </div>

      <div style={{ maxWidth:680, margin:"0 auto", padding:"28px 20px 60px" }}>

        <div style={{ background:"rgba(232,179,75,0.07)", borderRadius:14, border:"1px solid rgba(232,179,75,0.2)", padding:"14px 18px", marginBottom:24, display:"flex", gap:10 }}>
          <span style={{ fontSize:18, flexShrink:0 }}>✝</span>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", lineHeight:1.7 }}>
            Churches can request missionaries, Bible teachers and evangelists. Other churches respond by sending workers, transport or hosting. This turns SendMe into a <strong style={{ color:"#e8b34b" }}>global coordination platform</strong> — not just donations.
          </div>
        </div>

        {submitMsg && (
          <div style={{ background: submitMsg.startsWith("⚠") ? "rgba(232,91,91,0.1)" : "rgba(62,207,142,0.1)", border:`1px solid ${submitMsg.startsWith("⚠") ? "rgba(232,91,91,0.3)" : "rgba(62,207,142,0.3)"}`, borderRadius:12, padding:"12px 16px", marginBottom:20, fontSize:14, color: submitMsg.startsWith("⚠") ? "#e85b5b" : "#3ecf8e" }}>
            {submitMsg}
          </div>
        )}

        {showForm && (
          <div style={{ background:"#0c1628", borderRadius:16, border:"1px solid rgba(232,179,75,0.25)", padding:20, marginBottom:24 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#eef1ff", marginBottom:16 }}>Post a Worker Request</div>
            <input placeholder="Request title *" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={inp}/>
            <input placeholder="Your church name *" value={form.church} onChange={e=>setForm(f=>({...f,church:e.target.value}))} style={inp}/>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <input placeholder="City / Area *" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} style={inp}/>
              <input placeholder="Country *" value={form.country} onChange={e=>setForm(f=>({...f,country:e.target.value}))} style={inp}/>
            </div>
            <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{...inp,color:"#eef1ff"}}>
              {Object.entries(REQUEST_TYPES).map(([val,{label}]) => (
                <option key={val} value={val} style={{background:"#0c1628"}}>{label}</option>
              ))}
            </select>
            <textarea placeholder="Describe the need in detail *" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{...inp,resize:"vertical",minHeight:80}}/>
            <input placeholder="Need 1 (e.g. 2 missionaries)" value={form.need1} onChange={e=>setForm(f=>({...f,need1:e.target.value}))} style={inp}/>
            <input placeholder="Need 2 (optional)" value={form.need2} onChange={e=>setForm(f=>({...f,need2:e.target.value}))} style={inp}/>
            <input placeholder="Need 3 (optional)" value={form.need3} onChange={e=>setForm(f=>({...f,need3:e.target.value}))} style={inp}/>
            <button onClick={submitRequest} disabled={!form.title||!form.church||!form.country}
              style={{ width:"100%", padding:"13px 0", borderRadius:12, border:"none", background:form.title&&form.church&&form.country?"linear-gradient(135deg,#e8b34b,#c8942b)":"rgba(255,255,255,0.06)", color:form.title&&form.church&&form.country?"#000":"rgba(255,255,255,0.25)", fontWeight:700, cursor:form.title&&form.church&&form.country?"pointer":"default", fontSize:15, fontFamily:"Georgia, serif" }}>
              Post Request
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>Loading requests...</div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>No open worker requests yet. Be the first to post a need!</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {requests.map(req => {
              const t = REQUEST_TYPES[req.type] || REQUEST_TYPES.other;
              return (
                <div key={req.id} style={{ background:"#0c1628", borderRadius:16, border:`1px solid ${t.color}33`, borderLeft:`3px solid ${t.color}`, padding:20 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, marginBottom:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6, flexWrap:"wrap" }}>
                        <span style={{ fontSize:11, padding:"3px 10px", borderRadius:999, background:`${t.color}18`, color:t.color, border:`1px solid ${t.color}44`, fontWeight:600 }}>{t.label}</span>
                        <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>📍 {req.city ? `${req.city}, ` : ""}{req.country} · {timeAgo(req.created_at)}</span>
                      </div>
                      <div style={{ fontSize:15, fontWeight:700, color:"#eef1ff", marginBottom:4 }}>{req.title}</div>
                      <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:4 }}>{req.church}</div>
                      {req.contact_email && <div style={{ fontSize:12, color:"rgba(232,179,75,0.7)", marginBottom:10 }}>✉ {req.contact_email}{req.contact_phone?" · "+req.contact_phone:""}</div>}
                      <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.7, marginBottom:12 }}>{req.description}</div>
                      {req.needs && req.needs.length > 0 && (
                        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:12 }}>
                          {req.needs.map((need,i) => (
                            <div key={i} style={{ display:"flex", gap:8, alignItems:"center" }}>
                              <div style={{ width:6, height:6, borderRadius:"50%", background:t.color, flexShrink:0 }}/>
                              <span style={{ fontSize:13, color:"rgba(255,255,255,0.6)" }}>{need}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>{req.responses} {req.responses===1?"response":"responses"}</span>
                    <button onClick={()=>{setResponding(req);setResponded(false);setResponse({commitment:"",note:""});}}
                      style={{ padding:"9px 20px", borderRadius:10, border:"none", background:`linear-gradient(135deg,${t.color},${t.color}cc)`, color:"#000", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif" }}>
                      Respond to This Need
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ textAlign:"center", padding:"32px 0 0", borderTop:"1px solid rgba(255,255,255,0.05)", marginTop:32 }}>
          <div style={{ fontSize:13, color:"#e8b34b", fontStyle:"italic" }}>"How then shall they call on him in whom they have not believed? and how shall they believe in him of whom they have not heard? and how shall they hear without a preacher?" — Romans 10:14</div>
        </div>
      </div>
    </div>
  );
}
