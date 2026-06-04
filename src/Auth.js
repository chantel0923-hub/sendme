import { useState } from "react";
import { supabase } from "./supabase";

export default function Auth({ onLogin }) {
  const [mode, setMode]       = useState("login"); // login | register
  const [role, setRole]       = useState("");
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  const handleLogin = async () => {
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true); setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    onLogin(data.user);
  };

  const handleRegister = async () => {
    if (!name || !email || !password || !role) { setError("Please fill in all fields."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    const { data, error } = await supabase.auth.signUp({ email, password,
      options: { data: { full_name: name, role } }
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    if (data.user) {
      await supabase.from("profiles").insert({
        id: data.user.id, email, full_name: name, role
      });
    }
    setSuccess("Account created! Please check your email to verify your account.");
  };

  const inp = {
    width:"100%", padding:"13px 16px", borderRadius:12,
    background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
    color:"#eef1ff", fontSize:15, fontFamily:"Georgia, serif", outline:"none",
    marginBottom:12,
  };

  const btn = (color="#e8b34b") => ({
    width:"100%", padding:"14px 0", borderRadius:12, border:"none",
    background:`linear-gradient(135deg,${color},${color}cc)`,
    color: color==="#e8b34b" ? "#000" : "#fff",
    fontWeight:700, cursor: loading ? "default" : "pointer",
    fontSize:15, fontFamily:"Georgia, serif",
    opacity: loading ? 0.7 : 1,
    boxShadow:`0 6px 24px ${color}44`,
    marginBottom:10,
  });

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", display:"flex", alignItems:"center", justifyContent:"center", padding:20, fontFamily:"Georgia, serif" }}>
      <div style={{ width:"100%", maxWidth:420 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:48, marginBottom:8 }}>✝</div>
          <div style={{ fontSize:36, fontWeight:800, color:"#fff" }}>
            Send<span style={{ color:"#e8b34b" }}>Me</span>
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:4, marginTop:4 }}>
            GLOBAL MISSION FUND
          </div>
          <div style={{ fontSize:13, color:"#e8b34b", fontStyle:"italic", marginTop:12 }}>
            "Here am I Lord, send me." — Isaiah 6:8
          </div>
        </div>

        {/* Card */}
        <div style={{ background:"#0c1628", borderRadius:20, border:"1px solid rgba(255,255,255,0.08)", padding:"32px 28px" }}>

          {/* Mode toggle */}
          <div style={{ display:"flex", background:"rgba(255,255,255,0.04)", borderRadius:12, padding:4, marginBottom:24 }}>
            {["login","register"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }}
                style={{ flex:1, padding:"10px 0", borderRadius:10, border:"none", cursor:"pointer",
                  background: mode===m ? "linear-gradient(135deg,#e8b34b,#c8942b)" : "transparent",
                  color: mode===m ? "#000" : "rgba(255,255,255,0.4)",
                  fontWeight:700, fontSize:14, fontFamily:"Georgia, serif",
                  transition:"all .2s",
                }}>
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {/* Error / Success */}
          {error && (
            <div style={{ background:"rgba(240,82,82,0.1)", border:"1px solid rgba(240,82,82,0.3)", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#f05252" }}>
              ⚠ {error}
            </div>
          )}
          {success && (
            <div style={{ background:"rgba(62,207,142,0.1)", border:"1px solid rgba(62,207,142,0.3)", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#3ecf8e" }}>
              ✓ {success}
            </div>
          )}

          {/* Register fields */}
          {mode === "register" && (
            <>
              <input value={name} onChange={e=>setName(e.target.value)}
                placeholder="Full name" style={inp}/>
              <select value={role} onChange={e=>setRole(e.target.value)}
  style={{ ...inp, color: role ? "#eef1ff" : "rgba(255,255,255,0.35)" }}>
  <option value="" style={{ background:"#0c1628", color:"#eef1ff" }}>I am a...</option>
  <option value="donor" style={{ background:"#0c1628", color:"#eef1ff" }}>Donor / Supporter</option>
  <option value="missionary" style={{ background:"#0c1628", color:"#eef1ff" }}>Missionary</option>
  <option value="church_admin" style={{ background:"#0c1628", color:"#eef1ff" }}>Church Administrator</option>
  <option value="pastor" style={{ background:"#0c1628", color:"#eef1ff" }}>Pastor / Minister</option>
</select>
            </>
          )}

          {/* Email & Password */}
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="Email address" style={inp}/>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
            placeholder="Password" style={inp}
            onKeyDown={e => e.key==="Enter" && (mode==="login" ? handleLogin() : handleRegister())}/>

          {/* Submit */}
          <button onClick={mode==="login" ? handleLogin : handleRegister}
            style={btn()} disabled={loading}>
            {loading ? "Please wait..." : mode==="login" ? "✝  Sign In to SendMe" : "✝  Create My Account"}
          </button>

          {/* Divider */}
          <div style={{ display:"flex", alignItems:"center", gap:12, margin:"16px 0" }}>
            <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.07)" }}/>
            <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>or</span>
            <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.07)" }}/>
          </div>

          {/* Continue as guest */}
          <button onClick={() => onLogin(null)}
            style={{ width:"100%", padding:"12px 0", borderRadius:12,
              border:"1px solid rgba(255,255,255,0.1)",
              background:"rgba(255,255,255,0.03)", color:"rgba(255,255,255,0.5)",
              fontWeight:600, cursor:"pointer", fontSize:14,
              fontFamily:"Georgia, serif" }}>
            Browse Missions as Guest →
          </button>

          <div style={{ textAlign:"center", fontSize:12, color:"rgba(255,255,255,0.2)", marginTop:16 }}>
            🔒 Your data is secure · SendMe is a non-profit platform
          </div>
        </div>
      </div>
    </div>
  );
}