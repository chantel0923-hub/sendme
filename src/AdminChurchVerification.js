// AdminChurchVerification.js — Br Donald's admin screen for verifying registered churches
import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { ADMIN_EMAIL } from "./AdminPayouts";

const timeAgo = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr), now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// Same geocoding helper used in ChurchRegistration.js — re-run here in case
// the original registration silently failed to get coordinates (e.g. missing
// Mapbox token in that environment, API hiccup, etc).
const geocodeLocation = async (city, country) => {
  try {
    const token = process.env.REACT_APP_MAPBOX_TOKEN;
    if (!token) return { lat: null, lng: null };
    const query = encodeURIComponent(`${city}, ${country}`.trim());
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&limit=1`
    );
    if (!res.ok) return { lat: null, lng: null };
    const data = await res.json();
    if (data?.features?.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { lat, lng };
    }
  } catch {
    // Network or API error — fall through to null coordinates
  }
  return { lat: null, lng: null };
};

export default function AdminChurchVerification({ onBack, user }) {
  const [churches, setChurches] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("pending");
  const [acting, setActing]     = useState(null); // church id being acted on
  const [error, setError]       = useState("");
  const [geocoding, setGeocoding] = useState(null); // church id currently being re-geocoded

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase
        .from("churches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setChurches(data || []);
    } catch (e) {
      setError("Could not load churches. (" + (e.message || "") + ")");
      setChurches([]);
    }
    setLoading(false);
  };

  const verify = async (church) => {
    setActing(church.id);
    setError("");
    try {
      const { error } = await supabase
        .from("churches")
        .update({ verified: true })
        .eq("id", church.id);
      if (error) throw error;
      await load();
    } catch (e) {
      setError("Could not verify church. (" + (e.message || "") + ")");
    }
    setActing(null);
  };

  const unverify = async (church) => {
    setActing(church.id);
    setError("");
    try {
      const { error } = await supabase
        .from("churches")
        .update({ verified: false })
        .eq("id", church.id);
      if (error) throw error;
      await load();
    } catch (e) {
      setError("Could not update church. (" + (e.message || "") + ")");
    }
    setActing(null);
  };

  // Fixes churches that registered with missing lat/lng (e.g. the Mapbox
  // token wasn't available at registration time, or the geocode call failed).
  // Without coordinates, a church won't appear on the map view even once verified.
  const fixCoordinates = async (church) => {
    setGeocoding(church.id);
    setError("");
    try {
      const { lat, lng } = await geocodeLocation(church.city, church.country);
      if (lat == null || lng == null) {
        setError(`Could not find coordinates for "${church.city}, ${church.country}". Check the Mapbox token is set, or the city/country spelling.`);
        setGeocoding(null);
        return;
      }
      const { error } = await supabase
        .from("churches")
        .update({ lat, lng })
        .eq("id", church.id);
      if (error) throw error;
      await load();
    } catch (e) {
      setError("Could not fetch coordinates. (" + (e.message || "") + ")");
    }
    setGeocoding(null);
  };

  if (!isAdmin) {
    return (
      <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🔒</div>
          <div style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>This screen is for SendMe admin only.</div>
          <button onClick={onBack} style={{ padding: "12px 28px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>Back</button>
        </div>
      </div>
    );
  }

  const filtered = churches.filter(c => {
    if (filter === "pending") return c.verified === false || c.verified == null;
    if (filter === "verified") return c.verified === true;
    return true; // all
  });
  const pendingCount = churches.filter(c => c.verified === false || c.verified == null).length;

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>

      {/* Header */}
      <div style={{ background: "#09111f", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Church Verification</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>ADMIN — REGISTERED CHURCHES</div>
        </div>
        {pendingCount > 0 && (
          <div style={{ background: "rgba(232,179,75,0.15)", border: "1px solid rgba(232,179,75,0.4)", borderRadius: 999, padding: "4px 14px", fontSize: 13, color: "#e8b34b", fontWeight: 700 }}>
            {pendingCount} pending
          </div>
        )}
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 60px" }}>

        {/* Explainer */}
        <div style={{ background: "rgba(232,179,75,0.06)", borderRadius: 16, border: "1px solid rgba(232,179,75,0.15)", padding: "18px 22px", marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e8b34b", marginBottom: 6 }}>✝ Why This Matters</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.8 }}>
            Once a church is verified, it appears in the Message Church Directory and becomes selectable
            in the missionary application's church dropdown — which is what allows that missionary's
            application to pass the church-verification approval gate.
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {[["pending", "Pending"], ["verified", "Verified"], ["all", "All"]].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              style={{ padding: "7px 18px", borderRadius: 999, border: `1px solid ${filter === key ? "#e8b34b" : "rgba(255,255,255,0.1)"}`, background: filter === key ? "rgba(232,179,75,0.15)" : "rgba(255,255,255,0.03)", color: filter === key ? "#e8b34b" : "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif" }}>
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ background: "rgba(240,82,82,0.1)", border: "1px solid rgba(240,82,82,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#f05252" }}>
            ⚠ {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "50px 0", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Loading churches...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", padding: "44px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⛪</div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.4)" }}>
              {filter === "pending" ? "No pending churches. 🙏" : `No ${filter} churches.`}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {filtered.map(c => {
              const isVerified = c.verified === true;
              const isActing = acting === c.id;
              const isGeocoding = geocoding === c.id;
              const missingCoords = c.lat == null || c.lng == null;
              return (
                <div key={c.id} style={{ background: "#0c1628", borderRadius: 18, border: `1px solid ${!isVerified ? "rgba(232,179,75,0.25)" : "rgba(255,255,255,0.07)"}`, padding: "20px 22px" }}>

                  {/* Header row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: "#eef1ff", marginBottom: 3 }}>{c.name || "Untitled Church"}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>📍 {c.city ? `${c.city}, ` : ""}{c.country || "Unknown"}{c.province ? ` (${c.province})` : ""}</div>
                    </div>
                    <span style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                      background: isVerified ? "rgba(62,207,142,0.12)" : "rgba(232,179,75,0.12)",
                      color: isVerified ? "#3ecf8e" : "#e8b34b",
                      border: `1px solid ${isVerified ? "rgba(62,207,142,0.3)" : "rgba(232,179,75,0.3)"}` }}>
                      {isVerified ? "✓ Verified" : "Pending"}
                    </span>
                  </div>

                  {/* Pastor info */}
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", padding: "14px 16px", marginBottom: 14, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.9 }}>
                    <div><strong style={{ color: "rgba(255,255,255,0.8)" }}>Senior Pastor:</strong> {c.pastor_name || "(not given)"} · {c.pastor_email || "no email on file"}{c.pastor_phone ? ` · ${c.pastor_phone}` : ""}</div>
                    <div><strong style={{ color: "rgba(255,255,255,0.8)" }}>Church Contact:</strong> {c.email || "(no email)"}{c.phone ? ` · ${c.phone}` : ""}{c.website ? ` · ${c.website}` : ""}</div>
                    <div><strong style={{ color: "rgba(255,255,255,0.8)" }}>Congregation Size:</strong> {c.size || "Not specified"}</div>
                  </div>

                  {/* Coordinates status */}
                  <div style={{ background: missingCoords ? "rgba(232,91,91,0.08)" : "rgba(62,207,142,0.07)", borderRadius: 12, border: `1px solid ${missingCoords ? "rgba(232,91,91,0.25)" : "rgba(62,207,142,0.2)"}`, padding: "12px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: missingCoords ? "#e85b5b" : "#3ecf8e", marginBottom: 2 }}>
                        {missingCoords ? "⚠️ Missing Map Coordinates" : "✓ Map Coordinates Set"}
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                        {missingCoords
                          ? "This church won't show on the map view until coordinates are added."
                          : `lat: ${Number(c.lat).toFixed(4)}, lng: ${Number(c.lng).toFixed(4)}`}
                      </div>
                    </div>
                    {missingCoords && (
                      <button onClick={() => fixCoordinates(c)} disabled={isGeocoding}
                        style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid rgba(232,91,91,0.4)", background: "rgba(232,91,91,0.1)", color: "#e85b5b", fontWeight: 700, cursor: isGeocoding ? "default" : "pointer", fontSize: 12, fontFamily: "Georgia, serif", whiteSpace: "nowrap" }}>
                        {isGeocoding ? "Looking up..." : "Fix Coordinates"}
                      </button>
                    )}
                  </div>

                  {/* Reviewed timestamp */}
                  {c.created_at && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginBottom: 14 }}>
                      Registered {timeAgo(c.created_at)}
                    </div>
                  )}

                  {/* Action */}
                  {isVerified ? (
                    <button onClick={() => unverify(c)} disabled={isActing}
                      style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", fontWeight: 700, cursor: isActing ? "default" : "pointer", fontSize: 13, fontFamily: "Georgia, serif" }}>
                      {isActing ? "Saving..." : "↩ Revoke Verification"}
                    </button>
                  ) : (
                    <button onClick={() => verify(c)} disabled={isActing}
                      style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: isActing ? "rgba(62,207,142,0.1)" : "linear-gradient(135deg,#3ecf8e,#2aaf74)", color: isActing ? "#3ecf8e" : "#000", fontWeight: 700, cursor: isActing ? "default" : "pointer", fontSize: 14, fontFamily: "Georgia, serif", boxShadow: isActing ? "none" : "0 4px 18px rgba(62,207,142,0.35)" }}>
                      {isActing ? "Saving..." : "✅ Verify Church"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ textAlign: "center", padding: "32px 0 0", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 32 }}>
          <div style={{ fontSize: 13, color: "#e8b34b", fontStyle: "italic" }}>"Try the spirits whether they are of God." — 1 John 4:1</div>
        </div>
      </div>
    </div>
  );
}
