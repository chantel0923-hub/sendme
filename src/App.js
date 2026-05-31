import { useState } from "react";
import "./App.css";

const MISSIONS = [
  { id:1, name:"Rev. Samuel Osei",   role:"Missionary",  city:"Addis Ababa", country:"Ethiopia", title:"Gospel & Food Aid — Merkato",      raised:9840,  goal:15000, color:"#e8b34b", status:"active"   },
  { id:2, name:"Sis. Maria Santos",  role:"Minister",    city:"Manaus",      country:"Brazil",   title:"Amazon River Mission",              raised:14200, goal:22000, color:"#4caf7d", status:"active"   },
  { id:3, name:"Pastor John Kimani", role:"Pastor",      city:"Nairobi",     country:"Kenya",    title:"Kibera Children's Ministry",        raised:18500, goal:18500, color:"#5b9cf6", status:"complete" },
  { id:4, name:"Ev. Grace Mensah",   role:"Evangelist",  city:"Kumasi",      country:"Ghana",    title:"Northern Ghana Village Crusade",    raised:7200,  goal:9500,  color:"#e85b5b", status:"active"   },
  { id:5, name:"Diac. Priya Rajan",  role:"Deaconess",   city:"Chennai",     country:"India",    title:"Dalit Women's Bible Mission",       raised:5500,  goal:8000,  color:"#4caf7d", status:"active"   },
  { id:6, name:"Bro. David Yuen",    role:"Missionary",  city:"Yangon",      country:"Myanmar",  title:"Refugee Camp Gospel Mission",       raised:4300,  goal:12000, color:"#b06cf5", status:"active",  protected:true },
];

const REGIONS = ["All","Africa","Asia","South America","Middle East","Europe"];

