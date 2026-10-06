// AdminMissionEditor.js
// Admin-only panel (rendered inside a mission card in Mission Approvals) for fixing
// or adding to a mission AFTER it has been posted: title, description, where it is,
// the map pin, field-access level, dates and the milestone descriptions.
//
// Deliberately NOT editable here: the funding goal, collection target, currency,
// milestone amounts, amount raised, status, church and missionary. Donors give
// against those numbers, so money changes only go through the dedicated tools
// (Cancel & Reallocate / Close Early), never a quick edit.
import { useState } from "react";
import { supabase } from "./supabase";
import { COUNTRIES, countryIso } from "./countries";
import { geocodeMissionLocation } from "./missionGeocode";

const REGIONS = ["Africa", "Asia", "South America", "Middle East", "Europe", "North America", "Pacific Islands", "Central Asia", "Other"];
const ACCESS_LEVELS = [
  { level: "1", label: "🟢 Easy Access" },
  { level: "2", label: "🟡 Rural Area" },
  { level: "3", label: "🟠 Difficult Terrain" },
  { level: "4", label: "🔴 High Risk" },
];

// "" -> null, a valid number -> number, anything else -> NaN
const num = (v) => {
  const t = String(v ?? "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

const inp = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10,
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
  color: "#eef1ff", fontSize: 13, fontFamily: "Georgia, serif", outline: "none", marginBottom: 12,
};
const lbl = { fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 5, display: "block" };

export default function AdminMissionEditor({ mission, onSaved, onCancel }) {
  const m = mission;
  const countryOk = !!countryIso(m.country);

  const [form, setForm] = useState({
    title: m.title || "",
    blurb: m.blurb || m.description || "",
    region: m.region || "",
    country: countryOk ? m.country : "",
    city: m.city || "",
    area: m.area || "",
    riskLevel: String(m.risk_level || ""),
    startDate: m.start_date ? String(m.start_date).slice(0, 10) : "",
    duration: m.duration_months ?? "",
    m1: m.milestone_1_detail || "",
    m2: m.milestone_2_detail || "",
    m3: m.milestone_3_detail || "",
    lat: m.lat ?? "",
    lng: m.lng ?? "",
  });
  const [finding, setFinding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapMsg, setMapMsg] = useState(null);   // { ok, text }
  const [error, setError] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // The place changed but the pin hasn't been refreshed yet
  const placeChanged = form.country !== (m.country || "") || form.city !== (m.city || "") || form.area !== (m.area || "");
  const pinUntouched = String(form.lat) === String(m.lat ?? "") && String(form.lng) === String(m.lng ?? "");

  const findOnMap = async () => {
    setMapMsg(null);
    if (!countryIso(form.country)) { setMapMsg({ ok: false, text: "Choose the country from the list first." }); return; }
    setFinding(true);
    const r = await geocodeMissionLocation(form.area, form.city, form.country);
    setFinding(false);
    if (r.lat === null) {
      setMapMsg({ ok: false, text: "Couldn't find that place. Try a nearby town, or type the coordinates yourself." });
      return;
    }
    set("lat", r.lat.toFixed(5));
    set("lng", r.lng.toFixed(5));
    setMapMsg(r.precise
      ? { ok: true, text: `✓ Found: ${r.place}` }
      : { ok: false, text: `Only the country was found (${r.place}), so the pin will sit in the middle of it. Add a city or area, or type exact coordinates.` });
  };

  const fail = (text) => { setError(text); return false; };

  const save = async () => {
    setError("");
    if (!form.title.trim()) return fail("A title is required.");
    if (!countryIso(form.country)) return fail("Please choose the country from the list (provinces and cities go in the City / Area boxes).");
    const lat = num(form.lat), lng = num(form.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng) || (lat !== null && (lat < -90 || lat > 90)) || (lng !== null && (lng < -180 || lng > 180))) {
      return fail("Latitude must be a number between -90 and 90, and longitude between -180 and 180.");
    }
    if ((lat === null) !== (lng === null)) return fail("Enter both latitude and longitude, or leave both blank.");
    const dur = num(form.duration);
    if (Number.isNaN(dur) || (dur !== null && dur < 0)) return fail("Duration must be a positive number of months.");

    const payload = {
      title: form.title.trim(),
      blurb: form.blurb.trim() || null,
      region: form.region || m.region || null,
      country: form.country,
      city: form.city.trim() || null,
      area: form.area.trim() || null,
      risk_level: Number(form.riskLevel) || Number(m.risk_level) || 1,
      start_date: form.startDate || null,
      duration_months: dur,
      milestone_1_detail: form.m1.trim() || null,
      milestone_2_detail: form.m2.trim() || null,
      milestone_3_detail: form.m3.trim() || null,
      lat,
      lng,
    };

    setSaving(true);
    try {
      const { data, error: err } = await supabase.from("missions").update(payload).eq("id", m.id).select("*").maybeSingle();
      if (err) throw err;
      // The Supabase client doesn't throw when the database silently blocks an update; it just returns no row.
      if (!data) throw new Error("nothing was saved — the database may have blocked the change");
      onSaved(data);
    } catch (e) {
      setError("Could not save the changes. (" + (e.message || "unknown error") + ")");
    }
    setSaving(false);
    return true;
  };

  return (
    <div style={{ background: "rgba(232,179,75,0.05)", border: "1px solid rgba(232,179,75,0.3)", borderRadius: 14, padding: "16px 16px 6px", marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#e8b34b", marginBottom: 4 }}>✏️ Edit mission</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 14 }}>
        Goal: <strong>${Math.round(m.goal || 0)}</strong> · Raised: <strong>${Math.round(m.raised || 0)}</strong> — funding amounts are locked here so
        a live mission can't change what donors gave to. Use Cancel &amp; Reallocate for money changes.
      </div>

      <label style={lbl}>Title *</label>
      <input style={inp} value={form.title} onChange={e => set("title", e.target.value)} />

      <label style={lbl}>Description</label>
      <textarea style={{ ...inp, minHeight: 110, resize: "vertical" }} value={form.blurb} onChange={e => set("blurb", e.target.value)} />

      <label style={lbl}>Region</label>
      <select style={inp} value={form.region} onChange={e => set("region", e.target.value)}>
        <option value="">—</option>
        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
      </select>

      <label style={lbl}>Country *</label>
      {!countryOk && m.country && (
        <div style={{ fontSize: 12, color: "#e85b5b", marginBottom: 6, lineHeight: 1.5 }}>
          ⚠ The saved country is “{m.country}”, which isn't a country. Please choose the right one below.
        </div>
      )}
      <select style={inp} value={form.country} onChange={e => set("country", e.target.value)}>
        <option value="">Select country...</option>
        {COUNTRIES.map(c => <option key={c.iso} value={c.name}>{c.name}</option>)}
      </select>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={lbl}>City / Town</label>
          <input style={inp} value={form.city} onChange={e => set("city", e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Area / District</label>
          <input style={inp} value={form.area} onChange={e => set("area", e.target.value)} />
        </div>
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 12px 2px", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ ...lbl, marginBottom: 0 }}>📍 Map pin</span>
          <button type="button" onClick={findOnMap} disabled={finding}
            style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(91,156,246,0.4)", background: "rgba(91,156,246,0.1)", color: "#5b9cf6", fontWeight: 700, fontSize: 12, fontFamily: "Georgia, serif", cursor: finding ? "default" : "pointer" }}>
            {finding ? "Searching..." : "🔎 Find on map"}
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>Latitude</label>
            <input style={inp} inputMode="decimal" placeholder="e.g. -26.267" value={form.lat} onChange={e => set("lat", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Longitude</label>
            <input style={inp} inputMode="decimal" placeholder="e.g. 28.122" value={form.lng} onChange={e => set("lng", e.target.value)} />
          </div>
        </div>
        {mapMsg && <div style={{ fontSize: 12, color: mapMsg.ok ? "#3ecf8e" : "#e8b34b", marginTop: -4, marginBottom: 10, lineHeight: 1.5 }}>{mapMsg.text}</div>}
        {!mapMsg && placeChanged && pinUntouched && (
          <div style={{ fontSize: 12, color: "#e8b34b", marginTop: -4, marginBottom: 10, lineHeight: 1.5 }}>
            The place changed but the pin hasn't — tap “Find on map” to move it.
          </div>
        )}
        {!form.lat && !form.lng && !mapMsg && (
          <div style={{ fontSize: 12, color: "#e85b5b", marginTop: -4, marginBottom: 10 }}>No pin yet — this mission won't appear on the world map until it has one.</div>
        )}
      </div>

      <label style={lbl}>Field access / conditions</label>
      <select style={inp} value={form.riskLevel} onChange={e => set("riskLevel", e.target.value)}>
        <option value="">—</option>
        {ACCESS_LEVELS.map(a => <option key={a.level} value={a.level}>{a.label}</option>)}
      </select>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={lbl}>Start date</label>
          <input style={inp} type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Duration (months)</label>
          <input style={inp} type="number" min="0" value={form.duration} onChange={e => set("duration", e.target.value)} />
        </div>
      </div>

      <label style={lbl}>Milestone 1 — what it covers</label>
      <input style={inp} value={form.m1} onChange={e => set("m1", e.target.value)} />
      <label style={lbl}>Milestone 2 — what it covers</label>
      <input style={inp} value={form.m2} onChange={e => set("m2", e.target.value)} />
      <label style={lbl}>Milestone 3 — what it covers</label>
      <input style={inp} value={form.m3} onChange={e => set("m3", e.target.value)} />

      {error && (
        <div style={{ background: "rgba(232,91,91,0.1)", border: "1px solid rgba(232,91,91,0.3)", borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 12, color: "#e85b5b", lineHeight: 1.5 }}>⚠ {error}</div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <button type="button" onClick={save} disabled={saving}
          style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#e8b34b,#c8942b)", color: "#000", fontWeight: 700, fontSize: 14, fontFamily: "Georgia, serif", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving..." : "✓ Save changes"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}
          style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.55)", fontWeight: 600, fontSize: 14, fontFamily: "Georgia, serif", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
