import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import Auth from "./Auth";
import "./App.css";
import MissionaryApplication from "./MissionaryApplication";
import ChurchRegistration from "./ChurchRegistration";
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

const DEMO_MISSIONS = [
  { id:1, name:"Rev. Samuel Osei",   role:"Missionary",  church:"Accra Redemption Church",   city:"Addis Ababa", country:"Ethiopia", area:"Merkato District",         region:"Africa",      lat:9.03,  lng:38.74, title:"Gospel & Food Aid — Merkato",     blurb:"Feeding 400 families weekly while planting the Word in one of Addis Ababa's most densely populated slums.",           raised:9840,  goal:15000, color:"#e8b34b", status:"active",   milestone:2, souls:312, bibles:200, churches:1, prayers:87,  protected:false, trustLevel:2, journeyStep:4, riskLevel:1, budget:[{label:"Food parcels",amount:4000},{label:"Bibles & Tracts",amount:2500},{label:"Transport",amount:1500},{label:"Accommodation",amount:1840}] },
  { id:2, name:"Sis. Maria Santos",  role:"Minister",    church:"Manaus River Fellowship",    city:"Manaus",      country:"Brazil",   area:"Amazon Riverside Villages", region:"S. America",  lat:-3.1,  lng:-60.0, title:"Amazon River Mission",            blurb:"Travelling by boat into 12 unreached riverside communities with the Gospel, medicines, and Bibles in the local dialect.",      raised:14200, goal:22000, color:"#4caf7d", status:"active",   milestone:2, souls:148, bibles:312, churches:3, prayers:134, protected:false, trustLevel:3, journeyStep:5, riskLevel:2, budget:[{label:"Boat fuel",amount:5000},{label:"Medicines",amount:4200},{label:"Bibles",amount:3000},{label:"Food",amount:2000}] },
  { id:3, name:"Pastor John Kimani", role:"Pastor",      church:"Nairobi First Assembly",     city:"Nairobi",     country:"Kenya",    area:"Kibera",                    region:"Africa",      lat:-1.31, lng:36.78, title:"Kibera Children's Ministry",      blurb:"Daily church, literacy classes and after-school Bible study for 600+ children in Africa's largest urban slum.",          raised:18500, goal:18500, color:"#5b9cf6", status:"complete", milestone:3, souls:600, bibles:600, churches:2, prayers:204, protected:false, trustLevel:3, journeyStep:8, riskLevel:1, budget:[{label:"School materials",amount:6000},{label:"Meals program",amount:5500},{label:"Church setup",amount:4000},{label:"Staff",amount:3000}] },
  { id:4, name:"Ev. Grace Mensah",   role:"Evangelist",  church:"Kumasi Pentecostal Centre",  city:"Kumasi",      country:"Ghana",    area:"Northern Rural Districts",  region:"Africa",      lat:6.69,  lng:-1.62, title:"Northern Ghana Village Crusade",  blurb:"Open-air crusades across 20 unreached villages, partnering with local pastors to plant permanent congregations.",         raised:7200,  goal:9500,  color:"#e85b5b", status:"active",   milestone:2, souls:2000,bibles:400, churches:4, prayers:156, protected:false, trustLevel:1, journeyStep:6, riskLevel:2, budget:[{label:"Tent & sound",amount:4000},{label:"Transport",amount:2000},{label:"Printing",amount:2000},{label:"Food",amount:1500}] },
  { id:5, name:"Diac. Priya Rajan",  role:"Deaconess",   church:"Chennai New Life Church",    city:"Chennai",     country:"India",    area:"Dalit Village Belt",        region:"Asia",        lat:13.08, lng:80.27, title:"Dalit Women's Bible Mission",     blurb:"Running literacy and discipleship circles for marginalised Dalit women across 15 villages south of Chennai.",             raised:5500,  goal:8000,  color:"#4caf7d", status:"active",   milestone:2, souls:180, bibles:180, churches:2, prayers:77,  protected:false, trustLevel:2, journeyStep:4, riskLevel:1, budget:[{label:"Bibles",amount:3000},{label:"Training materials",amount:2000},{label:"Transport",amount:1500},{label:"Meals",amount:1500}] },
  { id:6, name:"Bro. David Yuen",    role:"Missionary",  church:"Bangkok Grace Church",       city:"Yangon",      country:"Myanmar",  area:"Karen Refugee Camps",       region:"Asia",        lat:16.87, lng:96.19, title:"Refugee Camp Gospel Mission",     blurb:"Bringing the Karen-language Bible and trauma counselling to displaced families in temporary camps near Yangon.",           raised:4300,  goal:12000, color:"#b06cf5", status:"active",   milestone:1, souls:89,  bibles:200, churches:0, prayers:63,  protected:true,  trustLevel:2, journeyStep:3, riskLevel:3, budget:[{label:"Bibles (Karen)",amount:4000},{label:"Counselling resources",amount:3000},{label:"Transport",amount:3000},{label:"Food aid",amount:2000}] },
  { id:7, name:"Ptr. Leila Nassar",  role:"Minister",    church:"Beirut Evangelical Mission", city:"Beirut",      country:"Lebanon",  area:"Bekaa Valley Camps",        region:"M. East",     lat:33.88, lng:35.50, title:"Syrian Refugee Outreach",         blurb:"Quietly sharing hope and Scripture with Syrian families in the Bekaa Valley — where the name of Jesus must be whispered.", raised:6100,  goal:17000, color:"#f5a44a", status:"active",   milestone:1, souls:55,  bibles:150, churches:0, prayers:98,  protected:true,  trustLevel:2, journeyStep:2, riskLevel:3, budget:[{label:"Scripture packets",amount:6000},{label:"Food parcels",amount:5000},{label:"Transport",amount:4000},{label:"Admin",amount:2000}] },
];

