// AdminPastors.js
// Admin-only. A compact list of every pastor / organization leader who has
// registered a church or organization on SendMe. Tap a row to open everything
// we hold about them: what they saved on My Church, their account, their
// references, verification status, and activity. Read-only — verifying or
// rejecting still happens on the Verify Churches screen.
//
// Data comes from `churches` (one row per registered church/organization,
// linked to the pastor's login by user_id), plus `profiles` for the account
// details. Banking is shown only as "on file: yes/no" — never the details.
import { useState, useEffect } from "react";
import { supabase } from "./supabase";

// Fetches rows whose `col` is in `ids`, in chunks so the request URL stays short.
// Failures return what was gathered so far — extras (banking, missions) are
// best-effort and must never stop the list from loading.
const fetchIn = async (table, select, col, ids) => {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    try {
      const { data, error } = await supabase.from(table).select(select).in(col, ids.slice(i, i + 100));
      if (error) throw error;
      out.push(...(data || []));
    } catch (e) {
      console.warn(`AdminPastors: could not read ${table}`, e);
      return { rows: out, ok: false };
    }
  }
  return { rows: out, ok: true };
};

// Digits for a wa.me link, or "" if the contact isn't a usable international number.
const waDigits = (contact, country) => {
  const raw = String(contact || "").trim();
  if (!raw || raw.includes("@")) return "";
  const d = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return d.length >= 8 && d.length <= 15 ? d : "";
  if (d.startsWith("00")) return d.length >= 10 ? d.slice(2) : "";
  if (d.startsWith("0") && d.length === 10 && /south africa/i.test(country || "")) return "27" + d.slice(1);
  return "";
};

// What a reference answered when the admin messaged them (set on Verify Churches)
const refTag = (status) =>
  status === "confirmed" ? <span style={{ marginLeft: 8, fontWeight: 700, color: "#3ecf8e" }}>✓ Confirmed</span>
  : status === "declined" ? <span style={{ marginLeft: 8, fontWeight: 700, color: "#e85b5b" }}>✗ Declined</span>
  : null;

const day = (iso) => (iso ? String(iso).slice(0, 10) : "—");
const yn = (v) => (v ? "Yes" : "No");
const pretty = (k) => k.replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase());

// Columns already shown in the sections below (or not useful to read) — anything
// else with a value is listed under "Other saved details" so nothing is hidden.
const SHOWN_KEYS = new Set([
  "id", "user_id", "name", "street", "city", "province", "country", "phone", "email", "size", "website",
  "pastor_name", "pastor_email", "pastor_phone", "can_endorse", "show_phone_public",
  "reference_1_name", "reference_1_contact", "reference_2_name", "reference_2_contact",
  "reference_1_status", "reference_2_status",
  "verified", "rejected", "rejection_reason", "created_at", "lat", "lng", "entity_type",
]);

