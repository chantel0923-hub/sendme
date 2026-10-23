import { useState } from "react";
import { supabase } from "./supabase";

// Shown when someone arrives from a "reset your password" email link.
// The link signs them in with a temporary recovery session; this screen lets
// them choose the new password before they carry on into the app.
const MIN_LENGTH = 8;

export default function ResetPassword({ onDone }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const save = async () => {
    setErr("");
    if (pw.length < MIN_LENGTH) { setErr("Please use at least " + MIN_LENGTH + " characters."); return; }
    if (pw !== pw2) { setErr("The two passwords do not match."); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      if (!data || !data.user) throw new Error("Your password was not saved. Please try again.");
      setDone(true);
    } catch (e) {
      const m = (e && e.message) ? e.message : "Something went wrong. Please try again.";
      setErr(/same|different/i.test(m) ? "Please choose a password different from your old one." : m);
    }
    setBusy(false);
  };

  const box = { width: "100%", boxSizing: "border-box", padding: "13px 14px", marginBottom: 12, borderRadius: 10, border: "1px solid #2a3550", background: "#0d1526", color: "#f1ead8", fontSize: 16, fontFamily: "inherit" };
  const btn = { width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "#e8b34b", color: "#1a1204", fontWeight: 700, fontSize: 16, cursor: "pointer", fontFamily: "inherit" };

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#0a1224", border: "1px solid #1f2a44", borderRadius: 16, padding: "28px 22px", color: "#f1ead8" }}>
        <div style={{ textAlign: "center", fontSize: 40, color: "#e8b34b", marginBottom: 6 }}>✝</div>
        {done ? (
          <div style={{ textAlign: "center" }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 22 }}>Password changed ✓</h2>
            <p style={{ color: "#aeb6c8", lineHeight: 1.5, margin: "0 0 20px" }}>
              Your new password is saved. Use it the next time you sign in.
            </p>
            <button style={btn} onClick={onDone}>Continue to SendMe</button>
          </div>
        ) : (
          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: 22, textAlign: "center" }}>Choose a new password</h2>
            <p style={{ color: "#aeb6c8", lineHeight: 1.5, margin: "0 0 18px", textAlign: "center", fontSize: 14 }}>
              Enter your new password below (at least {MIN_LENGTH} characters).
            </p>
            <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" autoComplete="new-password" style={box} />
            <input type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" style={box}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) save(); }} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#aeb6c8", marginBottom: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password
            </label>
            {err && <div style={{ background: "#2a1218", border: "1px solid #6b2230", color: "#ff9aa8", padding: "10px 12px", borderRadius: 8, fontSize: 14, marginBottom: 14 }}>{err}</div>}
            <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} onClick={save} disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
            <button onClick={onDone} disabled={busy} style={{ width: "100%", marginTop: 10, padding: 10, background: "transparent", border: "none", color: "#7f8aa3", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
