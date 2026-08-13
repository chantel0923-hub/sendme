// YouTubeEmbed.js — Reusable YouTube video embed, themed for SendMe
import React from "react";

export default function YouTubeEmbed({ videoId, title = "SendMe Video", caption, autoplay = false }) {
  if (!videoId) return null;

  // Muted autoplay is the only kind browsers reliably allow without a user
  // gesture first — an unmuted autoplay param is silently ignored by most
  // browsers anyway, so this is the only version of "plays right away"
  // that actually works consistently.
  const src = autoplay
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`
    : `https://www.youtube.com/embed/${videoId}`;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        position: "relative",
        width: "100%",
        paddingBottom: "56.25%", // 16:9 ratio
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid rgba(232,179,75,0.25)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
      }}>
        <iframe
          src={src}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: "absolute",
            top: 0, left: 0,
            width: "100%", height: "100%",
            border: "none",
          }}
        />
      </div>
      {caption && (
        <div style={{
          marginTop: 8,
          fontSize: 12,
          color: "rgba(255,255,255,0.4)",
          fontFamily: "Georgia, serif",
          textAlign: "center",
        }}>
          {caption}
        </div>
      )}
    </div>
  );
}
