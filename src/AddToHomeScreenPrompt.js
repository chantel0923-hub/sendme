// AddToHomeScreenPrompt.js — Nudges people to save SendMe to their home
// screen. Built specifically because a WhatsApp-shared link is easy to
// open once and never find again — this is the fix for that.
//
// Doesn't depend on a registered service worker (deliberately, after the
// freeze that came from one) — works two ways instead:
//   1. Android/Chrome: opportunistically captures the native
//      `beforeinstallprompt` event if the browser offers it, giving a
//      real one-tap "Install" button.
//   2. Everyone else (iOS Safari always, or Android without a captured
//      prompt): shows clear, platform-specific manual steps.
//
// Dismiss is remembered per session (sessionStorage), not forever — the
// whole point is this keeps gently resurfacing for people who haven't
// actually installed yet, rather than a one-and-done dismiss that could
// permanently lose exactly the person we're trying to retain.
import { useState, useEffect } from "react";

const DISMISS_KEY = "sendme_a2hs_dismissed_session";

function detectPlatform() {
  const ua = window.navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);
  return { isIOS, isAndroid };
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true // iOS Safari's own flag
  );
}

export default function AddToHomeScreenPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);
  const { isIOS, isAndroid } = detectPlatform();

  useEffect(() => {
    if (isStandalone()) return; // already installed — never nag someone who's already in
    if (sessionStorage.getItem(DISMISS_KEY)) return;
    // Only relevant on phones — "add to home screen" doesn't mean much on desktop
    if (!isIOS && !isAndroid) return;

    setVisible(true);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setInstalling(false);
    setDeferredPrompt(null);
    if (outcome === "accepted") setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      background: "rgba(232,179,75,0.08)", border: "1px solid rgba(232,179,75,0.25)",
      borderRadius: 14, padding: "16px 18px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ fontSize: 22, flexShrink: 0 }}>📲</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e8b34b", marginBottom: 4 }}>
            Save SendMe to your home screen
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, marginBottom: 10 }}>
            {deferredPrompt ? (
              "Install SendMe so it's always one tap away — never lose this link in your chats again."
            ) : isIOS ? (
              <>Tap the <strong>Share</strong> icon <span style={{ fontFamily: "monospace" }}>⬆️</span> at the bottom of Safari, then tap <strong>"Add to Home Screen."</strong></>
            ) : (
              <>Tap the <strong>⋮ menu</strong> in the top corner of Chrome, then tap <strong>"Add to Home screen"</strong> or <strong>"Install app."</strong></>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                disabled={installing}
                style={{
                  padding: "9px 18px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg,#e8b34b,#c8942b)", color: "#000",
                  fontWeight: 700, cursor: installing ? "default" : "pointer",
                  fontSize: 13, fontFamily: "Georgia, serif", opacity: installing ? 0.7 : 1,
                }}
              >
                {installing ? "Installing..." : "Install Now"}
              </button>
            )}
            <button
              onClick={dismiss}
              style={{
                padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent", color: "rgba(255,255,255,0.4)", cursor: "pointer",
                fontSize: 13, fontFamily: "Georgia, serif",
              }}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
