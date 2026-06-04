import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import Auth from "./Auth";
import "./App.css";

const MISSIONS = [
  { id:1, name:"Rev. Samuel Osei",   role:"Missionary",  church:"Accra Redemption Church",   city:"Addis Ababa", country:"Ethiopia", area:"Merkato District",         region:"Africa",      lat:9.03,  lng:38.74, title:"Gospel & Food Aid — Merkato",     blurb:"Feeding 400 families weekly while planting the Word in one of Addis Ababa's most densely populated slums. Weekly open-air services, Bible distribution and feeding programs every Saturday.",           raised:9840,  goal:15000, color:"#e8b34b", status:"active",   milestone:2, souls:312, bibles:200, churches:1, prayers:87,  protected:false },
  { id:2, name:"Sis. Maria Santos",  role:"Minister",    church:"Manaus River Fellowship",    city:"Manaus",      country:"Brazil",   area:"Amazon Riverside Villages", region:"S. America",  lat:-3.1,  lng:-60.0, title:"Amazon River Mission",            blurb:"Travelling by boat into 12 unreached riverside communities with the Gospel, medicines, and Bibles in the local dialect. Each village receives a week of ministry before moving to the next.",      raised:14200, goal:22000, color:"#4caf7d", status:"active",   milestone:2, souls:148, bibles:312, churches:3, prayers:134, protected:false },
  { id:3, name:"Pastor John Kimani", role:"Pastor",      church:"Nairobi First Assembly",     city:"Nairobi",     country:"Kenya",    area:"Kibera",                    region:"Africa",      lat:-1.31, lng:36.78, title:"Kibera Children's Ministry",      blurb:"Daily church, literacy classes and after-school Bible study for 600+ children in Africa's largest urban slum. The children are being transformed and entire families are coming to faith.",          raised:18500, goal:18500, color:"#5b9cf6", status:"complete", milestone:3, souls:600, bibles:600, churches:2, prayers:204, protected:false },
  { id:4, name:"Ev. Grace Mensah",   role:"Evangelist",  church:"Kumasi Pentecostal Centre",  city:"Kumasi",      country:"Ghana",    area:"Northern Rural Districts",  region:"Africa",      lat:6.69,  lng:-1.62, title:"Northern Ghana Village Crusade",  blurb:"Open-air crusades across 20 unreached villages, partnering with local pastors to plant permanent congregations. Over 2,000 gathered on night 3 of the crusade alone.",                             raised:7200,  goal:9500,  color:"#e85b5b", status:"active",   milestone:2, souls:2000,bibles:400, churches:4, prayers:156, protected:false },
  { id:5, name:"Diac. Priya Rajan",  role:"Deaconess",   church:"Chennai New Life Church",    city:"Chennai",     country:"India",    area:"Dalit Village Belt",        region:"Asia",        lat:13.08, lng:80.27, title:"Dalit Women's Bible Mission",     blurb:"Running literacy and discipleship circles for marginalised Dalit women across 15 villages south of Chennai. Many are hearing the Gospel for the first time in their own language.",               raised:5500,  goal:8000,  color:"#4caf7d", status:"active",   milestone:2, souls:180, bibles:180, churches:2, prayers:77,  protected:false },
  { id:6, name:"Bro. David Yuen",    role:"Missionary",  church:"Bangkok Grace Church",       city:"Yangon",      country:"Myanmar",  area:"Karen Refugee Camps",       region:"Asia",        lat:16.87, lng:96.19, title:"Refugee Camp Gospel Mission",     blurb:"Bringing the Karen-language Bible and trauma counselling to displaced families in temporary camps near Yangon. This mission operates under Shadow Mode for safety reasons.",                       raised:4300,  goal:12000, color:"#b06cf5", status:"active",   milestone:1, souls:89,  bibles:200, churches:0, prayers:63,  protected:true  },
  { id:7, name:"Ptr. Leila Nassar",  role:"Minister",    church:"Beirut Evangelical Mission", city:"Beirut",      country:"Lebanon",  area:"Bekaa Valley Camps",        region:"M. East",     lat:33.88, lng:35.50, title:"Syrian Refugee Outreach",         blurb:"Quietly sharing hope and Scripture with Syrian families in the Bekaa Valley — where the name of Jesus must be whispered. This mission operates under Shadow Mode for safety.",                  raised:6100,  goal:17000, color:"#f5a44a", status:"active",   milestone:1, souls:55,  bibles:150, churches:0, prayers:98,  protected:true  },
];

