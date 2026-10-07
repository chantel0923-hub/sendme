// AdminTestimonies.js
// Admin-only screen to add, edit, hide and delete testimonies shown on the public
// Testimonies page — modelled on the General Fund "Log a Disbursement" form, but with
// the full story, before/after, impact numbers, several photos and a video.
//
// Two ways to use it:
//  • Link it to a mission (e.g. one that has finished): if that mission is marked
//    Complete, the testimony ENRICHES the mission's own card on the Testimonies page;
//    otherwise it appears as its own testimony card.
//  • Leave it unlinked: a stand-alone testimony (a field report, a praise report…).
//
// Saved in the `admin_testimonies` table (see the SQL in the hand-over message).
// Photos go to the public `proof-media` bucket (same as proofs and the General Fund);
// video is a link (YouTube embeds a player) — video files themselves are not uploaded,
// because video storage/egress is what costs money.
import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const MAX_PHOTOS = 6;

// ── Photo upload — same compress-then-upload pattern as MilestoneProof / General Fund ──
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => { img.src = e.target.result; };
    img.onerror = reject;
    img.onload = () => {
      const maxDim = 1600;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else { width = Math.round(width * maxDim / height); height = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not process image"))), "image/jpeg", 0.8);
    };
    reader.readAsDataURL(file);
  });
}
async function uploadPhoto(file) {
  const compressed = await compressImage(file);
  const fileName = `testimonies/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from("proof-media").upload(fileName, compressed, { contentType: "image/jpeg" });
  if (error) throw error;
  const { data } = supabase.storage.from("proof-media").getPublicUrl(fileName);
  return data.publicUrl;
}

function PhotoUploader({ photos, onChange, max }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, max - photos.length);
    if (files.length === 0) return;
    setUploading(true); setError("");
    try {
      const uploaded = [];
      for (const file of files) uploaded.push(await uploadPhoto(file));
      onChange([...photos, ...uploaded]);
    } catch (err) {
      setError("Could not upload a photo. (" + (err.message || "") + ")");
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };
  const removeAt = (i) => onChange(photos.filter((_, idx) => idx !== i));
  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        {photos.map((url, i) => (
          <div key={url} style={{ position: "relative", width: 80, height: 80 }}>
            <img src={url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)" }} />
            <button type="button" onClick={() => removeAt(i)} aria-label="Remove photo"
              style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", border: "none", background: "#e85b5b", color: "#fff", cursor: "pointer", fontSize: 12, lineHeight: "22px", padding: 0 }}>✕</button>
          </div>
        ))}
        {photos.length < max && (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            style={{ width: 80, height: 80, borderRadius: 10, border: "1px dashed rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", cursor: uploading ? "default" : "pointer", fontSize: 22, fontFamily: "Georgia, serif" }}>
            {uploading ? "…" : "+"}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
      {error && <div style={{ fontSize: 12, color: "#e85b5b" }}>{error}</div>}
    </div>
  );
}

const inp = {
  width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 10,
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
  color: "#eef1ff", fontSize: 14, fontFamily: "Georgia, serif", outline: "none", marginBottom: 12,
};
const lbl = { fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 5, display: "block" };

const EMPTY = {
  missionId: "", title: "", country: "", region: "", missionary: "",
  story: "", before: "", after: "", souls: "", bibles: "", churches: "",
  photos: [], videoUrl: "", published: true,
};

// "" -> null, a whole number >= 0 -> number, anything else -> NaN
const wholeNum = (v) => {
  const t = String(v ?? "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
};

export default function AdminTestimonies({ onBack }) {
  const [rows, setRows] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError("");
      const [t, m] = await Promise.all([
        supabase.from("admin_testimonies").select("*").order("created_at", { ascending: false }),
        supabase.from("missions").select("id, title, country, region, status, missionary_name, pastor_name").order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      if (t.error) {
        const msg = t.error.message || "";
        setLoadError(/does not exist|schema cache|relation/i.test(msg)
          ? "The testimonies table hasn't been created yet. Run the admin_testimonies SQL in Supabase first."
          : "Could not load testimonies. (" + msg + ")");
        setRows([]);
      } else {
        setRows(t.data || []);
      }
      setMissions(m.data || []);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Choosing a mission fills in any blanks from it (never overwrites what's already typed)
  const chooseMission = (id) => {
    const m = missions.find(x => x.id === id);
    setForm(f => ({
      ...f,
      missionId: id,
      title:      f.title      || (m ? m.title || "" : ""),
      country:    f.country    || (m ? m.country || "" : ""),
      region:     f.region     || (m ? m.region || "" : ""),
      missionary: f.missionary || (m ? m.missionary_name || m.pastor_name || "" : ""),
    }));
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setFormError(""); setNotice("");
    setForm({
      missionId: r.mission_id || "", title: r.title || "", country: r.country || "", region: r.region || "",
      missionary: r.missionary || "", story: r.story || "", before: r.before_text || "", after: r.after_text || "",
      souls: r.souls ?? "", bibles: r.bibles ?? "", churches: r.churches ?? "",
      photos: Array.isArray(r.photo_urls) ? r.photo_urls : [], videoUrl: r.video_url || "", published: !!r.published,
    });
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => { setForm(EMPTY); setEditingId(null); setFormError(""); };

  const save = async () => {
    setFormError(""); setNotice("");
    if (!form.title.trim()) { setFormError("Please give the testimony a title."); return; }
    if (form.story.trim().length < 20) { setFormError("Please write the story (at least a couple of sentences)."); return; }
    const souls = wholeNum(form.souls), bibles = wholeNum(form.bibles), churches = wholeNum(form.churches);
    if ([souls, bibles, churches].some(Number.isNaN)) { setFormError("Souls, Bibles and churches must be whole numbers (or left blank)."); return; }
    const video = form.videoUrl.trim();
    if (video && !/^https?:\/\//i.test(video)) { setFormError("The video link must start with https:// (a YouTube link works best)."); return; }

    const payload = {
      mission_id: form.missionId || null,
      title: form.title.trim(),
      country: form.country.trim() || null,
      region: form.region.trim() || null,
      missionary: form.missionary.trim() || null,
      story: form.story.trim(),
      before_text: form.before.trim() || null,
      after_text: form.after.trim() || null,
      souls, bibles, churches,
      photo_urls: form.photos,
      video_url: video || null,
      published: form.published,
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    try {
      let res;
      if (editingId) {
        res = await supabase.from("admin_testimonies").update(payload).eq("id", editingId).select("*").maybeSingle();
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        res = await supabase.from("admin_testimonies").insert({ ...payload, created_by: user?.id || null }).select("*").maybeSingle();
      }
      if (res.error) throw res.error;
      // supabase-js doesn't throw when the database silently blocks a write — it returns no row
      if (!res.data) throw new Error("nothing was saved — the database may have blocked it");
      setNotice(form.published ? "✓ Saved and published on the Testimonies page." : "✓ Saved as a draft (not shown publicly).");
      resetForm();
      setReloadKey(k => k + 1);
    } catch (e) {
      setFormError("Could not save. (" + (e.message || "unknown error") + ")");
    }
    setSaving(false);
  };

  const togglePublished = async (r) => {
    setBusyId(r.id); setNotice("");
    const { data, error } = await supabase.from("admin_testimonies").update({ published: !r.published, updated_at: new Date().toISOString() }).eq("id", r.id).select("*").maybeSingle();
    setBusyId(null);
    if (error || !data) { setNotice("⚠ Couldn't change that testimony. " + (error?.message || "")); return; }
    setRows(prev => prev.map(x => (x.id === r.id ? data : x)));
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete “${r.title}”? This cannot be undone.`)) return;
    setBusyId(r.id); setNotice("");
    const { data, error } = await supabase.from("admin_testimonies").delete().eq("id", r.id).select("id");
    setBusyId(null);
    if (error || !data || data.length === 0) { setNotice("⚠ Couldn't delete that testimony. " + (error?.message || "")); return; }
    setRows(prev => prev.filter(x => x.id !== r.id));
    if (editingId === r.id) resetForm();
  };

  const completed = missions.filter(m => m.status === "complete");
  const others = missions.filter(m => m.status !== "complete");
  const optLabel = (m) => `${m.title || "Untitled"}${m.country ? " — " + m.country : ""}`;

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>
      <div style={{ background: "#09111f", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>📖 Testimonies — Admin</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>ADD · EDIT · PUBLISH</div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px 60px" }}>
        {loadError && (
          <div style={{ background: "rgba(232,91,91,0.1)", border: "1px solid rgba(232,91,91,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#e85b5b", lineHeight: 1.6 }}>⚠ {loadError}</div>
        )}
        {notice && (
          <div style={{ background: notice.startsWith("✓") ? "rgba(62,207,142,0.1)" : "rgba(232,91,91,0.1)", border: `1px solid ${notice.startsWith("✓") ? "rgba(62,207,142,0.3)" : "rgba(232,91,91,0.3)"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: notice.startsWith("✓") ? "#3ecf8e" : "#e85b5b" }}>{notice}</div>
        )}

        {/* ── Form ── */}
        <div style={{ background: "#0c1628", borderRadius: 16, border: "1px solid rgba(232,179,75,0.25)", padding: 20, marginBottom: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{editingId ? "✏️ Edit testimony" : "＋ Add a testimony"}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 16 }}>
            Link it to a mission that has finished, or leave it unlinked for a stand-alone report. Linked to a <strong>completed</strong> mission, it
            fills in that mission's own card on the Testimonies page; otherwise it shows as its own testimony.
          </div>

          <label style={lbl}>Mission (optional)</label>
          <select style={inp} value={form.missionId} onChange={e => chooseMission(e.target.value)}>
            <option value="">— Not linked to a mission —</option>
            {completed.length > 0 && <optgroup label="Completed missions">{completed.map(m => <option key={m.id} value={m.id}>{optLabel(m)}</option>)}</optgroup>}
            {others.length > 0 && <optgroup label="Other missions">{others.map(m => <option key={m.id} value={m.id}>{optLabel(m)} ({m.status})</option>)}</optgroup>}
          </select>

          <label style={lbl}>Title *</label>
          <input style={inp} value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. 40 souls saved at the Eden Park tent meetings" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={lbl}>Country</label><input style={inp} value={form.country} onChange={e => set("country", e.target.value)} /></div>
            <div><label style={lbl}>By (missionary / pastor)</label><input style={inp} value={form.missionary} onChange={e => set("missionary", e.target.value)} /></div>
          </div>

          <label style={lbl}>The story *</label>
          <textarea style={{ ...inp, minHeight: 130, resize: "vertical" }} value={form.story} onChange={e => set("story", e.target.value)}
            placeholder="Tell it the way you'd want a donor to read it — what God did, lives changed, challenges overcome…" />

          <label style={lbl}>Before (optional)</label>
          <input style={inp} value={form.before} onChange={e => set("before", e.target.value)} placeholder="What was the situation before?" />
          <label style={lbl}>After (optional)</label>
          <input style={inp} value={form.after} onChange={e => set("after", e.target.value)} placeholder="What changed as a result?" />

          <label style={lbl}>Impact numbers (optional — leave blank if not known)</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <input style={inp} inputMode="numeric" placeholder="Souls" value={form.souls} onChange={e => set("souls", e.target.value)} />
            <input style={inp} inputMode="numeric" placeholder="Bibles" value={form.bibles} onChange={e => set("bibles", e.target.value)} />
            <input style={inp} inputMode="numeric" placeholder="Churches" value={form.churches} onChange={e => set("churches", e.target.value)} />
          </div>

          <label style={lbl}>Photos (optional — up to {MAX_PHOTOS})</label>
          <div style={{ marginBottom: 14 }}>
            <PhotoUploader photos={form.photos} onChange={(p) => set("photos", p)} max={MAX_PHOTOS} />
          </div>

          <label style={lbl}>Video link (optional)</label>
          <input style={inp} value={form.videoUrl} onChange={e => set("videoUrl", e.target.value)} placeholder="Paste a YouTube link — it plays on the page" />

          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, cursor: "pointer", fontSize: 14 }}>
            <input type="checkbox" checked={form.published} onChange={e => set("published", e.target.checked)} style={{ width: 18, height: 18 }} />
            Publish on the Testimonies page now
          </label>

          {formError && (
            <div style={{ background: "rgba(232,91,91,0.1)", border: "1px solid rgba(232,91,91,0.3)", borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 13, color: "#e85b5b", lineHeight: 1.5 }}>⚠ {formError}</div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={save} disabled={saving}
              style={{ flex: 1, padding: "13px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#e8b34b,#c8942b)", color: "#000", fontWeight: 700, fontSize: 14, fontFamily: "Georgia, serif", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving..." : editingId ? "✓ Save changes" : "✓ Save testimony"}
            </button>
            {editingId && (
              <button onClick={resetForm} disabled={saving}
                style={{ padding: "13px 20px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.55)", fontWeight: 600, fontSize: 14, fontFamily: "Georgia, serif", cursor: "pointer" }}>
                Cancel edit
              </button>
            )}
          </div>
        </div>

        {/* ── Existing testimonies ── */}
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Your testimonies ({rows.length})</div>
        {loading && <div style={{ textAlign: "center", padding: "30px 0", color: "rgba(255,255,255,0.3)" }}>Loading...</div>}
        {!loading && rows.length === 0 && !loadError && (
          <div style={{ textAlign: "center", padding: "30px 0", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No testimonies added yet.</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map(r => (
            <div key={r.id} style={{ background: "#0c1628", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                    {[r.country, r.mission_id ? "linked to a mission" : "stand-alone", `${Array.isArray(r.photo_urls) ? r.photo_urls.length : 0} photo(s)`, r.video_url ? "video" : null].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: r.published ? "#3ecf8e" : "#e8b34b", background: r.published ? "rgba(62,207,142,0.12)" : "rgba(232,179,75,0.12)", border: `1px solid ${r.published ? "rgba(62,207,142,0.3)" : "rgba(232,179,75,0.3)"}` }}>
                  {r.published ? "Published" : "Draft"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button onClick={() => startEdit(r)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(232,179,75,0.4)", background: "rgba(232,179,75,0.08)", color: "#e8b34b", fontWeight: 700, fontSize: 12, fontFamily: "Georgia, serif", cursor: "pointer" }}>✏️ Edit</button>
                <button onClick={() => togglePublished(r)} disabled={busyId === r.id} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", fontWeight: 600, fontSize: 12, fontFamily: "Georgia, serif", cursor: "pointer" }}>
                  {r.published ? "Hide" : "Publish"}
                </button>
                <button onClick={() => remove(r)} disabled={busyId === r.id} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(232,91,91,0.35)", background: "transparent", color: "#e85b5b", fontWeight: 600, fontSize: 12, fontFamily: "Georgia, serif", cursor: "pointer" }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
