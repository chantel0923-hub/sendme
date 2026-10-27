// A one-page flyer (A4) for churches: the Message pictures, what SendMe is, three steps, and a big QR code.
// A pastor's flyer carries their own church's invite link, so new members who sign up through it are counted
// for that church. Print it, or choose "Save as PDF" in the print window.
import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { qrMatrix, qrSvgPath } from "./qr";
import { HERO_IMAGES } from "./shareCard";
import { SITE_ORIGIN, NPC_NAME, NPC_REG_NO, FLYER_CONTACT, churchLink, siteLink } from "./shareConfig";

const PRINT_CSS = `
  @page { size: A4; margin: 0; }
  @media print {
    body * { visibility: hidden !important; }
    #sendme-flyer, #sendme-flyer * { visibility: visible !important; }
    #sendme-flyer { position: fixed !important; left: 0; top: 0; width: 210mm !important; height: 297mm !important; max-width: none !important; border: none !important; border-radius: 0 !important; box-shadow: none !important; }
  }
`;

export default function ChurchFlyer({ onBack, user, isAdmin }) {
  const [churches, setChurches] = useState([]);
  const [churchId, setChurchId] = useState("");
  const [qr, setQr]             = useState(null);   // { size, d }
  const [copied, setCopied]     = useState(false);
  const [loadError, setLoadError] = useState("");

  // Admin: every verified church. A pastor: only their own verified church(es). Anyone else: the general flyer only.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user && !isAdmin) return;
      try {
        let q = supabase.from("churches").select("id, name, city, country, user_id, verified").eq("verified", true);
        if (!isAdmin) q = q.eq("user_id", user.id);
        const { data, error } = await q;
        if (error) throw error;
        const list = (data || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
        if (cancelled) return;
        setChurches(list);
        if (!isAdmin && list.length) setChurchId(list[0].id);
      } catch (_e) { if (!cancelled) setLoadError("Could not load the church list."); }
    })();
    return () => { cancelled = true; };
  }, [user, isAdmin]);

  const church = churches.find(c => c.id === churchId) || null;
  const link = church ? churchLink(church.id) : siteLink();

  useEffect(() => {
    let cancelled = false;
    qrMatrix(link).then(rows => { if (!cancelled) setQr(qrSvgPath(rows)); }).catch(() => { if (!cancelled) setQr(null); });
    return () => { cancelled = true; };
  }, [link]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { window.prompt("Copy this link:", link); }
  };
  const waLink = `https://wa.me/?text=${encodeURIComponent("🙏 " + (church ? `${church.name} is part of` : "I'm part of") + " SendMe Global Mission Fund — Message believers supporting real missions around the world, one mission at a time.\n\nHave a look and join us: " + link)}`;

  const step = (n, title, text) => (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
      <div style={{ width: 34, height: 34, borderRadius: 17, background: "#e8b34b", color: "#0a1322", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 17 }}>{n}</div>
      <div><div style={{ fontWeight: 700, color: "#0a1322", fontSize: 16 }}>{title}</div><div style={{ color: "#445068", fontSize: 14, lineHeight: 1.5 }}>{text}</div></div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>
      <style>{PRINT_CSS}</style>
      <div style={{ background: "#09111f", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>📣 Flyer &amp; invite link</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>PRINT FOR YOUR CHURCH · SHARE YOUR LINK</div>
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "22px 16px 60px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          {(isAdmin || churches.length > 0) && (
            <select value={churchId} onChange={e => setChurchId(e.target.value)} aria-label="Church"
              style={{ padding: "10px 12px", borderRadius: 10, background: "#0c1628", border: "1px solid rgba(255,255,255,0.15)", color: "#eef1ff", fontSize: 14, fontFamily: "Georgia, serif", colorScheme: "dark", maxWidth: 320 }}>
              {isAdmin && <option value="" style={{ background: "#0c1628" }}>SendMe (no church)</option>}
              {churches.map(c => <option key={c.id} value={c.id} style={{ background: "#0c1628" }}>{c.name}{c.city ? ` — ${c.city}` : ""}</option>)}
            </select>
          )}
          <button onClick={() => window.print()}
            style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#e8b34b,#c8942b)", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>🖨 Print / Save as PDF</button>
          <button onClick={copyLink} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>{copied ? "✓ Copied" : "Copy link"}</button>
          <a href={waLink} target="_blank" rel="noopener noreferrer"
            style={{ padding: "10px 16px", borderRadius: 10, background: "linear-gradient(135deg,#25d366,#1da851)", color: "#04210f", fontWeight: 700, fontSize: 14, textDecoration: "none", fontFamily: "Georgia, serif" }}>📲 Share on WhatsApp</a>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, marginBottom: 16 }}>
          {church
            ? <>This flyer and link are for <strong style={{ color: "#eef1ff" }}>{church.name}</strong>. People who join through this QR code or link are counted for your church.</>
            : <>This is the general SendMe flyer. {isAdmin ? "Choose a church above for a church flyer with its own link." : "Pastors of verified churches get a flyer and link for their own church here."}</>}
          {loadError && <span style={{ color: "#e85b5b" }}> {loadError}</span>}
        </div>

        {/* ── the flyer (this is what prints) ── */}
        <div id="sendme-flyer" data-link={link}
          style={{ background: "#ffffff", color: "#0a1322", width: "100%", maxWidth: 794, aspectRatio: "210 / 297", margin: "0 auto", borderRadius: 6, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 10px 40px rgba(0,0,0,0.5)", fontFamily: "Georgia, serif" }}>
          <div style={{ background: "#0a1322", padding: "26px 0 20px", textAlign: "center" }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: "#fff", lineHeight: 1 }}>Send<span style={{ color: "#e8b34b" }}>Me</span></div>
            <div style={{ fontSize: 11, letterSpacing: 5, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>GLOBAL MISSION FUND</div>
            <div style={{ fontSize: 12, letterSpacing: 4, color: "#e8b34b", marginTop: 8, fontWeight: 700 }}>FOR MESSAGE BELIEVERS</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, padding: "14px 24px 0" }}>
            {HERO_IMAGES.map(src => (
              <img key={src} src={src} alt="" onError={e => { e.currentTarget.style.visibility = "hidden"; }}
                style={{ width: "100%", aspectRatio: "4 / 4.2", objectFit: "cover", objectPosition: "center 30%", borderRadius: 10, border: "2px solid #e8b34b" }} />
            ))}
          </div>
          <div style={{ padding: "18px 32px 0", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.25 }}>Sending the end-time Message to the nations</div>
            <div style={{ fontSize: 15, color: "#445068", marginTop: 6 }}>Support verified missionaries and churches — one mission at a time.</div>
          </div>
          <div style={{ padding: "18px 36px 0" }}>
            {step(1, "Choose a mission", "See who is going, where, and what it needs.")}
            {step(2, "Give by card or bank transfer", "Safe and simple, from anywhere in the world.")}
            {step(3, "See the proof", "Gifts are released in stages after the pastor verifies the work.")}
          </div>
          <div style={{ marginTop: "auto", padding: "10px 32px 0", display: "flex", gap: 22, alignItems: "center", justifyContent: "center" }}>
            <div style={{ border: "2px solid #0a1322", borderRadius: 10, padding: 8, lineHeight: 0, background: "#fff" }}>
              {qr ? (
                <svg viewBox={`0 0 ${qr.size} ${qr.size}`} width="160" height="160" shapeRendering="crispEdges" role="img" aria-label="QR code" data-testid="flyer-qr">
                  <rect width={qr.size} height={qr.size} fill="#fff" />
                  <path d={qr.d} fill="#0a1322" />
                </svg>
              ) : <div style={{ width: 160, height: 160 }} />}
            </div>
            <div style={{ maxWidth: 330 }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>Scan to see the missions</div>
              <div style={{ fontSize: 16, color: "#b8861b", fontWeight: 700, marginTop: 4 }}>{SITE_ORIGIN.replace("https://", "")}</div>
              {church && <div style={{ fontSize: 14, color: "#445068", marginTop: 8 }}>Shared by <strong style={{ color: "#0a1322" }}>{church.name}</strong>{church.city ? `, ${church.city}` : ""}</div>}
              {FLYER_CONTACT && <div style={{ fontSize: 13, color: "#445068", marginTop: 6 }}>{FLYER_CONTACT}</div>}
            </div>
          </div>
          <div style={{ padding: "12px 24px 16px", textAlign: "center", fontSize: 11, color: "#6b7690" }}>
            {NPC_NAME} · Reg. no. {NPC_REG_NO}
          </div>
        </div>
      </div>
    </div>
  );
}
