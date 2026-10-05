import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import YouTubeEmbed from "./YouTubeEmbed";
import { FEATURED_VIDEOS } from "./sendmeVideos";

// How long the confirmation link stays valid. Keep in step with the
// "Email OTP expiration" setting in Supabase (Authentication → Sign In / Providers → Email).
const CONFIRM_LINK_HOURS = 24;

// The WhatsApp number new members message when their confirmation email never
// arrives ("Ask SendMe to activate me on WhatsApp"). Digits with the country
// code — spaces and + are ignored, e.g. "+27 82 123 4567". While this is empty
// the button is simply hidden.
const SENDME_WHATSAPP_NUMBER = "+27 72 624 0395";

// Dial codes for the phone field. `iso` is the unique key (the USA and Canada
// share +1, so the code alone can't identify the selected row).
const COUNTRY_CODES = [
  { iso:"ZA", name:"South Africa", code:"+27" },
  { iso:"ZW", name:"Zimbabwe", code:"+263" },
  { iso:"ZM", name:"Zambia", code:"+260" },
  { iso:"BW", name:"Botswana", code:"+267" },
  { iso:"NA", name:"Namibia", code:"+264" },
  { iso:"MZ", name:"Mozambique", code:"+258" },
  { iso:"MW", name:"Malawi", code:"+265" },
  { iso:"LS", name:"Lesotho", code:"+266" },
  { iso:"SZ", name:"Eswatini", code:"+268" },
  { iso:"AO", name:"Angola", code:"+244" },
  { iso:"TZ", name:"Tanzania", code:"+255" },
  { iso:"KE", name:"Kenya", code:"+254" },
  { iso:"UG", name:"Uganda", code:"+256" },
  { iso:"RW", name:"Rwanda", code:"+250" },
  { iso:"CD", name:"DR Congo", code:"+243" },
  { iso:"ET", name:"Ethiopia", code:"+251" },
  { iso:"NG", name:"Nigeria", code:"+234" },
  { iso:"GH", name:"Ghana", code:"+233" },
  { iso:"CM", name:"Cameroon", code:"+237" },
  { iso:"MG", name:"Madagascar", code:"+261" },
  { iso:"MU", name:"Mauritius", code:"+230" },
  { iso:"EG", name:"Egypt", code:"+20" },
  { iso:"MA", name:"Morocco", code:"+212" },
  { iso:"US", name:"United States", code:"+1" },
  { iso:"CA", name:"Canada", code:"+1" },
  { iso:"GB", name:"United Kingdom", code:"+44" },
  { iso:"IE", name:"Ireland", code:"+353" },
  { iso:"DE", name:"Germany", code:"+49" },
  { iso:"FR", name:"France", code:"+33" },
  { iso:"NL", name:"Netherlands", code:"+31" },
  { iso:"CH", name:"Switzerland", code:"+41" },
  { iso:"ES", name:"Spain", code:"+34" },
  { iso:"PT", name:"Portugal", code:"+351" },
  { iso:"IT", name:"Italy", code:"+39" },
  { iso:"SE", name:"Sweden", code:"+46" },
  { iso:"NO", name:"Norway", code:"+47" },
  { iso:"AU", name:"Australia", code:"+61" },
  { iso:"NZ", name:"New Zealand", code:"+64" },
  { iso:"IN", name:"India", code:"+91" },
  { iso:"PK", name:"Pakistan", code:"+92" },
  { iso:"BD", name:"Bangladesh", code:"+880" },
  { iso:"NP", name:"Nepal", code:"+977" },
  { iso:"LK", name:"Sri Lanka", code:"+94" },
  { iso:"PH", name:"Philippines", code:"+63" },
  { iso:"ID", name:"Indonesia", code:"+62" },
  { iso:"CN", name:"China", code:"+86" },
  { iso:"JP", name:"Japan", code:"+81" },
  { iso:"KR", name:"South Korea", code:"+82" },
  { iso:"IL", name:"Israel", code:"+972" },
  { iso:"AE", name:"United Arab Emirates", code:"+971" },
  { iso:"TR", name:"Turkey", code:"+90" },
  { iso:"BR", name:"Brazil", code:"+55" },
  { iso:"MX", name:"Mexico", code:"+52" },
  { iso:"AR", name:"Argentina", code:"+54" },
  { iso:"CO", name:"Colombia", code:"+57" },
  { iso:"PE", name:"Peru", code:"+51" },
  { iso:"CL", name:"Chile", code:"+56" },
];

