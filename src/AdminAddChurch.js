import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { COUNTRIES, SIZES, normalizeWhatsApp, geocodeLocation } from "./ChurchRegistration";

// Admin-only screen with two modes:
//   mode="church" -> "Add a Church": the admin registers a church on behalf of a pastor
//                    (no pastor login needed) with two WhatsApp references.
//   mode="need"   -> "Churches in Need": same form plus a private note about the pastor's
//                    struggle, and a list of those churches. Never shown to the public.
// Saving goes through the database function admin_add_church (admin-only, see
// admin-add-church.sql). The church is saved UNVERIFIED so it shows up in Verify Churches.

const inp = {
  width:"100%", padding:"13px 16px", borderRadius:12, boxSizing:"border-box",
  background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
  color:"#eef1ff", fontSize:15, fontFamily:"Georgia, serif", outline:"none", marginBottom:14,
};
const lbl = { fontSize:12, color:"rgba(255,255,255,0.4)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:7, display:"block" };
const card = { background:"#0c1628", borderRadius:20, border:"1px solid rgba(255,255,255,0.08)", padding:"24px 22px", marginBottom:18 };
const sect = { fontSize:16, fontWeight:700, color:"#eef1ff", marginBottom:16, paddingBottom:10, borderBottom:"1px solid rgba(255,255,255,0.07)" };
const goldBtn = { width:"100%", padding:"15px 0", borderRadius:14, border:"none", background:"linear-gradient(135deg,#e8b34b,#c8942b)", color:"#000", fontWeight:700, cursor:"pointer", fontSize:16, fontFamily:"Georgia, serif" };
const greyBtn = { padding:"12px 16px", borderRadius:12, border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.04)", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" };
const waBtn = { padding:"11px 14px", borderRadius:12, border:"1px solid rgba(37,211,102,0.4)", background:"rgba(37,211,102,0.1)", color:"#25d366", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif", textDecoration:"none", display:"inline-block" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyForm = () => ({
  entityType:"church", churchName:"", street:"", city:"", province:"", country:"", otherCountry:"",
  phone:"", email:"", website:"", size:"",
  pastorName:"", pastorEmail:"", pastorPhone:"",
  canEndorse:true, showPhonePublic:false,
  reference1Name:"", reference1Contact:"", reference2Name:"", reference2Contact:"",
  situation:"", helpNeeded:"",
  pastorKnows:false,
});

// Accepts "+27 82 123 4567"; for South African records also "082 123 4567".
const toIntl = (raw, country) => {
  const ok = normalizeWhatsApp(raw);
  if (ok) return ok;
  const digits = String(raw || "").replace(/[\s\-()]/g, "");
  if (country === "South Africa" && /^0\d{9}$/.test(digits)) return "+27" + digits.slice(1);
  return "";
};

const waLink = (number, text) =>
  "https://wa.me/" + String(number || "").replace(/\D/g, "") + "?text=" + encodeURIComponent(text);

const refMessage = (refName, pastorName, churchName, city, country) =>
  `Hello ${refName}, greetings in the Name of the Lord Jesus. 🙏\n\n` +
  `This is Br Donald from SendMe Global Mission Fund (sendmeglobalmission.org), a platform that helps Message-believing churches and missionaries.\n\n` +
  `${pastorName} of ${churchName} (${city}, ${country}) gave us your name as a reference. ` +
  `Could you kindly confirm that you know ${pastorName} and that ${churchName} is genuine and Message-believing?\n\n` +
  `God bless you.`;

const pastorMessage = (pastorName, churchName, city, inNeed) =>
  `Hello ${pastorName}, greetings in the Name of the Lord Jesus. 🙏\n\n` +
  `This is Br Donald from SendMe Global Mission Fund (sendmeglobalmission.org). ` +
  `We have added ${churchName} (${city}) to SendMe. We are just confirming with the two references you gave us.` +
  (inNeed ? `\n\nWe would also love to hear how we can pray for you and stand with you.` : ``) +
  `\n\nGod bless you.`;

const FField = ({ label, children }) => (
  <div>{label && <label style={lbl}>{label}</label>}{children}</div>
);

