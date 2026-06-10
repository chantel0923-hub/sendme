import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const DEMO_TESTIMONIES = [
  {
    id:1, mission:"Kibera Children's Ministry", missionary:"Pastor John Kimani",
    country:"Kenya", region:"Africa", completed:"2025-04-30",
    souls:600, bibles:600, churches:2, duration:"18 months",
    color:"#5b9cf6",
    story:"What began as a small Sunday school in Kibera has grown into a full literacy and discipleship program reaching over 600 children weekly. Entire families came to faith as children brought the Word home. Two local congregations were planted and are now self-sustaining.",
    beforeText:"No church presence in Kibera East. Children with no education, no hope.",
    afterText:"600 children in weekly Bible study. 2 planted churches. Local leadership trained and serving.",
    tags:["Children Ministry","Church Planting","Africa","Education"],
    impact:"$18,500 deployed with full accountability. Every shilling accounted for.",
  },
  {
    id:2, mission:"Amazon River Mission", missionary:"Sis. Maria Santos",
    country:"Brazil", region:"S. America", completed:"2025-03-15",
    souls:148, bibles:312, churches:3, duration:"12 months",
    color:"#4caf7d",
    story:"Travelling by boat into 12 unreached riverside communities, Sister Maria brought the Gospel, medicines, and Bibles in the local dialect. Three permanent congregations were planted with local pastors trained and ordained.",
    beforeText:"12 riverside villages with no Gospel witness. No access by road.",
    afterText:"148 souls reached. 312 Bibles distributed. 3 churches planted along the river.",
    tags:["Village Outreach","Bible Distribution","South America","Medical"],
    impact:"$14,200 raised. All milestones verified with GPS-tagged photos.",
  },
];