const REGIONS = ["All","Africa","Asia","S. America","Middle East","Europe"];
const AMOUNTS = [25, 50, 100, 250, 500];
const pct = (r, g) => Math.min(100, Math.round((r / g) * 100));

const Bar = ({ raised, goal, color, height=6 }) => (
  <div style={{ background:"rgba(255,255,255,0.07)", borderRadius:999, height, overflow:"hidden" }}>
    <div style={{ width:`${pct(raised,goal)}%`, height:"100%", borderRadius:999, background:`linear-gradient(90deg,${color},${color}bb)`, boxShadow:`0 0 6px ${color}55`, transition:"width .7s ease" }}/>
  </div>
);

const MsTrack = ({ current, color }) => (
  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
    {[1,2,3].map(n => (
      <div key={n} style={{ display:"flex", alignItems:"center", gap:6 }}>
        <div style={{ width:n<=current?10:7, height:n<=current?10:7, borderRadius:999, transition:"all .3s", background:n<=current?color:"rgba(255,255,255,0.1)", boxShadow:n<=current?`0 0 7px ${color}99`:"none", border:n===current?`2px solid ${color}`:"none" }}/>
        {n<3 && <div style={{ width:18, height:1, background:n<current?color:"rgba(255,255,255,0.08)" }}/>}
      </div>
    ))}
    <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginLeft:4, fontFamily:"monospace" }}>M{current}/3</span>
  </div>
);

