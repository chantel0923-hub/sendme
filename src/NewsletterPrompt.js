// NewsletterPrompt.js
// A small card on the Home screen inviting signed-in members to opt in to the
// monthly newsletter. Previously the only place to opt in (after the first-login
// Welcome screen) was the toggle at the bottom of the profile page, which most
// people never scroll to.
//
// - Shown only to signed-in users whose `profiles.newsletter_optin` is not true.
// - "Yes, subscribe" sets newsletter_optin = true (same column the profile
//   toggle uses), shows a short confirmation, then disappears.
// - "Not now" hides it on this device for DISMISS_DAYS days. It is never
//   pre-ticked and never subscribes anyone without the tap.
import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const DISMISS_DAYS = 30;

const readDismissed = (key) => {
  try {
    const t = Number(localStorage.getItem(key));
    return t && Date.now() - t < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch (e) {
    return false;
  }
};

export default function NewsletterPrompt({ user }) {
  const [state, setState] = useState("hidden"); // hidden | ask | saving | done | error
  const key = user?.id ? `sendme_newsletter_prompt_dismissed_${user.id}` : null;

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user?.id || !key) return;
      if (readDismissed(key)) return;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("newsletter_optin")
          .eq("id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled && data && !data.newsletter_optin) setState("ask");
      } catch (e) {
        console.error("NewsletterPrompt check failed:", e);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [user?.id, key]);

  const subscribe = async () => {
    setState("saving");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ newsletter_optin: true })
        .eq("id", user.id);
      if (error) throw error;
      setState("done");
      setTimeout(() => setState("hidden"), 4000);
    } catch (e) {
      console.error("NewsletterPrompt subscribe failed:", e);
      setState("error");
    }
  };

  const dismiss = () => {
    try { localStorage.setItem(key, String(Date.now())); } catch (e) { /* ignore */ }
    setState("hidden");
  };

  if (state === "hidden") return null;

  const box = {
    background: "rgba(91,156,246,0.07)",
    border: "1px solid rgba(91,156,246,0.25)",
    borderRadius: 14,
    padding: "14px 18px",
    marginBottom: 16,
    fontFamily: "Georgia, serif",
  };

  if (state === "done") {
    return (
      <div style={{ ...box, background: "rgba(62,207,142,0.08)", border: "1px solid rgba(62,207,142,0.25)", color: "#3ecf8e", fontSize: 14 }}>
        ✓ You're subscribed. Look out for the SendMe newsletter once a month. You can change this any time in your profile.
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#5b9cf6", marginBottom: 4 }}>📬 Get the monthly SendMe newsletter</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 12 }}>
        How much was raised, missions completed, and testimonies from the field — once a month. You can unsubscribe any time in your profile.
      </div>
      {state === "error" && (
        <div style={{ fontSize: 12, color: "#f05252", marginBottom: 10 }}>⚠ Couldn't save that. Please try again.</div>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={subscribe}
          disabled={state === "saving"}
          style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#e8b34b,#c8942b)", color: "#000", fontWeight: 700, fontSize: 13, fontFamily: "Georgia, serif", cursor: state === "saving" ? "default" : "pointer", opacity: state === "saving" ? 0.7 : 1 }}
        >
          {state === "saving" ? "Saving..." : "Yes, subscribe"}
        </button>
        <button
          onClick={dismiss}
          disabled={state === "saving"}
          style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.5)", fontWeight: 600, fontSize: 13, fontFamily: "Georgia, serif", cursor: "pointer" }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
