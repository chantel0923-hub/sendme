// WelcomeScreen.js — Shown exactly once, right after a user's first login
// following registration. Explains what SendMe does and plays the Vision &
// Mission video front and center. Dismissing it (or navigating away) marks
// profiles.has_seen_welcome = true, so it never shows again for that account.
import { useState } from "react";
import { supabase } from "./supabase";
import YouTubeEmbed from "./YouTubeEmbed";
import { FEATURED_VIDEOS } from "./sendmeVideos";

export default function WelcomeScreen({ user, onContinue }) {
  const [saving, setSaving] = useState(false);
  // WhatsApp Notification Group opt-in — captures consent + number here so
  // admin can manually add the person to the group (WhatsApp itself has no
  // API for programmatically adding members to a group, so this is the
  // consent-collection half of that flow, not an automatic add).
  const [joinGroup, setJoinGroup] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");

  const handleContinue = async () => {
    setSaving(true);
    try {
      if (user?.id) {
        const { error } = await supabase
          .from("profiles")
          .update({
            has_seen_welcome: true,
            whatsapp_group_optin: joinGroup,
            whatsapp_number: joinGroup ? (whatsappNumber || null) : null,
          })
          .eq("id", user.id);
        // Same rule as everywhere else in this app: Supabase's JS client
        // does NOT throw on a failed update, so this must be checked
        // explicitly — otherwise a blocked write here would silently show
        // this same welcome screen again on every future login.
        if (error) console.error("WelcomeScreen: failed to mark has_seen_welcome", error);
      }
    } catch (e) {
      console.error("WelcomeScreen: has_seen_welcome update threw", e);
    }
    setSaving(false);
    onContinue();
  };

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "";
  const canContinue = !joinGroup || whatsappNumber.trim().length >= 7;

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px 60px", textAlign: "center" }}>

        <div style={{ fontSize: 34, marginBottom: 10 }}>✝</div>
        <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
          Welcome{firstName ? `, ${firstName}` : ""} — you're in.
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, maxWidth: 520, margin: "0 auto 32px" }}>
          Before you dive in, take two minutes to see why SendMe exists, and
          what we're believing God to do together.
        </div>

        {FEATURED_VIDEOS.missionVision && (
          <div style={{ marginBottom: 28, textAlign: "left" }}>
            <YouTubeEmbed
              videoId={FEATURED_VIDEOS.missionVision}
              title="SendMe — Vision & Mission"
              autoplay
            />
          </div>
        )}

        <div style={{ background: "rgba(232,179,75,0.06)", border: "1px solid rgba(232,179,75,0.2)", borderRadius: 16, padding: "20px 22px", marginBottom: 20, textAlign: "left" }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.8 }}>
            SendMe connects Message-believing missionaries, churches, and
            donors around one simple conviction: give directly, give with
            accountability, and see exactly where every offering goes. Every
            mission is endorsed by a verified church, funded in milestones,
            and held in escrow until the work is proven — a partnership,
            not a donation into the dark.
          </div>
        </div>

        {/* WhatsApp Notification Group opt-in — admin manually adds numbers
            to the group afterward (see the note below); WhatsApp doesn't
            allow apps to add members automatically. */}
        <div style={{ background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.2)", borderRadius: 16, padding: "18px 20px", marginBottom: 32, textAlign: "left" }}>
          <div
            onClick={() => setJoinGroup(j => !j)}
            style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
              background: joinGroup ? "linear-gradient(135deg,#25d366,#1da851)" : "rgba(255,255,255,0.05)",
              border: joinGroup ? "none" : "1px solid rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, color: "#000", fontWeight: 700,
            }}>
              {joinGroup ? "✓" : ""}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#eef1ff", marginBottom: 3 }}>
                📲 Join the SendMe Global Mission Fund Notification group
              </div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.65 }}>
                Get every approved mission, emergency need, and helper request posted straight to a WhatsApp group — plus monthly reports and testimonies from the field.
              </div>
            </div>
          </div>
          {joinGroup && (
            <div style={{ marginTop: 14, marginLeft: 34 }}>
              <input
                type="tel"
                placeholder="Your WhatsApp number (e.g. +27 82 123 4567)"
                value={whatsappNumber}
                onChange={e => setWhatsappNumber(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10, boxSizing: "border-box",
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                  color: "#eef1ff", fontSize: 13, fontFamily: "Georgia, serif", outline: "none",
                }}
              />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 6, lineHeight: 1.5 }}>
                SendMe admin will add this number to the group directly — WhatsApp doesn't allow apps to do this automatically. You can leave the group at any time.
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleContinue}
          disabled={saving || !canContinue}
          style={{
            padding: "14px 36px", borderRadius: 14, border: "none",
            background: "linear-gradient(135deg,#e8b34b,#c8942b)", color: "#000",
            fontWeight: 700, cursor: (saving || !canContinue) ? "default" : "pointer",
            fontSize: 15, fontFamily: "Georgia, serif",
            boxShadow: "0 6px 24px rgba(232,179,75,0.4)",
            opacity: (saving || !canContinue) ? 0.7 : 1,
          }}
        >
          {saving ? "One moment..." : !canContinue ? "Enter your WhatsApp number above" : "Continue to SendMe →"}
        </button>

        <div style={{ marginTop: 32, fontSize: 13, color: "#e8b34b", fontStyle: "italic" }}>
          "Here am I Lord, send me." — Isaiah 6:8
        </div>
      </div>
    </div>
  );
}