const DonateScreen = ({ mission: m, onBack, onSuccess }) => {
  const [amt, setAmt] = useState("");
  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14 }}>← Back</button>
        <span style={{ fontSize:18, fontWeight:700 }}>Donate to {m.protected ? m.role : m.name}</span>
      </div>
      <div style={{ maxWidth:600, margin:"0 auto", padding:"32px 20px", display:"flex", flexDirection:"column", gap:20 }}>
        <div style={{ background:`linear-gradient(135deg,${m.color}18,${m.color}06)`, borderRadius:18, border:`1px solid ${m.color}33`, padding:20 }}>
          <div style={{ fontSize:11, color:m.color, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>Donating to</div>
          <div style={{ fontSize:20, fontWeight:700, color:"#eef1ff", marginBottom:4 }}>{m.protected ? "🔒 Protected Missionary" : m.name}</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", marginBottom:14 }}>{m.title}</div>
          <Bar raised={m.raised} goal={m.goal} color={m.color} height={8}/>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
            <span style={{ fontSize:13, color:m.color, fontWeight:700 }}>${m.raised.toLocaleString()} raised</span>
            <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>${(m.goal - m.raised).toLocaleString()} still needed</span>
          </div>
        </div>
        <div style={{ background:"rgba(232,179,75,0.06)", borderRadius:14, border:"1px solid rgba(232,179,75,0.2)", padding:"14px 18px", display:"flex", gap:10 }}>
          <span style={{ fontSize:18, flexShrink:0 }}>🔐</span>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", lineHeight:1.7 }}>Your donation is held in <strong style={{ color:"#e8b34b" }}>secure escrow</strong> and only released to the missionary when milestone proof is verified by our admin team.</div>
        </div>
        <div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", marginBottom:10 }}>Select an amount</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
            {AMOUNTS.map(a => (
              <button key={a} onClick={() => setAmt(String(a))} style={{ padding:"11px 0", borderRadius:12, border:`1px solid ${amt===String(a)?m.color:"rgba(255,255,255,0.1)"}`, background:amt===String(a)?`${m.color}22`:"rgba(255,255,255,0.03)", color:amt===String(a)?m.color:"rgba(255,255,255,0.5)", fontWeight:700, cursor:"pointer", fontSize:14, transition:"all .15s" }}>${a}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", marginBottom:8 }}>Or enter a custom amount</div>
          <div style={{ display:"flex", borderRadius:13, overflow:"hidden", border:`1px solid ${amt&&!AMOUNTS.includes(Number(amt))?m.color:"rgba(255,255,255,0.1)"}` }}>
            <div style={{ padding:"13px 15px", background:"rgba(255,255,255,0.04)", color:"rgba(255,255,255,0.4)", fontSize:18 }}>$</div>
            <input type="number" value={AMOUNTS.includes(Number(amt))?"":amt} onChange={e=>setAmt(e.target.value)} placeholder="Enter amount" style={{ flex:1, padding:"13px 15px", background:"rgba(255,255,255,0.03)", border:"none", color:"#eef1ff", fontSize:18, fontFamily:"Georgia, serif", outline:"none" }}/>
          </div>
        </div>
        <button onClick={() => { if(amt && Number(amt) > 0) onSuccess(amt); }} style={{ padding:"16px 0", borderRadius:14, border:"none", background:amt&&Number(amt)>0?`linear-gradient(135deg,${m.color},${m.color}cc)`:"rgba(255,255,255,0.06)", color:amt&&Number(amt)>0?"#000":"rgba(255,255,255,0.25)", fontWeight:700, cursor:amt&&Number(amt)>0?"pointer":"default", fontSize:16, fontFamily:"Georgia, serif", boxShadow:amt&&Number(amt)>0?`0 6px 28px ${m.color}44`:"none", transition:"all .2s" }}>
          {amt && Number(amt) > 0 ? `💝  Give $${amt} to this Mission` : "Enter an amount to continue"}
        </button>
        <div style={{ textAlign:"center", fontSize:12, color:"rgba(255,255,255,0.2)" }}>🔒 Funds held in escrow · Released only on verified proof of work</div>
      </div>
    </div>
  );
};

const SuccessScreen = ({ mission: m, amt, onContinue }) => (
  <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif", display:"flex", alignItems:"center", justifyContent:"center", padding:32 }}>
    <div style={{ textAlign:"center", maxWidth:480, display:"flex", flexDirection:"column", gap:20, alignItems:"center" }}>
      <div style={{ width:90, height:90, borderRadius:999, background:"rgba(62,207,142,0.12)", border:"2px solid rgba(62,207,142,0.4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:44 }}>🙏</div>
      <div>
        <div style={{ fontSize:30, fontWeight:700, color:"#eef1ff", marginBottom:8 }}>God Bless You</div>
        <div style={{ fontSize:15, color:"rgba(255,255,255,0.5)", lineHeight:1.8 }}>Your gift of <strong style={{ color:"#3ecf8e" }}>${amt}</strong> to <strong style={{ color:"#eef1ff" }}>{m.protected ? "this protected missionary" : m.name}</strong>'s mission has been placed in escrow.<br/>You will receive a notification when the next milestone proof is submitted.</div>
      </div>
      <div style={{ background:"rgba(232,179,75,0.08)", borderRadius:16, border:"1px solid rgba(232,179,75,0.2)", padding:"16px 24px", width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:15, color:"#e8b34b", fontStyle:"italic", marginBottom:4 }}>"The harvest is plentiful but the workers are few."</div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>Matthew 9:37</div>
      </div>
      <button onClick={onContinue} style={{ padding:"14px 40px", borderRadius:14, border:"none", background:"linear-gradient(135deg,#3ecf8e,#2aaf74)", color:"#000", fontWeight:700, cursor:"pointer", fontSize:15, fontFamily:"Georgia, serif", boxShadow:"0 6px 28px rgba(62,207,142,0.4)" }}>← Continue Exploring</button>
    </div>
  </div>
);

const MissionDetail = ({ mission: m, onBack, onDonate }) => {
  const [proofTab, setProofTab] = useState("photos");
  const proofPhotos = ["Sunday service gathering","Food parcel distribution","Community prayer meeting","New believers baptism"];
  const proofVideos = ["Weekly ministry highlights","Testimony from community elder"];
  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14 }}>← Back</button>
        <span style={{ fontSize:18, fontWeight:700 }}>Mission Detail</span>
        <span style={{ marginLeft:"auto", padding:"4px 12px", borderRadius:999, fontSize:12, background:m.status==="complete"?"rgba(62,207,142,0.15)":`${m.color}18`, color:m.status==="complete"?"#3ecf8e":m.color, border:`1px solid ${m.status==="complete"?"#3ecf8e33":m.color+"33"}` }}>{m.status==="complete" ? "✓ Completed" : m.protected ? "🔒 Protected" : "● Active"}</span>
      </div>
      <div style={{ maxWidth:700, margin:"0 auto", padding:"0 20px 60px" }}>
        <div style={{ background:`linear-gradient(160deg,${m.color}18 0%,#060c18 100%)`, borderBottom:`1px solid ${m.color}1a`, padding:"28px 0 24px" }}>
          <div style={{ display:"flex", gap:16, alignItems:"flex-start", marginBottom:16 }}>
            <div style={{ width:64, height:64, borderRadius:20, flexShrink:0, background:`linear-gradient(135deg,${m.color}44,${m.color}18)`, border:`2px solid ${m.color}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>✝</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:m.color, letterSpacing:2, textTransform:"uppercase", marginBottom:3 }}>{m.role} · {m.church}</div>
              <div style={{ fontSize:22, fontWeight:700, color:"#eef1ff", lineHeight:1.2 }}>{m.protected ? "🔒 " + m.role : m.name}</div>
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.35)", marginTop:4 }}>📍 {m.protected ? `${m.region} (Location Protected)` : `${m.area}, ${m.city}, ${m.country}`}</div>
            </div>
          </div>
          <div style={{ fontSize:18, fontWeight:700, color:"#eef1ff", marginBottom:8 }}>{m.title}</div>
          <div style={{ fontSize:14, color:"rgba(255,255,255,0.55)", lineHeight:1.85 }}>{m.blurb}</div>
        </div>
        <div style={{ padding:"24px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <span style={{ fontSize:13, color:"rgba(255,255,255,0.4)" }}>Funding Progress</span>
            <MsTrack current={m.milestone} color={m.color}/>
          </div>
          <Bar raised={m.raised} goal={m.goal} color={m.color} height={10}/>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:10 }}>
            <span style={{ fontSize:16, color:m.color, fontWeight:700 }}>${m.raised.toLocaleString()} raised</span>
            <span style={{ fontSize:13, color:"rgba(255,255,255,0.3)" }}>{pct(m.raised,m.goal)}% of ${m.goal.toLocaleString()}</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginTop:20 }}>
            {[["🙏",m.souls,"Souls",m.color],["📖",m.bibles,"Bibles","#5b9cf6"],["⛪",m.churches,"Churches","#3ecf8e"]].map(([icon,val,label,c])=>(
              <div key={label} style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", padding:"14px 10px", textAlign:"center" }}>
                <div style={{ fontSize:22 }}>{icon}</div>
                <div style={{ fontSize:20, fontWeight:700, color:c, marginTop:4 }}>{val.toLocaleString()}</div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding:"24px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div style={{ fontSize:16, fontWeight:700, color:"#eef1ff" }}>📋 Proof of Work</div>
            <div style={{ display:"flex", gap:8 }}>
              {["photos","videos"].map(t=>(
                <button key={t} onClick={()=>setProofTab(t)} style={{ padding:"5px 14px", borderRadius:8, border:`1px solid ${proofTab===t?m.color:"rgba(255,255,255,0.1)"}`, background:proofTab===t?`${m.color}18`:"transparent", color:proofTab===t?m.color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:12, fontFamily:"Georgia, serif" }}>{t==="photos"?"📸 Photos":"🎥 Videos"}</button>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {(proofTab==="photos" ? proofPhotos.slice(0,m.photos) : proofVideos.slice(0,m.videos)).map((item,i)=>(
              <div key={i} style={{ padding:"12px 16px", borderRadius:12, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:8, height:8, borderRadius:999, background:m.color, boxShadow:`0 0 6px ${m.color}`, flexShrink:0 }}/>
                <span style={{ fontSize:13, color:"rgba(255,255,255,0.6)", flex:1 }}>{item}</span>
                <span style={{ fontSize:11, padding:"2px 8px", borderRadius:6, background:"rgba(62,207,142,0.1)", color:"#3ecf8e", border:"1px solid rgba(62,207,142,0.2)" }}>✓ Verified</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding:"24px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ background:"rgba(255,255,255,0.02)", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", padding:"16px 18px", display:"flex", gap:14, alignItems:"center" }}>
            <span style={{ fontSize:28 }}>⛪</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)", marginBottom:3 }}>Endorsed by verified church</div>
              <div style={{ fontSize:15, fontWeight:700, color:"#eef1ff" }}>{m.church}</div>
            </div>
            <span style={{ padding:"4px 12px", borderRadius:999, fontSize:12, background:"rgba(62,207,142,0.12)", color:"#3ecf8e", border:"1px solid rgba(62,207,142,0.25)" }}>✓ Verified</span>
          </div>
        </div>
        <div style={{ padding:"20px 0 0" }}>
          <div style={{ background:"rgba(255,255,255,0.02)", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", padding:"16px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <span style={{ fontSize:22 }}>🙏</span>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"#eef1ff" }}>{m.prayers} people are praying</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>Join them in prayer for this mission</div>
              </div>
            </div>
            <button style={{ padding:"8px 18px", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif" }}>🙏 Pray</button>
          </div>
          <button onClick={onDonate} style={{ width:"100%", padding:"16px 0", borderRadius:14, border:"none", background:`linear-gradient(135deg,${m.color},${m.color}cc)`, color:"#000", fontWeight:700, cursor:"pointer", fontSize:16, fontFamily:"Georgia, serif", letterSpacing:.3, boxShadow:`0 6px 28px ${m.color}44` }}>💝  Donate to This Mission</button>
        </div>
      </div>
    </div>
  );
};

const HomeScreen = ({ onMission, user, onSignOut }) => {
  const [region, setRegion] = useState("All");
  const visible = region === "All" ? MISSIONS : MISSIONS.filter(m => m.region === region || m.region.startsWith(region.slice(0,3)));
  return (
    <div style={{ minHeight:"100vh", background:"#060c18", fontFamily:"Georgia, serif", color:"#eef1ff" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:100 }}>
        <div>
          <div style={{ fontSize:28, fontWeight:800, color:"#fff" }}>Send<span style={{ color:"#e8b34b" }}>Me</span></div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", letterSpacing:4 }}>GLOBAL MISSION FUND</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {user && <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>✝ {user.email?.split("@")[0]}</span>}
          <button style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:13 }}>🙏 Pray</button>
          <button style={{ background:"linear-gradient(135deg,#e8b34b,#c8942b)", border:"none", borderRadius:10, padding:"8px 16px", color:"#000", cursor:"pointer", fontSize:13, fontWeight:700 }}>✝ Apply</button>
          {user && <button onClick={onSignOut} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"8px 14px", color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:12 }}>Sign Out</button>}
        </div>
      </div>
      <div style={{ maxWidth:900, margin:"0 auto", padding:"24px 20px" }}>
        <div style={{ borderRadius:20, overflow:"hidden", marginBottom:24, border:"1px solid rgba(255,255,255,0.08)", position:"relative", height:280 }}>
          <img src={process.env.PUBLIC_URL + '/world-map.png'} alt="World Map" style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.85 }}/>
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(6,12,24,0.85) 0%, transparent 50%)" }}/>
          <div style={{ position:"absolute", bottom:20, left:24 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#e8b34b", letterSpacing:2, marginBottom:4 }}>🌍 WORLD MISSION MAP</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>Click a missionary card below to explore</div>
          </div>
          {MISSIONS.map(m => {
            const x = ((m.lng + 180) / 360) * 100;
            const y = ((90 - m.lat) / 180) * 100;
            return (
              <div key={m.id} onClick={() => onMission(m)} title={m.protected ? "Protected Mission" : m.name} style={{ position:"absolute", left:`${x}%`, top:`${y}%`, transform:"translate(-50%,-50%)", cursor:"pointer", zIndex:5 }}>
                <div style={{ width:16, height:16, borderRadius:"50%", background:m.status==="complete"?"#3ecf8e":m.color, border:"2.5px solid #fff", boxShadow:`0 0 10px ${m.color}, 0 0 20px ${m.color}55`, transition:"transform .2s" }}
                  onMouseEnter={e => e.currentTarget.style.transform="scale(1.4)"}
                  onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}/>
              </div>
            );
          })}
        </div>
        <div style={{ background:"rgba(232,179,75,0.08)", borderRadius:16, border:"1px solid rgba(232,179,75,0.2)", padding:"16px 20px", textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:15, color:"#f4e4c0", fontStyle:"italic", lineHeight:1.7 }}>"Go ye into all the world and preach the gospel to every creature."</div>
          <div style={{ fontSize:12, color:"#e8b34b", marginTop:6, fontWeight:700 }}>Mark 16:15</div>
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
          {REGIONS.map(r => (
            <button key={r} onClick={() => setRegion(r)} style={{ padding:"7px 16px", borderRadius:999, border:`1px solid ${region===r?"#e8b34b":"rgba(255,255,255,0.1)"}`, background:region===r?"rgba(232,179,75,0.15)":"rgba(255,255,255,0.03)", color:region===r?"#e8b34b":"rgba(255,255,255,0.5)", cursor:"pointer", fontSize:13, fontWeight:600, transition:"all .15s" }}>{r}</button>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:28 }}>
          {[["✝","17","Active Missions","#e8b34b"],["💝","$125k","Total Raised","#3ecf8e"],["👥","1,847","Donors","#5b9cf6"],["🌍","12","Countries","#b06cf5"]].map(([icon,val,label,c])=>(
            <div key={label} style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", padding:"16px 12px", textAlign:"center" }}>
              <div style={{ fontSize:20 }}>{icon}</div>
              <div style={{ fontSize:18, fontWeight:700, color:c, marginTop:4 }}>{val}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:18, fontWeight:700, color:"#eef1ff", marginBottom:16 }}>✝ Active Missions</div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {visible.map(m => (
            <div key={m.id} onClick={() => onMission(m)} style={{ background:"#0c1628", borderRadius:18, border:`1px solid ${m.color}22`, padding:20, cursor:"pointer", borderLeft:`3px solid ${m.color}`, transition:"transform .15s, box-shadow .15s" }}
              onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow=`0 8px 32px ${m.color}22`; }}
              onMouseLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=""; }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                  <div style={{ width:48, height:48, borderRadius:14, background:`${m.color}22`, border:`1.5px solid ${m.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>✝</div>
                  <div>
                    <div style={{ fontSize:10, color:m.color, letterSpacing:2, textTransform:"uppercase", marginBottom:2 }}>{m.role}</div>
                    <div style={{ fontSize:16, fontWeight:700, color:"#eef1ff" }}>{m.protected ? "🔒 Protected Mission" : m.name}</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:2 }}>📍 {m.protected ? m.region + " (Protected)" : `${m.city}, ${m.country}`}</div>
                  </div>
                </div>
                <span style={{ padding:"3px 10px", borderRadius:999, fontSize:11, background:m.status==="complete"?"rgba(62,207,142,0.15)":`${m.color}18`, color:m.status==="complete"?"#3ecf8e":m.color, border:`1px solid ${m.status==="complete"?"#3ecf8e33":m.color+"33"}`, whiteSpace:"nowrap" }}>{m.status==="complete" ? "✓ Done" : "● Active"}</span>
              </div>
              <div style={{ fontSize:14, fontWeight:600, color:"rgba(238,241,255,0.8)", marginBottom:10 }}>{m.title}</div>
              <Bar raised={m.raised} goal={m.goal} color={m.color}/>
              <div style={{ display:"flex", justifyContent:"space-between", margin:"8px 0 14px" }}>
                <span style={{ fontSize:13, color:m.color, fontWeight:700 }}>${m.raised.toLocaleString()} raised</span>
                <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>{pct(m.raised,m.goal)}% of ${m.goal.toLocaleString()}</span>
              </div>
              <button onClick={e => { e.stopPropagation(); onMission(m); }} style={{ width:"100%", padding:"12px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${m.color},${m.color}cc)`, color:"#000", fontWeight:700, cursor:"pointer", fontSize:14, boxShadow:`0 4px 20px ${m.color}44` }}>View Mission & Donate →</button>
            </div>
          ))}
        </div>
        <div style={{ textAlign:"center", padding:"40px 0 20px", borderTop:"1px solid rgba(255,255,255,0.06)", marginTop:32 }}>
          <div style={{ fontSize:14, color:"rgba(255,255,255,0.3)", marginBottom:6 }}>✝ SendMe — For Message Believers Worldwide</div>
          <div style={{ fontSize:13, color:"#e8b34b", fontStyle:"italic" }}>"Here am I Lord, send me." — Isaiah 6:8</div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [screen, setScreen] = useState("home");
  const [selectedMission, setSelectedMission] = useState(null);
  const [donateAmt, setDonateAmt] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setScreen("home");
  };

  const openMission = (m) => { setSelectedMission(m); setScreen("detail"); };
  const openDonate  = ()  => { setScreen("donate"); };
  const handleSuccess = (amt) => { setDonateAmt(amt); setScreen("success"); };

  if (!authReady) return (
    <div style={{ minHeight:"100vh", background:"#060c18", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ fontSize:48, color:"#e8b34b" }}>✝</div>
    </div>
  );

  if (!user) return <Auth onLogin={(u) => setUser(u)} />;

  if (screen === "detail" && selectedMission)
    return <MissionDetail mission={selectedMission} onBack={() => setScreen("home")} onDonate={openDonate}/>;

  if (screen === "donate" && selectedMission)
    return <DonateScreen mission={selectedMission} onBack={() => setScreen("detail")} onSuccess={handleSuccess}/>;

  if (screen === "success" && selectedMission)
    return <SuccessScreen mission={selectedMission} amt={donateAmt} onContinue={() => setScreen("home")}/>;

  return <HomeScreen onMission={openMission} user={user} onSignOut={signOut}/>;
}