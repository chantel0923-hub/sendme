// AdminGeneralFund.js
// Admin screen for the General Fund: shows the real balance (only admin can
// see donation rows — RLS on general_fund_log restricts those to the admin
// email, same pattern as family_needs_admin_all), and lets admin log a
// disbursement. A disbursement IS the accountability record AND the public
// testimony in one step — no separate reporting system needed.

import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const fmt = (n) => String(Math.round(n||0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const timeAgo = (d) => {
  if (!d) return "";
  const diff = Math.floor((new Date() - new Date(d)) / 1000);
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
};

// ── Photo upload — same compress-then-upload pattern used everywhere else
// this session (MilestoneProof.js, PastorFamilyNeedReview.js), capped at 2
// here since that's what this specific log calls for.
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => { img.src = e.target.result; };
    img.onerror = reject;
    img.onload = () => {
      const maxDim = 1600;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else { width = Math.round(width * maxDim / height); height = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not process image")), "image/jpeg", 0.8);
    };
    reader.readAsDataURL(file);
  });
}
async function uploadPhoto(file) {
  const compressed = await compressImage(file);
  const fileName = `general-fund/${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`;
  const { error } = await supabase.storage.from("proof-media").upload(fileName, compressed, { contentType: "image/jpeg" });
  if (error) throw error;
  const { data } = supabase.storage.from("proof-media").getPublicUrl(fileName);
  return data.publicUrl;
}
function PhotoUploader({ photos, onChange, max = 2 }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, max - photos.length);
    if (files.length === 0) return;
    setUploading(true); setError("");
    try {
      const uploaded = [];
      for (const file of files) uploaded.push(await uploadPhoto(file));
      onChange([...photos, ...uploaded]);
    } catch (err) {
      setError("Could not upload photo. (" + (err.message||"") + ")");
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };
  const removeAt = (i) => onChange(photos.filter((_,idx)=>idx!==i));
  return (
    <div>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:8 }}>
        {photos.map((url,i)=>(
          <div key={i} style={{ position:"relative", width:80, height:80 }}>
            <img src={url} alt="" style={{ width:80, height:80, objectFit:"cover", borderRadius:10, border:"1px solid rgba(255,255,255,0.15)" }}/>
            <button type="button" onClick={()=>removeAt(i)} style={{ position:"absolute", top:-6, right:-6, width:22, height:22, borderRadius:"50%", border:"none", background:"#e85b5b", color:"#fff", cursor:"pointer", fontSize:12, lineHeight:"22px", padding:0 }}>✕</button>
          </div>
        ))}
        {photos.length < max && (
          <button type="button" onClick={()=>inputRef.current?.click()} disabled={uploading}
            style={{ width:80, height:80, borderRadius:10, border:"1px dashed rgba(255,255,255,0.25)", background:"rgba(255,255,255,0.03)", color:"rgba(255,255,255,0.4)", cursor:uploading?"default":"pointer", fontSize:22, fontFamily:"Georgia, serif" }}>
            {uploading?"…":"+"}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display:"none" }}/>
      {error && <div style={{ fontSize:12, color:"#e85b5b" }}>{error}</div>}
    </div>
  );
}

