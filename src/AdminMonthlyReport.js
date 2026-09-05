// AdminMonthlyReport.js
// Pulls together the raw numbers for a given month — missions approved,
// funds raised, emergencies resolved, churches verified — so admin can
// write the actual testimony/report narrative around real data instead of
// digging through Supabase by hand. This screen gathers facts; the story
// and voice stay entirely with whoever writes the report.
import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const fmt = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const monthLabel = (d) => d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

export default function AdminMonthlyReport({ onBack }) {
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, -1 = last month, etc.
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);

  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const rangeStart = new Date(target.getFullYear(), target.getMonth(), 1).toISOString();
  const rangeEnd   = new Date(target.getFullYear(), target.getMonth() + 1, 1).toISOString();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [missionsApproved, missionsCompleted, donations, emergenciesApproved, churchesVerified] = await Promise.all([
          supabase.from("missions").select("id, title, country, goal").eq("status", "active").gte("reviewed_at", rangeStart).lt("reviewed_at", rangeEnd),
          supabase.from("missions").select("id, title, country").eq("status", "complete").gte("reviewed_at", rangeStart).lt("reviewed_at", rangeEnd),
          supabase.from("donations").select("amount, kind, status").gte("created_at", rangeStart).lt("created_at", rangeEnd).eq("status", "completed"),
          supabase.from("emergency_requests").select("id, title, country").eq("status", "active").gte("reviewed_at", rangeStart).lt("reviewed_at", rangeEnd),
          supabase.from("churches").select("id, name, country").eq("verified", true).gte("created_at", rangeStart).lt("created_at", rangeEnd),
        ]);

        const donationRows = donations.data || [];
        const totalRaised = donationRows.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
        const missionDonations = donationRows.filter(d => d.kind !== "emergency").length;
        const emergencyDonations = donationRows.filter(d => d.kind === "emergency").length;

        setStats({
          missionsApproved: missionsApproved.data || [],
          missionsCompleted: missionsCompleted.data || [],
          emergenciesApproved: emergenciesApproved.data || [],
          churchesVerified: churchesVerified.data || [],
          totalRaised,
          donationCount: donationRows.length,
          missionDonations,
          emergencyDonations,
        });
      } catch (e) {
        console.error("AdminMonthlyReport fetch error:", e);
        setStats(null);
      }
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOffset]);

  const buildReportText = () => {
    if (!stats) return "";
    const lines = [
      `✝ SENDME MONTHLY REPORT — ${monthLabel(target).toUpperCase()}`,
      "",
      `💰 Total raised: $${fmt(stats.totalRaised)} across ${stats.donationCount} gift${stats.donationCount !== 1 ? "s" : ""}`,
      "",
      `🌍 Missions approved this month (${stats.missionsApproved.length}):`,
      ...stats.missionsApproved.map(m => `  • ${m.title} — ${m.country}`),
      "",
      `🎉 Missions completed this month (${stats.missionsCompleted.length}):`,
      ...stats.missionsCompleted.map(m => `  • ${m.title} — ${m.country}`),
      "",
      `🚨 Emergency needs approved this month (${stats.emergenciesApproved.length}):`,
      ...stats.emergenciesApproved.map(e => `  • ${e.title} — ${e.country}`),
      "",
      `⛪ Churches verified this month (${stats.churchesVerified.length}):`,
      ...stats.churchesVerified.map(c => `  • ${c.name} — ${c.country}`),
      "",
      `"Here am I Lord, send me." — Isaiah 6:8`,
    ];
    return lines.join("\n");
  };

  const copyReport = () => {
    const text = buildReportText();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const StatCard = ({ icon, value, label, color }) => (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", padding: "16px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "#e8b34b", marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>
      <div style={{ background: "#09111f", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>📊 Monthly Report</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>RAW DATA FOR YOUR TESTIMONY REPORT</div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px 60px" }}>

        {/* Month picker */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 24 }}>
          <button onClick={() => setMonthOffset(o => o - 1)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 14px", color: "#eef1ff", cursor: "pointer", fontSize: 16 }}>←</button>
          <div style={{ fontSize: 16, fontWeight: 700, minWidth: 180, textAlign: "center" }}>{monthLabel(target)}</div>
          <button onClick={() => setMonthOffset(o => Math.min(0, o + 1))} disabled={monthOffset === 0} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 14px", color: monthOffset === 0 ? "rgba(255,255,255,0.2)" : "#eef1ff", cursor: monthOffset === 0 ? "default" : "pointer", fontSize: 16 }}>→</button>
        </div>

        {loading && <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)" }}>Loading...</div>}

        {!loading && stats && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
              <StatCard icon="💰" value={`$${fmt(stats.totalRaised)}`} label={`Raised (${stats.donationCount} gifts)`} color="#3ecf8e" />
              <StatCard icon="🌍" value={stats.missionsApproved.length} label="Missions approved" />
              <StatCard icon="🎉" value={stats.missionsCompleted.length} label="Missions completed" />
              <StatCard icon="🚨" value={stats.emergenciesApproved.length} label="Emergencies approved" />
              <StatCard icon="⛪" value={stats.churchesVerified.length} label="Churches verified" />
              <StatCard icon="🤝" value={stats.missionDonations + stats.emergencyDonations} label="Total gifts given" />
            </div>

            <div style={{ background: "rgba(232,179,75,0.06)", borderRadius: 14, border: "1px solid rgba(232,179,75,0.2)", padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
                This is the raw data for {monthLabel(target)} — copy it below as a starting point, then add your own words, testimonies, and photos before posting to the WhatsApp group.
              </div>
            </div>

            <button onClick={copyReport} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: copied ? "rgba(62,207,142,0.15)" : "linear-gradient(135deg,#e8b34b,#c8942b)", color: copied ? "#3ecf8e" : "#000", fontWeight: 700, cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif", marginBottom: 24 }}>
              {copied ? "✓ Copied — paste into WhatsApp" : "📋 Copy Report Draft"}
            </button>

            <div style={{ background: "#0c1628", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", padding: "16px 18px", whiteSpace: "pre-wrap", fontSize: 12.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, fontFamily: "monospace" }}>
              {buildReportText()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
