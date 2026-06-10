import { useState } from "react";

const INTERESTS = [
  { key:"children",    label:"Children Ministry",    icon:"👦" },
  { key:"village",     label:"Village Outreach",      icon:"🏘️" },
  { key:"bibles",      label:"Bible Distribution",    icon:"📖" },
  { key:"planting",    label:"Church Planting",       icon:"⛪" },
  { key:"youth",       label:"Youth Outreach",        icon:"🎯" },
  { key:"medical",     label:"Medical Missions",      icon:"🏥" },
  { key:"refugees",    label:"Refugee Ministry",      icon:"🤝" },
  { key:"womens",      label:"Women's Ministry",      icon:"🙏" },
  { key:"africa",      label:"Africa",                icon:"🌍" },
  { key:"asia",        label:"Asia",                  icon:"🌏" },
  { key:"mideast",     label:"Middle East",           icon:"🕊️" },
  { key:"americas",    label:"South America",         icon:"🌎" },
];

const MISSION_TAGS = {
  1: ["children","village","africa","bibles"],
  2: ["village","americas","bibles","medical"],
  3: ["children","village","africa","planting"],
  4: ["village","africa","planting","youth"],
  5: ["womens","bibles","asia","village"],
  6: ["refugees","asia","bibles","medical"],
  7: ["refugees","mideast","bibles"],
};

export default function MissionMatching({ missions, onMission, onBack }) {
  const [selected, setSelected] = useState([]);
  const [matched, setMatched]   = useState(null);

  const toggle = (key) => {
    setSelected(s => s.includes(key) ? s.filter(k=>k!==key) : [...s, key]);
    setMatched(null);
  };

  const findMatches = () => {
    if (selected.length === 0) return;
    const scored = missions.map(m => {
      const tags = MISSION_TAGS[m.id] || [];
      const score = selected.filter(s => tags.includes(s)).length;
      return { ...m, score };
    }).filter(m => m.score > 0).sort((a,b) => b.score - a.score);
    setMatched(scored);
  };

  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const pct = (r,g) => Math.min(100,Math.round((r/g)*100));

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>Mission Matching</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>FIND MISSIONS YOU CARE ABOUT</div>
        </div>
      </div>

      <div style={{ maxWidth:680, margin:"0 auto", padding:"28px 20px 60px" }}>

        <div style={{ background:"rgba(232,179,75,0.08)", borderRadius:14, border:"1px solid rgba(232,179,75,0.2)", padding:"16px 18px", marginBottom:24, textAlign:"center" }}>
          <div style={{ fontSize:18, marginBottom:6 }}>✝</div>
          <div style={{ fontSize:16, fontWeight:700, color:"#eef1ff", marginBottom:6 }}>Find Your Mission Burden</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)", lineHeight:1.7 }}>Select the types of ministry that burden your heart and we will match you to missionaries who need your support.</div>
        </div>

        {/* Interest grid */}
        <div style={{ fontSize:14, fontWeight:700, color:"#eef1ff", marginBottom:14 }}>What burdens your heart?</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:24 }}>
          {INTERESTS.map(({ key, label, icon }) => {
            const on = selected.includes(key);
            return (
              <div key={key} onClick={() => toggle(key)}
                style={{ background: on ? "rgba(232,179,75,0.12)" : "rgba(255,255,255,0.03)", borderRadius:12, border:`1px solid ${on?"rgba(232,179,75,0.4)":"rgba(255,255,255,0.08)"}`, padding:"14px 10px", textAlign:"center", cursor:"pointer", transition:"all .2s" }}>
                <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
                <div style={{ fontSize:12, color: on ? "#e8b34b" : "rgba(255,255,255,0.5)", fontWeight: on ? 700 : 400, lineHeight:1.3 }}>{label}</div>
              </div>
            );
          })}
        </div>

        <button onClick={findMatches} disabled={selected.length === 0}
          style={{ width:"100%", padding:"14px 0", borderRadius:14, border:"none",
            background: selected.length > 0 ? "linear-gradient(135deg,#e8b34b,#c8942b)" : "rgba(255,255,255,0.06)",
            color: selected.length > 0 ? "#000" : "rgba(255,255,255,0.25)",
            fontWeight:700, cursor: selected.length > 0 ? "pointer" : "default",
            fontSize:15, fontFamily:"Georgia, serif",
            boxShadow: selected.length > 0 ? "0 6px 24px rgba(232,179,75,0.4)" : "none",
            marginBottom:24, transition:"all .2s" }}>
          {selected.length === 0 ? "Select at least one interest" : `Find Matching Missions (${selected.length} selected)`}
        </button>

        {/* Matches */}
        {matched !== null && (
          <>
            <div style={{ fontSize:16, fontWeight:700, color:"#eef1ff", marginBottom:14 }}>
              {matched.length > 0 ? `${matched.length} Missions Match Your Burden` : "No exact matches — try fewer filters"}
            </div>
            {matched.length === 0 ? (
              <div style={{ textAlign:"center", padding:"30px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>
                Try selecting fewer interests to broaden your search.
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {matched.map(m => (
                  <div key={m.id} onClick={() => onMission(m)}
                    style={{ background:"#0c1628", borderRadius:16, border:`1px solid ${m.color}33`, borderLeft:`3px solid ${m.color}`, padding:18, cursor:"pointer", transition:"transform .15s" }}
                    onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
                    onMouseLeave={e=>e.currentTarget.style.transform=""}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                      <div>
                        <div style={{ fontSize:11, color:m.color, letterSpacing:2, textTransform:"uppercase", marginBottom:3 }}>{m.role}</div>
                        <div style={{ fontSize:16, fontWeight:700, color:"#eef1ff" }}>{m.protected ? "Protected Mission" : m.name}</div>
                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:2 }}>📍 {m.protected ? m.region+" (Protected)" : `${m.city}, ${m.country}`}</div>
                      </div>
                      <div style={{ background:`${m.color}22`, borderRadius:999, padding:"4px 12px", fontSize:12, color:m.color, fontWeight:700, whiteSpace:"nowrap" }}>
                        {m.score}/{selected.length} match
                      </div>
                    </div>
                    <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", marginBottom:10, lineHeight:1.6 }}>{m.title}</div>
                    <div style={{ background:"rgba(255,255,255,0.07)", borderRadius:999, height:5, overflow:"hidden", marginBottom:8 }}>
                      <div style={{ width:`${pct(m.raised,m.goal)}%`, height:"100%", borderRadius:999, background:m.color }}/>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontSize:12, color:m.color, fontWeight:700 }}>${fmt(m.raised)} raised</span>
                      <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{pct(m.raised,m.goal)}% of ${fmt(m.goal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
