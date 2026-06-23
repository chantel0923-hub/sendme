import { useState, useEffect, useRef } from "react";

const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Simple QR code using a free API - no npm package needed
const QRCode = ({ url, size = 200, color = "#e8b34b" }) => {
  const encoded = encodeURIComponent(url);
  const apiUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&color=e8b34b&bgcolor=0c1628&margin=10`;
  return (
    <img src={apiUrl} alt="QR Code" style={{ width:size, height:size, borderRadius:12, border:"2px solid rgba(232,179,75,0.3)", display:"block" }}/>
  );
};

const SHARE_TYPES = [
  { key:"app",      label:"SendMe App",          desc:"Share the SendMe platform with your church",         url:"https://sendme-nine.vercel.app" },
  { key:"missions", label:"View All Missions",   desc:"Direct link to the active missions list",            url:"https://sendme-nine.vercel.app/missions" },
  { key:"apply",    label:"Apply as Missionary", desc:"For believers called to the mission field",          url:"https://sendme-nine.vercel.app/apply" },
  { key:"church",   label:"Register Your Church",desc:"For Message churches wanting to endorse missionaries",url:"https://sendme-nine.vercel.app/register-church" },
  { key:"emergency",label:"Emergency Requests",  desc:"For urgent mission needs requiring quick response",  url:"https://sendme-nine.vercel.app/emergency" },
];

export default function QRShare({ missions = [], onBack }) {
  const [activeType, setActiveType] = useState("app");
  const [selectedMission, setSelectedMission] = useState(null);
  const [copied, setCopied] = useState(false);

  const currentUrl = selectedMission
    ? `https://sendme-nine.vercel.app/mission/${selectedMission.id}`
    : SHARE_TYPES.find(t => t.key === activeType)?.url || "https://sendme-nine.vercel.app";

  const currentLabel = selectedMission
    ? selectedMission.title
    : SHARE_TYPES.find(t => t.key === activeType)?.label || "SendMe";

  const copyLink = () => {
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `Join me on SendMe - the global missionary crowdfunding platform for Message believers.\n\n` +
      `${currentLabel}\n` +
      `${currentUrl}\n\n` +
      `"Go ye into all the world and preach the gospel to every creature." - Mark 16:15`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>QR Code Sharing</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>FOR CHURCH SERVICES & CONVENTIONS</div>
        </div>
      </div>

      <div style={{ maxWidth:680, margin:"0 auto", padding:"28px 20px 60px" }}>

        <div style={{ background:"rgba(232,179,75,0.07)", borderRadius:14, border:"1px solid rgba(232,179,75,0.2)", padding:"14px 18px", marginBottom:24, display:"flex", gap:10 }}>
          <span style={{ fontSize:18, flexShrink:0 }}>📱</span>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", lineHeight:1.7 }}>
            Put this QR code on the screen at church services or conventions. Believers scan it with their phone camera to instantly open SendMe. <strong style={{ color:"#e8b34b" }}>No app download needed</strong> — works directly in any phone browser.
          </div>
        </div>

        {/* QR Display */}
        <div style={{ background:"#0c1628", borderRadius:20, border:"1px solid rgba(232,179,75,0.2)", padding:28, marginBottom:20, textAlign:"center" }}>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", marginBottom:16, letterSpacing:1, textTransform:"uppercase" }}>
            Scan to open — {currentLabel}
          </div>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
            <div style={{ padding:16, background:"#0a0f1e", borderRadius:16, border:"1px solid rgba(232,179,75,0.15)" }}>
              <QRCode url={currentUrl} size={200}/>
            </div>
          </div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)", marginBottom:16, wordBreak:"break-all", padding:"8px 12px", background:"rgba(255,255,255,0.03)", borderRadius:8 }}>
            {currentUrl}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <button onClick={copyLink}
              style={{ padding:"11px 0", borderRadius:12, border:"1px solid rgba(232,179,75,0.3)", background:"rgba(232,179,75,0.08)", color:copied?"#3ecf8e":"#e8b34b", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif", transition:"all .2s" }}>
              {copied ? "✓ Copied!" : "Copy Link"}
            </button>
            <button onClick={shareWhatsApp}
              style={{ padding:"11px 0", borderRadius:12, border:"1px solid rgba(37,211,102,0.3)", background:"rgba(37,211,102,0.08)", color:"#25d366", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif" }}>
              Share on WhatsApp
            </button>
          </div>
        </div>

        {/* Type selector */}
        <div style={{ fontSize:14, fontWeight:700, color:"#eef1ff", marginBottom:12 }}>Select what to share</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
          {SHARE_TYPES.map(t => (
            <div key={t.key}
              onClick={() => { setActiveType(t.key); setSelectedMission(null); }}
              style={{ background:activeType===t.key&&!selectedMission?"rgba(232,179,75,0.1)":"rgba(255,255,255,0.02)", borderRadius:12, border:`1px solid ${activeType===t.key&&!selectedMission?"rgba(232,179,75,0.35)":"rgba(255,255,255,0.07)"}`, padding:"14px 16px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", transition:"all .2s" }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:activeType===t.key&&!selectedMission?"#e8b34b":"#eef1ff" }}>{t.label}</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:3 }}>{t.desc}</div>
              </div>
              {activeType===t.key&&!selectedMission && <span style={{ color:"#e8b34b", fontSize:18 }}>●</span>}
            </div>
          ))}
        </div>

        {/* Mission specific QR */}
        {missions.length > 0 && (
          <>
            <div style={{ fontSize:14, fontWeight:700, color:"#eef1ff", marginBottom:12 }}>Or share a specific mission</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {missions.slice(0,5).map(m => (
                <div key={m.id}
                  onClick={() => { setSelectedMission(m); setActiveType(null); }}
                  style={{ background:selectedMission?.id===m.id?"rgba(232,179,75,0.1)":"rgba(255,255,255,0.02)", borderRadius:12, border:`1px solid ${selectedMission?.id===m.id?"rgba(232,179,75,0.35)":m.color+"22"}`, borderLeft:`3px solid ${m.color}`, padding:"12px 16px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", transition:"all .2s" }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#eef1ff" }}>{m.protected?"Protected Mission":m.name}</div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:2 }}>{m.title} · {m.country}</div>
                  </div>
                  {selectedMission?.id===m.id && <span style={{ color:"#e8b34b", fontSize:18 }}>●</span>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Church display tip */}
        <div style={{ background:"rgba(91,156,246,0.07)", borderRadius:14, border:"1px solid rgba(91,156,246,0.2)", padding:"16px 18px", marginTop:24 }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#5b9cf6", marginBottom:8 }}>Tip for church services</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", lineHeight:1.7 }}>
            Take a screenshot of the QR code and put it on the church projector screen or print it on your bulletin. Members scan with their phone camera — no app needed. Works on all Android and iPhone devices.
          </div>
        </div>

        <div style={{ textAlign:"center", padding:"32px 0 0", borderTop:"1px solid rgba(255,255,255,0.05)", marginTop:32 }}>
          <div style={{ fontSize:13, color:"#e8b34b", fontStyle:"italic" }}>"Here am I Lord, send me." — Isaiah 6:8</div>
        </div>
      </div>
    </div>
  );
}