const DEMO_UPDATES = [
  { id:1, mission_id:1, author:"Rev. Samuel Osei",   text:"Day 7 — Merkato. Held our 3rd open-air service this week. 78 attended, 12 received prayer. Food parcels distributed to 40 families. Praise the Lord!", type:"update", created_at:"2025-05-14T08:30:00Z" },
  { id:2, mission_id:1, author:"Rev. Samuel Osei",   text:"Please pray for safe travel tomorrow as we move to the eastern district. Roads are difficult this time of year.", type:"prayer",  created_at:"2025-05-12T14:00:00Z" },
  { id:3, mission_id:2, author:"Sis. Maria Santos",  text:"Day 3 — Amazon. Arrived at village 4 by boat this morning. Held our first cottage meeting. 17 attended. The hunger for the Word here is incredible.", type:"update", created_at:"2025-05-10T10:00:00Z" },
  { id:4, mission_id:4, author:"Ev. Grace Mensah",   text:"Night 2 of the crusade. Estimated 2,000 people gathered! The tent was full and many spilled outside. God is moving in northern Ghana!", type:"update", created_at:"2025-05-08T20:00:00Z" },
];

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
  raised:row.raised||0, goal:row.goal||1000, color:row.color||getColor(i),
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
  {step:3,icon:"✈️", label:"Travelling"},
  {step:4,icon:"📍",label:"Arrived at Location"},
  {step:5,icon:"⛪",label:"Services Started"},
  {step:6,icon:"🙏",label:"Souls Reached"},
  {step:7,icon:"📷",label:"Proof Uploaded"},
  {step:8,icon:"✅",label:"Mission Completed"},
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