export default function AdminGeneralFund({ onBack }) {
  const [log, setLog]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase.from("general_fund_log").select("*").order("created_at", { ascending:false });
      if (error) throw error;
      setLog(data || []);
    } catch (e) {
      setError("Could not load the General Fund log. (" + (e.message||"") + ")");
      setLog([]);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const totalRaised    = log.filter(r=>r.type==="donation").reduce((s,r)=>s+(r.amount||0),0);
  const totalDisbursed = log.filter(r=>r.type==="disbursement").reduce((s,r)=>s+(r.amount||0),0);
  const available      = totalRaised - totalDisbursed;

  const logDisbursement = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0 || !description.trim()) return;
    setSaving(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("general_fund_log").insert({
        type: "disbursement",
        amount: amt,
        description: description.trim(),
        media_urls: photos.length > 0 ? photos : null,
        created_by: user?.id || null,
      });
      if (error) throw error;
      setDescription(""); setAmount(""); setPhotos([]);
      load();
    } catch (e) {
      setError("Could not log this disbursement. (" + (e.message||"") + ")");
    }
    setSaving(false);
  };

  const inp = { width:"100%", padding:"12px 14px", borderRadius:10, boxSizing:"border-box", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", color:"#eef1ff", fontSize:14, fontFamily:"Georgia, serif", outline:"none", marginBottom:12 };

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
        <div style={{ fontSize:18, fontWeight:700 }}>🌐 General Fund — Admin</div>
      </div>

      <div style={{ maxWidth:680, margin:"0 auto", padding:"24px 20px 60px" }}>
        {error && <div style={{ background:"rgba(232,91,91,0.08)", border:"1px solid rgba(232,91,91,0.25)", borderRadius:10, padding:"10px 14px", marginBottom:16, color:"#e85b5b", fontSize:13 }}>{error}</div>}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:28 }}>
          {[["💰",`$${fmt(totalRaised)}`,"Total Raised","#3ecf8e"],["💸",`$${fmt(totalDisbursed)}`,"Total Given","#e8b34b"],["🏦",`$${fmt(available)}`,"Available Now","#5b9cf6"]].map(([icon,val,label,c])=>(
            <div key={label} style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, border:"1px solid rgba(255,255,255,0.08)", padding:"14px 10px", textAlign:"center" }}>
              <div style={{ fontSize:18 }}>{icon}</div>
              <div style={{ fontSize:17, fontWeight:700, color:c, marginTop:4 }}>{val}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ background:"#0c1628", borderRadius:16, border:"1px solid rgba(62,207,142,0.25)", padding:20, marginBottom:28 }}>
          <div style={{ fontSize:15, fontWeight:700, color:"#eef1ff", marginBottom:6 }}>Log a Disbursement</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:16, lineHeight:1.6 }}>
            This becomes both the accountability record AND a public testimony — write it the way you'd want a donor to read it.
          </div>
          <input placeholder="Amount ($)" type="number" value={amount} onChange={e=>setAmount(e.target.value)} style={inp}/>
          <textarea placeholder="e.g. 'SendMe assisted a mission in Kenya with an urgent transport cost when their own funding ran short.'"
            value={description} onChange={e=>setDescription(e.target.value)}
            style={{ ...inp, minHeight:80, resize:"vertical" }}/>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:8 }}>Photos <span style={{color:"rgba(255,255,255,0.2)"}}>(optional — up to 2)</span></div>
          <div style={{ marginBottom:16 }}>
            <PhotoUploader photos={photos} onChange={setPhotos} max={2}/>
          </div>
          <button onClick={logDisbursement} disabled={saving||!amount||!description.trim()}
            style={{ width:"100%", padding:"12px 0", borderRadius:12, border:"none",
              background:(amount&&description.trim())?"linear-gradient(135deg,#3ecf8e,#2aaf74)":"rgba(255,255,255,0.06)",
              color:(amount&&description.trim())?"#000":"rgba(255,255,255,0.25)",
              fontWeight:700, cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>
            {saving ? "Logging..." : "✓ Log Disbursement & Publish Testimony"}
          </button>
        </div>

        <div style={{ fontSize:15, fontWeight:700, color:"#eef1ff", marginBottom:14 }}>Full Log</div>
        {loading ? (
          <div style={{ textAlign:"center", padding:"30px 0", color:"rgba(255,255,255,0.3)" }}>Loading...</div>
        ) : log.length === 0 ? (
          <div style={{ textAlign:"center", padding:"30px 0", color:"rgba(255,255,255,0.3)", fontSize:13 }}>No activity yet.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {log.map(entry => (
              <div key={entry.id} style={{ background:"#0c1628", borderRadius:12, border:"1px solid rgba(255,255,255,0.07)", padding:"12px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <span style={{ fontSize:12, fontWeight:700, color: entry.type==="donation" ? "#3ecf8e" : "#e8b34b" }}>
                    {entry.type==="donation" ? "💰 Donation In" : "💸 Disbursement Out"} — ${fmt(entry.amount)}
                  </span>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{timeAgo(entry.created_at)}</span>
                </div>
                {entry.type==="donation" ? (
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{entry.donor_name || "Anonymous"}{entry.donor_email?` · ${entry.donor_email}`:""}</div>
                ) : (
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>{entry.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