export default function AdminPastors({ onBack }) {
  const [rows, setRows] = useState([]);
  const [profiles, setProfiles] = useState({});   // user_id -> profile
  const [bankingIds, setBankingIds] = useState(null); // Set of church ids with banking, or null if unknown
  const [missionCounts, setMissionCounts] = useState(null); // church_id -> { total, active }, or null if unknown
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data, error: err } = await supabase
          .from("churches")
          .select("*")
          .order("created_at", { ascending: false });
        if (err) throw err;
        const list = data || [];
        setRows(list);

        const userIds = [...new Set(list.map(c => c.user_id).filter(Boolean))];
        const churchIds = list.map(c => c.id);

        const [prof, bank, miss] = await Promise.all([
          fetchIn("profiles", "id, full_name, email, role, created_at, whatsapp_number, whatsapp_group_optin, newsletter_optin, blocked_from_applying", "id", userIds),
          fetchIn("payout_details", "church_id", "church_id", churchIds),
          fetchIn("missions", "id, church_id, status", "church_id", churchIds),
        ]);
        const pmap = {};
        prof.rows.forEach(p => { pmap[p.id] = p; });
        setProfiles(pmap);
        setBankingIds(bank.ok ? new Set(bank.rows.map(b => b.church_id)) : null);
        if (miss.ok) {
          const counts = {};
          miss.rows.forEach(m => {
            const c = counts[m.church_id] || (counts[m.church_id] = { total: 0, active: 0 });
            c.total += 1;
            if (m.status === "active") c.active += 1;
          });
          setMissionCounts(counts);
        } else {
          setMissionCounts(null);
        }
      } catch (e) {
        console.error("AdminPastors load error:", e);
        setError("Could not load pastors. (" + (e.message || "") + ")");
      }
      setLoading(false);
    };
    load();
  }, []);

  const statusOf = (c) => (c.rejected ? "rejected" : c.verified ? "verified" : "pending");

  const filtered = rows.filter(c => {
    const st = statusOf(c);
    if (filter === "verified" && st !== "verified") return false;
    if (filter === "pending" && st !== "pending") return false;
    if (filter === "rejected" && st !== "rejected") return false;
    if (filter === "church" && c.entity_type === "organization") return false;
    if (filter === "organization" && c.entity_type !== "organization") return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const p = profiles[c.user_id] || {};
    return [c.pastor_name, c.name, c.city, c.country, c.province, c.pastor_phone, c.pastor_email, p.full_name, p.email]
      .some(v => String(v || "").toLowerCase().includes(q));
  });

  const badge = (st) => ({
    verified: { t: "✓ Verified", c: "#3ecf8e", bg: "rgba(62,207,142,0.12)", bd: "rgba(62,207,142,0.3)" },
    pending:  { t: "Pending",    c: "#e8b34b", bg: "rgba(232,179,75,0.12)", bd: "rgba(232,179,75,0.3)" },
    rejected: { t: "✗ Rejected", c: "#e85b5b", bg: "rgba(232,91,91,0.12)",  bd: "rgba(232,91,91,0.3)" },
  }[st]);

  const chip = (active) => ({
    padding: "7px 14px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "Georgia, serif",
    border: `1px solid ${active ? "#e8b34b" : "rgba(255,255,255,0.12)"}`,
    background: active ? "rgba(232,179,75,0.15)" : "rgba(255,255,255,0.03)",
    color: active ? "#e8b34b" : "rgba(255,255,255,0.55)",
  });

  const Field = ({ label, value, children }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
      <span style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#eef1ff", textAlign: "right", wordBreak: "break-word" }}>{children || value || "—"}</span>
    </div>
  );

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: "#e8b34b", marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );

  const chatLink = (contact, country, label) => {
    const d = waDigits(contact, country);
    if (!d) return null;
    return (
      <a href={`https://wa.me/${d}`} target="_blank" rel="noopener noreferrer"
        style={{ marginLeft: 8, color: "#25d366", fontWeight: 700, fontSize: 12, textDecoration: "none" }}>
        💬 {label || "WhatsApp"}
      </a>
    );
  };

  const renderDetail = (c) => {
    const p = profiles[c.user_id] || null;
    const isOrg = c.entity_type === "organization";
    const mc = missionCounts ? (missionCounts[c.id] || { total: 0, active: 0 }) : null;
    const others = Object.entries(c).filter(([k, v]) =>
      !SHOWN_KEYS.has(k) && v !== null && v !== undefined && v !== "" && typeof v !== "object"
    );

    return (
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <Section title={isOrg ? "Organization leader" : "Pastor"}>
          <Field label="Name" value={c.pastor_name} />
          <Field label="Email" value={c.pastor_email} />
          <Field label="Phone">
            {c.pastor_phone ? <>{c.pastor_phone}{chatLink(c.pastor_phone, c.country)}</> : "—"}
          </Field>
        </Section>

        <Section title={isOrg ? "Organization" : "Church"}>
          <Field label="Name" value={c.name} />
          <Field label="Type" value={isOrg ? "Organization" : "Church"} />
          <Field label="Street" value={c.street} />
          <Field label="City" value={c.city} />
          <Field label="Province / State" value={c.province} />
          <Field label="Country" value={c.country} />
          <Field label="Phone">
            {c.phone ? <>{c.phone}{chatLink(c.phone, c.country)}</> : "—"}
          </Field>
          <Field label="Email" value={c.email} />
          <Field label="Website" value={c.website} />
          <Field label={isOrg ? "Team size" : "Congregation size"} value={c.size} />
          <Field label="Phone shown publicly" value={yn(c.show_phone_public)} />
          <Field label="Can endorse missionaries" value={yn(c.can_endorse)} />
        </Section>

        <Section title="Verification">
          <Field label="Status" value={statusOf(c) === "verified" ? "Verified" : statusOf(c) === "rejected" ? "Rejected" : "Pending"} />
          {c.rejected && <Field label="Rejection reason" value={c.rejection_reason} />}
          <Field label="Registered" value={day(c.created_at)} />
          <Field label="Map coordinates" value={c.lat != null && c.lng != null ? "Set" : "Missing"} />
        </Section>

        <Section title={isOrg ? "Board member references" : "Pastor references"}>
          <Field label={isOrg ? "Board member 1" : "Reference 1"}>
            {c.reference_1_name ? <>{c.reference_1_name}{c.reference_1_contact ? ` · ${c.reference_1_contact}` : ""}{chatLink(c.reference_1_contact, c.country)}{refTag(c.reference_1_status)}</> : "—"}
          </Field>
          <Field label={isOrg ? "Board member 2" : "Reference 2"}>
            {c.reference_2_name ? <>{c.reference_2_name}{c.reference_2_contact ? ` · ${c.reference_2_contact}` : ""}{chatLink(c.reference_2_contact, c.country)}{refTag(c.reference_2_status)}</> : "—"}
          </Field>
        </Section>

        <Section title="Activity">
          <Field label="Missions endorsed" value={mc ? `${mc.total} (${mc.active} active)` : "—"} />
          <Field label="Banking details on file" value={bankingIds ? yn(bankingIds.has(c.id)) : "—"} />
        </Section>

        <Section title="Login account">
          {p ? (
            <>
              <Field label="Account name" value={p.full_name} />
              <Field label="Login email" value={p.email} />
              <Field label="Role" value={p.role} />
              <Field label="Joined" value={day(p.created_at)} />
              <Field label="WhatsApp number">
                {p.whatsapp_number ? <>{p.whatsapp_number}{chatLink(p.whatsapp_number, c.country)}</> : "—"}
              </Field>
              <Field label="In WhatsApp group list" value={yn(p.whatsapp_group_optin)} />
              <Field label="Newsletter" value={yn(p.newsletter_optin)} />
              {p.blocked_from_applying && <Field label="Blocked from applying" value="Yes" />}
            </>
          ) : (
            <Field label="Account" value="Not linked to a login account" />
          )}
        </Section>

        {others.length > 0 && (
          <Section title="Other saved details">
            {others.map(([k, v]) => (
              <Field key={k} label={pretty(k)} value={typeof v === "boolean" ? yn(v) : String(v)} />
            ))}
          </Section>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>
      <div style={{ background: "#09111f", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>🙏 Pastors</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>
            {loading ? "LOADING" : `${rows.length} REGISTERED · SHOWING ${filtered.length}`}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 60px" }}>
        <input
          placeholder="Search by pastor, church, city, country or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#eef1ff", fontSize: 13, fontFamily: "Georgia, serif", outline: "none", marginBottom: 14 }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {[["all", "All"], ["verified", "Verified"], ["pending", "Pending"], ["rejected", "Rejected"], ["church", "Churches"], ["organization", "Organizations"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={chip(filter === k)}>{l}</button>
          ))}
        </div>

        {error && (
          <div style={{ background: "rgba(240,82,82,0.1)", border: "1px solid rgba(240,82,82,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#f05252" }}>⚠ {error}</div>
        )}
        {loading && <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)" }}>Loading...</div>}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
            {rows.length === 0 ? "No pastors have registered yet." : "No matches."}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(c => {
            const st = statusOf(c);
            const b = badge(st);
            const open = openId === c.id;
            const isOrg = c.entity_type === "organization";
            return (
              <div key={c.id} style={{ background: "#0c1628", borderRadius: 14, border: `1px solid ${open ? "rgba(232,179,75,0.35)" : "rgba(255,255,255,0.07)"}`, padding: "14px 16px" }}>
                <div onClick={() => setOpenId(open ? null : c.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{c.pastor_name || (profiles[c.user_id]?.full_name) || "Unnamed"}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                      {c.name || (isOrg ? "Untitled Organization" : "Untitled Church")}{isOrg ? " · Organization" : ""}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                      📍 {c.city ? `${c.city}, ` : ""}{c.country || "Unknown"}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: b.c, background: b.bg, border: `1px solid ${b.bd}`, whiteSpace: "nowrap" }}>{b.t}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{open ? "▲ Hide" : "▼ Details"}</span>
                  </div>
                </div>
                {open && renderDetail(c)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