export default function App() {
  const [region, setRegion] = useState("All");
  const [selected, setSelected] = useState(null);

  const visible = region === "All" ? MISSIONS : MISSIONS.filter(m => m.region === region);

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", fontFamily:"'Georgia', serif", color:"#eef1ff" }}>

      {/* Header */}
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:100 }}>
        <div>
          <div style={{ fontSize:28, fontWeight:800, color:"#fff" }}>Send<span style={{ color:"#e8b34b" }}>Me</span></div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", letterSpacing:4 }}>GLOBAL MISSION FUND</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:13 }}>🙏 Pray</button>
          <button style={{ background:"linear-gradient(135deg,#e8b34b,#c8942b)", border:"none", borderRadius:10, padding:"8px 16px", color:"#000", cursor:"pointer", fontSize:13, fontWeight:700 }}>✝ Apply</button>
        </div>
      </div>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"24px 20px" }}>

        {/* World Map */}
        <div style={{ borderRadius:20, overflow:"hidden", marginBottom:24, border:"1px solid rgba(255,255,255,0.08)", position:"relative", height:280 }}>
          <img src={process.env.PUBLIC_URL + '/world-map.png'} alt="World Map" style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.85 }}/>
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(6,12,24,0.85) 0%, transparent 50%)" }}/>
          <div style={{ position:"absolute", bottom:20, left:24 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#e8b34b", letterSpacing:2, marginBottom:4 }}>🌍 WORLD MISSION MAP</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>Missionaries serving across the nations</div>
          </div>
          {/* Mission pins */}
          {MISSIONS.map(m => {
            const x = ((m.lng + 180) / 360) * 100;
            const y = ((90 - m.lat) / 180) * 100;
            return (
              <div key={m.id} onClick={() => setSelected(m)}
                style={{ position:"absolute", left:`${x || 50}%`, top:`${y || 50}%`, transform:"translate(-50%,-50%)", cursor:"pointer" }}>
                <div style={{ width:14, height:14, borderRadius:"50%", background:m.color, border:"2px solid #fff", boxShadow:`0 0 8px ${m.color}` }}/>
              </div>
            );
          })}
        </div>

        {/* Scripture */}
        <div style={{ background:"rgba(232,179,75,0.08)", borderRadius:16, border:"1px solid rgba(232,179,75,0.2)", padding:"16px 20px", textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:14, color:"#f4e4c0", fontStyle:"italic", lineHeight:1.7 }}>"Go ye into all the world and preach the gospel to every creature."</div>
          <div style={{ fontSize:12, color:"#e8b34b", marginTop:6, fontWeight:700 }}>Mark 16:15</div>
        </div>

        {/* Region filters */}
        <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
          {REGIONS.map(r => (
            <button key={r} onClick={() => setRegion(r)}
              style={{ padding:"7px 16px", borderRadius:999, border:`1px solid ${region===r ? "#e8b34b" : "rgba(255,255,255,0.1)"}`, background: region===r ? "rgba(232,179,75,0.15)" : "rgba(255,255,255,0.03)", color: region===r ? "#e8b34b" : "rgba(255,255,255,0.5)", cursor:"pointer", fontSize:13, fontWeight:600 }}>{r}</button>
          ))}
        </div>

        {/* Mission cards */}
        <div style={{ fontSize:18, fontWeight:700, color:"#eef1ff", marginBottom:16 }}>✝ Active Missions</div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {MISSIONS.map(m => (
            <div key={m.id} onClick={() => setSelected(m)}
              style={{ background:"#0c1628", borderRadius:18, border:`1px solid ${m.color}22`, padding:20, cursor:"pointer", borderLeft:`3px solid ${m.color}`, transition:"transform .15s" }}
              onMouseEnter={e => e.currentTarget.style.transform="translateY(-2px)"}
              onMouseLeave={e => e.currentTarget.style.transform=""}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                  <div style={{ width:48, height:48, borderRadius:14, background:`${m.color}22`, border:`1.5px solid ${m.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>✝</div>
                  <div>
                    <div style={{ fontSize:10, color:m.color, letterSpacing:2, textTransform:"uppercase", marginBottom:2 }}>{m.role}</div>
                    <div style={{ fontSize:16, fontWeight:700, color:"#eef1ff" }}>{m.protected ? "🔒 Protected" : m.name}</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:2 }}>📍 {m.city}, {m.country}</div>
                  </div>
                </div>
                <span style={{ padding:"3px 10px", borderRadius:999, fontSize:11, background: m.status==="complete" ? "rgba(76,175,125,0.15)" : `${m.color}18`, color: m.status==="complete" ? "#4caf7d" : m.color, border:`1px solid ${m.status==="complete" ? "#4caf7d33" : m.color+"33"}` }}>
                  {m.status==="complete" ? "✓ Done" : "● Active"}
                </span>
              </div>
              <div style={{ fontSize:14, fontWeight:600, color:"rgba(238,241,255,0.8)", marginBottom:10 }}>{m.title}</div>
              <div style={{ background:"rgba(255,255,255,0.07)", borderRadius:999, height:6, overflow:"hidden", marginBottom:8 }}>
                <div style={{ width:`${Math.min(100,Math.round((m.raised/m.goal)*100))}%`, height:"100%", borderRadius:999, background:`linear-gradient(90deg,${m.color},${m.color}bb)`, boxShadow:`0 0 6px ${m.color}55` }}/>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                <span style={{ fontSize:13, color:m.color, fontWeight:700 }}>${m.raised.toLocaleString()} raised</span>
                <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>{Math.round((m.raised/m.goal)*100)}% of ${m.goal.toLocaleString()}</span>
              </div>
              <button style={{ width:"100%", padding:"12px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${m.color},${m.color}cc)`, color:"#000", fontWeight:700, cursor:"pointer", fontSize:14, boxShadow:`0 4px 20px ${m.color}44` }}>
                💝 Donate Now
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ textAlign:"center", padding:"40px 0 20px", borderTop:"1px solid rgba(255,255,255,0.06)", marginTop:32 }}>
          <div style={{ fontSize:14, color:"rgba(255,255,255,0.3)", marginBottom:6 }}>✝ SendMe — For Message Believers Worldwide</div>
          <div style={{ fontSize:13, color:"#e8b34b", fontStyle:"italic" }}>"Here am I Lord, send me." — Isaiah 6:8</div>
        </div>
      </div>
    </div>
  );
}