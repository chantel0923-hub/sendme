// AdminUsers.js
// Admin-only screen listing every registered SendMe user (from `profiles`),
// with search and a role filter. Read-only — nothing here edits a profile.
//
// It also shows a "Waiting for verification" section: members whose email was
// never confirmed (confirmation email lost, in spam, or the link expired), each
// with a one-tap Confirm. That goes through the admin-only `confirm-user` Edge
// Function (it needs the service-role key, which must never reach the browser).
// Deploy it with:  supabase functions deploy confirm-user --use-api
//
// NOTE: the list below depends on the "Admin can read all profiles" RLS policy on
// `profiles`. Without it Supabase only returns the admin's own row, which is
// why the header badge used to say "1 registered user". If the list shows
// only one person, that policy is missing.
import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const PAGE = 1000; // Supabase returns at most 1000 rows per request by default

// Digits for a wa.me link, or "" if the number isn't a usable international number.
const waDigits = (raw) => {
  const t = String(raw || "").trim();
  const d = t.replace(/\D/g, "");
  if (t.startsWith("+")) return d.length >= 8 && d.length <= 15 ? d : "";
  if (d.startsWith("00")) return d.length >= 10 ? d.slice(2) : "";
  return "";
};

// Edge Function errors arrive wrapped; pull out the server's own message if there is one.
const readFnError = async (e) => {
  try {
    const j = await e?.context?.json?.();
    if (j?.error) return j.error;
  } catch (_ignore) { /* not JSON */ }
  return e?.message || "Unknown error";
};