const validate = (f, mode) => {
  const country = f.country === "Other" ? f.otherCountry.trim() : f.country;
  if (!f.churchName.trim()) return "Please enter the church name.";
  if (!f.city.trim()) return "Please enter the city.";
  if (!country) return "Please choose the country.";
  if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) return "The church email doesn't look right.";
  if (!f.pastorName.trim()) return "Please enter the pastor's name.";
  const pw = toIntl(f.pastorPhone, country);
  if (!pw) return "Please enter the pastor's WhatsApp number with the country code (e.g. +27 82 000 0000).";
  if (f.pastorEmail.trim() && !EMAIL_RE.test(f.pastorEmail.trim())) return "The pastor's email doesn't look right.";
  if (!f.reference1Name.trim()) return "Please enter the first reference's name.";
  const r1 = toIntl(f.reference1Contact, country);
  if (!r1) return "Please enter the first reference's WhatsApp number with the country code.";
  if (!f.reference2Name.trim()) return "Please enter the second reference's name.";
  const r2 = toIntl(f.reference2Contact, country);
  if (!r2) return "Please enter the second reference's WhatsApp number with the country code.";
  if (r1 === r2) return "The two references must be two different people.";
  if (r1 === pw || r2 === pw) return "A reference can't be the pastor himself — use two other people.";
  if (mode === "need" && f.situation.trim().length < 10) return "Please describe the pastor's situation (a sentence or two).";
  if (!f.pastorKnows) return "Please tick the box to confirm the pastor knows and agrees.";
  return null;
};

const STATUS = {
  open:      { label:"Open",             color:"#e85b5b" },
  supported: { label:"Being supported",  color:"#e8b34b" },
  closed:    { label:"Closed",           color:"#3ecf8e" },
};