const UpdatesFeed = ({ missionId, missionColor, missionName }) => {
  const [updates, setUpdates]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [newText, setNewText]   = useState("");
  const [postType, setPostType] = useState("update");
  const [posting, setPosting]   = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from("mission_updates")
          .select("*").eq("mission_id", missionId)
          .order("created_at",{ ascending:false });
        if (data && data.length > 0) setUpdates(data);
        else setUpdates(DEMO_UPDATES.filter(u => u.mission_id === missionId));
      } catch { setUpdates(DEMO_UPDATES.filter(u => u.mission_id === missionId)); }
      setLoading(false);
    };
    load();
  }, [missionId]);

  const postUpdate = async () => {
    if (!newText.trim()) return;
    setPosting(true);
    const update = { mission_id:missionId, author:missionName, text:newText.trim(), type:postType, created_at:new Date().toISOString() };
    try {
      await supabase.from("mission_updates").insert(update);
      setUpdates(u => [update, ...u]);
    } catch { setUpdates(u => [update,...u]); }
    setNewText(""); setPosting(false);
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
        <button onClick={postUpdate} disabled={posting||!newText.trim()}
          style={{ padding:"9px 20px",borderRadius:10,border:"none",background:newText.trim()?`linear-gradient(135deg,${missionColor},${missionColor}cc)`:"rgba(255,255,255,0.06)",color:newText.trim()?"#000":"rgba(255,255,255,0.25)",fontWeight:700,cursor:newText.trim()?"pointer":"default",fontSize:13,fontFamily:"Georgia,serif" }}>
          {posting?"Posting...":"Post Update"}
        </button>
      </div>
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
              <p style={{ fontSize:14,color:"rgba(255,255,255,0.7)",lineHeight:1.7,margin:0 }}>{u.text}</p>
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

  const joinChain = async () => {
    if (joined) return;
    setPraying(true);
    try { await supabase.from("mission_prayers").insert({ mission_id:missionId, type:"chain" }); } catch {}
    setCount(c => c+1); setJoined(true); setPraying(false);
  };

  const submitRequest = async () => {
    if (!request.trim()) return;
    try { await supabase.from("mission_prayers").insert({ mission_id:missionId, type:"request", text:request.trim() }); } catch {}
    setSubmitted(true);
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

const DonateScreen = ({ mission: m, onBack, onPayfast }) => {
  const [amt,setAmt]       = useState("");
  const [prayed,setPrayed] = useState(false);
  const [submitting,setSubmitting] = useState(false);
  const [error,setError]   = useState("");
  const canGive = amt && Number(amt) > 0 && prayed;

  const handleGive = async () => {
    if (!canGive || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onPayfast(amt);
    } catch {
      setError("Could not start PayFast checkout. Please try again.");
      setSubmitting(false);
    }
  };

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
            <span style={{ fontSize:12,color:"rgba(255,255,255,0.3)" }}>${fmt(m.goal-m.raised)} still needed</span>
          </div>
        </div>
        <div style={{ background:"rgba(232,179,75,0.06)",borderRadius:14,border:"1px solid rgba(232,179,75,0.2)",padding:"14px 18px",display:"flex",gap:10 }}>
          <span style={{ fontSize:18,flexShrink:0 }}>🔐</span>
          <div style={{ fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.7 }}>Your donation is held in <strong style={{ color:"#e8b34b" }}>secure escrow</strong> and only released when milestone proof is verified.</div>
        </div>
        <div>
          <div style={{ fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:10 }}>Select an amount</div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8 }}>
            {AMOUNTS.map(a => (
              <button key={a} onClick={()=>setAmt(String(a))} style={{ padding:"11px 0",borderRadius:12,border:`1px solid ${amt===String(a)?m.color:"rgba(255,255,255,0.1)"}`,background:amt===String(a)?`${m.color}22`:"rgba(255,255,255,0.03)",color:amt===String(a)?m.color:"rgba(255,255,255,0.5)",fontWeight:700,cursor:"pointer",fontSize:14,transition:"all .15s" }}>${a}</button>
            ))}
          </div>
        </div>
        <div>
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
          {!amt||Number(amt)===0?"Enter an amount to continue":!prayed?"✝  Tick the prayer commitment to give":submitting?"Redirecting to PayFast…":`💝  Give $${amt} via PayFast`}
        </button>
        {error && <div style={{ textAlign:"center",fontSize:13,color:"#e85b5b" }}>{error}</div>}
        <div style={{ textAlign:"center",fontSize:12,color:"rgba(255,255,255,0.2)" }}>🔒 Secure checkout via PayFast · Funds held in escrow · Released only on verified proof of work</div>
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

const MissionDetail = ({ mission: m, onBack, onDonate, onLedger }) => {
  const [proofTab,setProofTab] = useState("photos");
  const proofPhotos = ["Sunday service gathering","Food parcel distribution","Community prayer meeting","New believers baptism"];
  const proofVideos = ["Weekly ministry highlights","Testimony from community elder"];
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
        <JourneyTimeline currentStep={m.journeyStep||1} color={m.color} />
        <BudgetBreakdown budget={m.budget} goal={m.goal} color={m.color} />
        <UpdatesFeed missionId={m.id} missionColor={m.color} missionName={m.protected?"Missionary":m.name} />
        <PrayerChain missionId={m.id} missionColor={m.color} initialCount={m.prayers||0} />
        <AdoptMission mission={m} />
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
            {(proofTab==="photos"?proofPhotos:proofVideos).map((item,i)=>(
              <div key={i} style={{ padding:"12px 16px",borderRadius:12,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",gap:10 }}>
                <div style={{ width:8,height:8,borderRadius:999,background:m.color,boxShadow:`0 0 6px ${m.color}`,flexShrink:0 }}/>
                <span style={{ fontSize:13,color:"rgba(255,255,255,0.6)",flex:1 }}>{item}</span>
                <span style={{ fontSize:11,padding:"2px 8px",borderRadius:6,background:"rgba(62,207,142,0.1)",color:"#3ecf8e",border:"1px solid rgba(62,207,142,0.2)" }}>Verified</span>
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
            <button onClick={onDonate} style={{ padding:"16px 0",borderRadius:14,border:"none",background:`linear-gradient(135deg,${m.color},${m.color}cc)`,color:"#000",fontWeight:700,cursor:"pointer",fontSize:16,fontFamily:"Georgia, serif",boxShadow:`0 6px 28px ${m.color}44` }}>
              💝 Donate to This Mission
            </button>
            <button onClick={shareWhatsApp} style={{ padding:"16px 18px",borderRadius:14,border:"1px solid rgba(37,211,102,0.3)",background:"rgba(37,211,102,0.08)",color:"#25d366",fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"Georgia, serif",whiteSpace:"nowrap" }}>
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

  useEffect(() => {
    const fetchPrayers = async () => {
      setLoadingPrayer(true);
      try {
        const { data, error } = await supabase
          .from("mission_updates")
          .select("id, mission_id, author, text, created_at, missions(title, country)")
          .eq("type", "prayer")
          .order("created_at", { ascending: false });
        if (error) { console.log("PrayerWall fetch error:", error); setAllRequests([]); }
        else {
          const mapped = (data || []).map(r => ({
            id:      r.id,
            mission: r.missions?.title   || "Mission",
            country: r.missions?.country || "",
            text:    r.text,
            author:  r.author,
            urgent:  false,
            prayers: 0,
          }));
          setAllRequests(mapped);
        }
      } catch (e) {
        console.log("PrayerWall exception:", e);
        setAllRequests([]);
      }
      setLoadingPrayer(false);
    };
    fetchPrayers();
  }, []);

  const totalPraying = Object.values(joined).filter(Boolean).length;
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
                  <button onClick={() => setJoined(j => ({...j,[r.id]:true}))} disabled={isJoined}
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

const DonorProfile = ({ user, onBack }) => {
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
          <div style={{ fontSize:18,fontWeight:700 }}>My Donor Profile</div>
          <div style={{ fontSize:11,color:"rgba(255,255,255,0.3)",letterSpacing:2,marginTop:2 }}>SENDME GLOBAL MISSION FUND</div>
        </div>
      </div>
      <div style={{ maxWidth:680,margin:"0 auto",padding:"28px 20px 60px" }}>
        <div style={{ background:"linear-gradient(135deg,rgba(232,179,75,0.12),rgba(232,179,75,0.04))",borderRadius:20,border:"1px solid rgba(232,179,75,0.2)",padding:"24px",marginBottom:24,textAlign:"center" }}>
          <div style={{ width:70,height:70,borderRadius:"50%",background:"linear-gradient(135deg,#e8b34b,#c8942b)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 14px",boxShadow:"0 0 28px rgba(232,179,75,0.4)" }}>✝</div>
          <div style={{ fontSize:20,fontWeight:700,color:"#eef1ff",marginBottom:4 }}>{user?.user_metadata?.full_name||user?.email?.split("@")[0]||"Believer"}</div>
          <div style={{ fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:12 }}>{user?.email}</div>
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
const NavDropdown = ({ user, userRole, onProfile, onEmergency, onTestimonies, onWorker, onMatching, onQR, onFaq, onPayout, onMilestoneProof, onPastorReview, onMissionaryDashboard }) => {
  const [open,setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(()=>{
    const handler = (e)=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown",handler);
    return ()=>document.removeEventListener("mousedown",handler);
  },[]);

  const isMissionary = userRole === "missionary";
  const isPastor     = userRole === "pastor";

  const items = [
    user && { label:"My Profile",        icon:"✝",  color:"#e8b34b",                onClick:onProfile },
    isMissionary && user &&              { label:"📊 My Dashboard",  color:"#e8b34b", onClick:onMissionaryDashboard },
    { label:"🚨 Emergency",              color:"#e85b5b",                            onClick:onEmergency },
    { label:"Testimonies",               color:"#3ecf8e",                            onClick:onTestimonies },
    { label:"Send Worker",               color:"#b06cf5",                            onClick:onWorker },
    { label:"Find Mission",              color:"#5b9cf6",                            onClick:onMatching },
    { label:"QR Share",                  color:"rgba(255,255,255,0.65)",             onClick:onQR },
    { label:"FAQ",                       color:"#e8b34b",                            onClick:onFaq },
    user && { label:"Payout Details",    color:"rgba(255,255,255,0.65)",             onClick:onPayout },
    (isMissionary||isPastor) && user && { label:"📋 Submit Proof",  color:"#5b9cf6", onClick:onMilestoneProof },
    isPastor && user &&                  { label:"⛪ Review Proofs", color:"#3ecf8e", onClick:onPastorReview },
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

// ── HOME SCREEN ───────────────────────────────────────────────────────────────
const HomeScreen = ({ onMission, user, userRole, onSignOut, onApply, onChurch, onChurches, onProfile, onEmergency, onMatching, onPray, onTestimonies, onWorker, onQR, onFaq, onPayout, onAdminPayouts, isAdmin, isPastor, onMilestoneProof, onPastorReview, onMissionaryDashboard, onAdminApprovals, onAdminChurchVerification, guest, onSignIn, onDonate, onAdminWorkers }) => {
  const [region,setRegion]       = useState("All");
  const [missions,setMissions]   = useState([]);
  const [loading,setLoading]     = useState(true);
  const [usingDemo,setUsingDemo] = useState(false);
  useEffect(()=>{
    const fetchMissions = async () => {
      setLoading(true);
      try {
        const {data,error} = await supabase.from("missions").select("*").eq("status","active").order("created_at",{ascending:false});
        if(error) throw error;
        if(data&&data.length>0){setMissions(data.map((row,i)=>mapRow(row,i)));setUsingDemo(false);}
        else{setMissions(DEMO_MISSIONS);setUsingDemo(true);}
      } catch{setMissions(DEMO_MISSIONS);setUsingDemo(true);}
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
          <button onClick={onApply} style={{ background:"linear-gradient(135deg,#e8b34b,#c8942b)",border:"none",borderRadius:10,padding:"8px 16px",color:"#000",cursor:"pointer",fontSize:13,fontWeight:700 }}>Apply</button>
          {isPastor && <button onClick={onChurch} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 16px",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:13 }}>Register Church</button>}
          <NavDropdown
            user={user} userRole={userRole}
            onProfile={onProfile} onEmergency={onEmergency} onTestimonies={onTestimonies}
            onWorker={onWorker} onMatching={onMatching} onQR={onQR} onFaq={onFaq}
            onPayout={onPayout} onMilestoneProof={onMilestoneProof} onPastorReview={onPastorReview}
            onMissionaryDashboard={onMissionaryDashboard}
          />
          {isAdmin&&<button onClick={onAdminChurchVerification} style={{ background:"rgba(91,156,246,0.1)",border:"1px solid rgba(91,156,246,0.3)",borderRadius:10,padding:"8px 14px",color:"#5b9cf6",cursor:"pointer",fontSize:12,fontWeight:700 }}>⛪ Churches</button>}
          {isAdmin&&<button onClick={onAdminWorkers} style={{ background:"rgba(91,156,246,0.1)",border:"1px solid rgba(91,156,246,0.3)",borderRadius:10,padding:"8px 14px",color:"#5b9cf6",cursor:"pointer",fontSize:12,fontWeight:700 }}>👥 Workers</button>}
          {isAdmin&&<button onClick={onAdminApprovals} style={{ background:"rgba(232,179,75,0.1)",border:"1px solid rgba(232,179,75,0.3)",borderRadius:10,padding:"8px 14px",color:"#e8b34b",cursor:"pointer",fontSize:12,fontWeight:700 }}>📋 Approvals</button>}
          {isAdmin&&<button onClick={onAdminPayouts} style={{ background:"rgba(232,91,91,0.1)",border:"1px solid rgba(232,91,91,0.3)",borderRadius:10,padding:"8px 14px",color:"#e85b5b",cursor:"pointer",fontSize:12,fontWeight:700 }}>💰 Payouts</button>}
          {user&&<button onClick={onSignOut} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"8px 14px",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:12 }}>Sign Out</button>}
        </div>
      </div>
      <div style={{ maxWidth:900,margin:"0 auto",padding:"24px 20px" }}>
        <div style={{ marginBottom:24 }}>
          {loading?<LoadingMap/>:<MapboxMap missions={missions} onMissionClick={onMission}/>}
        </div>
        {usingDemo&&!loading&&(
          <div style={{ background:"rgba(232,179,75,0.06)",borderRadius:12,border:"1px solid rgba(232,179,75,0.15)",padding:"10px 16px",marginBottom:16,display:"flex",gap:10,alignItems:"center" }}>
            <span style={{ fontSize:16 }}>📋</span>
            <span style={{ fontSize:13,color:"rgba(255,255,255,0.4)" }}>Showing <strong style={{ color:"#e8b34b" }}>demo missions</strong> — no approved missions in database yet.</span>
          </div>
        )}
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
        <div style={{ fontSize:18,fontWeight:700,color:"#eef1ff",marginBottom:16 }}>✝ {usingDemo?"Demo Missions":"Active Missions"}</div>
        {loading?(
          <div style={{ textAlign:"center",padding:"40px 0",color:"rgba(255,255,255,0.3)",fontSize:14 }}>Loading missions...</div>
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
        if (data && data.length > 0) setMissions(data.map((r,i) => mapRow(r,i)));
        else setMissions(DEMO_MISSIONS.filter(m => m.status==="active"));
      } catch { setMissions(DEMO_MISSIONS.filter(m => m.status==="active")); }
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
                    <span style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>${fmt(needed)} still needed</span>
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
            ["✝", "Message-Believing", "Built for the end-time Bride"],
            ["🌍", "Global Reach",      "Active missions across every continent"],
            ["🔒", "Full Escrow",       "Funds held until milestones are met"],
            ["⛪", "Church-Anchored",   "Every missionary endorsed by a local church"],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{
              background:"rgba(255,255,255,0.03)", borderRadius:12,
              border:"1px solid rgba(255,255,255,0.06)", padding:"14px 12px",
            }}>
              <div style={{ fontSize:20, marginBottom:6 }}>{icon}</div>
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

export default function App() {
  const [user,setUser]                         = useState(null);
  const [showSplash,setShowSplash]             = useState(false);
  const [userRole,setUserRole]                 = useState(null);
  const [authReady,setAuthReady]               = useState(false);
  const [screen,setScreen]                     = useState("home");
  const [selectedMission,setSelectedMission]   = useState(null);
  const [guest,setGuest]                       = useState(false);
  const [pfReturn,setPfReturn]                 = useState(null);

  const loadRole = async (u) => {
    if (!u) { setUserRole(null); return; }
    try {
      const { data } = await supabase.from("profiles").select("role").eq("id", u.id).single();
      setUserRole(data?.role || u.user_metadata?.role || null);
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

  const signOut       = async()=>{await supabase.auth.signOut();setUser(null);setUserRole(null);setGuest(false);setScreen("home");};
  const isPastor      = userRole === "pastor";
  const isAdminUser   = user?.email === ADMIN_EMAIL;
  const openMission   = (m)  =>{setSelectedMission(m);setScreen("detail");};
  const openDonate    = ()   =>{setScreen("donate");};
  const handlePayfastDonate = (amt) => startPayfastDonation({ mission: selectedMission, amount: amt, user });

  if(!authReady) return(<div style={{ minHeight:"100vh",background:"#060c18",display:"flex",alignItems:"center",justifyContent:"center" }}><div style={{ fontSize:48,color:"#e8b34b" }}>✝</div></div>);
  if(pfReturn) return <PayfastResultScreen status={pfReturn.status} amount={pfReturn.amount} onContinue={()=>setPfReturn(null)}/>;
  if(!user && !guest) return <Auth onLogin={(u)=>{ setUser(u); if(!localStorage.getItem("sendme_splash_seen")){ setShowSplash(true); } }} onGuest={()=>setGuest(true)}/>;
  if(showSplash) return <MissionVisionSplash onDone={()=>{ localStorage.setItem("sendme_splash_seen","1"); setShowSplash(false); }}/>;

  if(screen==="donor-browse")    return <DonorBrowse onBack={()=>setScreen("home")} onMission={openMission} user={user}/>;
  if(screen==="faq")              return <FAQScreen onBack={()=>setScreen("home")}/>;
  if(screen==="payout")           return <PayoutSetup onBack={()=>setScreen("home")}/>;
  if(screen==="admin-payouts")    return user?.email===ADMIN_EMAIL ? <AdminPayouts onBack={()=>setScreen("home")}/> : <FAQScreen onBack={()=>setScreen("home")}/>;
  if(screen==="pray")             return <PrayerWall missions={DEMO_MISSIONS} onBack={()=>setScreen("home")}/>;
  if(screen==="churches")         return <ChurchesTab onBack={()=>setScreen("home")}/>;
  if(screen==="apply")            return <MissionaryApplication onBack={()=>setScreen("home")} user={user}/>;
  if(screen==="church")           return (isPastor||isAdminUser) ? <ChurchRegistration onBack={()=>setScreen("home")} user={user}/> : null;
  if(screen==="profile")          return <DonorProfile user={user} onBack={()=>setScreen("home")}/>;
  if(screen==="emergency")        return <EmergencyRequests onBack={()=>setScreen("home")} user={user}/>;
  if(screen==="matching")         return <MissionMatching missions={DEMO_MISSIONS} onMission={openMission} onBack={()=>setScreen("home")}/>;
  if(screen==="testimonies")      return <TestimonyEngine onBack={()=>setScreen("home")} onMission={openMission}/>;
  if(screen==="worker")           return <SendAWorker onBack={()=>setScreen("home")} user={user}/>;
  if(screen==="qr")               return <QRShare missions={DEMO_MISSIONS} onBack={()=>setScreen("home")}/>;
  if(screen==="milestone-proof")  return <MilestoneProof onBack={()=>setScreen("home")} user={user}/>;
  if(screen==="pastor-review")    return (isPastor||isAdminUser) ? <PastorReview onBack={()=>setScreen("home")} user={user}/> : <FAQScreen onBack={()=>setScreen("home")}/>;
  if(screen==="missionary-dashboard") return <MissionaryDashboard onBack={()=>setScreen("home")} user={user} onSubmitProof={()=>setScreen("milestone-proof")}/>;
  if(screen==="admin-approvals")  return isAdminUser ? <AdminApprovals onBack={()=>setScreen("home")} user={user}/> : <FAQScreen onBack={()=>setScreen("home")}/>;
  if(screen==="admin-church-verification") return isAdminUser ? <AdminChurchVerification onBack={()=>setScreen("home")} user={user}/> : <FAQScreen onBack={()=>setScreen("home")}/>;
  if(screen==="admin-workers")        return isAdminUser ? <AdminWorkerRequests onBack={()=>setScreen("home")}/> : <FAQScreen onBack={()=>setScreen("home")}/>;
  if(screen==="ledger"&&selectedMission)  return <TransparencyLedger mission={selectedMission} onBack={()=>setScreen("detail")}/>;
  if(screen==="detail"&&selectedMission)  return <MissionDetail mission={selectedMission} onBack={()=>setScreen("home")} onDonate={openDonate} onLedger={()=>setScreen("ledger")}/>;
  if(screen==="donate"&&selectedMission)  return <DonateScreen mission={selectedMission} onBack={()=>setScreen("detail")} onPayfast={handlePayfastDonate}/>;

  return(
    <HomeScreen
      onMission={openMission} user={user} userRole={userRole} onSignOut={signOut}
      onApply={()=>setScreen("apply")} onChurch={()=>setScreen("church")}
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
      isAdmin={user?.email===ADMIN_EMAIL}
      isPastor={isPastor||isAdminUser}
      guest={guest}
      onSignIn={()=>setGuest(false)}
      onDonate={()=>setScreen("donor-browse")}
      onAdminWorkers={()=>setScreen("admin-workers")}
    />
  );
}