export default function AdminUsers({ onBack }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Members waiting for email verification (from the confirm-user Edge Function)
  const [unverified, setUnverified] = useState(null);   // null = still loading
  const [unvError, setUnvError] = useState("");
  const [unvKey, setUnvKey] = useState(0);               // bump to reload the list
  const [confirmingId, setConfirmingId] = useState(null);
  const [confirmedIds, setConfirmedIds] = useState({});  // activated during this visit
  const [confirmError, setConfirmError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data, error: err, count } = await supabase
          .from("profiles")
          .select(
            "id, full_name, email, role, country, created_at, whatsapp_number, whatsapp_group_optin, newsletter_optin, blocked_from_applying",
            { count: "exact" }
          )
          .order("created_at", { ascending: false })
          .range(0, PAGE - 1);
        if (err) throw err;
        setRows(data || []);
        setTotal(count ?? (data || []).length);
      } catch (e) {
        console.error("AdminUsers fetch error:", e);
        setError("Could not load users. (" + (e.message || "") + ")");
      }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadUnverified = async () => {
      setUnvError("");
      try {
        const { data, error: err } = await supabase.functions.invoke("confirm-user", { body: { action: "list_unverified" } });
        if (err) throw err;
        if (data?.error) throw new Error(data.error);
        if (!cancelled) setUnverified(data?.users || []);
      } catch (e) {
        const msg = await readFnError(e);
        if (!cancelled) { setUnverified([]); setUnvError(msg); }
      }
    };
    loadUnverified();
    return () => { cancelled = true; };
  }, [unvKey]);

  const confirmUser = async (u) => {
    const label = `${u.full_name || "this member"} (${u.email})`;
    if (!window.confirm(`Activate ${label}?\n\nOnly do this if you know them and the email address is spelled correctly.`)) return;
    setConfirmingId(u.id);
    setConfirmError("");
    try {
      const { data, error: err } = await supabase.functions.invoke("confirm-user", { body: { action: "confirm", user_id: u.id } });
      if (err) throw err;
      if (data?.error) throw new Error(data.error);
      setConfirmedIds(prev => ({ ...prev, [u.id]: true }));
    } catch (e) {
      setConfirmError(`Could not activate ${u.email}: ${await readFnError(e)}`);
    }
    setConfirmingId(null);
  };

  const roles = Array.from(new Set(rows.map(r => r.role).filter(Boolean))).sort();

  const filtered = rows.filter(r => {
    if (roleFilter !== "all" && r.role !== roleFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.full_name || "").toLowerCase().includes(q) ||
      (r.email || "").toLowerCase().includes(q) ||
      (r.whatsapp_number || "").includes(q) ||
      (r.country || "").toLowerCase().includes(q)
    );
  });

  const joined = (iso) => (iso ? String(iso).slice(0, 10) : "—");

  const chip = (active) => ({
    padding: "7px 14px",
    borderRadius: 20,
    border: active ? "1px solid #e8b34b" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(232,179,75,0.12)" : "rgba(255,255,255,0.03)",
    color: active ? "#e8b34b" : "rgba(255,255,255,0.55)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "Georgia, serif",
  });

  const tag = (color, bg) => ({
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.5,
    padding: "2px 8px",
    borderRadius: 10,
    color,
    background: bg,
    whiteSpace: "nowrap",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>
      <div style={{ background: "#09111f", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>👤 Registered Users</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>
            {total === null ? "LOADING" : `${total} REGISTERED · SHOWING ${filtered.length}`}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 60px" }}>
        {/* ── Waiting for verification ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: "#e8b34b" }}>
              ⏳ Waiting for verification{unverified ? ` (${unverified.filter(u => !confirmedIds[u.id]).length})` : ""}
            </div>
            <button onClick={() => { setUnverified(null); setUnvKey(k => k + 1); }}
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "5px 12px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif" }}>
              ↻ Refresh
            </button>
          </div>

          {unverified === null && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Checking...</div>}

          {unvError && (
            <div style={{ background: "rgba(240,82,82,0.1)", border: "1px solid rgba(240,82,82,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#f05252", lineHeight: 1.6 }}>
              ⚠ Couldn't check for members waiting for verification. ({unvError}) If this is the first time, the <strong>confirm-user</strong> function may not be deployed yet:<br />
              <code>supabase functions deploy confirm-user --use-api</code>
            </div>
          )}

          {confirmError && (
            <div style={{ background: "rgba(240,82,82,0.1)", border: "1px solid rgba(240,82,82,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: "#f05252" }}>⚠ {confirmError}</div>
          )}

          {unverified && !unvError && unverified.length === 0 && (
            <div style={{ fontSize: 13, color: "#3ecf8e" }}>✓ Nobody is waiting for verification.</div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(unverified || []).map(u => {
              const p = rows.find(r => r.id === u.id);
              const nm = u.full_name || p?.full_name || "Unnamed";
              const digits = waDigits(p?.whatsapp_number || u.whatsapp_number);
              const done = !!confirmedIds[u.id];
              const first = nm.split(" ")[0];
              const tell = `Hello ${first}, your SendMe account is now active. Please go to sendmeglobalmission.org and sign in with your email and password. God bless you.`;
              return (
                <div key={u.id} style={{ background: done ? "rgba(62,207,142,0.06)" : "#0c1628", borderRadius: 12, border: `1px solid ${done ? "rgba(62,207,142,0.3)" : "rgba(232,179,75,0.25)"}`, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{nm}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2, wordBreak: "break-all" }}>{u.email}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                        {u.role ? `${u.role} · ` : ""}signed up {joined(u.created_at)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {done ? (
                        <>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#3ecf8e" }}>✓ Activated</span>
                          {digits && (
                            <a href={`https://wa.me/${digits}?text=${encodeURIComponent(tell)}`} target="_blank" rel="noopener noreferrer"
                              style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(37,211,102,0.4)", background: "rgba(37,211,102,0.08)", color: "#25d366", fontWeight: 700, fontSize: 12, textDecoration: "none", fontFamily: "Georgia, serif" }}>
                              💬 Tell them on WhatsApp
                            </a>
                          )}
                        </>
                      ) : (
                        <button onClick={() => confirmUser(u)} disabled={confirmingId === u.id}
                          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#e8b34b,#c8942b)", color: "#000", fontWeight: 700, fontSize: 13, fontFamily: "Georgia, serif", cursor: confirmingId === u.id ? "default" : "pointer", opacity: confirmingId === u.id ? 0.6 : 1 }}>
                          {confirmingId === u.id ? "Activating..." : "✓ Confirm account"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <input
          placeholder="Search by name, email, number or country..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#eef1ff", fontSize: 13, fontFamily: "Georgia, serif", outline: "none", marginBottom: 14 }}
        />

        {roles.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            <button onClick={() => setRoleFilter("all")} style={chip(roleFilter === "all")}>All</button>
            {roles.map(role => (
              <button key={role} onClick={() => setRoleFilter(role)} style={chip(roleFilter === role)}>
                {role} ({rows.filter(r => r.role === role).length})
              </button>
            ))}
          </div>
        )}

        {error && (
          <div style={{ background: "rgba(240,82,82,0.1)", border: "1px solid rgba(240,82,82,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#f05252" }}>
            ⚠ {error}
          </div>
        )}

        {!loading && !error && rows.length === 1 && (
          <div style={{ background: "rgba(232,179,75,0.08)", border: "1px solid rgba(232,179,75,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#e8b34b", lineHeight: 1.6 }}>
            Only one user is visible. If you expect more, the "Admin can read all profiles" policy hasn't been added in Supabase yet.
          </div>
        )}

        {!loading && total !== null && total > rows.length && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>
            Showing the newest {rows.length} of {total} users.
          </div>
        )}

        {loading && <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)" }}>Loading...</div>}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>No matches.</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(r => (
            <div key={r.id} style={{ background: "#0c1628", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#eef1ff" }}>{r.full_name || "Unnamed"}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2, wordBreak: "break-all" }}>{r.email || "no email"}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {r.role && <span style={tag("#e8b34b", "rgba(232,179,75,0.12)")}>{r.role}</span>}
                  {r.blocked_from_applying && <span style={tag("#e85b5b", "rgba(232,91,91,0.12)")}>BLOCKED</span>}
                </div>
              </div>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                <span>Joined {joined(r.created_at)}</span>
                {r.country && <span>{r.country}</span>}
                {r.whatsapp_number && (
                  <span style={{ color: r.whatsapp_group_optin ? "#25d366" : "rgba(255,255,255,0.4)" }}>
                    📲 {r.whatsapp_number}{r.whatsapp_group_optin ? " (WhatsApp opt-in)" : ""}
                  </span>
                )}
                {r.newsletter_optin && <span style={{ color: "#5b9cf6" }}>✉ Newsletter</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
