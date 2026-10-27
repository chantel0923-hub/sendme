// "🖼 Share as image" — makes the 1080×1920 share picture for a mission or testimony and opens the phone's
// share sheet (WhatsApp → My status / a chat). Where that isn't possible the picture is saved instead.
import { useState } from "react";
import { buildShareImage, shareCardImage } from "./shareCard";

const base = { padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(232,179,75,0.45)", background: "rgba(232,179,75,0.1)", color: "#e8b34b", fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "Georgia, serif" };

export default function ShareImageButton({ kind, getData, label = "🖼 Share as image", style, block = false }) {
  const [state, setState] = useState("idle");   // idle | working | saved | error
  const run = async (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (state === "working") return;
    setState("working");
    try {
      const { blob, filename, caption } = await buildShareImage(kind, getData());
      const result = await shareCardImage(blob, { filename, caption });
      setState(result === "downloaded" ? "saved" : "idle");
    } catch (_err) {
      setState("error");
    }
  };
  return (
    <div style={{ display: block ? "flex" : "inline-flex", flexDirection: "column", gap: 6, alignItems: "stretch", width: block ? "100%" : undefined }}>
      <button onClick={run} disabled={state === "working"} style={{ ...base, ...style, opacity: state === "working" ? 0.7 : 1 }}>
        {state === "working" ? "Preparing the image…" : label}
      </button>
      {state === "saved" && <div style={{ fontSize: 12, color: "#3ecf8e", lineHeight: 1.5, maxWidth: 260 }}>✓ Saved to your device. Open WhatsApp → My status and pick it from your gallery.</div>}
      {state === "error" && <div style={{ fontSize: 12, color: "#e85b5b", lineHeight: 1.5, maxWidth: 260 }}>Couldn't make the image — please try again.</div>}
    </div>
  );
}
