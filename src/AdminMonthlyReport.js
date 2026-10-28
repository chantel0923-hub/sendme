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

export default function AdminMonthlyReport({ onBack, user }) {
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, -1 = last month, etc.
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  // Newsletter — admin's own words go at the top, same philosophy as the
  // existing WhatsApp report draft ("copy it, then add your own words").
  const [personalMessage, setPersonalMessage] = useState("");
  const [newsletterSubject, setNewsletterSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [sendError, setSendError] = useState("");

  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const rangeStart = new Date(target.getFullYear(), target.getMonth(), 1).toISOString();
  const rangeEnd   = new Date(target.getFullYear(), target.getMonth() + 1, 1).toISOString();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [missionsApproved, missionsCompleted, donations, emergenciesApproved, churchesVerified, optedInCount] = await Promise.all([
          supabase.from("missions").select("id, title, country, goal").eq("status", "active").gte("reviewed_at", rangeStart).lt("reviewed_at", rangeEnd),
          supabase.from("missions").select("id, title, country").eq("status", "complete").gte("reviewed_at", rangeStart).lt("reviewed_at", rangeEnd),
          supabase.from("donations").select("amount, kind, status").gte("created_at", rangeStart).lt("created_at", rangeEnd).in("status", ["complete", "completed"]),   // the Paystack webhook writes "complete"
          supabase.from("emergency_requests").select("id, title, country").eq("status", "active").gte("reviewed_at", rangeStart).lt("reviewed_at", rangeEnd),
          supabase.from("churches").select("id, name, country").eq("verified", true).gte("created_at", rangeStart).lt("created_at", rangeEnd),
          // Newsletter recipient count — shown before sending so admin knows
          // how many people will actually receive it.
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("newsletter_optin", true),
        ]);

        // Bank-transfer (EFT) gifts live in their own table and only count once the admin has pressed
        // "Money arrived" — they are never also in `donations`, so adding them here cannot double count.
        // If that table can't be read, the report still works with card gifts alone.
        let eftRows = [];
        try {
          const eft = await supabase.from("eft_donations").select("confirmed_amount_usd, kind")
            .eq("status", "confirmed").gte("confirmed_at", rangeStart).lt("confirmed_at", rangeEnd);
          if (!eft.error) eftRows = (eft.data || []).map(r => ({ amount: r.confirmed_amount_usd, kind: r.kind }));
        } catch (_e) { /* ignore */ }
        const donationRows = [...(donations.data || []), ...eftRows];
        const totalRaised = donationRows.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
        const missionDonations = donationRows.filter(d => d.kind !== "emergency").length;
        const emergencyDonations = donationRows.filter(d => d.kind === "emergency").length;

        const completedMissions = missionsCompleted.data || [];
        // Testimony content for this month's completed missions — pulled
        // fresh here rather than assumed, so the newsletter shows real
        // stories, not just numbers. Missing quietly if a mission has no
        // testimony_extras row yet (not every completed mission has one).
        let testimonies = [];
        if (completedMissions.length > 0) {
          const { data: extras } = await supabase
            .from("testimony_extras")
            .select("mission_id, story, before_text, after_text")
            .in("mission_id", completedMissions.map(m => m.id));
          testimonies = (extras || [])
            .map(e => ({ ...e, mission: completedMissions.find(m => m.id === e.mission_id) }))
            .filter(t => t.mission && (t.story || t.before_text || t.after_text));
        }

        // "Fruit that remains": missions completed, souls reached, Bibles-Message Books given out and churches
        // planted — for this month and in total. Souls / books / churches are added up the same way as on the
        // Testimonies page: a published admin testimony linked to a completed mission replaces that mission's own
        // figures, and published testimonies not linked to a completed mission add their own on top.
        let fruit = null;
        try {
          const [allDone, adm] = await Promise.all([
            supabase.from("missions").select("id, souls, bibles, churches_planted").eq("status", "complete"),
            supabase.from("admin_testimonies").select("id, mission_id, souls, bibles, churches").eq("published", true).order("created_at", { ascending: false }),
          ]);
          if (!allDone.error) {
            const adminRows = adm.error ? [] : (adm.data || []);
            const enrichFor = {};
            adminRows.forEach(a => { if (a.mission_id && !enrichFor[a.mission_id]) enrichFor[a.mission_id] = a; });
            const used = new Set();
            const missionFigures = (allDone.data || []).map(m => {
              const a = enrichFor[m.id];
              if (a) used.add(a.id);
              return { id: m.id, souls: a?.souls ?? m.souls ?? 0, bibles: a?.bibles ?? m.bibles ?? 0, churches: a?.churches ?? m.churches_planted ?? 0 };
            });
            const standAlone = adminRows.filter(a => !used.has(a.id)).map(a => ({ souls: a.souls || 0, bibles: a.bibles || 0, churches: a.churches || 0 }));
            const add = (list, k) => list.reduce((sum, r) => sum + (Number(r[k]) || 0), 0);
            const monthIds = new Set(completedMissions.map(m => m.id));
            const monthFigures = missionFigures.filter(r => monthIds.has(r.id));
            fruit = {
              month: { missions: completedMissions.length, souls: add(monthFigures, "souls"), bibles: add(monthFigures, "bibles"), churches: add(monthFigures, "churches") },
              total: { missions: missionFigures.length, souls: add([...missionFigures, ...standAlone], "souls"), bibles: add([...missionFigures, ...standAlone], "bibles"), churches: add([...missionFigures, ...standAlone], "churches") },
            };
          }
        } catch (_e) { /* the report still works without these figures */ }

        setStats({
          fruit,
          missionsApproved: missionsApproved.data || [],
          missionsCompleted: completedMissions,
          emergenciesApproved: emergenciesApproved.data || [],
          churchesVerified: churchesVerified.data || [],
          totalRaised,
          donationCount: donationRows.length,
          missionDonations,
          emergencyDonations,
          testimonies,
          optedInCount: optedInCount.count || 0,
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

  useEffect(() => {
    setNewsletterSubject(`SendMe Monthly Update — ${monthLabel(target)}`);
    setSendResult(null);
    setSendError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOffset]);

  const buildReportText = () => {
    if (!stats) return "";
    const siteUrl = "https://sendmeglobalmission.org";
    const lines = [
      `✝ SENDME MONTHLY REPORT — ${monthLabel(target).toUpperCase()}`,
      "",
      `💰 Total raised: $${fmt(stats.totalRaised)} across ${stats.donationCount} gift${stats.donationCount !== 1 ? "s" : ""}`,
      "",
      `🌍 Missions approved this month (${stats.missionsApproved.length}):`,
      ...stats.missionsApproved.map(m => `  • ${m.title} — ${m.country}\n    ${siteUrl}/mission/${m.id}`),
      "",
      `🎉 Missions completed this month (${stats.missionsCompleted.length}):`,
      ...stats.missionsCompleted.map(m => `  • ${m.title} — ${m.country}\n    ${siteUrl}/mission/${m.id}`),
      "",
      `🚨 Emergency needs approved this month (${stats.emergenciesApproved.length}):`,
      ...stats.emergenciesApproved.map(e => `  • ${e.title} — ${e.country}`),
      "",
      `⛪ Churches verified this month (${stats.churchesVerified.length}):`,
      ...stats.churchesVerified.map(c => `  • ${c.name} — ${c.country}`),
      "",
      ...(stats.fruit ? [
        `🌱 FRUIT THAT REMAINS`,
        `This month — ${stats.fruit.month.missions} mission${stats.fruit.month.missions !== 1 ? "s" : ""} completed:`,
        `  🙏 ${fmt(stats.fruit.month.souls)} souls reached`,
        `  📖 ${fmt(stats.fruit.month.bibles)} Bibles-Message Books given out`,
        `  ⛪ ${fmt(stats.fruit.month.churches)} church${stats.fruit.month.churches !== 1 ? "es" : ""} planted`,
        `So far in total — ${stats.fruit.total.missions} mission${stats.fruit.total.missions !== 1 ? "s" : ""} completed:`,
        `  🙏 ${fmt(stats.fruit.total.souls)} souls reached`,
        `  📖 ${fmt(stats.fruit.total.bibles)} Bibles-Message Books given out`,
        `  ⛪ ${fmt(stats.fruit.total.churches)} church${stats.fruit.total.churches !== 1 ? "es" : ""} planted`,
        "",
      ] : []),
      `📖 See these testimonies and more, and give toward what God is doing:`,
      `${siteUrl}/testimonies`,
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

  // Builds the actual email HTML donors receive — same dark navy/gold shell
  // as every other SendMe email (see send-notification's wrapEmail), built
  // with tables + bgcolor rather than div backgrounds so it survives
  // Outlook's rendering engine same as those templates.
  const buildNewsletterHtml = () => {
    if (!stats) return "";
    const siteUrl = "https://sendmeglobalmission.org";
    const esc = (s) => String(s || "").replace(/</g, "&lt;");

    const missionRows = stats.missionsCompleted.length > 0
      ? stats.missionsCompleted.map(m => `<li style="margin-bottom:6px;">${esc(m.title)} — ${esc(m.country)}</li>`).join("")
      : `<li style="color:rgba(255,255,255,0.4);">No missions completed this month.</li>`;

    const testimonyBlocks = stats.testimonies.length > 0
      ? stats.testimonies.map(t => `
          <div style="background:rgba(232,179,75,0.06);border:1px solid rgba(232,179,75,0.2);border-radius:12px;padding:16px 18px;margin-bottom:14px;">
            <div style="font-size:14px;font-weight:700;color:#e8b34b;margin-bottom:8px;">${esc(t.mission.title)} — ${esc(t.mission.country)}</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.65);line-height:1.7;">${esc(t.story || t.after_text || t.before_text)}</div>
          </div>`).join("")
      : "";

    return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#060c18" style="background:#060c18;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#0c1628" style="max-width:600px;width:100%;background:#0c1628;border:1px solid #1c2942;">
          <tr>
            <td align="center" bgcolor="#09111f" style="background:#09111f;padding:28px 32px;border-bottom:1px solid #1c2942;">
              <span style="font-family:Georgia,serif;font-size:28px;font-weight:800;color:#ffffff;">Send<span style="color:#e8b34b;">Me</span></span><br/>
              <span style="font-family:Georgia,serif;font-size:10px;color:#8a94ab;letter-spacing:3px;">GLOBAL MISSION FUND — ${monthLabel(target).toUpperCase()}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font-family:Georgia,serif;">
              ${personalMessage.trim() ? `<div style="font-size:14px;color:#eef1ff;line-height:1.8;margin-bottom:24px;white-space:pre-wrap;">${esc(personalMessage)}</div>` : ""}

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="50%" align="center" bgcolor="rgba(255,255,255,0.03)" style="padding:14px 8px;border:1px solid rgba(255,255,255,0.08);">
                    <div style="font-size:20px;font-weight:700;color:#3ecf8e;">$${fmt(stats.totalRaised)}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px;">Raised this month</div>
                  </td>
                  <td width="50%" align="center" bgcolor="rgba(255,255,255,0.03)" style="padding:14px 8px;border:1px solid rgba(255,255,255,0.08);">
                    <div style="font-size:20px;font-weight:700;color:#e8b34b;">${stats.missionsCompleted.length}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px;">Missions completed</div>
                  </td>
                </tr>
              </table>

              <div style="font-size:16px;font-weight:700;color:#eef1ff;margin-bottom:12px;">Missions Completed This Month</div>
              <ul style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.8;padding-left:20px;margin:0 0 24px;">${missionRows}</ul>

              ${stats.fruit ? `
              <div style="font-size:16px;font-weight:700;color:#eef1ff;margin-bottom:12px;">Fruit That Remains</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="25%" align="center" style="padding:12px 4px;border:1px solid rgba(255,255,255,0.08);"><div style="font-size:20px;font-weight:700;color:#3ecf8e;">${stats.fruit.total.missions}</div><div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px;">Missions completed</div></td>
                  <td width="25%" align="center" style="padding:12px 4px;border:1px solid rgba(255,255,255,0.08);"><div style="font-size:20px;font-weight:700;color:#e8b34b;">${fmt(stats.fruit.total.souls)}</div><div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px;">Souls reached</div></td>
                  <td width="25%" align="center" style="padding:12px 4px;border:1px solid rgba(255,255,255,0.08);"><div style="font-size:20px;font-weight:700;color:#5b9cf6;">${fmt(stats.fruit.total.bibles)}</div><div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px;">Bibles-Message Books given out</div></td>
                  <td width="25%" align="center" style="padding:12px 4px;border:1px solid rgba(255,255,255,0.08);"><div style="font-size:20px;font-weight:700;color:#3ecf8e;">${fmt(stats.fruit.total.churches)}</div><div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px;">Churches planted</div></td>
                </tr>
              </table>
              <div style="font-size:12px;color:rgba(255,255,255,0.45);margin:-12px 0 24px;text-align:center;">This month: ${fmt(stats.fruit.month.souls)} souls · ${fmt(stats.fruit.month.bibles)} books · ${fmt(stats.fruit.month.churches)} church${stats.fruit.month.churches !== 1 ? "es" : ""} planted</div>` : ""}

              ${testimonyBlocks ? `<div style="font-size:16px;font-weight:700;color:#eef1ff;margin-bottom:12px;">Testimonies</div>${testimonyBlocks}` : ""}

              <div style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.7;margin-top:16px;">
                Thank you for standing with the work God is doing through SendMe. Every gift — large or small — is part of someone's "Here am I, send me."
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#0c1628" style="padding:20px 32px;border-top:1px solid #1c2942;font-family:Georgia,serif;">
              <a href="${siteUrl}/testimonies" style="display:inline-block;padding:12px 28px;background:#e8b34b;border-radius:10px;color:#000;text-decoration:none;font-weight:700;font-size:13px;margin-bottom:14px;">See More Testimonies & Give</a><br/>
              <span style="font-size:12px;color:#e8b34b;font-style:italic;">"Here am I Lord, send me." — Isaiah 6:8</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>`;
  };

  const sendNewsletter = async () => {
    if (!stats || stats.optedInCount === 0) return;
    const ok = window.confirm(
      `This will send this newsletter to ${stats.optedInCount} donor${stats.optedInCount !== 1 ? "s" : ""} who've opted in.\n\n` +
      `This cannot be undone once sent. Have you reviewed the content below?`
    );
    if (!ok) return;
    setSending(true);
    setSendResult(null);
    setSendError("");
    try {
      const { data, error } = await supabase.functions.invoke("send-newsletter", {
        body: { subject: newsletterSubject, html: buildNewsletterHtml(), sentBy: user?.id || null },
      });
      if (error) throw error;
      setSendResult(data);
    } catch (e) {
      setSendError("Could not send newsletter. (" + (e.message || "") + ")");
    }
    setSending(false);
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

            {/* ── Monthly Newsletter ─────────────────────────────────────── */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "36px 0 28px" }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: "#eef1ff", marginBottom: 4 }}>📧 Monthly Newsletter</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 18 }}>
              Emails this month's update to every donor who's opted in — {stats.optedInCount} right now.
            </div>

            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Subject line</div>
            <input value={newsletterSubject} onChange={e => setNewsletterSubject(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#eef1ff", fontSize: 14, fontFamily: "Georgia, serif", outline: "none", boxSizing: "border-box", marginBottom: 14 }} />

            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Your personal message <span style={{ color: "rgba(255,255,255,0.2)" }}>(optional — appears at the top, above the stats)</span></div>
            <textarea value={personalMessage} onChange={e => setPersonalMessage(e.target.value)}
              placeholder="A few words from you this month — what stood out, what to pray for, what's coming next..."
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#eef1ff", fontSize: 14, fontFamily: "Georgia, serif", outline: "none", resize: "vertical", minHeight: 90, boxSizing: "border-box", marginBottom: 16 }} />

            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Preview</div>
            <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 20 }}>
              <iframe title="newsletter-preview" srcDoc={buildNewsletterHtml()} style={{ width: "100%", height: 480, border: "none", background: "#060c18" }} />
            </div>

            {stats.optedInCount === 0 ? (
              <div style={{ background: "rgba(232,179,75,0.06)", border: "1px solid rgba(232,179,75,0.2)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                No one has opted in to the newsletter yet — nothing to send.
              </div>
            ) : (
              <>
                <button onClick={sendNewsletter} disabled={sending}
                  style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: sending ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#3ecf8e,#2aaf74)", color: sending ? "rgba(255,255,255,0.3)" : "#000", fontWeight: 700, cursor: sending ? "default" : "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>
                  {sending ? "Sending..." : `📧 Send to ${stats.optedInCount} Donor${stats.optedInCount !== 1 ? "s" : ""}`}
                </button>
                {sendError && (
                  <div style={{ background: "rgba(232,91,91,0.1)", border: "1px solid rgba(232,91,91,0.3)", borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: 13, color: "#e85b5b" }}>
                    {sendError}
                  </div>
                )}
                {sendResult && (
                  <div style={{ background: "rgba(62,207,142,0.08)", border: "1px solid rgba(62,207,142,0.25)", borderRadius: 10, padding: "12px 16px", marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
                    ✓ {sendResult.message}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
