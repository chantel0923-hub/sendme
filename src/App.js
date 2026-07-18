import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import Auth from "./Auth";
import "./App.css";
import MissionaryApplication from "./MissionaryApplication";
import ChurchRegistration from "./ChurchRegistration";
import MyChurch from "./MyChurch";
import MapboxMap from "./MapboxMap";
import ChurchesTab from "./ChurchesTab";
import TransparencyLedger from "./TransparencyLedger";
import EmergencyRequests from "./EmergencyRequests";
import MissionMatching from "./MissionMatching";
import TestimonyEngine from "./TestimonyEngine";
import SendAWorker from "./SendAWorker";
import QRShare from "./QRShare";
import FAQScreen from './FAQScreen';
import PayoutSetup from './PayoutSetup';
import AdminPayouts, { ADMIN_EMAIL } from './AdminPayouts';
import YouTubeEmbed from './YouTubeEmbed';
import { FEATURED_VIDEOS, SENDME_CHANNEL_URL } from './sendmeVideos';
import { startPayfastDonation } from './payfast';
import MilestoneProof from './MilestoneProof';
import PastorReview from './PastorReview';
import MissionaryDashboard from './MissionaryDashboard';
import AdminApprovals from './AdminApprovals';
import AdminChurchVerification from './AdminChurchVerification';
import AdminWorkerRequests from './AdminWorkerRequests';
import AdminEmergencyRequests from './AdminEmergencyRequests';
import NotificationOptIn from './NotificationOptIn';

const COLORS = ["#e8b34b","#4caf7d","#5b9cf6","#e85b5b","#b06cf5","#f5a44a","#3ecf8e","#f06292"];
const getColor = (id) => COLORS[id % COLORS.length];

const mapRow = (row, i) => ({
  id:row.id,
  name: [row.full_name, row.name, row.pastor_name, row.title].find(v => v && String(v).trim().toLowerCase() !== "null") ||
        (row.missionary_role ? (row.missionary_role + " — " + (row.city||row.country||"Unknown")) : "Unknown"),
  role:row.missionary_role||"Missionary",
  church:row.church_name||"", city:row.city||"", country:row.country||"",
  area:row.area||"", region:row.region||"Africa",
  lat:parseFloat(row.lat)||0, lng:parseFloat(row.lng)||0,
  title:row.title||"Untitled Mission", blurb:row.blurb||row.description||"",
  raised:row.raised||0, goal:row.goal||1000,
  color:(row.color && row.color !== "null") ? row.color : getColor(i),
  status:row.status||"active", milestone:row.milestone||0,
  souls:row.souls||0, bibles:row.bibles||0, churches:row.churches_planted||0,
  prayers:row.prayers||0, protected:row.protected||false,
  trustLevel:row.trust_level||1, journeyStep:row.journey_step||1,
  riskLevel:row.risk_level||1, budget:row.budget||[],
});

const REGIONS = ["All","Africa","Asia","S. America","Middle East","Europe"];
const AMOUNTS = [25,50,100,250,500];
const pct = (r,g) => Math.min(100,Math.round((r/g)*100));
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,",");

const TRUST_LEVELS = [
  {level:0,label:"Unverified",      color:"rgba(255,255,255,0.3)",bg:"rgba(255,255,255,0.05)"},
  {level:1,label:"Verified Mission",color:"#e8b34b",             bg:"rgba(232,179,75,0.12)" },
  {level:2,label:"Transparent",     color:"#5b9cf6",             bg:"rgba(91,156,246,0.12)" },
  {level:3,label:"Trusted Partner", color:"#3ecf8e",             bg:"rgba(62,207,142,0.12)" },
];
const TrustBadge = ({ level=0 }) => {
  const safeLevel = Math.min(Math.max(level||0, 0), 3);
  const t = TRUST_LEVELS[safeLevel];
  const icons = ["","✝","✝✝","✝✝✝"];
  return (
    <span style={{ padding:"3px 10px", borderRadius:999, fontSize:11, background:t.bg, color:t.color, border:`1px solid ${t.color}44`, whiteSpace:"nowrap", fontWeight:600 }}>
      {icons[level]} {t.label}
    </span>
  );
};

const RISK_LEVELS = [
  {level:0,label:"Unknown",         color:"rgba(255,255,255,0.3)",dot:"⚪"},
  {level:1,label:"Easy Access",     color:"#3ecf8e",              dot:"🟢"},
  {level:2,label:"Rural Area",      color:"#e8b34b",              dot:"🟡"},
  {level:3,label:"Difficult Terrain",color:"#f5a44a",             dot:"🟠"},
  {level:4,label:"High Risk",       color:"#e85b5b",              dot:"🔴"},
];
const RiskBadge = ({ level=1 }) => {
  const safeLevel = Math.min(Math.max(level||1, 0), 4);
  const r = RISK_LEVELS[safeLevel];
  return (
    <span style={{ padding:"3px 10px", borderRadius:999, fontSize:11, background:`${r.color}18`, color:r.color, border:`1px solid ${r.color}44`, whiteSpace:"nowrap", fontWeight:600 }}>
      {r.dot} {r.label}
    </span>
  );
};

