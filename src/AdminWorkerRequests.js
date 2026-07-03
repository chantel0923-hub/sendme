// AdminWorkerRequests.js
// Admin screen to view and manage Send a Worker requests and responses.
// Accessible via AdminApprovals.js tab or directly via onAdminWorkers prop.

import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const timeAgo = (d) => {
  const diff = Math.floor((new Date() - new Date(d)) / 1000);
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
};

const REQUEST_TYPES = {
  missionary_team: { label:"Missionary Team", color:"#e8b34b" },
  bible_teacher:   { label:"Bible Teacher",   color:"#5b9cf6" },
  evangelist:      { label:"Evangelist",      color:"#4caf7d" },
  transport:       { label:"Transport Help",  color:"#f5a44a" },
  hosting:         { label:"Hosting",         color:"#b06cf5" },
  other:           { label:"Other Need",      color:"rgba(255,255,255,0.4)" },
};

export default function AdminWorkerRequests({ onBack }) {
  const [requests, setRequests]     = useState([]);
  const [responses, setResponses]   = useState({});
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState(null);
  const [filter, setFilter]         = useState("open"); // open | all

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: rqData, error } = await supabase
          .from("worker_requests")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setRequests(rqData || []);

        // Load responses for all requests
        const { data: rpData } = await supabase
          .from("worker_responses")
          .select("*")
          .order("created_at", { ascending: false });
        const grouped = {};
        (rpData || []).forEach(r => {
          if (!grouped[r.request_id]) grouped[r.request_id] = [];
          grouped[r.request_id].push(r);
        });
        setResponses(grouped);
      } catch (e) {
        console.log("AdminWorkerRequests fetch error:", e);
      }
      setLoading(false);
    };
    load();
  }, []);

  const closeRequest = async (id) => {
    const { error } = await supabase
      .from("worker_requests")
      .update({ status: "closed" })
      .eq("id", id);
    if (!error) setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "closed" } : r));
    else console.log("closeRequest error:", error);
  };

  const reopenRequest = async (id) => {
    const { error } = await supabase
      .from("worker_requests")
      .update({ status: "open" })
      .eq("id", id);
    if (!error) setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "open" } : r));
  };

  const deleteRequest = async (id) => {
    if (!window.confirm("Delete this request permanently?")) return;
    const { error } = await supabase.from("worker_requests").delete().eq("id", id);
    if (!error) setRequests(prev => prev.filter(r => r.id !== id));
    else console.log("deleteRequest error:", error);
  };

  const filtered = filter === "open"
    ? requests.filter(r => r.status !== "closed")
    : requests;

  const openCount   = requests.filter(r => r.status !== "closed").length;
  const totalResp   = Object.values(responses).reduce((a, b) => a + b.length, 0);

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      {/* Header */}
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:700 }}>Worker Requests</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>SENDME ADMIN — CHURCH-TO-CHURCH COORDINATION</div>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"24px 20px 60px" }}>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:24 }}>
          {[
            ["📋", openCount, "Open Requests", "#e8b34b"],
            ["📬", totalResp, "Total Responses", "#4caf7d"],
            ["✅", requests.filter(r=>r.status==="closed").length, "Closed", "rgba(255,255,255,0.4)"],
          ].map(([icon, val, label, color]) => (
            <div key={label} style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", padding:"16px 12px", textAlign:"center" }}>
              <div style={{ fontSize:22 }}>{icon}</div>
              <div style={{ fontSize:22, fontWeight:700, color, marginTop:4 }}>{val}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display:"flex", background:"rgba(255,255,255,0.04)", borderRadius:10, padding:3, gap:3, marginBottom:20, width:"fit-content" }}>
          {[["open","Open Requests"],["all","All (incl. closed)"]].map(([key, label]) => (
            <button key={key} onClick={()=>setFilter(key)} style={{ padding:"8px 18px", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif", fontWeight:600,
              background: filter===key ? "linear-gradient(135deg,#e8b34b,#c8942b)" : "transparent",
              color: filter===key ? "#000" : "rgba(255,255,255,0.4)",
            }}>{label}</button>
          ))}
        </div>

        {loading && <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)" }}>Loading requests...</div>}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>
            No {filter === "open" ? "open" : ""} worker requests yet.
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {filtered.map(req => {
            const t = REQUEST_TYPES[req.type] || REQUEST_TYPES.other;
            const reqResponses = responses[req.id] || [];
            const isClosed = req.status === "closed";
            const isExpanded = expanded === req.id;

            return (
              <div key={req.id} style={{ background:"#0c1628", borderRadius:16, border:`1px solid ${isClosed?"rgba(255,255,255,0.07)":t.color+"33"}`, borderLeft:`4px solid ${isClosed?"rgba(255,255,255,0.15)":t.color}`, padding:20 }}>

                {/* Request header */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, marginBottom:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                      <span style={{ fontSize:11, padding:"3px 10px", borderRadius:999, background:`${t.color}18`, color:t.color, border:`1px solid ${t.color}33` }}>{t.label}</span>
                      {isClosed && <span style={{ fontSize:11, padding:"3px 10px", borderRadius:999, background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.3)" }}>Closed</span>}
                      <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>📍 {req.country} · {timeAgo(req.created_at)}</span>
                    </div>
                    <div style={{ fontSize:15, fontWeight:700, color: isClosed?"rgba(255,255,255,0.4)":"#eef1ff", marginBottom:3 }}>{req.title}</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:4 }}>{req.church}</div>
                    {req.contact_email && (
                      <div style={{ fontSize:12, color:"rgba(232,179,75,0.7)" }}>✉ {req.contact_email}{req.contact_phone ? " · " + req.contact_phone : ""}</div>
                    )}
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:18, fontWeight:700, color: reqResponses.length > 0 ? "#4caf7d" : "rgba(255,255,255,0.3)" }}>{reqResponses.length}</div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>response{reqResponses.length!==1?"s":""}</div>
                  </div>
                </div>

                <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", lineHeight:1.7, marginBottom:14 }}>{req.description}</div>

                {/* Needs list */}
                {req.needs && req.needs.length > 0 && (
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
                    {req.needs.map((need, i) => (
                      <span key={i} style={{ fontSize:12, padding:"3px 10px", borderRadius:999, background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.5)", border:"1px solid rgba(255,255,255,0.08)" }}>{need}</span>
                    ))}
                  </div>
                )}

                {/* Responses section */}
                {reqResponses.length > 0 && (
                  <div style={{ marginBottom:14 }}>
                    <button onClick={()=>setExpanded(isExpanded ? null : req.id)}
                      style={{ background:"rgba(62,207,142,0.08)", border:"1px solid rgba(62,207,142,0.25)", borderRadius:10, padding:"8px 14px", color:"#3ecf8e", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"Georgia, serif" }}>
                      {isExpanded ? "▲ Hide" : "▼ View"} {reqResponses.length} Response{reqResponses.length!==1?"s":""}
                    </button>
                    {isExpanded && (
                      <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:10 }}>
                        {reqResponses.map((rp, i) => {
                          const mailBody =
`Dear ${req.church || "Pastor"},

Great news! Someone has responded to your worker request on SendMe:

"${req.title}"

They shared:
${rp.commitment ? rp.commitment.replace(/_/g," ") : "They are willing to help"}
${rp.note ? `"${rp.note}"` : ""}

You can reach them directly at: ${rp.responder_email || "contact SendMe admin for details"}${rp.responder_phone ? " / " + rp.responder_phone : ""}

In His service,
SendMe Global Mission Fund`;
                          const mailtoHref = req.contact_email
                            ? `mailto:${req.contact_email}?subject=${encodeURIComponent(`Someone can help with "${req.title}"`)}&body=${encodeURIComponent(mailBody)}`
                            : null;

                          return (
                            <div key={i} style={{ background:"rgba(62,207,142,0.05)", borderRadius:12, border:"1px solid rgba(62,207,142,0.15)", padding:"12px 14px" }}>
                              <div style={{ fontSize:13, fontWeight:700, color:"#3ecf8e", marginBottom:4 }}>
                                {rp.commitment?.replace(/_/g," ") || "Response"}
                              </div>
                              {rp.responder_email && <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:2 }}>✉ {rp.responder_email}{rp.responder_phone ? " · " + rp.responder_phone : ""}</div>}
                              {rp.note && <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.6, marginTop:6 }}>{rp.note}</div>}
                              <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", marginTop:6, marginBottom:10 }}>{timeAgo(rp.created_at)}</div>
                              {mailtoHref ? (
                                <a href={mailtoHref}
                                  style={{ display:"inline-block", padding:"7px 14px", borderRadius:9, border:"1px solid rgba(232,179,75,0.35)", background:"rgba(232,179,75,0.08)", color:"#e8b34b", cursor:"pointer", fontSize:12, fontFamily:"Georgia, serif", fontWeight:600, textDecoration:"none" }}>
                                  📧 Email {req.church || "the church"} — Someone Can Help
                                </a>
                              ) : (
                                <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)" }}>No church email on file — contact manually.</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Admin actions */}
                <div style={{ display:"flex", gap:8 }}>
                  {!isClosed ? (
                    <button onClick={()=>closeRequest(req.id)}
                      style={{ flex:1, padding:"10px 0", borderRadius:12, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.03)", color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif", fontWeight:600 }}>
                      ✓ Mark as Filled / Close
                    </button>
                  ) : (
                    <button onClick={()=>reopenRequest(req.id)}
                      style={{ flex:1, padding:"10px 0", borderRadius:12, border:"1px solid rgba(232,179,75,0.3)", background:"rgba(232,179,75,0.06)", color:"#e8b34b", cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif", fontWeight:600 }}>
                      ↩ Reopen Request
                    </button>
                  )}
                  <button onClick={()=>deleteRequest(req.id)}
                    style={{ padding:"10px 16px", borderRadius:12, border:"1px solid rgba(232,91,91,0.25)", background:"rgba(232,91,91,0.06)", color:"#e85b5b", cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif", fontWeight:600 }}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
