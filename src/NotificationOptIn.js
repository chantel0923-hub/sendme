import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { requestPushPermission } from "./firebase";

const DISMISS_KEY = "sendme_push_dismissed";

export default function NotificationOptIn({ user }) {
  const [status, setStatus]   = useState("idle"); // idle | asking | granted | denied | unsupported | error
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    const alreadyGranted = typeof Notification !== "undefined" && Notification.permission === "granted";
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (alreadyGranted || dismissed) return;
    setVisible(true);
  }, [user]);

  const enable = async () => {
    setStatus("asking");
    const result = await requestPushPermission();
    if (result.ok) {
      try {
        await supabase.from("push_subscriptions").upsert(
          { user_id: user.id, token: result.token, platform: "web" },
          { onConflict: "token" }
        );
        setStatus("granted");
        setVisible(false);
      } catch (e) {
        console.error("Saving push subscription failed:", e);
        setStatus("error");
      }
    } else {
      setStatus(result.reason);
      if (result.reason === "denied" || result.reason === "unsupported") setVisible(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{ background:"rgba(232,179,75,0.08)", border:"1px solid rgba(232,179,75,0.25)",
      borderRadius:14, padding:"14px 18px", marginBottom:20, display:"flex",
      alignItems:"center", gap:14, flexWrap:"wrap" }}>
      <div style={{ fontSize:20 }}>🔔</div>
      <div style={{ flex:1, minWidth:200, fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.6 }}>
        Get notified the moment a new mission needs your support.
      </div>
      <button onClick={enable} disabled={status==="asking"}
        style={{ padding:"9px 18px", borderRadius:10, border:"none",
          background:"linear-gradient(135deg,#e8b34b,#c8942b)", color:"#000",
          fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif" }}>
        {status==="asking" ? "Requesting..." : "Enable Notifications"}
      </button>
      <button onClick={dismiss}
        style={{ padding:"9px 14px", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)",
          background:"transparent", color:"rgba(255,255,255,0.4)", cursor:"pointer",
          fontSize:13, fontFamily:"Georgia, serif" }}>
        Not now
      </button>
    </div>
  );
}
