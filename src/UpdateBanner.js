// src/UpdateBanner.js — Shown whenever a new deployed version of SendMe is
// ready. Update detection is entirely event-driven (see index.js), so this
// component has no dependency on where it's mounted relative to <App />.
import { useState, useEffect } from "react";

export default function UpdateBanner() {
  const [waitingRegistration, setWaitingRegistration] = useState(null);

  useEffect(() => {
    const handleUpdate = (e) => setWaitingRegistration(e.detail);
    window.addEventListener("sendme-sw-update", handleUpdate);
    return () => window.removeEventListener("sendme-sw-update", handleUpdate);
  }, []);

  if (!waitingRegistration) return null;

  const refresh = () => {
    const waiting = waitingRegistration.waiting;
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" });
      // The registration's controllerchange listener (in
      // serviceWorkerRegistration.js) handles the actual reload once the
      // new worker takes control.
    } else {
      window.location.reload();
    }
  };

  return (
    <div style={{
      position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, background: "#0c1628", border: "1px solid rgba(232,179,75,0.35)",
      borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 16,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)", fontFamily: "Georgia, serif",
      maxWidth: "92vw", flexWrap: "wrap", justifyContent: "center",
    }}>
      <span style={{ fontSize: 13, color: "#eef1ff" }}>
        A new version of SendMe is available.
      </span>
      <button
        onClick={refresh}
        style={{
          padding: "9px 18px", borderRadius: 10, border: "none",
          background: "linear-gradient(135deg,#e8b34b,#c8942b)", color: "#000",
          fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "Georgia, serif",
          whiteSpace: "nowrap",
        }}
      >
        Refresh
      </button>
    </div>
  );
}