export default function TestimonyEngine({ onBack, onMission }) {
  const [testimonies, setTestimonies] = useState(DEMO_TESTIMONIES);
  const [selected, setSelected]       = useState(null);
  const [sharing, setSharing]         = useState(false);

  const shareTestimony = (t) => {
    const text = encodeURIComponent(
      `Praise Report from ${t.country}!\n\n` +
      `${t.mission} — COMPLETED\n` +
      `${t.souls} souls reached | ${t.bibles} Bibles | ${t.churches} churches planted\n\n` +
      `"${t.story.slice(0, 150)}..."\n\n` +
      `See the full testimony — SendMe Global Mission Fund\nhttps://sendme.org`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  if (selected) {
    const t = selected;
    return (
      <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
        <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
          <button onClick={()=>setSelected(null)} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
          <div>
            <div style={{ fontSize:18, fontWeight:700 }}>Mission Testimony</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>COMPLETED MISSION STORY</div>
          </div>
        </div>
        <div style={{ maxWidth:700, margin:"0 auto", padding:"28px 20px 60px" }}>
          <div style={{ background:`linear-gradient(135deg,${t.color}18,${t.color}06)`, borderRadius:20, border:`1px solid ${t.color}33`, padding:24, marginBottom:20 }}>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
              <span style={{ padding:"3px 12px", borderRadius:999, fontSize:12, background:"rgba(62,207,142,0.12)", color:"#3ecf8e", border:"1px solid rgba(62,207,142,0.25)", fontWeight:600 }}>Completed</span>
              <span style={{ padding:"3px 12px", borderRadius:999, fontSize:12, background:`${t.color}18`, color:t.color, border:`1px solid ${t.color}33` }}>📍 {t.country}</span>
              <span style={{ padding:"3px 12px", borderRadius:999, fontSize:12, background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.4)" }}>{t.duration}</span>
            </div>
            <div style={{ fontSize:22, fontWeight:700, color:"#eef1ff", marginBottom:6 }}>{t.mission}</div>
            <div style={{ fontSize:14, color:"rgba(255,255,255,0.5)" }}>by {t.missionary}</div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
            {[["🙏",t.souls,"Souls Reached",t.color],["📖",t.bibles,"Bibles Given","#5b9cf6"],["⛪",t.churches,"Churches Planted","#3ecf8e"]].map(([icon,val,label,c])=>(
              <div key={label} style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", padding:"14px 10px", textAlign:"center" }}>
                <div style={{ fontSize:22 }}>{icon}</div>
                <div style={{ fontSize:22, fontWeight:700, color:c, marginTop:4 }}>{fmt(val)}</div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ background:"#0c1628", borderRadius:16, border:"1px solid rgba(255,255,255,0.08)", padding:20, marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#eef1ff", marginBottom:12 }}>The Story</div>
            <div style={{ fontSize:14, color:"rgba(255,255,255,0.65)", lineHeight:1.85 }}>{t.story}</div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            <div style={{ background:"rgba(232,91,91,0.08)", borderRadius:14, border:"1px solid rgba(232,91,91,0.2)", padding:16 }}>
              <div style={{ fontSize:12, color:"#e85b5b", fontWeight:700, marginBottom:8, letterSpacing:1, textTransform:"uppercase" }}>Before</div>
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.7 }}>{t.beforeText}</div>
            </div>
            <div style={{ background:"rgba(62,207,142,0.08)", borderRadius:14, border:"1px solid rgba(62,207,142,0.2)", padding:16 }}>
              <div style={{ fontSize:12, color:"#3ecf8e", fontWeight:700, marginBottom:8, letterSpacing:1, textTransform:"uppercase" }}>After</div>
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.7 }}>{t.afterText}</div>
            </div>
          </div>

          <div style={{ background:"rgba(232,179,75,0.07)", borderRadius:12, border:"1px solid rgba(232,179,75,0.2)", padding:"12px 16px", marginBottom:20, fontSize:13, color:"rgba(255,255,255,0.5)", lineHeight:1.7 }}>
            <strong style={{ color:"#e8b34b" }}>Financial transparency:</strong> {t.impact}
          </div>

          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
            {t.tags.map(tag => (
              <span key={tag} style={{ padding:"4px 12px", borderRadius:999, fontSize:12, background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.4)", border:"1px solid rgba(255,255,255,0.1)" }}>{tag}</span>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <button onClick={()=>shareTestimony(t)}
              style={{ padding:"14px 0", borderRadius:14, border:"1px solid rgba(37,211,102,0.3)", background:"rgba(37,211,102,0.08)", color:"#25d366", fontWeight:700, cursor:"pointer", fontSize:15, fontFamily:"Georgia, serif" }}>
              Share This Testimony
            </button>
            <button onClick={()=>shareTestimony(t)}
              style={{ padding:"14px 0", borderRadius:14, border:"none", background:"linear-gradient(135deg,#e8b34b,#c8942b)", color:"#000", fontWeight:700, cursor:"pointer", fontSize:15, fontFamily:"Georgia, serif", boxShadow:"0 6px 24px rgba(232,179,75,0.4)" }}>
              Support Another Mission
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>Mission Testimonies</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>COMPLETED MISSIONS — GOD'S FAITHFULNESS</div>
        </div>
      </div>
      <div style={{ maxWidth:700, margin:"0 auto", padding:"28px 20px 60px" }}>
        <div style={{ background:"rgba(232,179,75,0.08)", borderRadius:16, border:"1px solid rgba(232,179,75,0.2)", padding:"20px 24px", marginBottom:24, textAlign:"center" }}>
          <div style={{ fontSize:20, fontWeight:700, color:"#eef1ff", marginBottom:6 }}>Fruit That Remains</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)", lineHeight:1.7 }}>Every completed mission becomes a permanent testimony archive. See what God has done through faithful believers worldwide.</div>
          <div style={{ fontSize:13, color:"#e8b34b", fontStyle:"italic", marginTop:10 }}>"Ye have not chosen me, but I have chosen you... that ye should go and bring forth fruit, and that your fruit should remain." — John 15:16</div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:24 }}>
          {[
            ["✅", testimonies.length, "Completed Missions", "#3ecf8e"],
            ["🙏", fmt(testimonies.reduce((s,t)=>s+t.souls,0)), "Souls Reached", "#e8b34b"],
            ["⛪", testimonies.reduce((s,t)=>s+t.churches,0), "Churches Planted", "#5b9cf6"],
          ].map(([icon,val,label,c])=>(
            <div key={label} style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", padding:"14px 10px", textAlign:"center" }}>
              <div style={{ fontSize:22 }}>{icon}</div>
              <div style={{ fontSize:20, fontWeight:700, color:c, marginTop:4 }}>{val}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {testimonies.map(t => (
            <div key={t.id} onClick={()=>setSelected(t)}
              style={{ background:"#0c1628", borderRadius:18, border:`1px solid ${t.color}33`, borderLeft:`3px solid ${t.color}`, padding:20, cursor:"pointer", transition:"transform .15s" }}
              onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
              onMouseLeave={e=>e.currentTarget.style.transform=""}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div>
                  <div style={{ display:"flex", gap:8, marginBottom:6 }}>
                    <span style={{ padding:"3px 10px", borderRadius:999, fontSize:11, background:"rgba(62,207,142,0.12)", color:"#3ecf8e", border:"1px solid rgba(62,207,142,0.25)" }}>Completed</span>
                    <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>📍 {t.country}</span>
                  </div>
                  <div style={{ fontSize:16, fontWeight:700, color:"#eef1ff", marginBottom:3 }}>{t.mission}</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>by {t.missionary}</div>
                </div>
              </div>
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.7, marginBottom:14 }}>{t.story.slice(0,120)}...</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
                {[["🙏",fmt(t.souls),"Souls"],[" 📖",fmt(t.bibles),"Bibles"],["⛪",t.churches,"Churches"]].map(([icon,val,label])=>(
                  <div key={label} style={{ background:"rgba(255,255,255,0.03)", borderRadius:10, padding:"8px 6px", textAlign:"center" }}>
                    <div style={{ fontSize:14 }}>{icon}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:t.color }}>{val}</div>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={e=>{e.stopPropagation();setSelected(t);}}
                  style={{ flex:1, padding:"10px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${t.color},${t.color}cc)`, color:"#000", fontWeight:700, cursor:"pointer", fontSize:13 }}>
                  Read Full Testimony
                </button>
                <button onClick={e=>{e.stopPropagation();shareTestimony(t);}}
                  style={{ padding:"10px 16px", borderRadius:12, border:"1px solid rgba(37,211,102,0.3)", background:"rgba(37,211,102,0.08)", color:"#25d366", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif" }}>
                  Share
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
