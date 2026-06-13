// YouTubeEmbed.js — Reusable YouTube video embed, themed for SendMe
import React from "react";

export default function YouTubeEmbed({ videoId, title = "SendMe Video", caption }) {
  if (!videoId) return null;

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
          src={`https://www.youtube.com/embed/${videoId}`}
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
