// AdminFamilyNeeds.js
// Admin screen for the Family In Need state machine:
//   submitted -> pastor_review -> pastor_declined | admin_review
//   -> published -> funded -> paid -> complete | expired
//
// Pastor endorsement itself happens in PastorReview.js's new "Family Needs"
// tab, not here — this screen picks up once a pastor has already endorsed
// (status = admin_review) and carries it through publish, payout, and proof.

import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { notifyAdmin, sendNotification } from "./notifications";

const fmt = (n) => String(Math.round(n||0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const timeAgo = (d) => {
  if (!d) return "";
  const diff = Math.floor((new Date() - new Date(d)) / 1000);
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
};

const CATEGORY_META = {
  food:        { label: "🍲 Food",        color: "#e8b34b" },
  clothing:    { label: "👕 Clothing",     color: "#5b9cf6" },
  electricity: { label: "💡 Electricity",  color: "#f5a44a" },
  school:      { label: "🎒 School",       color: "#b06cf5" },
  medical:     { label: "🏥 Medical",      color: "#e85b5b" },
  other:       { label: "🤝 Other",        color: "#3ecf8e" },
};

// Very light heuristic — surname match between applicant and the church's
// own pastor name. Design doc calls for FLAGGING this, never blocking it;
// a shared surname is common and often innocent (small towns, common
// surnames), so this is a visibility aid for admin judgment, not a rule.
const surnameOf = (fullName) => (fullName || "").trim().split(/\s+/).pop()?.toLowerCase() || "";
const flagSurnameMatch = (applicantName, pastorName) => {
  const a = surnameOf(applicantName), p = surnameOf(pastorName);
  return a && p && a === p;
};

export default function AdminFamilyNeeds({ onBack, adminEmail }) {
  const [needs, setNeeds]         = useState([]);
  const [proofs, setProofs]       = useState([]);
  const [churches, setChurches]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState("admin_review");
  const [summaryById, setSummaryById] = useState({});
  const [busyId, setBusyId]       = useState(null);
  const [error, setError]         = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [{ data: needData, error: needErr }, { data: proofData }, { data: chData }] = await Promise.all([
        supabase.from("family_needs").select("*").order("created_at", { ascending: false }),
        supabase.from("family_need_proofs").select("*").order("submitted_at", { ascending: false }),
        supabase.from("churches").select("id, name, pastor_name, pastor_email"),
      ]);
      if (needErr) throw needErr;
      setNeeds(needData || []);
      setProofs(proofData || []);
      setChurches(chData || []);
    } catch (e) {
      setError("Could not load family needs. (" + (e.message || "") + ")");
      setNeeds([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const churchById = (id) => churches.find(c => c.id === id);

  // Pastor-endorsement-pattern visibility — design doc: "surface pastor
  // endorsement patterns to admin — a pastor repeatedly endorsing the same
  // people isn't necessarily wrong, but you want visibility into it."
  // Simple count of endorsed (non-declined, past submitted) needs per church.
  const endorsementCounts = needs.reduce((acc, n) => {
    if (n.church_id && n.pastor_endorsed_at) acc[n.church_id] = (acc[n.church_id] || 0) + 1;
    return acc;
  }, {});

  const publish = async (n) => {
    const summary = (summaryById[n.id] || "").trim();
    if (!summary) {
      window.alert("Write a public summary before publishing — it's what donors will see instead of any private family details.");
      return;
    }
    setBusyId(n.id);
    try {
      const { error } = await supabase
        .from("family_needs")
        .update({ public_summary: summary, status: "published", admin_published_at: new Date().toISOString() })
        .eq("id", n.id);
      if (error) throw error;
      setNeeds(prev => prev.map(x => x.id === n.id ? { ...x, public_summary: summary, status: "published" } : x));
      const church = churchById(n.church_id);
      sendNotification("family_need_published", church?.pastor_email, { category: n.category, city: n.city });
    } catch (e) {
      window.alert("Could not publish: " + (e.message || ""));
    }
    setBusyId(null);
  };

  const markFunded = async (n) => {
    setBusyId(n.id);
    try {
      const { error } = await supabase
        .from("family_needs")
        .update({ status: "funded", funded_at: new Date().toISOString() })
        .eq("id", n.id);
      if (error) throw error;
      setNeeds(prev => prev.map(x => x.id === n.id ? { ...x, status: "funded" } : x));
      const church = churchById(n.church_id);
      sendNotification("family_need_funded", church?.pastor_email, { category: n.category, city: n.city, amount: n.goal });
      notifyAdmin("family_need_funded", { category: n.category, city: n.city, amount: n.goal });
    } catch (e) {
      window.alert("Could not update status: " + (e.message || ""));
    }
    setBusyId(null);
  };

  // Same hard payout safeguard as AdminPayouts.js's markPaid/markEmPaid: the
  // amount owed is the raw goal (not the 10%-surcharge-inclusive
  // collection_target — that surcharge is SendMe's operating cost, not part
  // of what the church is owed), and marking paid is blocked unless enough
  // has actually been raised to cover it. This is a records-only toggle —
  // no real transfer happens here, same as everywhere else in AdminPayouts.
  const markPaid = async (n) => {
    const raised = n.raised || 0;
    const owed = n.goal || 0;
    if (raised < owed) {
      window.alert(
        `⚠ Not enough has been raised yet for this payout.\n\n` +
        `This ${n.category} need has raised $${fmt(raised)} so far, but the requested amount is $${fmt(owed)}.\n\n` +
        `Wait until more donations land before marking this as paid.`
      );
      return;
    }
    const church = churchById(n.church_id);
    const ok = window.confirm(
      `This only updates SendMe's records — it does NOT send any money.\n\n` +
      `Have you already completed the EFT transfer of $${fmt(owed)} to ${church?.name || "the endorsing church"} for this family need?\n\n` +
      `Click OK only if that transfer is already done.`
    );
    if (!ok) return;
    setBusyId(n.id);
    try {
      const { error } = await supabase
        .from("family_needs")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", n.id);
      if (error) throw error;
      setNeeds(prev => prev.map(x => x.id === n.id ? { ...x, status: "paid" } : x));
      notifyAdmin("payout_processed", { missionTitle: `Family In Need — ${n.category} (${n.city})`, amount: owed, recipientName: church?.name || "endorsing church" });
    } catch (e) {
      window.alert("Could not update status: " + (e.message || ""));
    }
    setBusyId(null);
  };

  const decideProof = async (proof, decision, reason) => {
    setBusyId(proof.id);
    try {
      const { error } = await supabase
        .from("family_need_proofs")
        .update({ status: decision })
        .eq("id", proof.id);
      if (error) throw error;
      setProofs(prev => prev.map(p => p.id === proof.id ? { ...p, status: decision } : p));
      const n = needs.find(x => x.id === proof.need_id);
      const church = n ? churchById(n.church_id) : null;
      if (decision === "approved") {
        const { error: needErr } = await supabase
          .from("family_needs")
          .update({ status: "complete" })
          .eq("id", proof.need_id);
        if (needErr) throw needErr;
        setNeeds(prev => prev.map(x => x.id === proof.need_id ? { ...x, status: "complete" } : x));
      } else if (decision === "rejected" && church?.pastor_email && n) {
        // Fire-and-forget, same pattern as every other admin action here.
        sendNotification("family_need_proof_submitted", church.pastor_email, {
          pastorName: church.pastor_name || "",
          category: n.category,
          city: n.city,
          reason: reason || "",
        }).catch(err => console.error("family_need_proof_submitted email threw", err));
      }
    } catch (e) {
      window.alert("Could not update proof: " + (e.message || ""));
    }
    setBusyId(null);
  };

  const decline = async (n) => {
    const reason = window.prompt("Reason for declining this family need (shown to the pastor):");
    if (reason === null) return;
    setBusyId(n.id);
    try {
      const { error } = await supabase
        .from("family_needs")
        .update({ status: "pastor_declined", pastor_decline_reason: reason || null })
        .eq("id", n.id);
      if (error) throw error;
      setNeeds(prev => prev.map(x => x.id === n.id ? { ...x, status: "pastor_declined", pastor_decline_reason: reason } : x));
    } catch (e) {
      window.alert("Could not update status: " + (e.message || ""));
    }
    setBusyId(null);
  };

  const counts = {
    admin_review: needs.filter(n => n.status === "admin_review").length,
    published:    needs.filter(n => n.status === "published").length,
    funded:       needs.filter(n => n.status === "funded").length,
    paid:         needs.filter(n => n.status === "paid").length,
    proofs:       proofs.filter(p => p.status === "pending").length,
    other:        needs.filter(n => ["submitted","pastor_review","pastor_declined","complete","expired"].includes(n.status)).length,
  };

  const filtered = filter === "proofs"
    ? []
    : filter === "other"
    ? needs.filter(n => ["submitted","pastor_review","pastor_declined","complete","expired"].includes(n.status))
    : needs.filter(n => n.status === filter);

  const pendingProofs = proofs.filter(p => p.status === "pending");

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:700 }}>🤝 Family In Need — Admin</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>NOT LIVE YET — SEQUENCED AFTER PAYFAST + STABLE MISSIONS</div>
        </div>
      </div>

      <div style={{ maxWidth:760, margin:"0 auto", padding:"24px 20px 60px" }}>

        {error && <div style={{ background:"rgba(232,91,91,0.08)", border:"1px solid rgba(232,91,91,0.25)", borderRadius:10, padding:"10px 14px", marginBottom:16, color:"#e85b5b", fontSize:13 }}>{error}</div>}

        <div style={{ display:"flex", background:"rgba(255,255,255,0.04)", borderRadius:10, padding:3, gap:3, marginBottom:20, flexWrap:"wrap" }}>
          {[
            ["admin_review", `Ready to Publish (${counts.admin_review})`],
            ["published",    `Published (${counts.published})`],
            ["funded",       `Funded — Pay Out (${counts.funded})`],
            ["paid",         `Paid (${counts.paid})`],
            ["proofs",       `Proof Review (${counts.proofs})`],
            ["other",        `Other (${counts.other})`],
          ].map(([key,label]) => (
            <button key={key} onClick={()=>setFilter(key)} style={{ padding:"8px 14px", borderRadius:8, border:"none", cursor:"pointer", fontSize:12, fontFamily:"Georgia, serif", fontWeight:600,
              background: filter===key ? "linear-gradient(135deg,#3ecf8e,#2aaf74)" : "transparent",
              color: filter===key ? "#000" : "rgba(255,255,255,0.4)",
            }}>{label}</button>
          ))}
        </div>

        {loading && <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)" }}>Loading...</div>}

        {/* ── Proof Review tab ─────────────────────────────────────────── */}
        {!loading && filter === "proofs" && (
          pendingProofs.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>No proofs awaiting review.</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {pendingProofs.map(p => {
                const n = needs.find(x => x.id === p.need_id);
                const meta = n ? (CATEGORY_META[n.category] || CATEGORY_META.other) : CATEGORY_META.other;
                return (
                  <div key={p.id} style={{ background:"#0c1628", borderRadius:16, border:`1px solid ${meta.color}33`, padding:20 }}>
                    <div style={{ fontSize:12, color:meta.color, marginBottom:8 }}>{meta.label} · {n ? `${n.city}, ${n.country}` : "Unknown need"}</div>
                    <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.7, marginBottom:10 }}>{p.description}</div>
                    {p.receipt_url && <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:"#5b9cf6", display:"block", marginBottom:6 }}>📎 View Receipt ↗</a>}
                    {p.media_url && <a href={p.media_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:"#5b9cf6", display:"block", marginBottom:12 }}>📎 View Delivery Photo ↗</a>}
                    <div style={{ display:"flex", gap:8 }}>
                      <button disabled={busyId===p.id} onClick={()=>decideProof(p,"approved")} style={{ flex:1, padding:"10px 0", borderRadius:12, border:"none", background:"linear-gradient(135deg,#3ecf8e,#2aaf74)", color:"#000", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif" }}>✓ Approve — Mark Complete</button>
                      <button disabled={busyId===p.id} onClick={()=>{ const reason = window.prompt("What needs to change before this proof can be approved? (sent to the pastor)"); if (reason !== null) decideProof(p,"rejected",reason); }} style={{ flex:1, padding:"10px 0", borderRadius:12, border:"1px solid rgba(232,91,91,0.35)", background:"rgba(232,91,91,0.08)", color:"#e85b5b", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif" }}>✗ Reject</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Need cards (all other tabs) ──────────────────────────────── */}
        {!loading && filter !== "proofs" && (
          filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>Nothing here.</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {filtered.map(n => {
                const meta = CATEGORY_META[n.category] || CATEGORY_META.other;
                const church = churchById(n.church_id);
                const target = n.collection_target || Math.round((n.goal||0)*1.1);
                const flagged = flagSurnameMatch(n.applicant_name, church?.pastor_name);
                const endorsementCount = n.church_id ? (endorsementCounts[n.church_id] || 0) : 0;
                return (
                  <div key={n.id} style={{ background:"#0c1628", borderRadius:16, border:`1px solid ${meta.color}33`, borderLeft:`4px solid ${meta.color}`, padding:20 }}>
                    <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap", alignItems:"center" }}>
                      <span style={{ fontSize:12, padding:"3px 10px", borderRadius:999, background:`${meta.color}18`, color:meta.color, border:`1px solid ${meta.color}33`, fontWeight:600 }}>{meta.label}</span>
                      <span style={{ fontSize:11, padding:"3px 10px", borderRadius:999, background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.4)" }}>{n.status}</span>
                      <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>📍 {n.city}, {n.country} · {timeAgo(n.created_at)}</span>
                    </div>

                    {/* Private detail — visible to admin only, this screen is never public */}
                    <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.7, marginBottom:10 }}>{n.description}</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginBottom:4 }}>Applicant: {n.applicant_name} {n.household_size ? `· ${n.household_size} in household` : ""}</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginBottom:4 }}>⛪ Church: {church?.name || "Unknown"} {endorsementCount > 1 && <span style={{ color:"#e8b34b" }}>· {endorsementCount} endorsements from this church</span>}</div>
                    {flagged && (
                      <div style={{ fontSize:12, color:"#e85b5b", background:"rgba(232,91,91,0.08)", border:"1px solid rgba(232,91,91,0.2)", borderRadius:8, padding:"6px 10px", marginBottom:8, display:"inline-block" }}>
                        ⚠ Flagged: applicant shares a surname with the endorsing pastor — not necessarily wrong, worth a quick look.
                      </div>
                    )}

                    <div style={{ fontSize:13, fontWeight:700, color:meta.color, marginTop:8 }}>Amount needed: ${fmt(n.goal)}</div>
                    {n.platform_surcharge != null && (
                      <div style={{ fontSize:12, color:"#5b9cf6", marginTop:2 }}>+ ${fmt(n.platform_surcharge)} platform surcharge (10%) — ${fmt(target)} total asked from donors</div>
                    )}
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:4 }}>${fmt(n.raised||0)} raised of ${fmt(target)}</div>

                    {n.status === "pastor_declined" && n.pastor_decline_reason && (
                      <div style={{ background:"rgba(232,91,91,0.08)", border:"1px solid rgba(232,91,91,0.2)", borderRadius:10, padding:"10px 14px", marginTop:10, fontSize:12, color:"rgba(255,255,255,0.6)" }}>
                        <strong style={{ color:"#e85b5b" }}>Decline reason:</strong> {n.pastor_decline_reason}
                      </div>
                    )}

                    {n.status === "admin_review" && (
                      <>
                        <textarea
                          placeholder="Write the public-facing summary — this is what donors will see. No names, no addresses. e.g. 'A family of five facing an urgent electricity reconnection.'"
                          value={summaryById[n.id] || ""}
                          onChange={e=>setSummaryById(prev => ({ ...prev, [n.id]: e.target.value }))}
                          style={{ width:"100%", marginTop:14, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"10px 12px", color:"#eef1ff", fontSize:13, fontFamily:"Georgia, serif", resize:"vertical", minHeight:60, boxSizing:"border-box" }}
                        />
                        <div style={{ display:"flex", gap:8, marginTop:10 }}>
                          <button disabled={busyId===n.id} onClick={()=>publish(n)} style={{ flex:1, padding:"10px 0", borderRadius:12, border:"none", background:"linear-gradient(135deg,#3ecf8e,#2aaf74)", color:"#000", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif" }}>✓ Publish</button>
                          <button disabled={busyId===n.id} onClick={()=>decline(n)} style={{ flex:1, padding:"10px 0", borderRadius:12, border:"1px solid rgba(232,91,91,0.35)", background:"rgba(232,91,91,0.08)", color:"#e85b5b", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif" }}>✗ Decline</button>
                        </div>
                      </>
                    )}

                    {n.status === "published" && (n.raised||0) >= target && (
                      <button disabled={busyId===n.id} onClick={()=>markFunded(n)} style={{ marginTop:14, width:"100%", padding:"10px 0", borderRadius:12, border:"none", background:"linear-gradient(135deg,#e8b34b,#c8942b)", color:"#000", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif" }}>
                        Mark as Fully Funded
                      </button>
                    )}

                    {n.status === "funded" && (
                      <div style={{ marginTop:14, background:"rgba(91,156,246,0.06)", border:"1px solid rgba(91,156,246,0.2)", borderRadius:10, padding:"10px 14px" }}>
                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:8 }}>💸 Amount to pay out to {church?.name || "the endorsing church"}</div>
                        <div style={{ fontSize:16, fontWeight:700, color:"#5b9cf6", marginBottom:10 }}>${fmt(n.goal)} <span style={{ fontSize:11, fontWeight:400, color:"rgba(255,255,255,0.3)" }}>(raw amount needed, not the surcharge-inclusive total)</span></div>
                        <button disabled={busyId===n.id} onClick={()=>markPaid(n)} style={{ width:"100%", padding:"10px 0", borderRadius:12, border:"none", background:"linear-gradient(135deg,#5b9cf6,#3a7bd5)", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif" }}>
                          Mark as Paid to Church
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
