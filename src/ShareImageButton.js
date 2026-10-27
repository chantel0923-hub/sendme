// "🖼 Share as image" — makes the 1080×1920 share picture for a mission or testimony and opens the phone's
// share sheet (WhatsApp → My status / a chat). Where that isn't possible the picture is saved instead.
import { useState } from "react";
import { buildShareImage, shareCardImage } from "./shareCard";

const base = { padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(232,179,75,0.45)", background: "rgba(232,179,75,0.1)", color: "#e8b34b", fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "Georgia, serif" };

const isPhone = () => { try { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ""); } catch (_e) { return false; } };

export default function ShareImageButton({ kind, getData, label = "🖼 Share as image", style, block = false }) {
  // idle | working | ready (picture made, one more tap to share) | saved | error
  const [state, setState] = useState("idle");
  const [made, setMade] = useState(null);   // { blob, filename, caption } once the picture exists
  const run = async (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (state === "working") return;
    try {
      let item = made;
      if (!item) {
        setState("working");
        item = await buildShareImage(kind, getData());
        setMade(item);
      }
      // If the picture was already made (second tap), allow the download fallback; the first attempt may ask for a tap.
      const result = await shareCardImage(item.blob, { filename: item.filename, caption: item.caption }, state === "ready");
      if (result !== "needs-tap") setMade(null);   // finished (or cancelled): next tap makes a fresh picture
      setState(result === "downloaded" ? "saved" : result === "needs-tap" ? "ready" : "idle");
    } catch (_err) {
      setState("error");
    }
  };
  const note = { fontSize: 12, lineHeight: 1.5, maxWidth: 260 };
  return (
    <div style={{ display: block ? "flex" : "inline-flex", flexDirection: "column", gap: 6, alignItems: "stretch", width: block ? "100%" : undefined }}>
      <button onClick={run} disabled={state === "working"} style={{ ...base, ...style, opacity: state === "working" ? 0.7 : 1 }}>
        {state === "working" ? "Preparing the image…" : state === "ready" ? "📲 Image ready — tap to send" : label}
      </button>
      {state === "ready" && <div style={{ ...note, color: "#e8b34b" }}>Tap once more and choose WhatsApp.</div>}
      {state === "saved" && (isPhone()
        ? <div style={{ ...note, color: "#e8b34b" }}>Your phone would not open sharing from here, so the picture was saved as a file (Downloads / Files app). For one-tap sharing, open SendMe in Chrome (Android) or Safari (iPhone) — not inside another app.</div>
        : <div style={{ ...note, color: "#3ecf8e" }}>✓ Saved in your Downloads folder. To post it: send it to your phone with WhatsApp Web (paperclip → Photos), then share it from your phone.</div>)}
      {state === "error" && <div style={{ ...note, color: "#e85b5b" }}>Couldn't make the image — please try again.</div>}
    </div>
  );
}