const JOURNEY_STEPS = [
  {step:1,icon:"✅",label:"Application Approved"},
  {step:2,icon:"💝",label:"Funding Goal Reached"},
  {step:3,icon:"⛪",label:"In the Field"},
  {step:4,icon:"🙏",label:"Impact Reported"},
  {step:5,icon:"🏆",label:"Mission Completed"},
];
const JourneyTimeline = ({ currentStep, color }) => (
  <div style={{ padding:"20px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
    <div style={{ fontSize:14, fontWeight:700, color:"#eef1ff", marginBottom:16 }}>Mission Journey</div>
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
      {JOURNEY_STEPS.map((s,i) => {
        const done=s.step<currentStep, active=s.step===currentStep;
        return (
          <div key={s.step} style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
              <div style={{ width:32,height:32,borderRadius:"50%",
                background:done?`linear-gradient(135deg,${color},${color}cc)`:active?`${color}22`:"rgba(255,255,255,0.05)",
                border:active?`2px solid ${color}`:done?"none":"1px solid rgba(255,255,255,0.1)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,transition:"all .3s",
                boxShadow:active?`0 0 14px ${color}66`:"none" }}>
                {done?"✓":active?s.icon:<span style={{opacity:0.3}}>{s.icon}</span>}
              </div>
              {i<JOURNEY_STEPS.length-1 && <div style={{ width:2,height:24,background:done?`${color}66`:"rgba(255,255,255,0.07)",transition:"background .3s" }}/>}
            </div>
            <div style={{ paddingTop:6 }}>
              <span style={{ fontSize:13,color:done?"rgba(255,255,255,0.55)":active?"#eef1ff":"rgba(255,255,255,0.2)",fontWeight:active?700:400,transition:"all .3s" }}>
                {s.label}
              </span>
              {active && <span style={{ marginLeft:8,fontSize:11,padding:"2px 8px",borderRadius:999,background:`${color}22`,color,border:`1px solid ${color}44` }}>Current</span>}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const BudgetBreakdown = ({ budget=[], goal, color }) => {
  if (!budget||budget.length===0) return null;
  const total = budget.reduce((acc,b)=>acc+b.amount,0);
  return (
    <div style={{ padding:"20px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize:14,fontWeight:700,color:"#eef1ff",marginBottom:4 }}>Budget Breakdown</div>
      <div style={{ fontSize:12,color:"rgba(255,255,255,0.35)",marginBottom:16 }}>People trust missions more when they see where the money goes.</div>
      <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
        {budget.map((b,i) => {
          const portion=Math.round((b.amount/total)*100);
          return (
            <div key={i}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
                <span style={{ fontSize:13,color:"rgba(255,255,255,0.7)" }}>{b.label}</span>
                <span style={{ fontSize:13,color,fontWeight:700 }}>${fmt(b.amount)} <span style={{ color:"rgba(255,255,255,0.3)",fontWeight:400 }}>({portion}%)</span></span>
              </div>
              <div style={{ background:"rgba(255,255,255,0.06)",borderRadius:999,height:5,overflow:"hidden" }}>
                <div style={{ width:`${portion}%`,height:"100%",borderRadius:999,background:`linear-gradient(90deg,${color},${color}99)`,transition:"width .7s ease" }}/>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop:14,padding:"10px 14px",borderRadius:10,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-between" }}>
        <span style={{ fontSize:13,color:"rgba(255,255,255,0.4)" }}>Total mission budget</span>
        <span style={{ fontSize:14,fontWeight:700,color:"#eef1ff" }}>${fmt(goal)}</span>
      </div>
    </div>
  );
};

const UpdatesFeed = ({ missionId, missionColor, missionName, canPost, guest }) => {
  const [updates, setUpdates]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [newText, setNewText]     = useState("");
  const [newMedia, setNewMedia]   = useState("");
  const [postType, setPostType]   = useState("update");
  const [posting, setPosting]     = useState(false);
  const [postError, setPostError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from("mission_updates")
          .select("*").eq("mission_id", missionId)
          .order("created_at",{ ascending:false });
        setUpdates(data || []);
      } catch { setUpdates([]); }
      setLoading(false);
    };
    load();
  }, [missionId]);

  const postUpdate = async () => {
    if (!newText.trim()) return;
    setPosting(true);
    setPostError("");
    const update = { mission_id:missionId, author:missionName, text:newText.trim(), type:postType, media_url:newMedia.trim()||null, created_at:new Date().toISOString() };
    try {
      // Supabase's client does NOT throw on a failed insert — it returns
      // { error } instead. Must check it explicitly or a blocked insert
      // silently looks like success.
      const { error } = await supabase.from("mission_updates").insert(update);
      if (error) throw error;
      setUpdates(u => [update, ...u]);
      setNewText(""); setNewMedia("");
    } catch (e) {
      console.error("postUpdate error:", e);
      // #95 — this specific RLS policy (mission_updates_insert_owner) blocks
      // anyone who isn't THIS mission's own missionary or pastor, even
      // though the UI-level canPostUpdates check above only confirms their
      // general role. A missionary who didn't create this particular
      // mission hits exactly this case. Give a message that explains what
      // actually happened instead of surfacing the raw Postgres RLS error.
      const isOwnershipBlock = e?.message?.includes("row-level security policy") || e?.code === "42501";
      setPostError(
        isOwnershipBlock
          ? "You can only post Field Reports and Prayer Requests on a mission you personally created (as its missionary or pastor). This looks like a different mission — if you believe you should have access here, please contact SendMe support via the FAQ page so Admin can help."
          : "Could not post your update — it was NOT saved. Please try again. (" + (e?.message || "unknown error") + ")"
      );
    }
    setPosting(false);
  };

  const timeAgo = (dateStr) => {
    const d = new Date(dateStr), now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  };

  return (
    <div style={{ padding:"24px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize:16,fontWeight:700,color:"#eef1ff",marginBottom:6 }}>Live Mission Updates</div>
      <div style={{ fontSize:12,color:"rgba(255,255,255,0.35)",marginBottom:16 }}>Field reports, photos and prayer requests from the missionary.</div>
      {canPost ? (
      <div style={{ background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.08)",padding:16,marginBottom:16 }}>
        <div style={{ display:"flex",gap:8,marginBottom:10 }}>
          {[["update","📋 Field Report"],["prayer","🙏 Prayer Request"]].map(([t,l]) => (
            <button key={t} onClick={()=>setPostType(t)}
              style={{ padding:"6px 14px",borderRadius:8,border:`1px solid ${postType===t?missionColor:"rgba(255,255,255,0.1)"}`,background:postType===t?`${missionColor}18`:"transparent",color:postType===t?missionColor:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:12,fontFamily:"Georgia,serif" }}>
              {l}
            </button>
          ))}
        </div>
        <textarea value={newText} onChange={e=>setNewText(e.target.value)}
          placeholder={postType==="prayer"?"Share a prayer request for this mission...":"Share a field update from the mission..."}
          style={{ width:"100%",padding:"10px 14px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#eef1ff",fontSize:14,fontFamily:"Georgia,serif",outline:"none",resize:"vertical",minHeight:70,boxSizing:"border-box",marginBottom:10 }}/>
        <input value={newMedia} onChange={e=>setNewMedia(e.target.value)}
          placeholder="📷 Photo/video URL (optional — YouTube, Google Drive, Dropbox...)"
          style={{ width:"100%",padding:"9px 14px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#eef1ff",fontSize:13,fontFamily:"Georgia,serif",outline:"none",boxSizing:"border-box",marginBottom:10 }}/>
        <button onClick={postUpdate} disabled={posting||!newText.trim()}
          style={{ padding:"9px 20px",borderRadius:10,border:"none",background:newText.trim()?`linear-gradient(135deg,${missionColor},${missionColor}cc)`:"rgba(255,255,255,0.06)",color:newText.trim()?"#000":"rgba(255,255,255,0.25)",fontWeight:700,cursor:newText.trim()?"pointer":"default",fontSize:13,fontFamily:"Georgia,serif" }}>
          {posting?"Posting...":"Post Update"}
        </button>
        {postError && (
          <div style={{ marginTop:10, background:"rgba(232,91,91,0.1)", border:"1px solid rgba(232,91,91,0.3)", borderRadius:10, padding:"10px 14px", color:"#e85b5b", fontSize:13 }}>
            ⚠ {postError}
          </div>
        )}
      </div>
      ) : (
        // #81/#82: Donor/Supporter and guest users can still read updates below,
        // but the post form is hidden rather than shown-then-blocked at submit.
        <div style={{ background:"rgba(255,255,255,0.02)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"14px 16px",marginBottom:16,fontSize:12.5,color:"rgba(255,255,255,0.35)" }}>
          {guest
            ? "Sign in to read along — only the mission's missionary or pastor can post Field Reports and Prayer Requests here."
            : "Only the mission's missionary or its pastor can post Field Reports and Prayer Requests here."}
        </div>
      )}
      {loading ? (
        <div style={{ textAlign:"center",padding:"20px 0",color:"rgba(255,255,255,0.3)",fontSize:13 }}>Loading updates...</div>
      ) : updates.length === 0 ? (
        <div style={{ textAlign:"center",padding:"20px 0",color:"rgba(255,255,255,0.3)",fontSize:13 }}>No updates yet. Be the first to post!</div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {updates.map((u,i) => (
            <div key={u.id||i} style={{ background:"#0c1628",borderRadius:12,border:`1px solid ${u.type==="prayer"?"rgba(176,108,245,0.2)":"rgba(255,255,255,0.07)"}`,padding:"14px 16px" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  <span style={{ fontSize:14 }}>{u.type==="prayer"?"🙏":"📋"}</span>
                  <span style={{ fontSize:13,fontWeight:700,color:u.type==="prayer"?"#b06cf5":missionColor }}>{u.author}</span>
                  <span style={{ fontSize:11,padding:"2px 8px",borderRadius:6,background:u.type==="prayer"?"rgba(176,108,245,0.12)":`${missionColor}18`,color:u.type==="prayer"?"#b06cf5":missionColor,border:`1px solid ${u.type==="prayer"?"rgba(176,108,245,0.25)":`${missionColor}44`}` }}>
                    {u.type==="prayer"?"Prayer Request":"Field Report"}
                  </span>
                </div>
                <span style={{ fontSize:11,color:"rgba(255,255,255,0.3)" }}>{timeAgo(u.created_at)}</span>
              </div>
              <p style={{ fontSize:14,color:"rgba(255,255,255,0.7)",lineHeight:1.7,margin:0,marginBottom:u.media_url?8:0 }}>{u.text}</p>
              {u.media_url && (
                u.media_url.includes("youtube.com") || u.media_url.includes("youtu.be") ? (
                  <a href={u.media_url} target="_blank" rel="noreferrer"
                    style={{ display:"inline-flex",alignItems:"center",gap:6,fontSize:12,color:"#e85b5b",textDecoration:"none",background:"rgba(232,91,91,0.08)",border:"1px solid rgba(232,91,91,0.2)",borderRadius:8,padding:"5px 12px",marginTop:4 }}>
                    ▶ Watch on YouTube
                  </a>
                ) : (
                  <a href={u.media_url} target="_blank" rel="noreferrer"
                    style={{ display:"inline-flex",alignItems:"center",gap:6,fontSize:12,color:"#e8b34b",textDecoration:"none",background:"rgba(232,179,75,0.08)",border:"1px solid rgba(232,179,75,0.2)",borderRadius:8,padding:"5px 12px",marginTop:4 }}>
                    📷 View Photo / Media
                  </a>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PrayerChain = ({ missionId, missionColor, initialCount=0 }) => {
  const [praying, setPraying]   = useState(false);
  const [count, setCount]       = useState(initialCount);
  const [joined, setJoined]     = useState(false);
  const [request, setRequest]   = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [chainError, setChainError]     = useState("");
  const [requestError, setRequestError] = useState("");

  // #78: the missions.prayers column (initialCount) is never actually
  // incremented anywhere — it's stale demo data. The real number of people
  // who joined the chain lives in mission_prayers (type:"chain"), so fetch
  // that on mount. Also check whether THIS logged-in user already joined
  // (via donor_id) so the button correctly shows "✓ Praying" on return
  // visits instead of resetting to unjoined every time.
  useEffect(() => {
    const loadRealCount = async () => {
      try {
        const { count: realCount } = await supabase
          .from("mission_prayers")
          .select("id", { count: "exact", head: true })
          .eq("mission_id", missionId)
          .eq("type", "chain");
        if (typeof realCount === "number") setCount(realCount);

        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (uid) {
          const { data: existing } = await supabase
            .from("mission_prayers")
            .select("id")
            .eq("mission_id", missionId)
            .eq("type", "chain")
            .eq("donor_id", uid)
            .limit(1);
          if (existing && existing.length > 0) setJoined(true);
        }
      } catch {}
    };
    loadRealCount();
  }, [missionId]);

  // mission_prayers requires a logged-in user to INSERT (RLS) — a blocked
  // insert shows this friendly message instead of the raw Postgres error.
  const friendlyError = (e) => {
    const msg = e?.message || "";
    if (e?.code === "42501" || msg.toLowerCase().includes("row-level security")) {
      return "Please log in to join the Prayer Chain or submit a request.";
    }
    return "Something went wrong — please try again. (" + (msg || "unknown error") + ")";
  };

  const joinChain = async () => {
    if (joined) return;
    setPraying(true);
    setChainError("");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || null;
      // Same fix as postUpdate() — Supabase returns { error }, it doesn't
      // throw, so this MUST be checked or a blocked insert looks like success.
      const { error } = await supabase.from("mission_prayers").insert({ mission_id:missionId, type:"chain", donor_id: uid });
      if (error) throw error;
      setCount(c => c+1); setJoined(true);
    } catch (e) {
      console.error("joinChain error:", e);
      setChainError(friendlyError(e));
    }
    setPraying(false);
  };

  const submitRequest = async () => {
    if (!request.trim()) return;
    setRequestError("");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || null;
      const { error } = await supabase.from("mission_prayers").insert({ mission_id:missionId, type:"request", text:request.trim(), donor_id: uid });
      if (error) throw error;
      setSubmitted(true);
    } catch (e) {
      console.error("submitRequest error:", e);
      setRequestError(friendlyError(e));
      // Deliberately not setting submitted=true and not clearing the
      // textarea, so a failed submit doesn't look like it worked.
    }
  };

  return (
    <div style={{ padding:"20px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize:14,fontWeight:700,color:"#eef1ff",marginBottom:4 }}>Prayer Chain</div>
      <div style={{ background:`${missionColor}0e`,borderRadius:14,border:`1px solid ${missionColor}22`,padding:"16px 18px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div>
          <div style={{ fontSize:22,fontWeight:700,color:missionColor }}>{fmt(count)} believers praying</div>
          <div style={{ fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:3 }}>Join the chain and stand in prayer for this mission</div>
        </div>
        <button onClick={joinChain} disabled={joined||praying}
          style={{ padding:"10px 20px",borderRadius:12,border:"none",
            background:joined?`${missionColor}22`:`linear-gradient(135deg,${missionColor},${missionColor}cc)`,
            color:joined?missionColor:"#000",fontWeight:700,cursor:joined?"default":"pointer",
            fontSize:14,fontFamily:"Georgia,serif",whiteSpace:"nowrap",
            boxShadow:joined?"none":`0 4px 18px ${missionColor}44` }}>
          {joined?"✓ Praying":"🙏 Join Prayer Chain"}
        </button>
      </div>
      {chainError && (
        <div style={{ background:"rgba(232,91,91,0.1)", border:"1px solid rgba(232,91,91,0.3)", borderRadius:10, padding:"10px 14px", color:"#e85b5b", fontSize:13, marginBottom:14 }}>
          ⚠ {chainError}
        </div>
      )}
      {!submitted ? (
        <div style={{ background:"rgba(255,255,255,0.02)",borderRadius:12,border:"1px solid rgba(255,255,255,0.07)",padding:14 }}>
          <div style={{ fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:8 }}>Share a specific prayer request for this mission</div>
          <textarea value={request} onChange={e=>setRequest(e.target.value)}
            placeholder="e.g. Pray for safe travel to the eastern villages this week..."
            style={{ width:"100%",padding:"10px 14px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#eef1ff",fontSize:13,fontFamily:"Georgia,serif",outline:"none",resize:"none",height:70,boxSizing:"border-box",marginBottom:10 }}/>
          <button onClick={submitRequest} disabled={!request.trim()}
            style={{ padding:"8px 18px",borderRadius:10,border:"none",background:request.trim()?`linear-gradient(135deg,${missionColor},${missionColor}cc)`:"rgba(255,255,255,0.06)",color:request.trim()?"#000":"rgba(255,255,255,0.3)",fontWeight:700,cursor:request.trim()?"pointer":"default",fontSize:13,fontFamily:"Georgia,serif" }}>
            Submit Prayer Request
          </button>
          {requestError && (
            <div style={{ marginTop:10, background:"rgba(232,91,91,0.1)", border:"1px solid rgba(232,91,91,0.3)", borderRadius:10, padding:"10px 14px", color:"#e85b5b", fontSize:13 }}>
              ⚠ {requestError}
            </div>
          )}
        </div>
      ) : (
        <div style={{ background:"rgba(62,207,142,0.08)",borderRadius:12,border:"1px solid rgba(62,207,142,0.25)",padding:"12px 16px",fontSize:13,color:"#3ecf8e" }}>
          ✓ Your prayer request has been submitted. Thank you for interceding!
        </div>
      )}
    </div>
  );
};

const AdoptMission = ({ mission: m }) => {
  const [selected, setSelected] = useState(null);
  const [adopted, setAdopted]   = useState(false);
  const MONTHLY = [10,25,50,100,200];

  const handleAdopt = async () => {
    if (!selected) return;
    try { await supabase.from("donations").insert({ mission_id:m.id, amount:selected, type:"monthly", status:"pending" }); } catch {}
    setAdopted(true);
  };

  if (adopted) return (
    <div style={{ padding:"20px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ background:"rgba(62,207,142,0.08)",borderRadius:14,border:"1px solid rgba(62,207,142,0.25)",padding:"16px 18px",textAlign:"center" }}>
        <div style={{ fontSize:22,marginBottom:8 }}>🙏</div>
        <div style={{ fontSize:15,fontWeight:700,color:"#eef1ff",marginBottom:6 }}>You are now supporting this mission monthly!</div>
        <div style={{ fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.7 }}>
          <strong style={{ color:"#3ecf8e" }}>${fmt(selected)}/month</strong> will be set aside for{" "}
          <strong style={{ color:"#eef1ff" }}>{m.protected?"this mission":m.name}</strong>.<br/>
          You will receive monthly updates as the mission progresses.
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding:"20px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize:14,fontWeight:700,color:"#eef1ff",marginBottom:4 }}>Adopt This Mission</div>
      <div style={{ fontSize:12,color:"rgba(255,255,255,0.35)",marginBottom:14 }}>
        Support <strong style={{ color:"#eef1ff" }}>{m.protected?"this missionary":m.name}</strong> with a monthly gift. Creates steady, reliable funding instead of once-off giving.
      </div>
      <div style={{ background:`${m.color}08`,borderRadius:12,border:`1px solid ${m.color}22`,padding:"12px 16px",marginBottom:14,fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.7 }}>
        "Support {m.protected?"this mission":m.name.split(" ").slice(-1)[0]}'s mission for just <strong style={{ color:m.color }}>${selected||"X"}/month</strong> — creating recurring funding so the work never stops."
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:14 }}>
        {MONTHLY.map(a => (
          <button key={a} onClick={()=>setSelected(a)}
            style={{ padding:"11px 0",borderRadius:12,border:`1px solid ${selected===a?m.color:"rgba(255,255,255,0.1)"}`,background:selected===a?`${m.color}22`:"rgba(255,255,255,0.03)",color:selected===a?m.color:"rgba(255,255,255,0.5)",fontWeight:700,cursor:"pointer",fontSize:13,transition:"all .15s" }}>
            ${a}
          </button>
        ))}
      </div>
      <button onClick={handleAdopt} disabled={!selected}
        style={{ width:"100%",padding:"14px 0",borderRadius:14,border:"none",
          background:selected?`linear-gradient(135deg,${m.color},${m.color}cc)`:"rgba(255,255,255,0.06)",
          color:selected?"#000":"rgba(255,255,255,0.25)",fontWeight:700,
          cursor:selected?"pointer":"default",fontSize:15,fontFamily:"Georgia,serif",
          boxShadow:selected?`0 6px 24px ${m.color}44`:"none",transition:"all .2s" }}>
        {selected?`✝  Adopt This Mission — $${selected}/month`:"Select a monthly amount"}
      </button>
    </div>
  );
};

const Bar = ({ raised,goal,color,height=6 }) => (
  <div style={{ background:"rgba(255,255,255,0.07)",borderRadius:999,height,overflow:"hidden" }}>
    <div style={{ width:`${pct(raised,goal)}%`,height:"100%",borderRadius:999,background:`linear-gradient(90deg,${color},${color}bb)`,boxShadow:`0 0 6px ${color}55`,transition:"width .7s ease" }}/>
  </div>
);

const MsTrack = ({ current,color }) => (
  <div style={{ display:"flex",gap:6,alignItems:"center" }}>
    {[1,2,3].map(n => (
      <div key={n} style={{ display:"flex",alignItems:"center",gap:6 }}>
        <div style={{ width:n<=current?10:7,height:n<=current?10:7,borderRadius:999,transition:"all .3s",background:n<=current?color:"rgba(255,255,255,0.1)",boxShadow:n<=current?`0 0 7px ${color}99`:"none",border:n===current?`2px solid ${color}`:"none" }}/>
        {n<3 && <div style={{ width:18,height:1,background:n<current?color:"rgba(255,255,255,0.08)" }}/>}
      </div>
    ))}
    <span style={{ fontSize:11,color:"rgba(255,255,255,0.3)",marginLeft:4,fontFamily:"monospace" }}>M{current}/3</span>
  </div>
);

const DonateScreen = ({ mission: m, onBack, onPayfast, user, onBrowseMissions }) => {
  // #86 — a mission can cross 100% funded while the donor already has this
  // screen open (someone else's gift just landed, or they navigated here
  // from a stale mission card). Guard here rather than only at the button
  // in MissionDetail, since this screen is the one that actually accepts
  // payment.
  const isFullyFunded = m.goal > 0 && m.raised >= m.goal;
  const [donateTab,setDonateTab] = useState("once");   // once | monthly
  const [amt,setAmt]             = useState("");
  const [monthly,setMonthly]     = useState(null);
  const [prayed,setPrayed]       = useState(false);
  const [submitting,setSubmitting] = useState(false);
  const [monthlyDone,setMonthlyDone] = useState(false);
  const [error,setError]         = useState("");
  const isGuest = !user;
  const [guestName,setGuestName]   = useState("");
  const [guestEmail,setGuestEmail] = useState("");
  const guestInfoValid = !isGuest || (guestName.trim().length > 1 && /\S+@\S+\.\S+/.test(guestEmail.trim()));
  const canGive = amt && Number(amt) > 0 && prayed && guestInfoValid;
  const MONTHLY = [10,25,50,100,200];

  const handleMonthlyAdopt = async () => {
    // #88 fix: this used to just insert a "pending" row straight into
    // Supabase and immediately show the success screen — no PayFast
    // subscription was ever actually created, so no card was ever charged
    // and nothing ever recurred. Now it goes through the real PayFast
    // subscription checkout, same as the once-off flow does.
    if (!monthly || (isGuest && !guestInfoValid) || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onPayfast(monthly, isGuest ? { name: guestName.trim(), email: guestEmail.trim() } : null, "monthly");
      // No setMonthlyDone(true) here — the browser is being redirected to
      // PayFast's hosted checkout right now. Success is only real once the
      // donor completes checkout there and payfast-notify.js's ITN confirms
      // it; setSubmitting(false) is likewise skipped since the page is navigating away.
    } catch {
      setError("Could not start PayFast checkout. Please try again.");
      setSubmitting(false);
    }
  };

  const handleGive = async () => {
    if (!canGive || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onPayfast(amt, isGuest ? { name: guestName.trim(), email: guestEmail.trim() } : null);
    } catch {
      setError("Could not start PayFast checkout. Please try again.");
      setSubmitting(false);
    }
  };

  // #86 — fully-funded guard: message the donor and point them at another
  // mission instead of rendering a form that would just create an
  // over-goal donation.
  if (isFullyFunded) {
    return (
      <div style={{ minHeight:"100vh",background:"#060c18",color:"#eef1ff",fontFamily:"Georgia, serif" }}>
        <div style={{ background:"#09111f",borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"16px 24px",display:"flex",alignItems:"center",gap:14,position:"sticky",top:0,zIndex:100 }}>
          <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 16px",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:14 }}>Back</button>
          <span style={{ fontSize:18,fontWeight:700 }}>Donate to {m.protected?m.role:m.name}</span>
        </div>
        <div style={{ maxWidth:600,margin:"0 auto",padding:"32px 20px",display:"flex",flexDirection:"column",gap:20 }}>
          <div style={{ background:"rgba(62,207,142,0.08)",borderRadius:18,border:"1px solid rgba(62,207,142,0.25)",padding:"32px 24px",textAlign:"center" }}>
            <div style={{ fontSize:40,marginBottom:12 }}>🎉</div>
            <div style={{ fontSize:19,fontWeight:700,color:"#eef1ff",marginBottom:10 }}>This mission's goal has been fully funded!</div>
            <div style={{ fontSize:14,color:"rgba(255,255,255,0.5)",lineHeight:1.7,marginBottom:8 }}>
              Thanks to generous givers like you, <strong style={{ color:"#3ecf8e" }}>{m.protected?"this mission":m.name}</strong> has reached its ${fmt(m.goal)} goal.
            </div>
            <div style={{ fontSize:13,color:"rgba(255,255,255,0.35)" }}>Your gift can go even further supporting a mission still in need.</div>
          </div>
          <button onClick={onBrowseMissions} style={{ width:"100%",padding:"16px 0",borderRadius:14,border:"none",background:`linear-gradient(135deg,${m.color},${m.color}cc)`,color:"#000",fontWeight:700,cursor:"pointer",fontSize:15,fontFamily:"Georgia, serif",boxShadow:`0 6px 24px ${m.color}44` }}>
            ✝  Support Another Mission
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh",background:"#060c18",color:"#eef1ff",fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f",borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"16px 24px",display:"flex",alignItems:"center",gap:14,position:"sticky",top:0,zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 16px",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:14 }}>Back</button>
        <span style={{ fontSize:18,fontWeight:700 }}>Donate to {m.protected?m.role:m.name}</span>
      </div>
      <div style={{ maxWidth:600,margin:"0 auto",padding:"32px 20px",display:"flex",flexDirection:"column",gap:20 }}>
        <div style={{ background:`linear-gradient(135deg,${m.color}18,${m.color}06)`,borderRadius:18,border:`1px solid ${m.color}33`,padding:20 }}>
          <div style={{ fontSize:11,color:m.color,letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>Donating to</div>
          <div style={{ fontSize:20,fontWeight:700,color:"#eef1ff",marginBottom:4 }}>{m.protected?"Protected Missionary":m.name}</div>
          <div style={{ fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:14 }}>{m.title}</div>
          <Bar raised={m.raised} goal={m.goal} color={m.color} height={8}/>
          <div style={{ display:"flex",justifyContent:"space-between",marginTop:8 }}>
            <span style={{ fontSize:13,color:m.color,fontWeight:700 }}>${fmt(m.raised)} raised</span>
            <span style={{ fontSize:12,color:"rgba(255,255,255,0.3)" }}>{m.raised>=m.goal?"🎉 Goal reached!":`$${fmt(m.goal-m.raised)} still needed`}</span>
          </div>
        </div>
        <div style={{ background:"rgba(232,179,75,0.06)",borderRadius:14,border:"1px solid rgba(232,179,75,0.2)",padding:"14px 18px",display:"flex",gap:10 }}>
          <span style={{ fontSize:18,flexShrink:0 }}>🔐</span>
          <div style={{ fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.7 }}>Your donation is held in <strong style={{ color:"#e8b34b" }}>secure escrow</strong> and only released when milestone proof is verified.</div>
        </div>

        {isGuest && (
          <div style={{ background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.1)",padding:"18px" }}>
            <div style={{ fontSize:14,fontWeight:700,color:"#eef1ff",marginBottom:4 }}>Your Details</div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:14 }}>So we can send your receipt and keep you updated on this mission.</div>
            <input type="text" value={guestName} onChange={e=>setGuestName(e.target.value)} placeholder="Your name"
              style={{ width:"100%",padding:"12px 14px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#eef1ff",fontSize:14,fontFamily:"Georgia, serif",outline:"none",boxSizing:"border-box",marginBottom:10 }}/>
            <input type="email" value={guestEmail} onChange={e=>setGuestEmail(e.target.value)} placeholder="Your email"
              style={{ width:"100%",padding:"12px 14px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#eef1ff",fontSize:14,fontFamily:"Georgia, serif",outline:"none",boxSizing:"border-box" }}/>
          </div>
        )}
        {/* ── Giving type tabs ── */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",background:"rgba(255,255,255,0.04)",borderRadius:12,padding:3,gap:3 }}>
          {[["once","Once-off Gift"],["monthly","Monthly Support"]].map(([key,label])=>(
            <button key={key} onClick={()=>{setDonateTab(key);setError("");}} style={{ padding:"11px 0",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"Georgia,serif",fontWeight:700,fontSize:14,transition:"all .2s",
              background:donateTab===key?"linear-gradient(135deg,#e8b34b,#c8942b)":"transparent",
              color:donateTab===key?"#000":"rgba(255,255,255,0.4)" }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Monthly tab ── */}
        {donateTab==="monthly" && (
          monthlyDone ? (
            <div style={{ background:"rgba(62,207,142,0.08)",borderRadius:14,border:"1px solid rgba(62,207,142,0.25)",padding:"20px 18px",textAlign:"center" }}>
              <div style={{ fontSize:28,marginBottom:10 }}>🙏</div>
              <div style={{ fontSize:16,fontWeight:700,color:"#eef1ff",marginBottom:6 }}>You are now supporting this mission monthly!</div>
              <div style={{ fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.7 }}>
                <strong style={{ color:"#3ecf8e" }}>${fmt(monthly)}/month</strong> set aside for <strong style={{ color:"#eef1ff" }}>{m.protected?"this mission":m.name}</strong>.<br/>
                You will receive updates as the mission progresses.
              </div>
            </div>
          ) : (
            <>
              <div style={{ background:`${m.color}08`,borderRadius:12,border:`1px solid ${m.color}22`,padding:"12px 16px",fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.7 }}>
                "Support {m.protected?"this mission":m.name.split(" ").slice(-1)[0]}'s mission for just <strong style={{ color:m.color }}>${monthly||"X"}/month</strong> — creating recurring funding so the work never stops."
              </div>
              <div style={{ fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:8 }}>Choose a monthly amount</div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:6 }}>
                {MONTHLY.map(a=>(
                  <button key={a} onClick={()=>setMonthly(a)} style={{ padding:"11px 0",borderRadius:12,border:`1px solid ${monthly===a?m.color:"rgba(255,255,255,0.1)"}`,background:monthly===a?`${m.color}22`:"rgba(255,255,255,0.03)",color:monthly===a?m.color:"rgba(255,255,255,0.5)",fontWeight:700,cursor:"pointer",fontSize:13,transition:"all .15s" }}>${a}</button>
                ))}
              </div>
              <button onClick={handleMonthlyAdopt} disabled={!monthly||submitting||(isGuest&&!guestInfoValid)}
                style={{ width:"100%",padding:"15px 0",borderRadius:14,border:"none",
                  background:(monthly&&(!isGuest||guestInfoValid))?`linear-gradient(135deg,${m.color},${m.color}cc)`:"rgba(255,255,255,0.06)",
                  color:(monthly&&(!isGuest||guestInfoValid))?"#000":"rgba(255,255,255,0.25)",fontWeight:700,
                  cursor:monthly&&!submitting&&(!isGuest||guestInfoValid)?"pointer":"default",fontSize:15,fontFamily:"Georgia,serif",
                  boxShadow:monthly?`0 6px 24px ${m.color}44`:"none",transition:"all .2s" }}>
                {submitting?"Processing...":!monthly?"Select a monthly amount":(isGuest&&!guestInfoValid)?"Enter your details above":`✝  Adopt This Mission — $${monthly}/month`}
              </button>
              <div style={{ textAlign:"center",fontSize:12,color:"rgba(255,255,255,0.2)" }}>Monthly support is recorded and tracked — full transparency</div>
            </>
          )
        )}

        {/* ── Once-off tab ── */}
        {donateTab==="once" && <div>
          <div style={{ fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:10 }}>Select an amount</div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8 }}>
            {AMOUNTS.map(a => (
              <button key={a} onClick={()=>setAmt(String(a))} style={{ padding:"11px 0",borderRadius:12,border:`1px solid ${amt===String(a)?m.color:"rgba(255,255,255,0.1)"}`,background:amt===String(a)?`${m.color}22`:"rgba(255,255,255,0.03)",color:amt===String(a)?m.color:"rgba(255,255,255,0.5)",fontWeight:700,cursor:"pointer",fontSize:14,transition:"all .15s" }}>${a}</button>
            ))}
          </div>
          <div style={{ marginTop:12 }}>
          <div style={{ fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:8 }}>Or enter a custom amount</div>
          <div style={{ display:"flex",borderRadius:13,overflow:"hidden",border:`1px solid ${amt&&!AMOUNTS.includes(Number(amt))?m.color:"rgba(255,255,255,0.1)"}` }}>
            <div style={{ padding:"13px 15px",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.4)",fontSize:18 }}>$</div>
            <input type="number" value={AMOUNTS.includes(Number(amt))?"":amt} onChange={e=>setAmt(e.target.value)} placeholder="Enter amount" style={{ flex:1,padding:"13px 15px",background:"rgba(255,255,255,0.03)",border:"none",color:"#eef1ff",fontSize:18,fontFamily:"Georgia, serif",outline:"none" }}/>
          </div>
          </div>
          <div onClick={()=>setPrayed(p=>!p)}
          style={{ background:prayed?"rgba(232,179,75,0.1)":"rgba(255,255,255,0.02)",borderRadius:14,border:`1px solid ${prayed?"rgba(232,179,75,0.4)":"rgba(255,255,255,0.08)"}`,padding:"16px 18px",display:"flex",gap:14,alignItems:"flex-start",cursor:"pointer",transition:"all .2s" }}>
          <div style={{ width:24,height:24,borderRadius:7,flexShrink:0,marginTop:1,
            background:prayed?"linear-gradient(135deg,#e8b34b,#c8942b)":"rgba(255,255,255,0.05)",
            border:prayed?"none":"1px solid rgba(255,255,255,0.2)",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#000",fontWeight:700,transition:"all .2s" }}>
            {prayed?"✓":""}
          </div>
          <div>
            <div style={{ fontSize:15,fontWeight:700,color:"#eef1ff",marginBottom:5 }}>I commit to pray for this mission</div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,0.4)",lineHeight:1.7,fontStyle:"italic" }}>"The effective, fervent prayer of a righteous man avails much." — James 5:16</div>
          </div>
        </div>
          <button onClick={handleGive} disabled={!canGive||submitting}
          style={{ padding:"16px 0",borderRadius:14,border:"none",
            background:canGive?`linear-gradient(135deg,${m.color},${m.color}cc)`:"rgba(255,255,255,0.06)",
            color:canGive?"#000":"rgba(255,255,255,0.25)",fontWeight:700,cursor:canGive&&!submitting?"pointer":"default",
            fontSize:16,fontFamily:"Georgia, serif",opacity:submitting?0.7:1,
            boxShadow:canGive?`0 6px 28px ${m.color}44`:"none",transition:"all .2s" }}>
          {!amt||Number(amt)===0?"Enter an amount to continue":!prayed?"✝  Tick the prayer commitment to give":(isGuest&&!guestInfoValid)?"Enter your details above":submitting?"Redirecting to PayFast…":`💝  Give $${amt} via PayFast`}
          </button>
          {error && <div style={{ textAlign:"center",fontSize:13,color:"#e85b5b" }}>{error}</div>}
          <div style={{ textAlign:"center",fontSize:12,color:"rgba(255,255,255,0.2)" }}>🔒 Secure checkout via PayFast · Funds held in escrow · Released only on verified proof of work</div>
        </div>}
      </div>
    </div>
  );
};

const PayfastResultScreen = ({ status, amount, onContinue }) => (
  <div style={{ minHeight:"100vh",background:"#060c18",color:"#eef1ff",fontFamily:"Georgia, serif",display:"flex",alignItems:"center",justifyContent:"center",padding:32 }}>
    <div style={{ textAlign:"center",maxWidth:480,display:"flex",flexDirection:"column",gap:20,alignItems:"center" }}>
      {status==="success" ? (
        <>
          <div style={{ width:90,height:90,borderRadius:999,background:"rgba(62,207,142,0.12)",border:"2px solid rgba(62,207,142,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:44 }}>🙏</div>
          <div>
            <div style={{ fontSize:30,fontWeight:700,color:"#eef1ff",marginBottom:8 }}>God Bless You</div>
            <div style={{ fontSize:15,color:"rgba(255,255,255,0.5)",lineHeight:1.8 }}>
              {amount?<>Your gift of <strong style={{ color:"#3ecf8e" }}>${amount}</strong> is on its way to the mission field via PayFast.</>:"Your donation via PayFast is being processed."}
            </div>
            <div style={{ fontSize:13,color:"rgba(255,255,255,0.3)",marginTop:10 }}>It will appear in your Giving History once PayFast confirms the payment — usually within a few minutes.</div>
          </div>
        </>
      ) : (
        <>
          <div style={{ width:90,height:90,borderRadius:999,background:"rgba(232,179,75,0.12)",border:"2px solid rgba(232,179,75,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:44 }}>🙁</div>
          <div>
            <div style={{ fontSize:26,fontWeight:700,color:"#eef1ff",marginBottom:8 }}>Payment Cancelled</div>
            <div style={{ fontSize:15,color:"rgba(255,255,255,0.5)",lineHeight:1.8 }}>No worries — nothing was charged. You're welcome to try again any time.</div>
          </div>
        </>
      )}
      <div style={{ background:"rgba(232,179,75,0.08)",borderRadius:16,border:"1px solid rgba(232,179,75,0.2)",padding:"16px 24px",width:"100%",textAlign:"center" }}>
        <div style={{ fontSize:15,color:"#e8b34b",fontStyle:"italic",marginBottom:4 }}>"The harvest is plentiful but the workers are few."</div>
        <div style={{ fontSize:12,color:"rgba(255,255,255,0.3)" }}>Matthew 9:37</div>
      </div>
      <button onClick={onContinue} style={{ padding:"14px 40px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#3ecf8e,#2aaf74)",color:"#000",fontWeight:700,cursor:"pointer",fontSize:15,fontFamily:"Georgia, serif",boxShadow:"0 6px 28px rgba(62,207,142,0.4)" }}>Continue Exploring</button>
    </div>
  </div>
);

const MissionDetail = ({ mission: m, onBack, onDonate, onLedger, user, userRole, guest, isAdmin, onBrowseMissions }) => {
  const [proofTab,setProofTab]     = useState("photos");
  const [proofItems,setProofItems] = useState([]);
  const [proofLoaded,setProofLoaded] = useState(false);
  const [fieldReportCount, setFieldReportCount] = useState(0);

  useEffect(() => {
    if (!m?.id || proofLoaded) return;
    const loadProofs = async () => {
      try {
        const { data, error } = await supabase
          .from("milestone_proofs")
          .select("description, media_url, status, milestone_number")
          .eq("mission_id", m.id)
          .eq("status", "approved")
          .order("milestone_number", { ascending: true });
        if (error) { console.log("proofItems fetch error:", error); return; }
        setProofItems(data || []);
      } catch(e) { console.log("proofItems exception:", e); }
      setProofLoaded(true);
    };
    loadProofs();
  }, [m?.id]);

  // #76/#77: real signal that the missionary is actually "in the field" —
  // at least one Field Report has been posted for this mission.
  useEffect(() => {
    if (!m?.id) return;
    const loadFieldReportCount = async () => {
      try {
        const { count } = await supabase
          .from("mission_updates")
          .select("id", { count: "exact", head: true })
          .eq("mission_id", m.id)
          .eq("type", "update");
        if (typeof count === "number") setFieldReportCount(count);
      } catch (e) { console.log("fieldReportCount fetch error:", e); }
    };
    loadFieldReportCount();
  }, [m?.id]);

  // #76/#77: Journey step is now computed live from real data instead of
  // a static journey_step column that was never actually incremented
  // anywhere. Steps only ever move forward as real milestones are hit.
  const computedJourneyStep = (() => {
    if (m.status === "complete") return 5;
    if (proofItems.length > 0 || (m.souls||0) > 0 || (m.bibles||0) > 0 || (m.churches||0) > 0) return 4;
    if (fieldReportCount > 0) return 3;
    if (m.goal > 0 && m.raised >= m.goal) return 2;
    return 1;
  })();

  // #81/#82: Live Mission Updates (Field Report / Prayer Request) posting is
  // restricted to the mission's own missionary or its pastor at the DB level
  // via RLS (mission_updates_insert_owner, from #69/#78). This is the UI-side
  // mirror so Donor/Supporter and guest users don't see a post form they'd be
  // blocked from submitting anyway. Role-level check only — per-mission
  // ownership (this specific missionary/pastor vs. this specific mission) is
  // already enforced server-side.
  const canPostUpdates = !guest && !!user && (userRole==="missionary" || userRole==="minister" || userRole==="pastor" || userRole==="org_leader" || isAdmin);

  const shareWhatsApp = () => {
    const name    = m.protected ? "a faithful missionary" : m.name;
    const country = m.country || m.region;
    const funded  = pct(m.raised, m.goal);
    const short   = m.blurb.length > 100 ? m.blurb.slice(0, 100) + "..." : m.blurb;
    const text = encodeURIComponent(
      `Help Reach Souls in ${country}!\n\n` +
      `Mission by ${name}\n` +
      `Goal: $${fmt(m.goal)} - ${funded}% funded\n\n` +
      `"${short}"\n\n` +
      `Help us reach unreached souls - SendMe Global Mission Fund\n` +
      `https://sendme-nine.vercel.app`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };
  return (
    <div style={{ minHeight:"100vh",background:"#060c18",color:"#eef1ff",fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f",borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"16px 24px",display:"flex",alignItems:"center",gap:14,position:"sticky",top:0,zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 16px",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:14 }}>Back</button>
        <span style={{ fontSize:18,fontWeight:700 }}>Mission Detail</span>
        <div style={{ marginLeft:"auto",display:"flex",gap:8,alignItems:"center" }}>
          <RiskBadge level={m.riskLevel||1} />
          <TrustBadge level={m.trustLevel||1} />
          <span style={{ padding:"4px 12px",borderRadius:999,fontSize:12,background:m.status==="complete"?"rgba(62,207,142,0.15)":`${m.color}18`,color:m.status==="complete"?"#3ecf8e":m.color,border:`1px solid ${m.status==="complete"?"#3ecf8e33":m.color+"33"}` }}>{m.status==="complete"?"Completed":m.protected?"Protected":"Active"}</span>
        </div>
      </div>
      <div style={{ maxWidth:700,margin:"0 auto",padding:"0 20px 60px" }}>
        <div style={{ background:`linear-gradient(160deg,${m.color}18 0%,#060c18 100%)`,borderBottom:`1px solid ${m.color}1a`,padding:"28px 0 24px" }}>
          <div style={{ display:"flex",gap:16,alignItems:"flex-start",marginBottom:16 }}>
            <div style={{ width:64,height:64,borderRadius:20,flexShrink:0,background:`linear-gradient(135deg,${m.color}44,${m.color}18)`,border:`2px solid ${m.color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28 }}>✝</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11,color:m.color,letterSpacing:2,textTransform:"uppercase",marginBottom:3 }}>{m.role} · {m.church}</div>
              <div style={{ fontSize:22,fontWeight:700,color:"#eef1ff",lineHeight:1.2 }}>{m.protected?"Protected "+m.role:m.name}</div>
              <div style={{ fontSize:13,color:"rgba(255,255,255,0.35)",marginTop:4 }}>📍 {m.protected?`${m.region} (Location Protected)`:`${m.area}, ${m.city}, ${m.country}`}</div>
            </div>
          </div>
          <div style={{ fontSize:18,fontWeight:700,color:"#eef1ff",marginBottom:8 }}>{m.title}</div>
          <div style={{ fontSize:14,color:"rgba(255,255,255,0.55)",lineHeight:1.85 }}>{m.blurb}</div>
        </div>
        <div style={{ padding:"24px 0",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <span style={{ fontSize:13,color:"rgba(255,255,255,0.4)" }}>Funding Progress</span>
            <MsTrack current={m.milestone} color={m.color}/>
          </div>
          <Bar raised={m.raised} goal={m.goal} color={m.color} height={10}/>
          <div style={{ display:"flex",justifyContent:"space-between",marginTop:10 }}>
            <span style={{ fontSize:16,color:m.color,fontWeight:700 }}>${fmt(m.raised)} raised</span>
            <span style={{ fontSize:13,color:"rgba(255,255,255,0.3)" }}>{pct(m.raised,m.goal)}% of ${fmt(m.goal)}</span>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginTop:20 }}>
            {[["🙏",m.souls,"Souls",m.color],["📖",m.bibles,"Bibles","#5b9cf6"],["⛪",m.churches,"Churches","#3ecf8e"]].map(([icon,val,label,c])=>(
              <div key={label} style={{ background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"14px 10px",textAlign:"center" }}>
                <div style={{ fontSize:22 }}>{icon}</div>
                <div style={{ fontSize:20,fontWeight:700,color:c,marginTop:4 }}>{fmt(val)}</div>
                <div style={{ fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <JourneyTimeline currentStep={computedJourneyStep} color={m.color} />
        <BudgetBreakdown budget={m.budget} goal={m.goal} color={m.color} />
        <UpdatesFeed missionId={m.id} missionColor={m.color} missionName={m.protected?"Missionary":m.name}
          canPost={canPostUpdates} guest={guest} />
        <PrayerChain missionId={m.id} missionColor={m.color} initialCount={m.prayers||0} />
        <div style={{ padding:"24px 0",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ fontSize:16,fontWeight:700,color:"#eef1ff" }}>Proof of Work</div>
            <div style={{ display:"flex",gap:8 }}>
              {["photos","videos"].map(t=>(
                <button key={t} onClick={()=>setProofTab(t)} style={{ padding:"5px 14px",borderRadius:8,border:`1px solid ${proofTab===t?m.color:"rgba(255,255,255,0.1)"}`,background:proofTab===t?`${m.color}18`:"transparent",color:proofTab===t?m.color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:12,fontFamily:"Georgia, serif" }}>{t==="photos"?"Photos":"Videos"}</button>
              ))}
            </div>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {proofItems.length === 0 && (
              <div style={{ fontSize:13,color:"rgba(255,255,255,0.3)",padding:"12px 0",textAlign:"center" }}>
                No verified milestone proofs yet.
              </div>
            )}
            {proofItems.map((item,i)=>(
              <div key={i} style={{ padding:"12px 16px",borderRadius:12,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",gap:10 }}>
                <div style={{ width:8,height:8,borderRadius:999,background:m.color,boxShadow:`0 0 6px ${m.color}`,flexShrink:0 }}/>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:13,color:"rgba(255,255,255,0.6)" }}>{item.description}</span>
                  {item.media_url && (
                    <a href={item.media_url} target="_blank" rel="noreferrer"
                      style={{ display:"block",fontSize:11,color:"#e8b34b",marginTop:3,textDecoration:"none" }}>
                      📷 View proof →
                    </a>
                  )}
                </div>
                <span style={{ fontSize:11,padding:"2px 8px",borderRadius:6,background:"rgba(62,207,142,0.1)",color:"#3ecf8e",border:"1px solid rgba(62,207,142,0.2)",flexShrink:0 }}>Verified</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding:"24px 0",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ background:"rgba(255,255,255,0.02)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"16px 18px",display:"flex",gap:14,alignItems:"center" }}>
            <span style={{ fontSize:28 }}>⛪</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12,color:"rgba(255,255,255,0.3)",marginBottom:3 }}>Endorsed by verified church</div>
              <div style={{ fontSize:15,fontWeight:700,color:"#eef1ff" }}>{m.church}</div>
            </div>
            <span style={{ padding:"4px 12px",borderRadius:999,fontSize:12,background:"rgba(62,207,142,0.12)",color:"#3ecf8e",border:"1px solid rgba(62,207,142,0.25)" }}>Verified</span>
          </div>
        </div>
        <div style={{ padding:"20px 0 0" }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr auto auto",gap:10 }}>
            {/* #86 — once a mission hits its funding goal, point donors at
                another mission instead of continuing to solicit gifts here.
                (DonateScreen also guards this directly for anyone who gets
                there another way — this is just the primary path.) */}
            {m.goal > 0 && m.raised >= m.goal ? (
              <button onClick={onBrowseMissions} style={{ padding:"16px 0",borderRadius:14,border:"none",background:"linear-gradient(135deg,#3ecf8e,#2fa06d)",color:"#000",fontWeight:700,cursor:"pointer",fontSize:16,fontFamily:"Georgia, serif",boxShadow:"0 6px 28px rgba(62,207,142,0.3)" }}>
                🎉 Goal Reached — Support Another Mission
              </button>
            ) : (
              <button onClick={onDonate} style={{ padding:"16px 0",borderRadius:14,border:"none",background:`linear-gradient(135deg,${m.color},${m.color}cc)`,color:"#000",fontWeight:700,cursor:"pointer",fontSize:16,fontFamily:"Georgia, serif",boxShadow:`0 6px 28px ${m.color}44` }}>
                💝 Donate to This Mission
              </button>
            )}
            <button onClick={shareWhatsApp} style={{ padding:"16px 18px",borderRadius:14,border:"1px solid rgba(62,207,142,0.3)",background:"rgba(62,207,142,0.08)",color:"#3ecf8e",fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"Georgia, serif",whiteSpace:"nowrap" }}>
              Help Spread This Mission
            </button>
            <button onClick={onLedger} style={{ padding:"16px 18px",borderRadius:14,border:"1px solid rgba(91,156,246,0.3)",background:"rgba(91,156,246,0.08)",color:"#5b9cf6",fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"Georgia, serif",whiteSpace:"nowrap" }}>
              View Ledger
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PrayerWall = ({ missions, onBack }) => {
  const [joined, setJoined]           = useState({});
  const [allRequests, setAllRequests] = useState([]);
  const [loadingPrayer, setLoadingPrayer] = useState(true);
  // #78: real global chain total, from mission_prayers — not local clicks
  const [totalChainCount, setTotalChainCount] = useState(0);
  // #78: per-mission chain counts, so each request card shows its mission's real count
  const [chainCountByMission, setChainCountByMission] = useState({});

  useEffect(() => {
    const fetchPrayers = async () => {
      setLoadingPrayer(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id || null;

        // Source 1: missionary-authored "Prayer Request" field reports
        const updatesReq = supabase
          .from("mission_updates")
          .select("id, mission_id, author, text, created_at, missions(title, country)")
          .eq("type", "prayer")
          .order("created_at", { ascending: false });

        // Source 2 (#69): visitor-submitted prayer requests from the Mission
        // Detail "Prayer Chain" box — previously never queried at all.
        const prayersReq = supabase
          .from("mission_prayers")
          .select("id, mission_id, text, created_at, missions(title, country)")
          .eq("type", "request")
          .order("created_at", { ascending: false });

        // Source 3 (#78): every chain join, used to compute real counts.
        const chainReq = supabase
          .from("mission_prayers")
          .select("id, mission_id, donor_id")
          .eq("type", "chain");

        const [updatesRes, prayersRes, chainRes] = await Promise.all([updatesReq, prayersReq, chainReq]);

        if (updatesRes.error) console.log("PrayerWall mission_updates fetch error:", updatesRes.error);
        if (prayersRes.error) console.log("PrayerWall mission_prayers fetch error:", prayersRes.error);
        if (chainRes.error)   console.log("PrayerWall chain count fetch error:", chainRes.error);

        // Real per-mission chain counts
        const byMission = {};
        (chainRes.data || []).forEach(row => {
          byMission[row.mission_id] = (byMission[row.mission_id] || 0) + 1;
        });
        setChainCountByMission(byMission);
        setTotalChainCount((chainRes.data || []).length);

        const fromUpdates = (updatesRes.data || []).map(r => ({
          id:        `update-${r.id}`,
          missionId: r.mission_id,
          mission:   r.missions?.title   || "Mission",
          country:   r.missions?.country || "",
          text:      r.text,
          author:    r.author || "A missionary",
          urgent:    false,
          created_at: r.created_at,
        }));
        const fromChainRequests = (prayersRes.data || []).map(r => ({
          id:        `chain-${r.id}`,
          missionId: r.mission_id,
          mission:   r.missions?.title   || "Mission",
          country:   r.missions?.country || "",
          text:      r.text,
          author:    "A believer praying for this mission",
          urgent:    false,
          created_at: r.created_at,
        }));

        const merged = [...fromUpdates, ...fromChainRequests]
          .filter(r => r.text)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .map(r => ({ ...r, prayers: byMission[r.missionId] || 0 }));

        setAllRequests(merged);

        // If this user already joined a mission's chain, reflect that so
        // the button shows "✓ Praying" instead of resetting on revisit.
        if (uid) {
          const joinedByMission = {};
          (chainRes.data || []).forEach(row => {
            if (row.donor_id === uid) joinedByMission[row.mission_id] = true;
          });
          const joinedByRequestId = {};
          merged.forEach(r => {
            if (joinedByMission[r.missionId]) joinedByRequestId[r.id] = true;
          });
          setJoined(joinedByRequestId);
        }
      } catch (e) {
        console.log("PrayerWall exception:", e);
        setAllRequests([]);
      }
      setLoadingPrayer(false);
    };
    fetchPrayers();
  }, []);

  // #78: real total, not local-click count. Local joins still bump it
  // optimistically until the next fetch.
  const totalPraying = totalChainCount + Object.values(joined).filter(Boolean).length;

  const joinPrayer = async (r) => {
    if (joined[r.id]) return;
    setJoined(j => ({ ...j, [r.id]: true }));
    // Write back to the same table Mission Detail's "Join Prayer Chain" uses,
    // so joining from the Wall counts toward the mission's real total too.
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || null;
      await supabase.from("mission_prayers").insert({ mission_id: r.missionId, type: "chain", donor_id: uid });
    } catch {}
  };
  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>Global Prayer Wall</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>INTERCEDING FOR THE NATIONS</div>
        </div>
        <div style={{ marginLeft:"auto", fontSize:13, color:"rgba(255,255,255,0.3)" }}>{fmt(totalPraying)} believers praying</div>
      </div>
      <div style={{ maxWidth:680, margin:"0 auto", padding:"28px 20px 60px" }}>
        <div style={{ background:"rgba(232,179,75,0.08)", borderRadius:16, border:"1px solid rgba(232,179,75,0.2)", padding:"20px 24px", marginBottom:24, textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🙏</div>
          <div style={{ fontSize:18, fontWeight:700, color:"#eef1ff", marginBottom:8 }}>The effectual fervent prayer of a righteous man availeth much.</div>
          <div style={{ fontSize:13, color:"#e8b34b", fontWeight:700 }}>James 5:16</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:24 }}>
          {[["🙏",fmt(totalPraying),"Believers Praying","#e8b34b"],["🌍",allRequests.length,"Active Requests","#5b9cf6"],["✝",allRequests.filter(r=>r.urgent).length,"Urgent Needs","#e85b5b"]].map(([icon,val,label,c]) => (
            <div key={label} style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", padding:"14px 10px", textAlign:"center" }}>
              <div style={{ fontSize:22 }}>{icon}</div>
              <div style={{ fontSize:20, fontWeight:700, color:c, marginTop:4 }}>{val}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
        {loadingPrayer && (
          <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>
            🙏 Loading prayer requests...
          </div>
        )}
        {!loadingPrayer && allRequests.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>
            No prayer requests yet. Missionaries post prayer requests from the Mission Detail screen.
          </div>
        )}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {allRequests.map(r => {
            const isJoined = joined[r.id];
            const count = r.prayers + (isJoined ? 1 : 0);
            return (
              <div key={r.id} style={{ background:"#0c1628", borderRadius:16, border:`1px solid ${r.urgent?"rgba(232,91,91,0.3)":"rgba(255,255,255,0.07)"}`, borderLeft:`3px solid ${r.urgent?"#e85b5b":"#e8b34b"}`, padding:20 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10, gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6, flexWrap:"wrap" }}>
                      {r.urgent && <span style={{ fontSize:11, padding:"2px 8px", borderRadius:999, background:"rgba(232,91,91,0.12)", color:"#e85b5b", border:"1px solid rgba(232,91,91,0.3)", fontWeight:600 }}>Urgent Prayer</span>}
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>📍 {r.country}</span>
                    </div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#e8b34b", marginBottom:6 }}>{r.mission}</div>
                    <div style={{ fontSize:14, color:"rgba(255,255,255,0.7)", lineHeight:1.7 }}>{r.text}</div>
                  </div>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:12 }}>
                  <span style={{ fontSize:13, color:"rgba(255,255,255,0.4)" }}>{fmt(count)} believers praying</span>
                  <button onClick={() => joinPrayer(r)} disabled={isJoined}
                    style={{ padding:"8px 20px", borderRadius:10, border:"none", background:isJoined?"rgba(62,207,142,0.12)":"linear-gradient(135deg,#e8b34b,#c8942b)", color:isJoined?"#3ecf8e":"#000", fontWeight:700, cursor:isJoined?"default":"pointer", fontSize:13, fontFamily:"Georgia, serif" }}>
                    {isJoined ? "✓ Praying" : "Join Prayer"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ textAlign:"center", padding:"32px 0 0", borderTop:"1px solid rgba(255,255,255,0.05)", marginTop:32 }}>
          <div style={{ fontSize:13, color:"#e8b34b", fontStyle:"italic" }}>"Pray without ceasing." — 1 Thessalonians 5:17</div>
        </div>
      </div>
    </div>
  );
};

const LoadingMap = () => (
  <div style={{ height:400,borderRadius:20,border:"1px solid rgba(255,255,255,0.08)",background:"#09111f",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16 }}>
    <div style={{ fontSize:36,color:"#e8b34b" }}>✝</div>
    <div style={{ fontSize:13,color:"rgba(255,255,255,0.3)" }}>Loading missions from Supabase...</div>
  </div>
);

const ROLE_LABELS = {
  donor:      { label:"Donor / Supporter",              color:"#3ecf8e" },
  missionary: { label:"Missionary",                     color:"#e8b34b" },
  pastor:     { label:"Pastor (Senior Leader)",          color:"#5b9cf6" },
  org_leader: { label:"Missionary-Sending Organization", color:"#5b9cf6" },
  minister:   { label:"Minister / Evangelist",           color:"#b06cf5" },
};

const DonorProfile = ({ user, onBack, userRole, isAdmin }) => {
  const [donations,setDonations] = useState([]);
  const [loading,setLoading]     = useState(true);
  useEffect(() => {
    const fetch = async () => {
      if (!user) { setLoading(false); return; }
      try {
        const { data } = await supabase.from("donations").select("*").eq("user_id",user.id).order("created_at",{ascending:false});
        setDonations(data||[]);
      } catch { setDonations([]); }
      setLoading(false);
    };
    fetch();
  },[user]);
  const DEMO = [
    {id:1,mission_name:"Gospel & Food Aid — Merkato",country:"Ethiopia",amount:50, created_at:"2025-03-12",status:"active"},
    {id:2,mission_name:"Amazon River Mission",        country:"Brazil",  amount:100,created_at:"2025-04-01",status:"active"},
    {id:3,mission_name:"Kibera Children's Ministry",  country:"Kenya",   amount:75, created_at:"2025-04-18",status:"complete"},
    {id:4,mission_name:"Syrian Refugee Outreach",     country:"Lebanon", amount:50, created_at:"2025-05-02",status:"active"},
  ];
  const disp  = donations.length>0?donations:DEMO;
  const total = disp.reduce((acc,d)=>acc+(d.amount||0),0);
  return (
    <div style={{ minHeight:"100vh",background:"#060c18",color:"#eef1ff",fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f",borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"16px 24px",display:"flex",alignItems:"center",gap:14,position:"sticky",top:0,zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 16px",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:14,fontFamily:"Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize:18,fontWeight:700 }}>My Profile</div>
          <div style={{ fontSize:11,color:"rgba(255,255,255,0.3)",letterSpacing:2,marginTop:2 }}>SENDME GLOBAL MISSION FUND</div>
        </div>
      </div>
      <div style={{ maxWidth:680,margin:"0 auto",padding:"28px 20px 60px" }}>
        <div style={{ background:"linear-gradient(135deg,rgba(232,179,75,0.12),rgba(232,179,75,0.04))",borderRadius:20,border:"1px solid rgba(232,179,75,0.2)",padding:"24px",marginBottom:24,textAlign:"center" }}>
          <div style={{ width:70,height:70,borderRadius:"50%",background:"linear-gradient(135deg,#e8b34b,#c8942b)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 14px",boxShadow:"0 0 28px rgba(232,179,75,0.4)" }}>✝</div>
          <div style={{ fontSize:20,fontWeight:700,color:"#eef1ff",marginBottom:4 }}>{user?.user_metadata?.full_name||user?.email?.split("@")[0]||"Believer"}</div>
          <div style={{ fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:10 }}>{user?.email}</div>
          <div style={{ display:"inline-block",fontSize:12,fontWeight:700,padding:"4px 14px",borderRadius:999,marginBottom:12,
            background:`${(isAdmin?"#e85b5b":ROLE_LABELS[userRole]?.color)||"#3ecf8e"}18`,
            color:isAdmin?"#e85b5b":(ROLE_LABELS[userRole]?.color||"#3ecf8e"),
            border:`1px solid ${(isAdmin?"#e85b5b":ROLE_LABELS[userRole]?.color)||"#3ecf8e"}44` }}>
            {isAdmin ? "Admin" : (ROLE_LABELS[userRole]?.label || "Donor / Supporter")}
          </div>
          <div style={{ fontSize:13,color:"#e8b34b",fontStyle:"italic" }}>"Here am I Lord, send me." — Isaiah 6:8</div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24 }}>
          {[["💝",`$${fmt(total)}`,"Total Given","#3ecf8e"],["🌍",new Set(disp.map(d=>d.mission_id||d.id)).size,"Missions Supported","#e8b34b"],["✈️",new Set(disp.map(d=>d.country).filter(Boolean)).size,"Countries Reached","#5b9cf6"]].map(([icon,val,label,c])=>(
            <div key={label} style={{ background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"16px 10px",textAlign:"center" }}>
              <div style={{ fontSize:22 }}>{icon}</div>
              <div style={{ fontSize:20,fontWeight:700,color:c,marginTop:4 }}>{val}</div>
              <div style={{ fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ background:"rgba(232,179,75,0.07)",borderRadius:14,border:"1px solid rgba(232,179,75,0.18)",padding:"14px 18px",marginBottom:24,textAlign:"center" }}>
          <div style={{ fontSize:14,color:"#f4e4c0",fontStyle:"italic",lineHeight:1.7 }}>"He which soweth sparingly shall reap also sparingly; and he which soweth bountifully shall reap also bountifully."</div>
          <div style={{ fontSize:12,color:"#e8b34b",marginTop:6,fontWeight:700 }}>2 Corinthians 9:6</div>
        </div>
        <div style={{ fontSize:16,fontWeight:700,color:"#eef1ff",marginBottom:14 }}>My Giving History</div>
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {disp.map((d,i)=>(
            <div key={d.id||i} style={{ background:"#0c1628",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"16px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12 }}>
              <div style={{ display:"flex",gap:12,alignItems:"center",flex:1,minWidth:0 }}>
                <div style={{ width:40,height:40,borderRadius:12,background:"rgba(62,207,142,0.12)",border:"1px solid rgba(62,207,142,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>💝</div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:14,fontWeight:700,color:"#eef1ff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{d.mission_name||"Mission"}</div>
                  <div style={{ fontSize:12,color:"rgba(255,255,255,0.35)",marginTop:2 }}>📍 {d.country||"Global"} · {d.created_at?new Date(d.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):""}</div>
                </div>
              </div>
              <div style={{ textAlign:"right",flexShrink:0 }}>
                <div style={{ fontSize:16,fontWeight:700,color:"#3ecf8e" }}>${fmt(d.amount||0)}</div>
                <span style={{ fontSize:11,padding:"2px 8px",borderRadius:999,background:d.status==="complete"?"rgba(62,207,142,0.12)":"rgba(232,179,75,0.12)",color:d.status==="complete"?"#3ecf8e":"#e8b34b",border:`1px solid ${d.status==="complete"?"rgba(62,207,142,0.25)":"rgba(232,179,75,0.25)"}` }}>
                  {d.status==="complete"?"✓ Completed":"● Active"}
                </span>
              </div>
            </div>
          ))}
        </div>
        {donations.length===0&&!loading&&<div style={{ background:"rgba(232,179,75,0.05)",borderRadius:10,border:"1px solid rgba(232,179,75,0.1)",padding:"10px 14px",marginTop:12,fontSize:12,color:"rgba(255,255,255,0.3)",textAlign:"center" }}>Demo data shown — your real giving history will appear here after your first donation.</div>}
        <div style={{ textAlign:"center",padding:"32px 0 0",borderTop:"1px solid rgba(255,255,255,0.05)",marginTop:32 }}>
          <div style={{ fontSize:13,color:"#e8b34b",fontStyle:"italic" }}>"Go ye into all the world and preach the gospel to every creature." — Mark 16:15</div>
        </div>
      </div>
    </div>
  );
};

// ── NAV "MORE" DROPDOWN ──────────────────────────────────────────────────────
const NavDropdown = ({ user, userRole, guest, onProfile, onEmergency, onTestimonies, onWorker, onMatching, onQR, onFaq, onPayout, onMilestoneProof, onPastorReview, onMissionaryDashboard }) => {
  const [open,setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(()=>{
    const handler = (e)=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown",handler);
    return ()=>document.removeEventListener("mousedown",handler);
  },[]);

  const items = [
    user && { label:"My Profile",        icon:"✝",  color:"#e8b34b",                onClick:onProfile },
    !guest && { label:"🚨 Emergency",     color:"#e85b5b",                            onClick:onEmergency },
    { label:"Testimonies",               color:"#3ecf8e",                            onClick:onTestimonies },
    !guest && { label:"Send Worker",      color:"#b06cf5",                            onClick:onWorker },
    { label:"Find Mission",              color:"#5b9cf6",                            onClick:onMatching },
    { label:"QR Share",                  color:"rgba(255,255,255,0.65)",             onClick:onQR },
    { label:"FAQ",                       color:"#e8b34b",                            onClick:onFaq },
  ].filter(Boolean);

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        background:open?"rgba(232,179,75,0.12)":"rgba(255,255,255,0.05)",
        border:`1px solid ${open?"rgba(232,179,75,0.35)":"rgba(255,255,255,0.1)"}`,
        borderRadius:10, padding:"8px 16px",
        color:open?"#e8b34b":"rgba(255,255,255,0.6)",
        cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif",
        display:"flex", alignItems:"center", gap:5,
      }}>
        More
        <span style={{ fontSize:10, display:"inline-block", transform:open?"rotate(180deg)":"none", transition:"transform .15s" }}>▾</span>
      </button>
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 8px)", right:0, minWidth:200,
          background:"#0c1628", border:"1px solid rgba(232,179,75,0.2)",
          borderRadius:14, boxShadow:"0 12px 40px rgba(0,0,0,0.6)",
          padding:6, zIndex:200, display:"flex", flexDirection:"column", gap:2,
        }}>
          {items.map(item=>(
            <button key={item.label}
              onClick={()=>{ item.onClick && item.onClick(); setOpen(false); }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}
              style={{
                display:"flex", alignItems:"center", gap:8,
                width:"100%", textAlign:"left", padding:"10px 12px",
                borderRadius:8, border:"none", background:"transparent",
                color:item.color, cursor:"pointer", fontSize:13,
                fontWeight:600, fontFamily:"Georgia, serif", transition:"background .12s",
              }}>
              {item.icon && <span>{item.icon}</span>}{item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── PASTOR "PAYOUTS" DROPDOWN ────────────────────────────────────────────────
// Groups Payout Details + Review Proofs — pastor-only per Bug #45 (missionaries
// no longer have Payout Details access) and Bug #50 (own top menu w/ dropdown).
const PayoutsDropdown = ({ onPayout, onPastorReview }) => {
  const [open,setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(()=>{
    const handler = (e)=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown",handler);
    return ()=>document.removeEventListener("mousedown",handler);
  },[]);

  const items = [
    { label:"💳 Payout Details", color:"rgba(255,255,255,0.65)", onClick:onPayout },
    { label:"⛪ Review Proofs",  color:"#3ecf8e",                onClick:onPastorReview },
  ];

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        background:open?"rgba(232,179,75,0.12)":"rgba(255,255,255,0.05)",
        border:`1px solid ${open?"rgba(232,179,75,0.35)":"rgba(255,255,255,0.1)"}`,
        borderRadius:10, padding:"8px 16px",
        color:open?"#e8b34b":"rgba(255,255,255,0.6)",
        cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif",
        display:"flex", alignItems:"center", gap:5,
      }}>
        Payouts
        <span style={{ fontSize:10, display:"inline-block", transform:open?"rotate(180deg)":"none", transition:"transform .15s" }}>▾</span>
      </button>
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 8px)", right:0, minWidth:190,
          background:"#0c1628", border:"1px solid rgba(232,179,75,0.2)",
          borderRadius:14, boxShadow:"0 12px 40px rgba(0,0,0,0.6)",
          padding:6, zIndex:200, display:"flex", flexDirection:"column", gap:2,
        }}>
          {items.map(item=>(
            <button key={item.label}
              onClick={()=>{ item.onClick && item.onClick(); setOpen(false); }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}
              style={{
                display:"flex", alignItems:"center", gap:8,
                width:"100%", textAlign:"left", padding:"10px 12px",
                borderRadius:8, border:"none", background:"transparent",
                color:item.color, cursor:"pointer", fontSize:13,
                fontWeight:600, fontFamily:"Georgia, serif", transition:"background .12s",
              }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── ADMIN DROPDOWN ───────────────────────────────────────────────────────────
// Groups the 5 admin-only nav buttons (Church Verification, Workers,
// Emergencies, Approvals, Payouts) that used to sit as separate buttons in
// the main nav, cluttering the bar for the one person who ever sees them.
// Same collapsible pattern as NavDropdown ("More") and PayoutsDropdown.
const AdminDropdown = ({ onAdminChurchVerification, onAdminWorkers, onAdminEmergency, onAdminApprovals, onAdminPayouts }) => {
  const [open,setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(()=>{
    const handler = (e)=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown",handler);
    return ()=>document.removeEventListener("mousedown",handler);
  },[]);

  const items = [
    { label:"⛪ Verify Churches", color:"#5b9cf6", onClick:onAdminChurchVerification },
    { label:"👥 Worker Requests", color:"#5b9cf6", onClick:onAdminWorkers },
    { label:"🚨 Emergencies",     color:"#e85b5b", onClick:onAdminEmergency },
    { label:"📋 Approvals",       color:"#e8b34b", onClick:onAdminApprovals },
    { label:"💰 Payouts",         color:"#e85b5b", onClick:onAdminPayouts },
  ];

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        background:open?"rgba(232,91,91,0.12)":"rgba(232,91,91,0.08)",
        border:`1px solid ${open?"rgba(232,91,91,0.4)":"rgba(232,91,91,0.25)"}`,
        borderRadius:10, padding:"8px 16px",
        color:"#e85b5b",
        cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif", fontWeight:700,
        display:"flex", alignItems:"center", gap:5,
      }}>
        ⚙ Admin
        <span style={{ fontSize:10, display:"inline-block", transform:open?"rotate(180deg)":"none", transition:"transform .15s" }}>▾</span>
      </button>
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 8px)", right:0, minWidth:200,
          background:"#0c1628", border:"1px solid rgba(232,91,91,0.2)",
          borderRadius:14, boxShadow:"0 12px 40px rgba(0,0,0,0.6)",
          padding:6, zIndex:200, display:"flex", flexDirection:"column", gap:2,
        }}>
          {items.map(item=>(
            <button key={item.label}
              onClick={()=>{ item.onClick && item.onClick(); setOpen(false); }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}
              style={{
                display:"flex", alignItems:"center", gap:8,
                width:"100%", textAlign:"left", padding:"10px 12px",
                borderRadius:8, border:"none", background:"transparent",
                color:item.color, cursor:"pointer", fontSize:13,
                fontWeight:600, fontFamily:"Georgia, serif", transition:"background .12s",
              }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── HOME SCREEN ───────────────────────────────────────────────────────────────
const HomeScreen = ({ onMission, user, userRole, onSignOut, onApply, onChurch, onMyChurch, onChurches, onProfile, onEmergency, onMatching, onPray, onTestimonies, onWorker, onQR, onFaq, onPayout, onAdminPayouts, isAdmin, isPastor, onMilestoneProof, onPastorReview, onMissionaryDashboard, onAdminApprovals, onAdminChurchVerification, guest, onSignIn, onDonate, onAdminWorkers, onAdminEmergency }) => {
  const [region,setRegion]       = useState("All");
  const [missions,setMissions]   = useState([]);
  const [loading,setLoading]     = useState(true);
  useEffect(()=>{
    const fetchMissions = async () => {
      setLoading(true);
      try {
        const {data,error} = await supabase.from("missions").select("*").eq("status","active").order("created_at",{ascending:false});
        if(error) throw error;
        setMissions(data ? data.map((row,i)=>mapRow(row,i)) : []);
      } catch{ setMissions([]); }
      setLoading(false);
    };
    fetchMissions();
  },[]);
  const visible      = region==="All"?missions:missions.filter(m=>m.region===region||m.region.startsWith(region.slice(0,3)));
  const totalRaised  = missions.reduce((acc,m)=>acc+(m.raised||0),0);
  const activeCount  = missions.filter(m=>m.status==="active").length;
  const countryCount = new Set(missions.map(m=>m.country)).size;
  return (
    <div style={{ minHeight:"100vh",background:"#060c18",fontFamily:"Georgia, serif",color:"#eef1ff" }}>
      <div style={{ background:"#09111f",borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"16px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100 }}>
        <div>
          <div style={{ fontSize:28,fontWeight:800,color:"#fff" }}>Send<span style={{ color:"#e8b34b" }}>Me</span></div>
          <div style={{ fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:4 }}>GLOBAL MISSION FUND</div>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
          {user&&<span style={{ fontSize:12,color:"rgba(255,255,255,0.4)" }}>✝ {user.email?.split("@")[0]}</span>}
          <button onClick={onDonate} style={{ background:"linear-gradient(135deg,#4caf7d,#3a8f63)",border:"none",borderRadius:10,padding:"8px 16px",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700 }}>💛 Donate</button>
          <button onClick={onPray} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 16px",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:13 }}>Pray</button>
          <button onClick={onChurches} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 16px",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:13 }}>Churches</button>
          {/* #80: Donor/Supporter role should not see Apply in the main nav */}
          {!guest && userRole!=="donor" && <button onClick={onApply} style={{ background:"linear-gradient(135deg,#e8b34b,#c8942b)",border:"none",borderRadius:10,padding:"8px 16px",color:"#000",cursor:"pointer",fontSize:13,fontWeight:700 }}>Apply</button>}
          {(userRole==="missionary"||isPastor) && user && <button onClick={onMilestoneProof} style={{ background:"rgba(91,156,246,0.1)",border:"1px solid rgba(91,156,246,0.3)",borderRadius:10,padding:"8px 16px",color:"#5b9cf6",cursor:"pointer",fontSize:13,fontWeight:700 }}>📋 Submit Proof</button>}
          {userRole==="missionary" && user && <button onClick={onMissionaryDashboard} style={{ background:"rgba(232,179,75,0.1)",border:"1px solid rgba(232,179,75,0.3)",borderRadius:10,padding:"8px 16px",color:"#e8b34b",cursor:"pointer",fontSize:13,fontWeight:700 }}>📊 My Dashboard</button>}
          {isPastor && <button onClick={onMyChurch} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 16px",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:13 }}>{userRole==="org_leader" ? "My Organization" : "My Church"}</button>}
          {isPastor && user && <PayoutsDropdown onPayout={onPayout} onPastorReview={onPastorReview} />}
          <NavDropdown
            user={user} userRole={userRole} guest={guest}
            onProfile={onProfile} onEmergency={onEmergency} onTestimonies={onTestimonies}
            onWorker={onWorker} onMatching={onMatching} onQR={onQR} onFaq={onFaq}
          />
          {isAdmin && <AdminDropdown onAdminChurchVerification={onAdminChurchVerification} onAdminWorkers={onAdminWorkers} onAdminEmergency={onAdminEmergency} onAdminApprovals={onAdminApprovals} onAdminPayouts={onAdminPayouts} />}
          {user&&<button onClick={onSignOut} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"8px 14px",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:12 }}>Sign Out</button>}
        </div>
      </div>
      <div style={{ maxWidth:900,margin:"0 auto",padding:"24px 20px" }}>
        {user && <NotificationOptIn user={user}/>}
        <div style={{ marginBottom:24 }}>
          {loading?<LoadingMap/>:<MapboxMap missions={missions} onMissionClick={onMission}/>}
        </div>
        {userRole==="missionary"&&user&&(
          <div onClick={onMissionaryDashboard} style={{ background:"rgba(232,179,75,0.08)",borderRadius:14,border:"1px solid rgba(232,179,75,0.25)",padding:"14px 18px",marginBottom:16,display:"flex",gap:14,alignItems:"center",cursor:"pointer",transition:"background .15s" }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(232,179,75,0.13)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(232,179,75,0.08)";}}>
            <span style={{ fontSize:24 }}>📊</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14,fontWeight:700,color:"#e8b34b" }}>View Your Missionary Dashboard</div>
              <div style={{ fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:2 }}>Check your mission's progress, current milestone, and submitted proofs</div>
            </div>
            <span style={{ fontSize:18,color:"#e8b34b" }}>→</span>
          </div>
        )}
        <div style={{ background:"rgba(232,179,75,0.08)",borderRadius:16,border:"1px solid rgba(232,179,75,0.2)",padding:"16px 20px",textAlign:"center",marginBottom:24 }}>
          <div style={{ fontSize:15,color:"#f4e4c0",fontStyle:"italic",lineHeight:1.7 }}>"Go ye into all the world and preach the gospel to every creature."</div>
          <div style={{ fontSize:12,color:"#e8b34b",marginTop:6,fontWeight:700 }}>Mark 16:15</div>
        </div>
        {FEATURED_VIDEOS.missionVision && (
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:16,fontWeight:700,color:"#eef1ff",marginBottom:10 }}>✝ Our Mission &amp; Vision</div>
            <YouTubeEmbed videoId={FEATURED_VIDEOS.missionVision} title="SendMe — Mission & Vision" />
            <div style={{ textAlign:"center" }}>
              <a href={SENDME_CHANNEL_URL} target="_blank" rel="noopener noreferrer"
                style={{ fontSize:12,color:"#e8b34b",textDecoration:"underline",fontFamily:"Georgia,serif" }}>
                Visit our YouTube channel for more videos
              </a>
            </div>
          </div>
        )}
        <div style={{ display:"flex",gap:8,marginBottom:20,flexWrap:"wrap" }}>
          {REGIONS.map(r=>(
            <button key={r} onClick={()=>setRegion(r)} style={{ padding:"7px 16px",borderRadius:999,border:`1px solid ${region===r?"#e8b34b":"rgba(255,255,255,0.1)"}`,background:region===r?"rgba(232,179,75,0.15)":"rgba(255,255,255,0.03)",color:region===r?"#e8b34b":"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:13,fontWeight:600,transition:"all .15s" }}>{r}</button>
          ))}
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:28 }}>
          {[["✝",activeCount,"Active Missions","#e8b34b"],["💝","$"+fmt(totalRaised),"Total Raised","#3ecf8e"],["👥",fmt(missions.reduce((acc,m)=>acc+(m.prayers||0),0)),"Prayers","#5b9cf6"],["🌍",countryCount,"Countries","#b06cf5"]].map(([icon,val,label,c])=>(
            <div key={label} style={{ background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"16px 12px",textAlign:"center" }}>
              <div style={{ fontSize:20 }}>{icon}</div>
              <div style={{ fontSize:18,fontWeight:700,color:c,marginTop:4 }}>{val}</div>
              <div style={{ fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:18,fontWeight:700,color:"#eef1ff",marginBottom:16 }}>✝ Active Missions</div>
        {loading?(
          <div style={{ textAlign:"center",padding:"40px 0",color:"rgba(255,255,255,0.3)",fontSize:14 }}>Loading missions...</div>
        ):visible.length===0?(
          <div style={{ textAlign:"center",padding:"48px 20px",color:"rgba(255,255,255,0.3)",fontSize:14,background:"rgba(255,255,255,0.02)",borderRadius:16,border:"1px solid rgba(255,255,255,0.06)" }}>
            {region==="All"
              ? "No active missions yet — check back soon as new missions are approved!"
              : `No active missions in ${region} yet — try a different region or check back soon.`}
          </div>
        ):(
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            {visible.map(m=>(
              <div key={m.id} onClick={()=>onMission(m)} style={{ background:"#0c1628",borderRadius:18,border:`1px solid ${m.color}22`,padding:20,cursor:"pointer",borderLeft:`3px solid ${m.color}`,transition:"transform .15s, box-shadow .15s" }}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 8px 32px ${m.color}22`;}}
                onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
                  <div style={{ display:"flex",gap:12,alignItems:"flex-start" }}>
                    <div style={{ width:48,height:48,borderRadius:14,background:`${m.color}22`,border:`1.5px solid ${m.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>✝</div>
                    <div>
                      <div style={{ fontSize:10,color:m.color,letterSpacing:2,textTransform:"uppercase",marginBottom:2 }}>{m.role}</div>
                      <div style={{ fontSize:16,fontWeight:700,color:"#eef1ff" }}>{m.protected?"Protected Mission":m.name}</div>
                      <div style={{ fontSize:12,color:"rgba(255,255,255,0.35)",marginTop:2 }}>📍 {m.protected?m.region+" (Protected)":`${m.city}, ${m.country}`}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end" }}>
                    <span style={{ padding:"3px 10px",borderRadius:999,fontSize:11,background:m.status==="complete"?"rgba(62,207,142,0.15)":`${m.color}18`,color:m.status==="complete"?"#3ecf8e":m.color,border:`1px solid ${m.status==="complete"?"#3ecf8e33":m.color+"33"}`,whiteSpace:"nowrap" }}>{m.status==="complete"?"Done":"Active"}</span>
                    <div style={{ display:"flex",gap:5 }}>
                      <RiskBadge level={m.riskLevel||1}/>
                      <TrustBadge level={m.trustLevel||1}/>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize:14,fontWeight:600,color:"rgba(238,241,255,0.8)",marginBottom:10 }}>{m.title}</div>
                <Bar raised={m.raised} goal={m.goal} color={m.color}/>
                <div style={{ display:"flex",justifyContent:"space-between",margin:"8px 0 14px" }}>
                  <span style={{ fontSize:13,color:m.color,fontWeight:700 }}>${fmt(m.raised)} raised</span>
                  <span style={{ fontSize:12,color:"rgba(255,255,255,0.3)" }}>{pct(m.raised,m.goal)}% of ${fmt(m.goal)}</span>
                </div>
                <button onClick={e=>{e.stopPropagation();onMission(m);}} style={{ width:"100%",padding:"12px 0",borderRadius:12,border:"none",background:`linear-gradient(135deg,${m.color},${m.color}cc)`,color:"#000",fontWeight:700,cursor:"pointer",fontSize:14,boxShadow:`0 4px 20px ${m.color}44` }}>View Mission & Donate</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ textAlign:"center",padding:"40px 0 20px",borderTop:"1px solid rgba(255,255,255,0.06)",marginTop:32 }}>
          <div style={{ fontSize:14,color:"rgba(255,255,255,0.3)",marginBottom:6 }}>✝ SendMe — For Message Believers Worldwide</div>
          <div style={{ fontSize:13,color:"#e8b34b",fontStyle:"italic" }}>"Here am I Lord, send me." — Isaiah 6:8</div>
          <button onClick={onFaq} style={{ marginTop:12,background:"none",border:"none",color:"rgba(232,179,75,0.5)",cursor:"pointer",fontSize:12,fontFamily:"Georgia,serif",textDecoration:"underline" }}>
            New to SendMe? Read our FAQ
          </button>
        </div>
      </div>
      {/* Guest sticky bottom banner */}
      {guest && (
        <div style={{ position:"fixed",bottom:0,left:0,right:0,background:"linear-gradient(135deg,#0c1628,#09111f)",borderTop:"1px solid rgba(232,179,75,0.3)",padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:200,gap:12 }}>
          <div style={{ fontSize:13,color:"rgba(255,255,255,0.6)" }}>
            <span style={{ color:"#e8b34b",fontWeight:700 }}>Join SendMe</span> — donate, track missions, and pray with believers worldwide
          </div>
          <button onClick={onSignIn} style={{ background:"linear-gradient(135deg,#e8b34b,#c8942b)",border:"none",borderRadius:10,padding:"10px 20px",color:"#000",cursor:"pointer",fontSize:13,fontWeight:700,whiteSpace:"nowrap",flexShrink:0 }}>
            ✝ Sign In / Register →
          </button>
        </div>
      )}
    </div>
  );
};



const DonorBrowse = ({ onBack, onMission, user }) => {
  const [missions, setMissions]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [sort, setSort]           = useState("urgent");   // urgent | least | newest
  const [region, setRegion]       = useState("All");

  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("missions").select("*").eq("status","active")
          .order("created_at",{ ascending:false });
        if (error) throw error;
        setMissions(data ? data.map((r,i) => mapRow(r,i)) : []);
      } catch { setMissions([]); }
      setLoading(false);
    };
    fetch_();
  }, []);

  const regions = ["All", ...Array.from(new Set(missions.map(m => m.region))).sort()];

  const sorted = [...missions]
    .filter(m => region === "All" || m.region === region)
    .sort((a,b) => {
      if (sort === "urgent")  return pct(a.raised,a.goal) - pct(b.raised,b.goal);
      if (sort === "least")   return (a.raised - a.goal) - (b.raised - b.goal);
      return 0; // newest — already ordered from DB
    });

  const totalNeeded = sorted.reduce((acc,m) => acc + Math.max(0, m.goal - m.raised), 0);

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>

      {/* Header */}
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:700 }}>Give to a Mission</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>ACTIVE MISSIONS NEEDING SUPPORT</div>
        </div>
        {!loading && <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>{sorted.length} mission{sorted.length!==1?"s":""}</div>}
      </div>

      <div style={{ maxWidth:680, margin:"0 auto", padding:"24px 20px 60px" }}>

        {/* Total needed banner */}
        {!loading && sorted.length > 0 && (
          <div style={{ background:"rgba(232,179,75,0.07)", borderRadius:14, border:"1px solid rgba(232,179,75,0.2)", padding:"14px 18px", marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)" }}>Total still needed across all missions</div>
            <div style={{ fontSize:18, fontWeight:700, color:"#e8b34b" }}>${fmt(totalNeeded)}</div>
          </div>
        )}

        {/* Sort + Filter */}
        <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
          <div style={{ display:"flex", background:"rgba(255,255,255,0.04)", borderRadius:10, padding:3, gap:3 }}>
            {[["urgent","Most Urgent"],["least","Least Funded"],["newest","Newest"]].map(([key,label]) => (
              <button key={key} onClick={()=>setSort(key)} style={{ padding:"7px 14px", borderRadius:8, border:"none", cursor:"pointer", fontSize:12, fontFamily:"Georgia, serif", fontWeight:600,
                background: sort===key ? "linear-gradient(135deg,#e8b34b,#c8942b)" : "transparent",
                color: sort===key ? "#000" : "rgba(255,255,255,0.4)",
              }}>{label}</button>
            ))}
          </div>
          {regions.length > 2 && (
            <select value={region} onChange={e=>setRegion(e.target.value)} style={{ padding:"7px 14px", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.04)", color:"#eef1ff", fontSize:12, fontFamily:"Georgia, serif", cursor:"pointer" }}>
              {regions.map(r => <option key={r} value={r} style={{ background:"#0c1628" }}>{r}</option>)}
            </select>
          )}
        </div>

        {/* Mission cards */}
        {loading && (
          <div style={{ textAlign:"center", padding:"60px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>
            Loading missions...
          </div>
        )}

        {!loading && sorted.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>
            No active missions found.
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {sorted.map(m => {
            const funded  = pct(m.raised, m.goal);
            const needed  = Math.max(0, m.goal - m.raised);
            const urgent  = funded < 40;
            return (
              <div key={m.id}
                onClick={() => onMission(m)}
                style={{ background:"#0c1628", borderRadius:16, border:`1px solid ${m.color}28`, borderLeft:`4px solid ${m.color}`, padding:20, cursor:"pointer", transition:"transform .15s, box-shadow .15s" }}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 8px 28px ${m.color}22`;}}
                onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}
              >
                {/* Top row */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8, gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:"#eef1ff", marginBottom:3 }}>
                      {m.protected ? "Protected Mission" : m.title}
                    </div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>
                      {m.protected ? m.country : `${m.name} · ${m.country}`}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
                    {urgent && (
                      <span style={{ fontSize:10, fontWeight:700, color:"#e85b5b", background:"rgba(232,91,91,0.12)", border:"1px solid rgba(232,91,91,0.3)", borderRadius:6, padding:"2px 8px", letterSpacing:1 }}>URGENT</span>
                    )}
                    <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)", background:"rgba(255,255,255,0.04)", borderRadius:6, padding:"2px 8px" }}>{m.region}</span>
                  </div>
                </div>

                {/* Blurb */}
                {!m.protected && (
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", lineHeight:1.65, marginBottom:14 }}>
                    {m.blurb?.length > 120 ? m.blurb.slice(0,120)+"…" : m.blurb}
                  </div>
                )}

                {/* Progress bar */}
                <div style={{ marginBottom:10 }}>
                  <Bar raised={m.raised} goal={m.goal} color={m.color} height={7}/>
                </div>

                {/* Stats row */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", gap:16 }}>
                    <span style={{ fontSize:13, color:m.color, fontWeight:700 }}>${fmt(m.raised)} raised</span>
                    <span style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>{m.raised>=m.goal?"🎉 Goal reached!":`$${fmt(needed)} still needed`}</span>
                  </div>
                  <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.5)",
                    background:"rgba(255,255,255,0.05)", borderRadius:8, padding:"4px 10px" }}>
                    {funded}% funded
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer scripture */}
        <div style={{ textAlign:"center", padding:"36px 0 0", borderTop:"1px solid rgba(255,255,255,0.05)", marginTop:32 }}>
          <div style={{ fontSize:13, color:"#e8b34b", fontStyle:"italic" }}>"Go ye into all the world and preach the gospel to every creature." — Mark 16:15</div>
        </div>
      </div>
    </div>
  );
};

const MissionVisionSplash = ({ onDone }) => (
  <div style={{
    minHeight:"100vh", background:"#060c18", display:"flex", alignItems:"center",
    justifyContent:"center", padding:24, fontFamily:"Georgia, serif",
  }}>
    <div style={{ width:"100%", maxWidth:520 }}>

      {/* Cross */}
      <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
        <svg width="40" height="54" viewBox="0 0 40 54" fill="none" xmlns="http://www.w3.org/2000/svg">
          <filter id="glow2"><feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <g filter="url(#glow2)">
            <rect x="16" y="0" width="8" height="54" rx="4" fill="url(#cg2)"/>
            <rect x="0" y="14" width="40" height="8" rx="4" fill="url(#cg2)"/>
          </g>
          <defs>
            <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f9d97a"/>
              <stop offset="50%" stopColor="#e8b34b"/>
              <stop offset="100%" stopColor="#c8942b"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Title */}
      <div style={{ textAlign:"center", marginBottom:32 }}>
        <div style={{ fontSize:38, fontWeight:800, color:"#fff", lineHeight:1.1 }}>
          Send<span style={{ color:"#e8b34b" }}>Me</span>
        </div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:4, marginTop:6 }}>
          GLOBAL MISSION FUND
        </div>
        <div style={{ fontSize:13, color:"#e8b34b", fontStyle:"italic", marginTop:10 }}>
          "Here am I Lord, send me." — Isaiah 6:8
        </div>
      </div>

      {/* Card */}
      <div style={{
        background:"#0c1628", borderRadius:20,
        border:"1px solid rgba(255,255,255,0.08)", padding:"32px 28px", marginBottom:16,
      }}>

        {/* Mission */}
        <div style={{ marginBottom:28 }}>
          <div style={{
            fontSize:11, color:"#e8b34b", fontWeight:700, letterSpacing:2.5,
            textTransform:"uppercase", marginBottom:10,
          }}>Our Mission</div>
          <div style={{ fontSize:15, color:"rgba(255,255,255,0.75)", lineHeight:1.85 }}>
            SendMe exists to <strong style={{ color:"#eef1ff" }}>connect Message-believing missionaries with faithful supporters</strong> worldwide — so that every believer called to the harvest field can go, sustained by the Body of Christ.
          </div>
        </div>

        <div style={{ height:1, background:"rgba(255,255,255,0.07)", marginBottom:28 }}/>

        {/* Vision */}
        <div style={{ marginBottom:28 }}>
          <div style={{
            fontSize:11, color:"#e8b34b", fontWeight:700, letterSpacing:2.5,
            textTransform:"uppercase", marginBottom:10,
          }}>Our Vision</div>
          <div style={{ fontSize:15, color:"rgba(255,255,255,0.75)", lineHeight:1.85 }}>
            A world where <strong style={{ color:"#eef1ff" }}>no missionary stands alone</strong> — where verified Message churches and transparent escrow funding ensure every offering reaches the field with accountability, dignity, and faith.
          </div>
        </div>

        <div style={{ height:1, background:"rgba(255,255,255,0.07)", marginBottom:28 }}/>

        {/* Pillars */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:4 }}>
          {[
            [null, "Message-Believing", "Built for the end-time Bride"],
            ["🌍", "Global Reach",      "Active missions across every continent"],
            ["🔒", "Full Escrow",       "Funds held until milestones are met"],
            ["⛪", "Church-Anchored",   "Every missionary endorsed by a local church"],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{
              background:"rgba(255,255,255,0.03)", borderRadius:12,
              border:"1px solid rgba(255,255,255,0.06)", padding:"14px 12px",
            }}>
              <div style={{ fontSize:20, marginBottom:6 }}>
                {icon ? icon : (
                  <svg width="20" height="26" viewBox="0 0 20 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="8" y="0" width="4" height="26" rx="2" fill="url(#pg)"/>
                    <rect x="0" y="7" width="20" height="4" rx="2" fill="url(#pg)"/>
                    <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f9d97a"/>
                      <stop offset="100%" stopColor="#c8942b"/>
                    </linearGradient></defs>
                  </svg>
                )}
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:"#eef1ff", marginBottom:4 }}>{title}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", lineHeight:1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scripture */}
      <div style={{ textAlign:"center", marginBottom:24 }}>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.35)", fontStyle:"italic", lineHeight:1.8 }}>
          "Go ye into all the world and preach the gospel to every creature."
        </div>
        <div style={{ fontSize:12, color:"#e8b34b", marginTop:4 }}>— Mark 16:15</div>
      </div>

      {/* CTA */}
      <button
        onClick={onDone}
        style={{
          width:"100%", padding:"16px 0", borderRadius:14, border:"none",
          background:"linear-gradient(135deg,#e8b34b,#c8942b)",
          color:"#000", fontWeight:700, fontSize:16, fontFamily:"Georgia, serif",
          cursor:"pointer", boxShadow:"0 6px 28px rgba(232,179,75,0.45)",
        }}
      >
        ✝ &nbsp; Enter SendMe
      </button>
    </div>
  </div>
);

const GuestBlocked = ({ title, message, onBack, onRegister, primaryLabel="✝ Sign In / Register", onPrimary }) => (
  <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif", display:"flex", alignItems:"center", justifyContent:"center", padding:32 }}>
    <div style={{ textAlign:"center", maxWidth:440 }}>
      <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
      <div style={{ fontSize:22, fontWeight:700, marginBottom:12 }}>{title}</div>
      <div style={{ fontSize:14, color:"rgba(255,255,255,0.5)", lineHeight:1.7, marginBottom:28 }}>{message}</div>
      <button onClick={onPrimary||onRegister} style={{ width:"100%", padding:"14px 0", borderRadius:14, border:"none", background:"linear-gradient(135deg,#e8b34b,#c8942b)", color:"#000", fontWeight:700, cursor:"pointer", fontSize:15, fontFamily:"Georgia, serif", marginBottom:12 }}>
        {primaryLabel}
      </button>
      <button onClick={onBack} style={{ width:"100%", padding:"12px 0", borderRadius:14, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"rgba(255,255,255,0.5)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>
        Back to Home
      </button>
    </div>
  </div>
);

export default function App() {
  const [user,setUser]                         = useState(null);
  const [showSplash,setShowSplash]             = useState(false);
  const [userRole,setUserRole]                 = useState(null);
  const [authReady,setAuthReady]               = useState(false);
  const [screen,setScreen]                     = useState("home");
  const [selectedMission,setSelectedMission]   = useState(null);
  const [guest,setGuest]                       = useState(false);
  const [pfReturn,setPfReturn]                 = useState(null);
  const [pendingMissionId,setPendingMissionId] = useState(null);
  const [liveMissions,setLiveMissions]         = useState([]);

  const loadRole = async (u) => {
    if (!u) { setUserRole(null); return; }
    try {
      const { data } = await supabase.from("profiles").select("role, is_admin").eq("id", u.id).single();
      setUserRole(data?.role || u.user_metadata?.role || null);
      // Attach is_admin flag directly to user object so isAdminUser check works
      if (data?.is_admin) u.isAdmin = true;
    } catch {
      setUserRole(u.user_metadata?.role || null);
    }
  };

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      const u = session?.user ?? null;
      setUser(u); loadRole(u); setAuthReady(true);
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_,session)=>{
      const u = session?.user ?? null;
      setUser(u); loadRole(u);
    });
    return ()=>subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    const pf = params.get("payfast");
    if(pf==="success"||pf==="cancel"){
      const missionId = params.get("m");
      let amount = null;
      try {
        const stored = JSON.parse(sessionStorage.getItem("sendme_pending_donation")||"null");
        if(stored && String(stored.mission_id)===String(missionId)) amount = stored.amount;
        sessionStorage.removeItem("sendme_pending_donation");
      } catch {}
      setPfReturn({ status: pf, amount });
      window.history.replaceState({}, "", window.location.pathname);
    }
  },[]);

  // Bug #61 — deep-link routing so QR/shared links (e.g. /mission/:id, /emergency, /apply)
  // open the right screen instead of always landing on Home.
  useEffect(()=>{
    const path = window.location.pathname.replace(/\/+$/,"") || "/";
    const missionMatch = path.match(/^\/mission\/([^/]+)$/);
    if(missionMatch){ setPendingMissionId(missionMatch[1]); return; }
    const ROUTE_SCREENS = {
      "/missions":"donor-browse",
      "/apply":"apply",
      "/register-church":"church",
      "/emergency":"emergency",
    };
    if(ROUTE_SCREENS[path]) setScreen(ROUTE_SCREENS[path]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Resolve a deep-linked mission id (from a QR/share URL) against Supabase directly,
  // so it works even for missions not in the "active" list (e.g. completed missions).
  useEffect(()=>{
    if(!pendingMissionId) return;
    let cancelled = false;
    (async () => {
      try{
        const { data, error } = await supabase.from("missions").select("*").eq("id", pendingMissionId).single();
        if(error || !data) throw error || new Error("Mission not found");
        if(!cancelled){ setSelectedMission(mapRow(data, 0)); setScreen("detail"); }
      } catch {
        if(!cancelled) setScreen("home");
      }
      if(!cancelled) setPendingMissionId(null);
    })();
    return ()=>{ cancelled = true; };
  },[pendingMissionId]);

  // Bug #62 — one shared, live missions list for Home + all secondary screens
  // (Mission Matching, Prayer Wall, QR Share) so they never diverge from what
  // donors see on the home map.
  useEffect(()=>{
    const fetchLiveMissions = async () => {
      try{
        const { data, error } = await supabase.from("missions").select("*").eq("status","active").order("created_at",{ascending:false});
        if(error) throw error;
        setLiveMissions(data ? data.map((row,i)=>mapRow(row,i)) : []);
      } catch { setLiveMissions([]); }
    };
    fetchLiveMissions();
  },[]);

  const signOut       = async()=>{await supabase.auth.signOut();setUser(null);setUserRole(null);setGuest(false);setScreen("home");};
  const isPastor      = userRole === "pastor" || userRole === "org_leader";
  const isAdminUser   = user?.email === ADMIN_EMAIL || user?.isAdmin === true;
  const openMission   = (m)  =>{setSelectedMission(m);setScreen("detail");};
  const openDonate    = ()   =>{setScreen("donate");};
  const handlePayfastDonate = (amt, guestInfo, type = "once") => startPayfastDonation({ mission: selectedMission, amount: amt, user, guestInfo, type });

  if(!authReady) return(<div style={{ minHeight:"100vh",background:"#060c18",display:"flex",alignItems:"center",justifyContent:"center" }}><div style={{ fontSize:48,color:"#e8b34b" }}>✝</div></div>);
  if(pfReturn) return <PayfastResultScreen status={pfReturn.status} amount={pfReturn.amount} onContinue={()=>setPfReturn(null)}/>;
  if(!user && !guest) return <Auth onLogin={(u)=>{ setUser(u); if(!localStorage.getItem("sendme_splash_seen")){ setShowSplash(true); } }} onGuest={()=>setGuest(true)}/>;
  if(showSplash) return <MissionVisionSplash onDone={()=>{ localStorage.setItem("sendme_splash_seen","1"); setShowSplash(false); }}/>;

  if(screen==="donor-browse")    return <DonorBrowse onBack={()=>setScreen("home")} onMission={openMission} user={user}/>;
  if(screen==="faq")              return <FAQScreen onBack={()=>setScreen("home")}/>;
  if(screen==="payout")           return <PayoutSetup onBack={()=>setScreen("home")} user={user}/>;
  if(screen==="admin-payouts")    return isAdminUser ? <AdminPayouts onBack={()=>setScreen("home")}/> : <FAQScreen onBack={()=>setScreen("home")}/>;
  if(screen==="pray")             return <PrayerWall missions={liveMissions} onBack={()=>setScreen("home")}/>;
  if(screen==="churches")         return <ChurchesTab onBack={()=>setScreen("home")}/>;
  if(screen==="apply")            return guest ? <GuestBlocked title="Registration Required" message="Applying as a missionary requires a SendMe account so your application can be tracked and your church can endorse you. Please sign in or register to continue." onBack={()=>setScreen("home")} onRegister={()=>{setGuest(false);setScreen("home");}}/> : userRole==="donor" ? <GuestBlocked title="Not Available for Donors" message="Applying as a missionary isn't available on a Donor/Supporter account. If you're called to the mission field, please register a separate missionary account, or contact admin to update your role." onBack={()=>setScreen("home")} primaryLabel="Back to Home" onPrimary={()=>setScreen("home")}/> : <MissionaryApplication onBack={()=>setScreen("home")} user={user}/>;
  if(screen==="church")           return (isPastor||isAdminUser) ? <ChurchRegistration onBack={()=>setScreen("home")} user={user} userRole={userRole}/> : null;
  if(screen==="my-church")        return (isPastor||isAdminUser) ? <MyChurch onBack={()=>setScreen("home")} user={user} userRole={userRole} onPayout={()=>setScreen("payout")}/> : null;
  if(screen==="profile")          return <DonorProfile user={user} onBack={()=>setScreen("home")} userRole={userRole} isAdmin={isAdminUser}/>;
  if(screen==="emergency")        return guest ? <GuestBlocked title="Registration Required" message="Submitting an emergency mission request requires a SendMe account, so admin can verify and follow up with you directly. Please sign in or register to continue." onBack={()=>setScreen("home")} onRegister={()=>{setGuest(false);setScreen("home");}}/> : <EmergencyRequests onBack={()=>setScreen("home")} user={user} userRole={userRole}/>;
  if(screen==="matching")         return <MissionMatching missions={liveMissions} onMission={openMission} onBack={()=>setScreen("home")}/>;
  if(screen==="testimonies")      return <TestimonyEngine onBack={()=>setScreen("home")} onMission={openMission}/>;
  if(screen==="worker")           return guest ? <GuestBlocked title="Registration Required" message="Posting or responding to a worker request requires a SendMe account, so churches can coordinate and follow up directly. Please sign in or register to continue." onBack={()=>setScreen("home")} onRegister={()=>{setGuest(false);setScreen("home");}}/> : <SendAWorker onBack={()=>setScreen("home")} user={user}/>;
  if(screen==="qr")               return <QRShare missions={liveMissions} onBack={()=>setScreen("home")}/>;
  if(screen==="milestone-proof")  return <MilestoneProof onBack={()=>setScreen("home")} user={user}/>;
  if(screen==="pastor-review")    return (isPastor||isAdminUser) ? <PastorReview onBack={()=>setScreen("home")} user={user} isAdmin={isAdminUser}/> : <FAQScreen onBack={()=>setScreen("home")}/>;
  if(screen==="missionary-dashboard") return <MissionaryDashboard onBack={()=>setScreen("home")} user={user} onSubmitProof={()=>setScreen("milestone-proof")}/>;
  if(screen==="admin-approvals")  return isAdminUser ? <AdminApprovals onBack={()=>setScreen("home")} user={user}/> : <FAQScreen onBack={()=>setScreen("home")}/>;
  if(screen==="admin-church-verification") return isAdminUser ? <AdminChurchVerification onBack={()=>setScreen("home")} user={user}/> : <FAQScreen onBack={()=>setScreen("home")}/>;
  if(screen==="admin-workers")        return isAdminUser ? <AdminWorkerRequests onBack={()=>setScreen("home")}/> : <FAQScreen onBack={()=>setScreen("home")}/>;
  if(screen==="admin-emergency")      return isAdminUser ? <AdminEmergencyRequests onBack={()=>setScreen("home")} adminEmail={user?.email}/> : <FAQScreen onBack={()=>setScreen("home")}/>;
  if(screen==="ledger"&&selectedMission)  return <TransparencyLedger mission={selectedMission} onBack={()=>setScreen("detail")}/>;
  if(screen==="detail"&&selectedMission)  return <MissionDetail mission={selectedMission} onBack={()=>setScreen("home")} onDonate={openDonate} onLedger={()=>setScreen("ledger")} user={user} userRole={userRole} guest={guest} isAdmin={isAdminUser} onBrowseMissions={()=>setScreen("donor-browse")}/>;
  if(screen==="donate"&&selectedMission)  return <DonateScreen mission={selectedMission} onBack={()=>setScreen("detail")} onPayfast={handlePayfastDonate} user={user} onBrowseMissions={()=>setScreen("donor-browse")}/>;

  return(
    <HomeScreen
      onMission={openMission} user={user} userRole={userRole} onSignOut={signOut}
      onApply={()=>setScreen("apply")} onChurch={()=>setScreen("church")}
      onMyChurch={()=>setScreen("my-church")}
      onChurches={()=>setScreen("churches")} onProfile={()=>setScreen("profile")}
      onEmergency={()=>setScreen("emergency")} onMatching={()=>setScreen("matching")}
      onPray={()=>setScreen("pray")} onTestimonies={()=>setScreen("testimonies")}
      onWorker={()=>setScreen("worker")} onQR={()=>setScreen("qr")}
      onFaq={()=>setScreen("faq")}
      onPayout={()=>setScreen("payout")}
      onAdminPayouts={()=>setScreen("admin-payouts")}
      onAdminApprovals={()=>setScreen("admin-approvals")}
      onAdminChurchVerification={()=>setScreen("admin-church-verification")}
      onMilestoneProof={()=>setScreen("milestone-proof")}
      onPastorReview={()=>setScreen("pastor-review")}
      onMissionaryDashboard={()=>setScreen("missionary-dashboard")}
      isAdmin={isAdminUser}
      isPastor={isPastor||isAdminUser}
      guest={guest}
      onSignIn={()=>setGuest(false)}
      onDonate={()=>setScreen("donor-browse")}
      onAdminWorkers={()=>setScreen("admin-workers")}
      onAdminEmergency={()=>setScreen("admin-emergency")}
    />
  );
}
