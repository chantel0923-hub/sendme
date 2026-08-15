// WatchHowLink.js — A compact "Watch how →" link usable on any screen
// (application forms, registration, donate, etc). Collapsed by default so
// it never pushes real form content down the page; expands to an inline
// video on click. Renders nothing if no videoId is set, so it's always
// safe to drop in even before a video exists for that screen yet.
import { useState } from "react";
import YouTubeEmbed from "./YouTubeEmbed";

export default function WatchHowLink({ videoId, label = "Watch how it works" }) {
  const [open, setOpen] = useState(false);
  if (!videoId) return null;

  return (
    <div style={{ marginBottom: 18 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(232,179,75,0.08)", border: "1px solid rgba(232,179,75,0.25)",
          borderRadius: 10, padding: "9px 16px", color: "#e8b34b", cursor: "pointer",
          fontSize: 13, fontFamily: "Georgia, serif", fontWeight: 700,
        }}
      >
        <span style={{ fontSize: 11 }}>{open ? "▾" : "▶"}</span>
        {open ? "Hide video" : label}
      </button>
      {open && (
        <div style={{ marginTop: 12, maxWidth: 480 }}>
          <YouTubeEmbed videoId={videoId} title={label} />
        </div>
      )}
    </div>
  );
}