// Turns what the person typed into international format (+27821234567).
// - If they typed a full number starting with "+", it is used as-is.
// - Otherwise the leading 0 is dropped and the chosen country code is added.
// Returns "" when the result isn't a plausible number (8–15 digits).
const normalizePhone = (iso, raw) => {
  const typed = String(raw || "").trim();
  if (!typed) return "";
  const digits = typed.replace(/\D/g, "");
  if (!digits) return "";
  let full;
  if (typed.startsWith("+")) {
    full = "+" + digits;
  } else {
    const entry = COUNTRY_CODES.find(c => c.iso === iso) || COUNTRY_CODES[0];
    full = entry.code + digits.replace(/^0+/, "");
  }
  return /^\+\d{8,15}$/.test(full) ? full : "";
};

export default function Auth({ onLogin, onGuest }) {
  const [mode, setMode]             = useState("login");
  const [role, setRole]             = useState("");
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  // Phone + WhatsApp opt-in (sign-up only)
  const [phoneIso, setPhoneIso]     = useState("ZA");
  const [phoneNum, setPhoneNum]     = useState("");
  const [waOptIn, setWaOptIn]       = useState(false); // must be ticked by the person — never pre-ticked

  // Email-confirmation help
  const [registered, setRegistered]       = useState(false); // sign-up just succeeded
  const [needsConfirm, setNeedsConfirm]   = useState(false); // tried to sign in before confirming
  const [resending, setResending]         = useState(false);
  const [resendMsg, setResendMsg]         = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // 6-digit code from the confirmation email (an alternative to tapping the link)
  const [otpCode, setOtpCode]     = useState("");
  const [verifying, setVerifying] = useState(false);

  // Supabase only allows one confirmation email per 60 seconds per address.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError("Please enter your email and password."); return; }
    setLoading(true); setError(""); setNeedsConfirm(false); setResendMsg("");
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      if (/not confirmed/i.test(error.message || "")) {
        setNeedsConfirm(true);
        setError("Your email address hasn't been verified yet. Open the confirmation email we sent you, or request a new one below.");
      } else {
        setError(error.message);
      }
      return;
    }
    onLogin(data.user);
  };

  const handleRegister = async () => {
    const cleanEmail = email.trim();
    const cleanName  = name.trim();
    if (!cleanName || !cleanEmail || !password || !role) { setError("Please fill in all fields."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }

    // Phone is optional. If one was typed it must be valid; it is saved in
    // international format (+27...).
    let fullPhone = "";
    if (phoneNum.trim()) {
      fullPhone = normalizePhone(phoneIso, phoneNum);
      if (!fullPhone) {
        setError("That phone number doesn't look right. Enter digits only (e.g. 82 123 4567), or the full number starting with + and the country code.");
        return;
      }
    }

    setLoading(true); setError(""); setResendMsg("");
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail, password,
      options: { data: {
        full_name: cleanName,
        role,
        whatsapp_number: fullPhone || null,
        whatsapp_group_optin: !!(waOptIn && fullPhone),
      } }
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    // Supabase doesn't return an error for signups with an already-registered
    // email (this is intentional, to prevent account enumeration). Instead it
    // returns a user object with an empty `identities` array. A genuinely new
    // signup always has at least one identity — this is the only reliable way
    // to detect the duplicate-email case client-side.
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError("An account with this email already exists. Please sign in instead, or use \"Forgot password?\" if you don't remember your password.");
      return;
    }
    // Note: the "profiles" row is created automatically by a database
    // trigger on auth.users (handle_new_user / on_auth_user_created), server-side.
    // We intentionally don't insert it from the client — signUp() doesn't
    // return an active session when email confirmation is required, so a
    // client-side insert would fail RLS (auth.uid() is null at that point).
    // The phone number and WhatsApp opt-in travel in the sign-up metadata and
    // are copied onto the profile by a second trigger (on_auth_user_created_whatsapp).
    setSuccess("Account created! We've emailed you a 6-digit code. Enter it below, or tap the button in the email.");
    setRegistered(true);
    setResendCooldown(60); // the first email was just sent
  };

  const handleResend = async () => {
    const addr = email.trim();
    if (!addr) { setError("Please enter your email address above first."); return; }
    if (resending || resendCooldown > 0) return;
    setResending(true); setError(""); setResendMsg("");
    const { error } = await supabase.auth.resend({ type: "signup", email: addr });
    setResending(false);
    if (error) { setError(error.message); return; }
    setResendMsg("A new confirmation email is on its way. Please check your inbox and your Spam folder.");
    setResendCooldown(60);
  };

  // Confirms the account with the 6-digit code from the email, which also signs
  // the person in. Supabase's current call is type "email"; "signup" is the older
  // name for the same thing, so it is tried as a fallback.
  const handleVerifyCode = async () => {
    const addr = email.trim();
    const code = otpCode.replace(/\D/g, "");
    if (!addr) { setError("Please enter your email address above first."); return; }
    if (code.length < 6) { setError("Please enter the 6-digit code from your email."); return; }
    if (verifying) return;
    setVerifying(true); setError("");
    let res = await supabase.auth.verifyOtp({ email: addr, token: code, type: "email" });
    if (res.error) res = await supabase.auth.verifyOtp({ email: addr, token: code, type: "signup" });
    setVerifying(false);
    if (res.error || !res.data?.user) {
      setError("That code didn't work. Please check it and try again, or tap \"Resend\" below for a new one.");
      return;
    }
    onLogin(res.data.user);
  };

  // "Ask SendMe to activate me on WhatsApp" — opens WhatsApp with the message
  // already written. Returns "" (button hidden) until a number is set above.
  const activationLink = () => {
    const digits = String(SENDME_WHATSAPP_NUMBER || "").replace(/\D/g, "");
    if (!digits) return "";
    const who = name.trim() ? `I am ${name.trim()} and ` : "";
    const msg = `Hello SendMe, ${who}I registered on the SendMe app with this email: ${email.trim()}. I did not get my confirmation email. Please activate my account. God bless you.`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) { setError("Please enter your email address."); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: "https://sendme-nine.vercel.app",
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSuccess("Password reset email sent! Check your inbox.");
  };

  const inp = {
    width: "100%", padding: "13px 16px", borderRadius: 12,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#eef1ff", fontSize: 15, fontFamily: "Georgia, serif", outline: "none",
    marginBottom: 12, boxSizing: "border-box",
  };

  // ── Forgot Password screen ──────────────────────────────────────────────
  if (forgotMode) return (
    <div style={{
      minHeight: "100vh", background: "#060c18",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, fontFamily: "Georgia, serif",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{
            width: 110, height: 110, borderRadius: "50%",
            border: "3px solid #e8b34b",
            boxShadow: "0 0 0 6px rgba(232,179,75,0.12), 0 0 40px rgba(232,179,75,0.25)",
            overflow: "hidden", flexShrink: 0,
          }}>
            <img src={process.env.PUBLIC_URL + "/Jesus.png"} alt="Jesus Christ"
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
          </div>
        </div>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
            Send<span style={{ color: "#e8b34b" }}>Me</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, marginTop: 6 }}>GLOBAL MISSION FUND</div>
        </div>
        <div style={{ background: "#0c1628", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", padding: "32px 28px" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#eef1ff", marginBottom: 8 }}>Reset Password</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 20, lineHeight: 1.6 }}>
            Enter your email address and we'll send you a link to reset your password.
          </div>
          {error && (
            <div style={{ background: "rgba(240,82,82,0.1)", border: "1px solid rgba(240,82,82,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#f05252" }}>
              ⚠ {error}
            </div>
          )}
          {success && (
            <div style={{ background: "rgba(62,207,142,0.1)", border: "1px solid rgba(62,207,142,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#3ecf8e" }}>
              ✓ {success}
            </div>
          )}
          <input
            type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
            placeholder="Your email address" style={inp}
            onKeyDown={e => e.key === "Enter" && handleForgotPassword()}
          />
          <button onClick={handleForgotPassword} disabled={loading} style={{
            width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg,#e8b34b,#c8942b)",
            color: "#000", fontWeight: 700, cursor: loading ? "default" : "pointer",
            fontSize: 15, fontFamily: "Georgia, serif", opacity: loading ? 0.7 : 1,
            boxShadow: "0 6px 24px rgba(232,179,75,0.44)", marginBottom: 14,
          }}>
            {loading ? "Sending..." : "✉  Send Reset Link"}
          </button>
          <button onClick={() => { setForgotMode(false); setError(""); setSuccess(""); resetEmail && setResetEmail(""); }} style={{
            width: "100%", padding: "12px 0", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)",
            color: "rgba(255,255,255,0.5)", fontWeight: 600, cursor: "pointer",
            fontSize: 14, fontFamily: "Georgia, serif",
          }}>
            ← Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );

  // ── Main Auth screen ────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "#060c18",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, fontFamily: "Georgia, serif",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* ── Jesus Portrait ── */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{
            width: 110, height: 110, borderRadius: "50%",
            border: "3px solid #e8b34b",
            boxShadow: "0 0 0 6px rgba(232,179,75,0.12), 0 0 40px rgba(232,179,75,0.25)",
            overflow: "hidden", flexShrink: 0,
          }}>
            <img
              src={process.env.PUBLIC_URL + "/Jesus.png"}
              alt="Jesus Christ"
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
            />
          </div>
        </div>

        {/* ── Gold SVG Cross ── */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <g filter="url(#glow)">
              <rect x="14" y="0" width="8" height="48" rx="4" fill="url(#crossGold)"/>
              <rect x="0" y="12" width="36" height="8" rx="4" fill="url(#crossGold)"/>
            </g>
            <defs>
              <linearGradient id="crossGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f9d97a"/>
                <stop offset="50%" stopColor="#e8b34b"/>
                <stop offset="100%" stopColor="#c8942b"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* ── Title ── */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
            Send<span style={{ color: "#e8b34b" }}>Me</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, marginTop: 6 }}>
            GLOBAL MISSION FUND
          </div>
          <div style={{ fontSize: 13, color: "#e8b34b", fontStyle: "italic", marginTop: 10 }}>
            "Here am I Lord, send me." — Isaiah 6:8
          </div>
        </div>

        {/* ── Card ── */}
        <div style={{
          background: "#0c1628", borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.08)", padding: "32px 28px",
        }}>

          {/* ── Tabs ── */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            background: "rgba(255,255,255,0.04)", borderRadius: 12,
            padding: 4, marginBottom: 24, gap: 4,
          }}>
            {[
              { key: "login",    label: "Sign In" },
              { key: "register", label: "Create Account" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setMode(key); setError(""); setSuccess(""); setRegistered(false); setNeedsConfirm(false); setResendMsg(""); }}
                style={{
                  padding: "11px 0", borderRadius: 10, border: "none", cursor: "pointer",
                  background: mode === key
                    ? "linear-gradient(135deg,#e8b34b,#c8942b)"
                    : "transparent",
                  color: mode === key ? "#000" : "rgba(255,255,255,0.4)",
                  fontWeight: 700, fontSize: 14, fontFamily: "Georgia, serif",
                  transition: "all .2s", textAlign: "center",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Error / Success ── */}
          {error && (
            <div style={{
              background: "rgba(240,82,82,0.1)", border: "1px solid rgba(240,82,82,0.3)",
              borderRadius: 10, padding: "10px 14px", marginBottom: 16,
              fontSize: 13, color: "#f05252",
            }}>
              ⚠ {error}
            </div>
          )}
          {success && (
            <div style={{
              background: "rgba(62,207,142,0.1)", border: "1px solid rgba(62,207,142,0.3)",
              borderRadius: 10, padding: "10px 14px", marginBottom: 16,
              fontSize: 13, color: "#3ecf8e",
            }}>
              ✓ {success}
            </div>
          )}

          {/* ── Confirmation help (after sign-up, or sign-in before confirming) ── */}
          {(registered || needsConfirm) && (
            <>
              {/* Option 1: type the 6-digit code from the email */}
              <div style={{
                background: "rgba(91,156,246,0.07)", border: "1px solid rgba(91,156,246,0.25)",
                borderRadius: 10, padding: "12px 14px", marginBottom: 12,
              }}>
                <div style={{ color: "#5b9cf6", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>🔢 Enter the 6-digit code from your email</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8}
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={e => { if (e.key === "Enter") handleVerifyCode(); }}
                    placeholder="123456"
                    aria-label="6-digit confirmation code"
                    style={{ ...inp, marginBottom: 0, flex: 1, minWidth: 0, letterSpacing: 4, textAlign: "center", fontSize: 18 }}
                  />
                  <button
                    type="button" onClick={handleVerifyCode}
                    disabled={verifying || otpCode.length < 6}
                    style={{
                      padding: "0 18px", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 14,
                      fontFamily: "Georgia, serif", background: "linear-gradient(135deg,#e8b34b,#c8942b)", color: "#000",
                      cursor: (verifying || otpCode.length < 6) ? "default" : "pointer",
                      opacity: (verifying || otpCode.length < 6) ? 0.6 : 1,
                    }}
                  >
                    {verifying ? "Checking..." : "Verify"}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 8, lineHeight: 1.5 }}>
                  You can also tap the button in the email instead — either one works.
                </div>
              </div>

              {/* Option 2: can't find it */}
              <div style={{
                background: "rgba(232,179,75,0.08)", border: "1px solid rgba(232,179,75,0.25)",
                borderRadius: 10, padding: "12px 14px", marginBottom: 16,
                fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.7,
              }}>
                <div style={{ color: "#e8b34b", fontWeight: 700, marginBottom: 4 }}>📬 Can't find the email?</div>
                <div>
                  Please check your <strong>Spam</strong>, <strong>Junk</strong> or <strong>Promotions</strong> folder —
                  confirmation emails often end up there. The code and the button stay valid for {CONFIRM_LINK_HOURS} hours.
                </div>
                {resendMsg && <div style={{ color: "#3ecf8e", marginTop: 8 }}>✓ {resendMsg}</div>}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || resendCooldown > 0}
                  style={{
                    marginTop: 10, width: "100%", padding: "10px 0", borderRadius: 10,
                    border: "1px solid rgba(232,179,75,0.4)", background: "rgba(232,179,75,0.1)",
                    color: "#e8b34b", fontWeight: 700, fontSize: 13, fontFamily: "Georgia, serif",
                    cursor: (resending || resendCooldown > 0) ? "default" : "pointer",
                    opacity: (resending || resendCooldown > 0) ? 0.6 : 1,
                  }}
                >
                  {resending ? "Sending..." : resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : "✉ Resend confirmation email"}
                </button>
                {activationLink() && (
                  <>
                    <a
                      href={activationLink()} target="_blank" rel="noopener noreferrer"
                      style={{
                        display: "block", textAlign: "center", textDecoration: "none", marginTop: 10,
                        padding: "10px 0", borderRadius: 10, border: "1px solid rgba(37,211,102,0.4)",
                        background: "rgba(37,211,102,0.08)", color: "#25d366", fontWeight: 700,
                        fontSize: 13, fontFamily: "Georgia, serif",
                      }}
                    >
                      💬 Still nothing? Ask SendMe to activate me on WhatsApp
                    </a>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6, lineHeight: 1.5 }}>
                      SendMe will activate your account and message you back. Then just sign in with your email and password.
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* ── Register-only fields ── */}
          {mode === "register" && (
            <>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Full name" style={inp}
              />
              <select
                value={role} onChange={e => setRole(e.target.value)}
                style={{ ...inp, color: role ? "#eef1ff" : "rgba(255,255,255,0.35)" }}
              >
                <option value="" style={{ background: "#0c1628", color: "#eef1ff" }}>I am a...</option>
                <option value="donor"      style={{ background: "#0c1628", color: "#eef1ff" }}>Donor / Supporter</option>
                <option value="missionary" style={{ background: "#0c1628", color: "#eef1ff" }}>Missionary</option>
                <option value="pastor"     style={{ background: "#0c1628", color: "#eef1ff" }}>Pastor (Senior Leader)</option>
                <option value="org_leader" style={{ background: "#0c1628", color: "#eef1ff" }}>Missionary-Sending Organization</option>
                <option value="minister"   style={{ background: "#0c1628", color: "#eef1ff" }}>Minister / Evangelist</option>
              </select>
            </>
          )}

          {/* ── Email ── */}
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email address" style={inp}
          />

          {/* ── Phone with country code + WhatsApp opt-in (register only) ── */}
          {mode === "register" && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <select
                  value={phoneIso} onChange={e => setPhoneIso(e.target.value)}
                  aria-label="Country code"
                  style={{ ...inp, flex: "1 1 50%", width: "auto", minWidth: 0, marginBottom: 0, padding: "13px 10px", fontSize: 14 }}
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.iso} value={c.iso} style={{ background: "#0c1628", color: "#eef1ff" }}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
                <input
                  type="tel" inputMode="tel" autoComplete="tel-national"
                  value={phoneNum} onChange={e => setPhoneNum(e.target.value)}
                  placeholder="Phone (optional)"
                  style={{ ...inp, flex: "1 1 50%", width: "auto", minWidth: 0, marginBottom: 0 }}
                />
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 12, lineHeight: 1.5 }}>
                No need to type the leading 0 — e.g. 82 123 4567. Or type the full number starting with +.
              </div>

              {phoneNum.trim() && (
                <label style={{
                  display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer",
                  background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.22)",
                  borderRadius: 12, padding: "12px 14px", marginBottom: 12,
                }}>
                  <input
                    type="checkbox" checked={waOptIn} onChange={e => setWaOptIn(e.target.checked)}
                    style={{ width: 20, height: 20, marginTop: 2, accentColor: "#25d366", flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
                    <strong style={{ color: "#25d366" }}>📲 Add my number to the SendMe WhatsApp group</strong>{" "}
                    so I receive updates on my application and mission progress.
                    <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                      Optional. Other members of the group may be able to see your number.
                    </span>
                  </span>
                </label>
              )}
            </>
          )}

          {/* ── Password with eye toggle ── */}
          <div style={{ position: "relative", marginBottom: 4 }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              style={{ ...inp, marginBottom: 0, paddingRight: 48 }}
              onKeyDown={e => e.key === "Enter" && (mode === "login" ? handleLogin() : handleRegister())}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.35)", fontSize: 18, padding: 0, lineHeight: 1,
              }}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>

          {/* ── Forgot password link (login mode only) ── */}
          {mode === "login" && (
            <div style={{ textAlign: "right", marginBottom: 16, marginTop: 6 }}>
              <button
                onClick={() => { setForgotMode(true); setError(""); setSuccess(""); setResetEmail(email); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#e8b34b", fontSize: 12, fontFamily: "Georgia, serif",
                  textDecoration: "underline", padding: 0,
                }}
              >
                Forgot password?
              </button>
            </div>
          )}
          {mode === "register" && <div style={{ marginBottom: 4 }} />}

          {/* ── Submit button ── */}
          <button
            onClick={mode === "login" ? handleLogin : handleRegister}
            disabled={loading}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg,#e8b34b,#c8942b)",
              color: "#000", fontWeight: 700, cursor: loading ? "default" : "pointer",
              fontSize: 15, fontFamily: "Georgia, serif",
              opacity: loading ? 0.7 : 1,
              boxShadow: "0 6px 24px rgba(232,179,75,0.44)",
              marginBottom: 10,
            }}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "✝  Sign In to SendMe"
              : "✝  Create My Account"}
          </button>

          {/* ── Divider ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }}/>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }}/>
          </div>

          {/* ── Guest button ── */}
          <button
            onClick={onGuest}
            style={{
              width: "100%", padding: "12px 0", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)",
              fontWeight: 600, cursor: "pointer", fontSize: 14,
              fontFamily: "Georgia, serif",
            }}
          >
            Browse Missions as Guest →
          </button>

          <div style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 16 }}>
            🔒 Your data is secure · SendMe is a non-profit platform
          </div>
        </div>

        {/* ── Introduction video ── */}
        {FEATURED_VIDEOS.missionVision && (
          <div style={{ marginTop: 24 }}>
            <div style={{ textAlign: "center", fontSize: 13, color: "#e8b34b", fontWeight: 700, marginBottom: 10 }}>
              ▶ New to SendMe? Watch this short introduction
            </div>
            <YouTubeEmbed videoId={FEATURED_VIDEOS.missionVision} title="SendMe — Vision & Mission" />
          </div>
        )}
      </div>
    </div>
  );
}
