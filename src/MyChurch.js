import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import ChurchRegistration from "./ChurchRegistration";

export default function MyChurch({ onBack, user }) {
  const [loading, setLoading] = useState(true);
  const [church, setChurch]   = useState(null);
  const [form, setForm]       = useState(null);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    const load = async () => {
      if (!user) { setLoading(false); return; }
      try {
        const { data, error } = await supabase
          .from("churches")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        setChurch(data);
        if (data) {
          setForm({
            name:               data.name || "",
            street:             data.street || "",
            city:               data.city || "",
            province:           data.province || "",
            country:            data.country || "",
            phone:              data.phone || "",
            email:              data.email || "",
            website:            data.website || "",
            pastor_name:        data.pastor_name || "",
            pastor_phone:       data.pastor_phone || "",
            show_phone_public:  !!data.show_phone_public,
            can_endorse:        !!data.can_endorse,
          });
        }
      } catch (e) {
        setError("Could not load your church details. (" + (e.message || "") + ")");
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!church || !form) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      const { error } = await supabase
        .from("churches")
        .update({
          name:              form.name,
          street:            form.street || null,
          city:              form.city,
          province:          form.province,
          country:           form.country,
          phone:             form.phone,
          email:             form.email,
          website:           form.website,
          pastor_name:       form.pastor_name,
          pastor_phone:      form.pastor_phone,
          show_phone_public: form.show_phone_public,
          can_endorse:       form.can_endorse,
        })
        .eq("id", church.id)
        .eq("user_id", user.id); // belt-and-braces — RLS enforces this server-side too
      if (error) throw error;
      setSaved(true);
    } catch (e) {
      setError("Could not save changes. (" + (e.message || "") + ")");
    }
    setSaving(false);
  };

  const inp = {
    width: "100%", padding: "12px 16px", borderRadius: 10,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#eef1ff", fontSize: 14, fontFamily: "Georgia, serif", outline: "none",
    marginBottom: 14, boxSizing: "border-box",
  };
  const lbl = { fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 6 };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif" }}>
        Loading your church...
      </div>
    );
  }

  // No church linked to this account yet — send them through registration.
  // (ChurchRegistration itself now blocks a second registration once one exists.)
  if (!church) {
    return <ChurchRegistration onBack={onBack} user={user} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>
      <div style={{ background: "#09111f", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>My Church</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>MANAGE YOUR CHURCH DETAILS</div>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "28px 20px 60px" }}>
        {!church.verified && (
          <div style={{ background: "rgba(232,179,75,0.08)", border: "1px solid rgba(232,179,75,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#e8b34b" }}>
            ⏳ Your church is still pending admin verification.
          </div>
        )}
        {error && (
          <div style={{ background: "rgba(240,82,82,0.1)", border: "1px solid rgba(240,82,82,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#f05252" }}>
            ⚠ {error}
          </div>
        )}
        {saved && (
          <div style={{ background: "rgba(62,207,142,0.1)", border: "1px solid rgba(62,207,142,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#3ecf8e" }}>
            ✓ Saved
          </div>
        )}

        <div style={lbl}>Church Name</div>
        <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

        <div style={lbl}>Street Address</div>
        <input style={inp} value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={lbl}>City</div>
            <input style={inp} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
          </div>
          <div>
            <div style={lbl}>Province / State</div>
            <input style={inp} value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} />
          </div>
        </div>

        <div style={lbl}>Country</div>
        <input style={inp} value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={lbl}>Church Phone</div>
            <input style={inp} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <div style={lbl}>Pastor's Phone</div>
            <input style={inp} value={form.pastor_phone} onChange={e => setForm(f => ({ ...f, pastor_phone: e.target.value }))} />
          </div>
        </div>

        <div style={lbl}>Church Email</div>
        <input style={inp} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />

        <div style={lbl}>Website</div>
        <input style={inp} value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />

        <div style={lbl}>Senior Pastor — Full Name</div>
        <input style={inp} value={form.pastor_name} onChange={e => setForm(f => ({ ...f, pastor_name: e.target.value }))} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 14, color: "#eef1ff" }}>Display Phone Number Publicly</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Visible to all visitors in the Church Directory</div>
          </div>
          <input type="checkbox" checked={form.show_phone_public} onChange={e => setForm(f => ({ ...f, show_phone_public: e.target.checked }))} style={{ width: 20, height: 20 }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: 14, color: "#eef1ff" }}>Endorsement Authority</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>This church can endorse missionary applications on SendMe</div>
          </div>
          <input type="checkbox" checked={form.can_endorse} onChange={e => setForm(f => ({ ...f, can_endorse: e.target.checked }))} style={{ width: 20, height: 20 }} />
        </div>

        <button onClick={handleSave} disabled={saving} style={{ width: "100%", marginTop: 24, padding: "14px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#e8b34b,#c8942b)", color: "#000", fontWeight: 700, cursor: saving ? "default" : "pointer", fontSize: 15, fontFamily: "Georgia, serif", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