export default function AdminAddChurch({ onBack, mode = "church", onVerify }) {
  const isNeed = mode === "need";
  const [tab, setTab] = useState("add");
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [filter, setFilter] = useState("open");
  const [busyId, setBusyId] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isOrg = form.entityType === "organization";

  const load = useCallback(async () => {
    setLoading(true); setLoadErr("");
    const { data: needs, error: e1 } = await supabase
      .from("church_needs").select("*").order("created_at", { ascending: false });
    if (e1) {
      setLoadErr(/does not exist|relation|schema cache/i.test(e1.message || "")
        ? "The Churches in Need table isn't set up yet — run admin-add-church.sql in Supabase first."
        : (e1.message || "Could not load the list."));
      setRows([]); setLoading(false); return;
    }
    const ids = (needs || []).map(n => n.church_id);
    let byId = {};
    if (ids.length) {
      const { data: ch, error: e2 } = await supabase.from("churches")
        .select("id,name,city,country,pastor_name,pastor_phone,pastor_email,reference_1_name,reference_1_contact,reference_1_status,reference_2_name,reference_2_contact,reference_2_status,verified,entity_type")
        .in("id", ids);
      if (e2) { setLoadErr(e2.message || "Could not load the churches."); setRows([]); setLoading(false); return; }
      (ch || []).forEach(c => { byId[c.id] = c; });
    }
    setRows((needs || []).map(n => ({ ...n, church: byId[n.church_id] || null })));
    setLoading(false);
  }, []);

  useEffect(() => { if (isNeed && tab === "list") load(); }, [isNeed, tab, load]);

  const submit = async () => {
    const err = validate(form, mode);
    if (err) { setError(err); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setSaving(true); setError("");
    try {
      const country = form.country === "Other" ? form.otherCountry.trim() : form.country;
      const pastorPhone = toIntl(form.pastorPhone, country);
      const r1 = toIntl(form.reference1Contact, country);
      const r2 = toIntl(form.reference2Contact, country);
      const { lat, lng } = await geocodeLocation(form.city.trim(), country, form.street.trim(), form.province.trim());
      const church = {
        name: form.churchName.trim(), street: form.street.trim(), city: form.city.trim(),
        province: form.province.trim(), country,
        phone: form.phone.trim(), email: form.email.trim(), website: form.website.trim(), size: form.size,
        pastor_name: form.pastorName.trim(), pastor_email: form.pastorEmail.trim(), pastor_phone: pastorPhone,
        can_endorse: form.canEndorse, show_phone_public: form.showPhonePublic,
        reference_1_name: form.reference1Name.trim(), reference_1_contact: r1,
        reference_2_name: form.reference2Name.trim(), reference_2_contact: r2,
        entity_type: form.entityType, lat, lng,
      };
      const need = isNeed ? { situation: form.situation.trim(), help_needed: form.helpNeeded.trim() } : null;
      const { data, error: dbErr } = await supabase.rpc("admin_add_church", { p_church: church, p_need: need });
      if (dbErr) throw dbErr;
      if (!data) throw new Error("Nothing was saved. Please try again.");
      setSaved({
        id: data, name: church.name, city: church.city, country, pastorName: church.pastor_name, pastorPhone,
        ref1Name: church.reference_1_name, ref1: r1, ref2Name: church.reference_2_name, ref2: r2,
        pinned: lat != null && lng != null, noEmail: !church.pastor_email, inNeed: isNeed,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const m = e?.message || "Please try again.";
      setError(/function .*admin_add_church|schema cache/i.test(m)
        ? "The database step isn't done yet — run admin-add-church.sql in Supabase first."
        : "Could not save: " + m);
    }
    setSaving(false);
  };

  const another = () => { setSaved(null); setForm(emptyForm()); setError(""); };

  const changeStatus = async (row, status) => {
    setBusyId(row.id);
    const { data, error: e } = await supabase.from("church_needs")
      .update({ status, updated_at: new Date().toISOString() }).eq("id", row.id).select("id,status");
    setBusyId(null);
    if (e || !data || !data.length) { setLoadErr((e && e.message) || "The change was not saved."); return; }
    setLoadErr("");
    setRows(rs => rs.map(r => r.id === row.id ? { ...r, status } : r));
  };

  const removeFromList = async (row) => {
    if (!window.confirm("Remove this church from the Churches in Need list? The church itself stays on SendMe.")) return;
    setBusyId(row.id);
    const { data, error: e } = await supabase.from("church_needs").delete().eq("id", row.id).select("id");
    setBusyId(null);
    if (e || !data || !data.length) { setLoadErr((e && e.message) || "It was not removed."); return; }
    setLoadErr("");
    setRows(rs => rs.filter(r => r.id !== row.id));
  };

  const title = isNeed ? "Churches in Need" : "Add a Church";
  const shown = rows.filter(r => filter === "all" || r.status === filter);

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={greyBtn}>Back</button>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>{isNeed ? "🤲 " : "⛪ "}{title}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>ADMIN · PRIVATE</div>
        </div>
      </div>

      <div style={{ maxWidth:640, margin:"0 auto", padding:"24px 20px 80px" }}>
        {isNeed && (
          <div style={{ display:"flex", gap:8, marginBottom:18 }}>
            {[["add","➕ Add a church in need"],["list","📋 The list"]].map(([k, t]) => (
              <button key={k} onClick={() => setTab(k)}
                style={{ ...greyBtn, flex:1, color: tab===k ? "#000" : "rgba(255,255,255,0.6)",
                  background: tab===k ? "linear-gradient(135deg,#e8b34b,#c8942b)" : "rgba(255,255,255,0.04)", fontWeight:700 }}>{t}</button>
            ))}
          </div>
        )}

        {/* ───────── LIST ───────── */}
        {isNeed && tab === "list" && (
          <div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
              {[["open","Open"],["supported","Being supported"],["closed","Closed"],["all","All"]].map(([k, t]) => (
                <button key={k} onClick={() => setFilter(k)}
                  style={{ ...greyBtn, padding:"8px 14px", fontSize:13,
                    color: filter===k ? "#e8b34b" : "rgba(255,255,255,0.5)",
                    border: filter===k ? "1px solid rgba(232,179,75,0.5)" : "1px solid rgba(255,255,255,0.1)" }}>{t}</button>
              ))}
            </div>
            {loadErr && <div style={{ background:"rgba(240,82,82,0.1)", border:"1px solid rgba(240,82,82,0.3)", borderRadius:10, padding:"10px 16px", marginBottom:16, fontSize:13, color:"#f05252" }}>{loadErr}</div>}
            {loading && <div style={{ color:"rgba(255,255,255,0.4)", padding:20 }}>Loading…</div>}
            {!loading && !loadErr && shown.length === 0 && (
              <div style={{ color:"rgba(255,255,255,0.4)", padding:20, textAlign:"center", lineHeight:1.7 }}>Nothing here yet.</div>
            )}
            {shown.map(r => {
              const c = r.church;
              const st = STATUS[r.status] || STATUS.open;
              const name = c ? c.name : "(church not found)";
              return (
                <div key={r.id} style={card}>
                  <div style={{ display:"flex", justifyContent:"space-between", gap:10, alignItems:"flex-start", flexWrap:"wrap" }}>
                    <div>
                      <div style={{ fontSize:17, fontWeight:700 }}>{name}</div>
                      {c && <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)", marginTop:3 }}>{c.city}, {c.country} · Pastor {c.pastor_name}</div>}
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      <span style={{ fontSize:11, fontWeight:700, color:st.color, border:`1px solid ${st.color}55`, borderRadius:999, padding:"3px 10px" }}>{st.label}</span>
                      {c && <span style={{ fontSize:11, fontWeight:700, color: c.verified ? "#3ecf8e" : "rgba(255,255,255,0.4)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:999, padding:"3px 10px" }}>{c.verified ? "Verified" : "Not verified yet"}</span>}
                    </div>
                  </div>
                  {r.situation && <div style={{ marginTop:14, fontSize:14, lineHeight:1.7, color:"rgba(255,255,255,0.75)" }}>{r.situation}</div>}
                  {r.help_needed && <div style={{ marginTop:8, fontSize:13, lineHeight:1.7, color:"rgba(255,255,255,0.5)" }}><strong style={{ color:"#e8b34b" }}>Help needed:</strong> {r.help_needed}</div>}
                  {c && (
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:14 }}>
                      {c.pastor_phone && <a style={waBtn} target="_blank" rel="noreferrer" href={waLink(c.pastor_phone, pastorMessage(c.pastor_name, c.name, c.city, true))}>💬 WhatsApp {c.pastor_name}</a>}
                      {c.reference_1_contact && <a style={waBtn} target="_blank" rel="noreferrer" href={waLink(c.reference_1_contact, refMessage(c.reference_1_name, c.pastor_name, c.name, c.city, c.country))}>💬 {c.reference_1_name}{c.reference_1_status ? ` (${c.reference_1_status})` : ""}</a>}
                      {c.reference_2_contact && <a style={waBtn} target="_blank" rel="noreferrer" href={waLink(c.reference_2_contact, refMessage(c.reference_2_name, c.pastor_name, c.name, c.city, c.country))}>💬 {c.reference_2_name}{c.reference_2_status ? ` (${c.reference_2_status})` : ""}</a>}
                    </div>
                  )}
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:14 }}>
                    <select value={r.status} disabled={busyId === r.id} onChange={e => changeStatus(r, e.target.value)}
                      style={{ ...inp, width:"auto", marginBottom:0, padding:"10px 12px", fontSize:13 }}>
                      {Object.keys(STATUS).map(k => <option key={k} value={k} style={{ background:"#0c1628" }}>{STATUS[k].label}</option>)}
                    </select>
                    <button disabled={busyId === r.id} onClick={() => removeFromList(r)} style={{ ...greyBtn, fontSize:13 }}>Remove from list</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ───────── SAVED ───────── */}
        {(!isNeed || tab === "add") && saved && (
          <div style={card}>
            <div style={{ fontSize:20, fontWeight:700, marginBottom:6 }}>✓ {saved.name} added</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", lineHeight:1.7, marginBottom:6 }}>
              Saved as <strong style={{ color:"#e8b34b" }}>not yet verified</strong>{saved.inNeed ? " and added to the private Churches in Need list" : ""}.{" "}
              {saved.pinned ? "A map pin was placed." : "No map pin was found for this address — it can be fixed later."}
              {saved.noEmail ? " No pastor email was saved." : ""}
            </div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.65)", margin:"16px 0 10px", fontWeight:700 }}>Now WhatsApp them (WhatsApp opens with the message ready — you tap Send):</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <a style={waBtn} target="_blank" rel="noreferrer" href={waLink(saved.pastorPhone, pastorMessage(saved.pastorName, saved.name, saved.city, saved.inNeed))}>💬 Pastor {saved.pastorName}</a>
              <a style={waBtn} target="_blank" rel="noreferrer" href={waLink(saved.ref1, refMessage(saved.ref1Name, saved.pastorName, saved.name, saved.city, saved.country))}>💬 Reference 1 — {saved.ref1Name}</a>
              <a style={waBtn} target="_blank" rel="noreferrer" href={waLink(saved.ref2, refMessage(saved.ref2Name, saved.pastorName, saved.name, saved.city, saved.country))}>💬 Reference 2 — {saved.ref2Name}</a>
            </div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", lineHeight:1.7, marginTop:16 }}>
              When they answer, open Verify Churches and tick Confirmed / Declined, then verify the church.
            </div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop:16 }}>
              {onVerify && <button onClick={onVerify} style={{ ...greyBtn, flex:1 }}>Open Verify Churches</button>}
              <button onClick={another} style={{ ...greyBtn, flex:1 }}>➕ Add another</button>
            </div>
          </div>
        )}

        {/* ───────── FORM ───────── */}
        {(!isNeed || tab === "add") && !saved && (
          <div>
            {error && <div role="alert" style={{ background:"rgba(240,82,82,0.1)", border:"1px solid rgba(240,82,82,0.3)", borderRadius:10, padding:"10px 16px", marginBottom:18, fontSize:13, color:"#f05252" }}>{error}</div>}

            <div style={card}>
              <div style={sect}>{isNeed ? "The church and its pastor" : "Church information"}</div>
              <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                {[["church","⛪ Church"],["organization","🌍 Organization"]].map(([k, t]) => (
                  <button key={k} type="button" onClick={() => set("entityType", k)}
                    style={{ ...greyBtn, flex:1, fontWeight:700, color: form.entityType===k ? "#e8b34b" : "rgba(255,255,255,0.5)",
                      border: form.entityType===k ? "1px solid rgba(232,179,75,0.5)" : "1px solid rgba(255,255,255,0.1)" }}>{t}</button>
                ))}
              </div>
              <FField label={isOrg ? "Organization name *" : "Church name *"}>
                <input style={inp} value={form.churchName} onChange={e => set("churchName", e.target.value)} placeholder="e.g. Eagle Ministry Tabernacle"/>
              </FField>
              <FField label="Street address">
                <input style={inp} value={form.street} onChange={e => set("street", e.target.value)} placeholder="e.g. 12 Main Street, Northmead"/>
              </FField>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <FField label="City *"><input style={inp} value={form.city} onChange={e => set("city", e.target.value)} placeholder="e.g. Benoni"/></FField>
                <FField label="Province / State"><input style={inp} value={form.province} onChange={e => set("province", e.target.value)} placeholder="e.g. Gauteng"/></FField>
              </div>
              <FField label="Country *">
                <select style={{ ...inp, color: form.country ? "#eef1ff" : "rgba(255,255,255,0.35)" }} value={form.country} onChange={e => set("country", e.target.value)}>
                  <option value="" style={{ background:"#0c1628" }}>Select country...</option>
                  {COUNTRIES.map(c => <option key={c} value={c} style={{ background:"#0c1628" }}>{c}</option>)}
                </select>
              </FField>
              {form.country === "Other" && (
                <FField label="Country name *"><input style={inp} value={form.otherCountry} onChange={e => set("otherCountry", e.target.value)}/></FField>
              )}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <FField label="Church phone (optional)"><input style={inp} type="tel" value={form.phone} onChange={e => set("phone", e.target.value)}/></FField>
                <FField label="Church email (optional)"><input style={inp} type="email" value={form.email} onChange={e => set("email", e.target.value)}/></FField>
              </div>
              <FField label="Website (optional)"><input style={inp} value={form.website} onChange={e => set("website", e.target.value)}/></FField>
              <FField label="Congregation size">
                <select style={{ ...inp, color: form.size ? "#eef1ff" : "rgba(255,255,255,0.35)" }} value={form.size} onChange={e => set("size", e.target.value)}>
                  <option value="" style={{ background:"#0c1628" }}>Approximate size...</option>
                  {SIZES.map(s => <option key={s} value={s} style={{ background:"#0c1628" }}>{s}</option>)}
                </select>
              </FField>
            </div>

            <div style={card}>
              <div style={sect}>{isOrg ? "Organization leader" : "Pastor"}</div>
              <FField label="Full name *"><input style={inp} value={form.pastorName} onChange={e => set("pastorName", e.target.value)} placeholder="e.g. Pastor Johan van der Merwe"/></FField>
              <FField label="WhatsApp number (with country code) *">
                <input style={inp} type="tel" inputMode="tel" value={form.pastorPhone} onChange={e => set("pastorPhone", e.target.value)} placeholder="e.g. +27 82 000 0000"/>
              </FField>
              <FField label="Email (optional)"><input style={inp} type="email" value={form.pastorEmail} onChange={e => set("pastorEmail", e.target.value)}/></FField>
            </div>

            <div style={card}>
              <div style={sect}>Two references (you will WhatsApp them)</div>
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", lineHeight:1.7, marginBottom:16 }}>
                Two other people who can confirm this {isOrg ? "organization" : "church"} is genuine. Use their WhatsApp numbers with the country code.
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:"#e8b34b", marginBottom:10 }}>Reference 1</div>
              <FField label="Name *"><input style={inp} value={form.reference1Name} onChange={e => set("reference1Name", e.target.value)}/></FField>
              <FField label="WhatsApp number *"><input style={inp} type="tel" inputMode="tel" value={form.reference1Contact} onChange={e => set("reference1Contact", e.target.value)} placeholder="e.g. +27 83 000 0000"/></FField>
              <div style={{ fontSize:14, fontWeight:700, color:"#e8b34b", margin:"6px 0 10px" }}>Reference 2</div>
              <FField label="Name *"><input style={inp} value={form.reference2Name} onChange={e => set("reference2Name", e.target.value)}/></FField>
              <FField label="WhatsApp number *"><input style={inp} type="tel" inputMode="tel" value={form.reference2Contact} onChange={e => set("reference2Contact", e.target.value)} placeholder="e.g. +27 84 000 0000"/></FField>
            </div>

            {isNeed && (
              <div style={card}>
                <div style={sect}>🤲 The pastor's situation (private — only you see this)</div>
                <FField label="What is he going through? *">
                  <textarea style={{ ...inp, minHeight:100, lineHeight:1.7, resize:"vertical" }} value={form.situation} onChange={e => set("situation", e.target.value)} placeholder="A sentence or two"/>
                </FField>
                <FField label="How could SendMe help? (optional)">
                  <textarea style={{ ...inp, minHeight:80, lineHeight:1.7, resize:"vertical" }} value={form.helpNeeded} onChange={e => set("helpNeeded", e.target.value)} placeholder="e.g. rent for the church hall, a Bible-Message Books supply, prayer"/>
                </FField>
              </div>
            )}

            <div style={card}>
              <label style={{ display:"flex", gap:12, alignItems:"flex-start", cursor:"pointer", fontSize:14, lineHeight:1.65, color:"rgba(255,255,255,0.75)" }}>
                <input type="checkbox" checked={form.pastorKnows} onChange={e => set("pastorKnows", e.target.checked)} style={{ marginTop:4, width:18, height:18, flexShrink:0 }}/>
                <span>The {isOrg ? "leader" : "pastor"} knows he is being added to SendMe and agrees to SendMe's rules (funds released only on proof of work).</span>
              </label>
            </div>

            <button onClick={submit} disabled={saving} style={{ ...goldBtn, opacity: saving ? 0.6 : 1, cursor: saving ? "default" : "pointer" }}>
              {saving ? "Finding the location & saving…" : (isNeed ? "Add to Churches in Need" : "Add this church")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
