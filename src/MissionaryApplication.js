import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { notifyAdmin } from "./notifications";

const inp = {
  width: "100%", padding: "13px 16px", borderRadius: 12, boxSizing: "border-box",
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#eef1ff", fontSize: 15, fontFamily: "Georgia, serif", outline: "none",
  marginBottom: 14, transition: "border .2s",
};
const inpFocus = { border: "1px solid rgba(232,179,75,0.6)", background: "rgba(232,179,75,0.05)" };
const textarea = { ...inp, resize: "vertical", minHeight: 100, lineHeight: 1.7 };
const label = { fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7, display: "block" };
const sectionTitle = { fontSize: 16, fontWeight: 700, color: "#eef1ff", marginBottom: 18, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)" };

const STEPS = [
  { number:1, label:"Personal", icon:"✝" },
  { number:2, label:"Calling",  icon:"🌍" },
  { number:3, label:"Church",   icon:"⛪" },
  { number:4, label:"Mission",  icon:"📋" },
  { number:5, label:"Submit",   icon:"🙏" },
];

const CURRENCIES = [
  { code:"USD", label:"US Dollar (USD)" },
  { code:"AED", label:"UAE Dirham (AED)" },
  { code:"ARS", label:"Argentine Peso (ARS)" },
  { code:"AUD", label:"Australian Dollar (AUD)" },
  { code:"BDT", label:"Bangladeshi Taka (BDT)" },
  { code:"BRL", label:"Brazilian Real (BRL)" },
  { code:"CAD", label:"Canadian Dollar (CAD)" },
  { code:"CHF", label:"Swiss Franc (CHF)" },
  { code:"CLP", label:"Chilean Peso (CLP)" },
  { code:"CNY", label:"Chinese Yuan (CNY)" },
  { code:"COP", label:"Colombian Peso (COP)" },
  { code:"CZK", label:"Czech Koruna (CZK)" },
  { code:"DKK", label:"Danish Krone (DKK)" },
  { code:"EGP", label:"Egyptian Pound (EGP)" },
  { code:"ETB", label:"Ethiopian Birr (ETB)" },
  { code:"EUR", label:"Euro (EUR)" },
  { code:"GBP", label:"British Pound (GBP)" },
  { code:"GHS", label:"Ghanaian Cedi (GHS)" },
  { code:"HKD", label:"Hong Kong Dollar (HKD)" },
  { code:"HUF", label:"Hungarian Forint (HUF)" },
  { code:"IDR", label:"Indonesian Rupiah (IDR)" },
  { code:"ILS", label:"Israeli Shekel (ILS)" },
  { code:"INR", label:"Indian Rupee (INR)" },
  { code:"JPY", label:"Japanese Yen (JPY)" },
  { code:"KES", label:"Kenyan Shilling (KES)" },
  { code:"KRW", label:"South Korean Won (KRW)" },
  { code:"LKR", label:"Sri Lankan Rupee (LKR)" },
  { code:"MAD", label:"Moroccan Dirham (MAD)" },
  { code:"MWK", label:"Malawian Kwacha (MWK)" },
  { code:"MXN", label:"Mexican Peso (MXN)" },
  { code:"MYR", label:"Malaysian Ringgit (MYR)" },
  { code:"MZN", label:"Mozambican Metical (MZN)" },
  { code:"NAD", label:"Namibian Dollar (NAD)" },
  { code:"NGN", label:"Nigerian Naira (NGN)" },
  { code:"NOK", label:"Norwegian Krone (NOK)" },
  { code:"NPR", label:"Nepalese Rupee (NPR)" },
  { code:"NZD", label:"New Zealand Dollar (NZD)" },
  { code:"PEN", label:"Peruvian Sol (PEN)" },
  { code:"PHP", label:"Philippine Peso (PHP)" },
  { code:"PKR", label:"Pakistani Rupee (PKR)" },
  { code:"PLN", label:"Polish Zloty (PLN)" },
  { code:"RON", label:"Romanian Leu (RON)" },
  { code:"RWF", label:"Rwandan Franc (RWF)" },
  { code:"SEK", label:"Swedish Krona (SEK)" },
  { code:"SGD", label:"Singapore Dollar (SGD)" },
  { code:"THB", label:"Thai Baht (THB)" },
  { code:"TZS", label:"Tanzanian Shilling (TZS)" },
  { code:"UGX", label:"Ugandan Shilling (UGX)" },
  { code:"UAH", label:"Ukrainian Hryvnia (UAH)" },
  { code:"VND", label:"Vietnamese Dong (VND)" },
  { code:"XAF", label:"Central African CFA Franc (XAF)" },
  { code:"XOF", label:"West African CFA Franc (XOF)" },
  { code:"ZAR", label:"South African Rand (ZAR)" },
  { code:"ZMW", label:"Zambian Kwacha (ZMW)" },
];

// Converts an amount in fromCurrency to USD using the fawazahmed0 currency API
// (free, no API key required, 170+ currencies including all African currencies).
const convertToUSD = async (amount, fromCurrency) => {
  if (!amount || Number(amount) <= 0) return null;
  if (fromCurrency === "USD") return Number(amount);
  const lowerCurrency = fromCurrency.toLowerCase();
  const toDateString = (d) => d.toISOString().split("T")[0];
  const today = toDateString(new Date());
  const yesterday = toDateString(new Date(Date.now() - 86400000));

  const fetchRate = async (dateStr) => {
    const res = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr}/v1/currencies/usd.json`
    );
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    const rate = data?.usd?.[lowerCurrency];
    if (!rate) throw new Error("Currency not found: " + lowerCurrency);
    return rate;
  };

  try {
    let rate;
    try { rate = await fetchRate(today); }
    catch { rate = await fetchRate(yesterday); }
    return Number(amount) / rate;
  } catch {
    return null;
  }
};

// Fix: missions never had lat/lng geocoded at all (unlike churches, which
// got a geocoding fix earlier). A mission with no lat/lng defaults to (0,0)
// on the map — the Gulf of Guinea near Gabon — regardless of the actual
// target country. Same hardcoded Mapbox token fallback used in MapboxMap.js
// and AdminChurchVerification.js — Vercel renames REACT_APP_ prefixed env
// vars, so process.env.REACT_APP_MAPBOX_TOKEN is undefined in production.
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN ||
  "pk.eyJ1Ijoic2VuZG1lMDkyMyIsImEiOiJjbXI1anZpOGcwYXJvMzFyMHo2aDU2YnI2In0.CutnKCVEf1SzDpddacdekg";

const geocodeMissionLocation = async (area, country) => {
  try {
    const token = MAPBOX_TOKEN;
    if (!token || !country) return { lat: null, lng: null };
    const parts = [area, country].filter(Boolean).join(", ");
    const query = encodeURIComponent(parts.trim());
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&limit=1`
    );
    if (!res.ok) return { lat: null, lng: null };
    const data = await res.json();
    if (data?.features?.length > 0) {
      const feature = data.features[0];
      const [lng, lat] = feature.center;

      // Sanity check against country (missions don't have a province field
      // like churches do, but country is just as reliable a cross-check).
      // If it doesn't match, leave coordinates blank rather than silently
      // saving a wrong pin — same pattern used for church geocoding.
      const countryCtx = (feature.context || []).find(c => c.id?.startsWith("country"));
      const countryText = (countryCtx?.text || feature.place_name || "").toLowerCase();
      const enteredCountry = country.toLowerCase();
      const matches = countryText && (
        countryText.includes(enteredCountry) || enteredCountry.includes(countryText)
      );
      if (!matches) {
        console.warn(`Mission geocode mismatch: expected country "${country}" but got "${countryText}" for query "${parts}". Leaving coordinates blank.`);
        return { lat: null, lng: null };
      }

      return { lat, lng };
    }
    return { lat: null, lng: null };
  } catch (e) {
    console.warn("Mission geocoding failed:", e);
    return { lat: null, lng: null };
  }
};

const ROLES   = ["Missionary","Evangelist","Pastor","Church Planter","Bible Distributor","Medical Missionary","Children's Minister","Other"];
const REGIONS = ["Africa","Asia","South America","Middle East","Europe","North America","Pacific Islands","Central Asia","Other"];

// Mirrors RISK_LEVELS / RiskBadge in App.js (level 1-4; level 0 "Unknown" is the
// pre-existing DB fallback and isn't offered as a self-select choice here).
const ACCESS_LEVELS = [
  { level:"1", label:"Easy Access",       dot:"🟢", desc:"Safe, established access — no significant travel or entry barriers" },
  { level:"2", label:"Rural Area",        dot:"🟡", desc:"Remote or rural setting, harder to reach but not restricted" },
  { level:"3", label:"Difficult Terrain", dot:"🟠", desc:"Challenging travel/terrain or limited infrastructure" },
  { level:"4", label:"High Risk",         dot:"🔴", desc:"Security, political, or persecution risk in this field" },
];

const FInput = ({ label: lbl, ...props }) => {
  const [focused, setFocused] = useState(false);
  const isTextarea = props.as === "textarea";
  const El = isTextarea ? "textarea" : "input";
  return (
    <div>
      {lbl && <label style={label}>{lbl}</label>}
      <El {...props} as={undefined}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ ...(isTextarea ? textarea : inp), ...(focused ? inpFocus : {}) }}/>
    </div>
  );
};

const FSelect = ({ label: lbl, children, value, onChange }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {lbl && <label style={label}>{lbl}</label>}
      <select value={value} onChange={onChange}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ ...inp, color: value ? "#eef1ff" : "rgba(255,255,255,0.35)", ...(focused ? inpFocus : {}) }}>
        {children}
      </select>
    </div>
  );
};

const StepBar = ({ current }) => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:0, marginBottom:32, padding:"0 8px" }}>
    {STEPS.map((s, i) => {
      const done=s.number<current, active=s.number===current;
      return (
        <div key={s.number} style={{ display:"flex", alignItems:"center", flex:i<STEPS.length-1?1:"none" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, flexShrink:0 }}>
            <div style={{ width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,transition:"all .3s",
              background:done||active?"linear-gradient(135deg,#e8b34b,#c8942b)":"rgba(255,255,255,0.05)",
              border:done||active?"none":"1px solid rgba(255,255,255,0.1)",
              color:done||active?"#000":"rgba(255,255,255,0.25)",
              boxShadow:active?"0 0 18px rgba(232,179,75,0.5)":"none" }}>
              {done?"✓":s.icon}
            </div>
            <span style={{ fontSize:10,letterSpacing:1,whiteSpace:"nowrap",
              color:active?"#e8b34b":done?"rgba(232,179,75,0.6)":"rgba(255,255,255,0.2)",
              fontWeight:active?700:400 }}>{s.label}</span>
          </div>
          {i<STEPS.length-1 && (
            <div style={{ flex:1,height:2,margin:"0 4px",marginBottom:18,
              background:done?"linear-gradient(90deg,#e8b34b,#c8942b)":"rgba(255,255,255,0.07)",
              transition:"background .4s" }}/>
          )}
        </div>
      );
    })}
  </div>
);

const Step1 = ({ form, set }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
    <div style={sectionTitle}>Personal Information</div>
    <FInput label="Full Name *" placeholder="Your full name" value={form.fullName} onChange={e=>set("fullName",e.target.value)}/>
    <FInput label="Email Address *" type="email" placeholder="your@email.com" value={form.email} onChange={e=>set("email",e.target.value)}/>
    <FInput label="Phone Number" type="tel" placeholder="+27 82 000 0000" value={form.phone} onChange={e=>set("phone",e.target.value)}/>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
      <FInput label="Country of Birth" placeholder="e.g. South Africa" value={form.birthCountry} onChange={e=>set("birthCountry",e.target.value)}/>
      <FInput label="Current Country" placeholder="e.g. Nigeria" value={form.currentCountry} onChange={e=>set("currentCountry",e.target.value)}/>
    </div>
    <FInput label="Home Address" placeholder="Street, City, Province" value={form.address} onChange={e=>set("address",e.target.value)}/>
    <FSelect label="Missionary Role *" value={form.role} onChange={e=>set("role",e.target.value)}>
      <option value="" style={{background:"#0c1628"}}>Select your role...</option>
      {ROLES.map(r=><option key={r} value={r} style={{background:"#0c1628"}}>{r}</option>)}
    </FSelect>
  </div>
);

const Step2 = ({ form, set }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
    <div style={sectionTitle}>Your Calling & Testimony</div>
    <FSelect label="How long have you been a Message believer? *" value={form.yearsBeliever} onChange={e=>set("yearsBeliever",e.target.value)}>
      <option value="" style={{background:"#0c1628"}}>Select years...</option>
      {Array.from({length:50},(_,i)=>i+1).map(y=>(
        <option key={y} value={y} style={{background:"#0c1628"}}>{y} {y===1?"year":"years"}</option>
      ))}
    </FSelect>
    <div style={{ marginBottom:14 }}>
      <label style={label}>Describe your calling to the mission field *</label>
      <textarea placeholder="Share how the Lord called you..." value={form.calling} onChange={e=>set("calling",e.target.value)} style={{...textarea,minHeight:130}}/>
    </div>
    <div style={{ marginBottom:14 }}>
      <label style={label}>Your personal testimony *</label>
      <textarea placeholder="How did you come to faith?" value={form.testimony} onChange={e=>set("testimony",e.target.value)} style={{...textarea,minHeight:130}}/>
    </div>
    <div style={{ marginBottom:14 }}>
      <label style={label}>Previous mission or ministry experience</label>
      <textarea placeholder="Any previous ministry work..." value={form.experience} onChange={e=>set("experience",e.target.value)} style={textarea}/>
    </div>
    <div style={{ background:"rgba(176,108,245,0.08)",borderRadius:14,border:"1px solid rgba(176,108,245,0.25)",padding:"16px 18px",marginTop:4 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div>
          <div style={{ fontSize:14,fontWeight:700,color:"#eef1ff",marginBottom:4 }}>Request Shadow Mode</div>
          <div style={{ fontSize:12,color:"rgba(255,255,255,0.4)",lineHeight:1.6,maxWidth:320 }}>Enable if working in a region where your identity must be protected.</div>
        </div>
        <div onClick={()=>set("shadowMode",!form.shadowMode)}
          style={{ width:48,height:28,borderRadius:999,cursor:"pointer",
            background:form.shadowMode?"linear-gradient(135deg,#b06cf5,#8a4fd4)":"rgba(255,255,255,0.1)",
            position:"relative",transition:"background .25s",flexShrink:0,
            border:form.shadowMode?"none":"1px solid rgba(255,255,255,0.15)" }}>
          <div style={{ position:"absolute",top:3,width:22,height:22,borderRadius:"50%",background:"#fff",transition:"left .25s",left:form.shadowMode?23:3,boxShadow:"0 1px 4px rgba(0,0,0,0.4)" }}/>
        </div>
      </div>
    </div>
  </div>
);

// Step 3 — Church & Endorsement
// Loads registered SendMe churches from Supabase and lets the missionary
// select their church from a dropdown. This links the mission to the church's
// banking details so payouts go to the right account automatically.
// If their church is not yet registered, they can toggle to manual entry —
// the mission is saved with church_verified=false and flagged in AdminPayouts.
const Step3 = ({ form, set, churches, churchesLoading }) => {
  const manualMode = form.churchNotOnSendMe;

  const handleChurchSelect = (e) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      set("churchId", "");
      set("churchName", "");
      set("pastorName", "");
      set("pastorEmail", "");
      set("pastorPhone", "");
      set("churchCity", "");
      set("churchCountry", "");
      set("churchVerified", false);
      return;
    }
    const church = churches.find(c => c.id === selectedId);
    if (church) {
      set("churchId", church.id);
      set("churchName", church.name);
      set("pastorName", church.pastor_name || "");
      set("pastorEmail", church.pastor_email || "");
      set("pastorPhone", church.pastor_phone || "");
      set("churchCity", church.city || "");
      set("churchCountry", church.country || "");
      set("churchVerified", true);
    }
  };

  const toggleManual = () => {
    const next = !manualMode;
    set("churchNotOnSendMe", next);
    // Clear any previously selected church when switching modes
    set("churchId", "");
    set("churchName", "");
    set("pastorName", "");
    set("pastorEmail", "");
    set("pastorPhone", "");
    set("churchCity", "");
    set("churchCountry", "");
    set("churchVerified", false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
      <div style={sectionTitle}>Church & Endorsement</div>

      {/* Accountability notice */}
      <div style={{ background:"rgba(232,179,75,0.07)",borderRadius:12,border:"1px solid rgba(232,179,75,0.2)",padding:"14px 16px",marginBottom:18 }}>
        <div style={{ fontSize:13,color:"rgba(255,255,255,0.6)",lineHeight:1.7 }}>
          All missionaries must be endorsed by a <strong style={{color:"#e8b34b"}}>verified Message-believing church</strong>.<br/>
          <strong style={{color:"#e8b34b"}}>Mission funds are paid directly to the church</strong> — the church takes financial accountability for this mission.
        </div>
      </div>

      {!manualMode ? (
        <>
          {/* Registered church dropdown */}
          <label style={label}>Select Your Sending Church *</label>
          {churchesLoading ? (
            <div style={{ ...inp, color:"rgba(255,255,255,0.3)", display:"flex", alignItems:"center" }}>Loading registered churches...</div>
          ) : (
            <select value={form.churchId || ""} onChange={handleChurchSelect}
              style={{ ...inp, color: form.churchId ? "#eef1ff" : "rgba(255,255,255,0.35)" }}>
              <option value="" style={{background:"#0c1628"}}>— Select your church —</option>
              {churches.map(c => (
                <option key={c.id} value={c.id} style={{background:"#0c1628"}}>
                  {c.name} — {c.city}, {c.country}
                </option>
              ))}
            </select>
          )}

          {/* Show selected church details as confirmation */}
          {form.churchId && (
            <div style={{ background:"rgba(62,207,142,0.07)",borderRadius:12,border:"1px solid rgba(62,207,142,0.25)",padding:"14px 16px",marginBottom:14 }}>
              <div style={{ fontSize:12,color:"rgba(62,207,142,0.8)",letterSpacing:1,textTransform:"uppercase",marginBottom:8 }}>✓ Church Selected</div>
              <div style={{ fontSize:13,color:"rgba(255,255,255,0.7)",lineHeight:1.8 }}>
                <strong style={{color:"#eef1ff"}}>{form.churchName}</strong><br/>
                Pastor: {form.pastorName} · {form.pastorEmail}<br/>
                {form.churchCity && <>{form.churchCity}, {form.churchCountry}</>}
              </div>
              <div style={{ fontSize:12,color:"rgba(62,207,142,0.7)",marginTop:8 }}>
                🏦 Funds will be paid to this church's registered bank account upon milestone completion.
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Manual fallback — church not yet on SendMe */}
          <div style={{ background:"rgba(232,179,75,0.07)",borderRadius:12,border:"1px solid rgba(232,179,75,0.2)",padding:"12px 16px",marginBottom:14 }}>
            <div style={{ fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.7 }}>
              ⚠️ Your application will be marked as <strong style={{color:"#e8b34b"}}>pending church registration</strong>. SendMe admin will contact your pastor to register the church before your mission can be approved.
            </div>
          </div>
          <FInput label="Home Church Name *" placeholder="e.g. Eagle Ministry Tabernacle" value={form.churchName} onChange={e=>set("churchName",e.target.value)}/>
          <FInput label="Pastor / Minister Name *" placeholder="Full name of your pastor" value={form.pastorName} onChange={e=>set("pastorName",e.target.value)}/>
          <FInput label="Pastor's Email Address *" type="email" placeholder="pastor@yourchurch.org" value={form.pastorEmail} onChange={e=>set("pastorEmail",e.target.value)}/>
          <FInput label="Pastor's Phone Number" type="tel" placeholder="+27 82 000 0000" value={form.pastorPhone} onChange={e=>set("pastorPhone",e.target.value)}/>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <FInput label="Church City" placeholder="City" value={form.churchCity} onChange={e=>set("churchCity",e.target.value)}/>
            <FInput label="Church Country" placeholder="Country" value={form.churchCountry} onChange={e=>set("churchCountry",e.target.value)}/>
          </div>
          <FInput label="Church Website (optional)" placeholder="https://www.yourchurch.org" value={form.churchWebsite} onChange={e=>set("churchWebsite",e.target.value)}/>
        </>
      )}

      {/* Toggle between modes */}
      <div onClick={toggleManual}
        style={{ display:"flex",gap:14,alignItems:"center",padding:"12px 16px",borderRadius:12,cursor:"pointer",marginTop:4,
          background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",transition:"all .2s" }}>
        <div style={{ width:20,height:20,borderRadius:4,flexShrink:0,
          background:manualMode?"linear-gradient(135deg,#e8b34b,#c8942b)":"rgba(255,255,255,0.05)",
          border:manualMode?"none":"1px solid rgba(255,255,255,0.15)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#000",fontWeight:700 }}>
          {manualMode?"✓":""}
        </div>
        <span style={{ fontSize:13,color:"rgba(255,255,255,0.45)",lineHeight:1.5 }}>
          My church is not yet registered on SendMe — I will enter details manually
        </span>
      </div>
    </div>
  );
};

const FundingGoalCurrency = ({ form, set }) => {
  const [converting, setConverting] = useState(false);
  const [rateError, setRateError] = useState(false);

  useEffect(() => {
    if (!form.localAmount || Number(form.localAmount) <= 0) {
      set("fundingGoal", "");
      return;
    }
    if (form.localCurrency === "USD") {
      set("fundingGoal", form.localAmount);
      setRateError(false);
      return;
    }
    setConverting(true);
    setRateError(false);
    const timer = setTimeout(async () => {
      const usd = await convertToUSD(form.localAmount, form.localCurrency);
      if (usd === null) {
        setRateError(true);
        set("fundingGoal", "");
      } else {
        set("fundingGoal", Math.round(usd).toString());
      }
      setConverting(false);
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.localAmount, form.localCurrency]);

  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div>
          <label style={label}>Your Funding Goal *</label>
          <input type="number" placeholder="0" value={form.localAmount}
            onChange={e=>set("localAmount", e.target.value)}
            style={{ ...inp, marginBottom:0 }}/>
        </div>
        <div>
          <label style={label}>In Currency *</label>
          <select value={form.localCurrency} onChange={e=>set("localCurrency", e.target.value)}
            style={{ ...inp, marginBottom:0, color:"#eef1ff" }}>
            {CURRENCIES.map(c=>(
              <option key={c.code} value={c.code} style={{background:"#0c1628"}}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ marginTop:10, minHeight:48 }}>
        {form.localCurrency !== "USD" && Number(form.localAmount) > 0 && (
          <div style={{ background:"rgba(232,179,75,0.07)",borderRadius:10,border:"1px solid rgba(232,179,75,0.2)",padding:"10px 14px",display:"flex",alignItems:"center",gap:10 }}>
            {converting ? (
              <span style={{ fontSize:13,color:"rgba(255,255,255,0.45)" }}>Converting to USD...</span>
            ) : rateError ? (
              <span style={{ fontSize:13,color:"#f05252" }}>Couldn't fetch a live exchange rate. Please check your connection and try again, or enter your goal directly in USD above.</span>
            ) : form.fundingGoal ? (
              <>
                <span style={{ fontSize:13,color:"rgba(255,255,255,0.5)" }}>≈</span>
                <span style={{ fontSize:18,fontWeight:700,color:"#e8b34b" }}>${Number(form.fundingGoal).toLocaleString()} USD</span>
                <span style={{ fontSize:12,color:"rgba(255,255,255,0.35)",marginLeft:"auto" }}>This USD amount will be locked in once you submit</span>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

const Step4 = ({ form, set }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
    <div style={sectionTitle}>Mission Details</div>
    <FInput label="Mission Title *" placeholder="e.g. Gospel & Food Aid — Merkato District" value={form.missionTitle} onChange={e=>set("missionTitle",e.target.value)}/>
    <FSelect label="Target Region *" value={form.targetRegion} onChange={e=>set("targetRegion",e.target.value)}>
      <option value="" style={{background:"#0c1628"}}>Select region...</option>
      {REGIONS.map(r=><option key={r} value={r} style={{background:"#0c1628"}}>{r}</option>)}
    </FSelect>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
      <FInput label="Target Country *" placeholder="e.g. Ethiopia" value={form.targetCountry} onChange={e=>set("targetCountry",e.target.value)}/>
      <FInput label="Specific Area / District" placeholder="e.g. Merkato District" value={form.targetArea} onChange={e=>set("targetArea",e.target.value)}/>
    </div>
    <div style={{ marginBottom:14 }}>
      <label style={label}>Field Access / Conditions *</label>
      <select value={form.riskLevel} onChange={e=>set("riskLevel",e.target.value)}
        style={{ ...inp, color: form.riskLevel ? "#eef1ff" : "rgba(255,255,255,0.35)", marginBottom:6 }}>
        <option value="" style={{background:"#0c1628"}}>Select field conditions...</option>
        {ACCESS_LEVELS.map(a=>(
          <option key={a.level} value={a.level} style={{background:"#0c1628"}}>{a.dot} {a.label}</option>
        ))}
      </select>
      <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", lineHeight:1.6 }}>
        {ACCESS_LEVELS.find(a=>a.level===form.riskLevel)?.desc || "This shows donors what to expect getting workers and supplies to the field — pick the closest match."}
      </div>
    </div>
    <div style={{ marginBottom:14 }}>
      <label style={label}>Describe your mission *</label>
      <textarea placeholder="What will you do? Who are you reaching?" value={form.missionDescription} onChange={e=>set("missionDescription",e.target.value)} style={{...textarea,minHeight:140}}/>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
      <FInput label="Mission Start Date" type="date" value={form.startDate} onChange={e=>set("startDate",e.target.value)}/>
      <FSelect label="Expected Duration" value={form.duration} onChange={e=>set("duration",e.target.value)}>
        <option value="" style={{background:"#0c1628"}}>Select duration...</option>
        {Array.from({length:72},(_,i)=>i+1).map(m=>(
          <option key={m} value={m} style={{background:"#0c1628"}}>{m} {m===1?"month":"months"}</option>
        ))}
      </FSelect>
    </div>
    <FundingGoalCurrency form={form} set={set}/>
    <div style={{ background:"rgba(91,156,246,0.07)",borderRadius:14,border:"1px solid rgba(91,156,246,0.25)",padding:"16px 18px",marginBottom:14 }}>
      <div style={{ display:"flex",gap:10,marginBottom:8 }}>
        <span style={{ fontSize:18,flexShrink:0 }}>🌐</span>
        <div style={{ fontSize:13,color:"rgba(255,255,255,0.55)",lineHeight:1.7 }}>
          SendMe operates across multiple countries and currencies. To keep this platform completely free for missionaries and donors worldwide, a <strong style={{color:"#5b9cf6"}}>10% platform surcharge</strong> is applied on top of your funding goal. This covers international payment processing, currency conversion, platform maintenance, and operational costs.
        </div>
      </div>
      {Number(form.fundingGoal) > 0 && (
        <div style={{ background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"12px 14px",marginTop:6,display:"flex",flexDirection:"column",gap:6 }}>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:13 }}>
            <span style={{ color:"rgba(255,255,255,0.4)" }}>Your funding goal</span>
            <span style={{ color:"#eef1ff" }}>${Number(form.fundingGoal).toLocaleString()}</span>
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:13 }}>
            <span style={{ color:"rgba(255,255,255,0.4)" }}>Platform surcharge (10%)</span>
            <span style={{ color:"#5b9cf6" }}>${Math.round(Number(form.fundingGoal)*0.1).toLocaleString()}</span>
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700,borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:8,marginTop:2 }}>
            <span style={{ color:"#eef1ff" }}>Donors will be asked for</span>
            <span style={{ color:"#e8b34b" }}>${Math.round(Number(form.fundingGoal)*1.1).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
    <FInput label="Milestone 1 — First goal" placeholder="e.g. First open-air crusade" value={form.milestone1} onChange={e=>set("milestone1",e.target.value)}/>
    <FInput label="Milestone 2 — Mid-mission goal" placeholder="e.g. Plant first congregation" value={form.milestone2} onChange={e=>set("milestone2",e.target.value)}/>
    <FInput label="Milestone 3 — Final goal" placeholder="e.g. Local leadership trained" value={form.milestone3} onChange={e=>set("milestone3",e.target.value)}/>
  </div>
);

const Step5 = ({ form, set, submitted, submitting, onSubmit }) => {
  if (submitted) {
    return (
      <div style={{ textAlign:"center",padding:"20px 0 10px",display:"flex",flexDirection:"column",alignItems:"center",gap:20 }}>
        <div style={{ width:80,height:80,borderRadius:"50%",background:"rgba(62,207,142,0.12)",border:"2px solid rgba(62,207,142,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:38 }}>🙏</div>
        <div>
          <div style={{ fontSize:26,fontWeight:700,color:"#eef1ff",marginBottom:10 }}>Application Submitted</div>
          <div style={{ fontSize:14,color:"rgba(255,255,255,0.5)",lineHeight:1.8,maxWidth:380 }}>
            Thank you, <strong style={{color:"#e8b34b"}}>{form.fullName}</strong>. Your application has been received.<br/><br/>
            {form.churchVerified
              ? <>An endorsement request has been sent to <strong style={{color:"#eef1ff"}}>{form.pastorName}</strong> at <strong style={{color:"#eef1ff"}}>{form.churchName}</strong>.</>
              : <>Our admin team will contact <strong style={{color:"#eef1ff"}}>{form.pastorName}</strong> to register <strong style={{color:"#eef1ff"}}>{form.churchName}</strong> on SendMe before your mission can be approved.</>
            }<br/><br/>
            Our admin team will review within <strong style={{color:"#e8b34b"}}>3–5 working days</strong>.
          </div>
        </div>
        <div style={{ background:"rgba(232,179,75,0.08)",borderRadius:16,border:"1px solid rgba(232,179,75,0.2)",padding:"16px 24px",width:"100%" }}>
          <div style={{ fontSize:14,color:"#e8b34b",fontStyle:"italic",marginBottom:4 }}>"Here am I Lord, send me."</div>
          <div style={{ fontSize:12,color:"rgba(255,255,255,0.3)" }}>Isaiah 6:8</div>
        </div>
      </div>
    );
  }

  const fields = [
    ["Name",           form.fullName],
    ["Email",          form.email],
    ["Role",           form.role],
    ["Church",         form.churchName],
    ["Church status",  form.churchVerified ? "✓ Registered on SendMe" : "⚠️ Pending church registration"],
    ["Pastor",         form.pastorName],
    ["Pastor email",   form.pastorEmail],
    ["Mission title",  form.missionTitle],
    ["Target country", form.targetCountry],
    ["Your funding goal", (form.localCurrency!=="USD" && form.localAmount) ? `${Number(form.localAmount).toLocaleString()} ${form.localCurrency}` : null],
    ["Funding goal",   form.fundingGoal?`$${Number(form.fundingGoal).toLocaleString()} USD`:null],
    ["Platform surcharge (10%)", form.fundingGoal?`$${Math.round(Number(form.fundingGoal)*0.1).toLocaleString()}`:null],
    ["Total donors asked for", form.fundingGoal?`$${Math.round(Number(form.fundingGoal)*1.1).toLocaleString()}`:null],
    ["Shadow mode",    form.shadowMode?"Requested":"No"],
  ];

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
      <div style={sectionTitle}>Review & Submit</div>
      <div style={{ background:"rgba(255,255,255,0.02)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"18px 20px" }}>
        <div style={{ fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:14,letterSpacing:1,textTransform:"uppercase" }}>Application Summary</div>
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {fields.map(([k,v]) => v ? (
            <div key={k} style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,borderBottom:"1px solid rgba(255,255,255,0.05)",paddingBottom:8 }}>
              <span style={{ fontSize:12,color:"rgba(255,255,255,0.35)",flexShrink:0,minWidth:110 }}>{k}</span>
              <span style={{ fontSize:13,color:v.startsWith?.("⚠️")?"#e8b34b":v.startsWith?.("✓")?"#3ecf8e":"#eef1ff",textAlign:"right" }}>{v}</span>
            </div>
          ) : null)}
        </div>
      </div>

      {/* Payout accountability notice */}
      <div style={{ background:"rgba(91,156,246,0.07)",borderRadius:12,border:"1px solid rgba(91,156,246,0.25)",padding:"14px 18px",fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.7 }}>
        🏦 <strong style={{color:"#5b9cf6"}}>Payout accountability:</strong> All mission funds will be released to{" "}
        <strong style={{color:"#eef1ff"}}>{form.churchName || "your church"}</strong>'s registered bank account upon verified milestone completion.
      </div>

      <div style={{ background:"rgba(232,179,75,0.07)",borderRadius:12,border:"1px solid rgba(232,179,75,0.2)",padding:"14px 18px",display:"flex",gap:10 }}>
        <span style={{ fontSize:18,flexShrink:0 }}>📬</span>
        <div style={{ fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.7 }}>
          Submitting will send an <strong style={{color:"#e8b34b"}}>endorsement request</strong> to your pastor and place your mission in the <strong style={{color:"#e8b34b"}}>admin review queue</strong>.
        </div>
      </div>

      <div onClick={()=>set("surchargeAcknowledged",!form.surchargeAcknowledged)}
        style={{ display:"flex",gap:14,alignItems:"flex-start",padding:"14px 16px",borderRadius:12,cursor:"pointer",
          background:form.surchargeAcknowledged?"rgba(91,156,246,0.08)":"rgba(255,255,255,0.02)",
          border:`1px solid ${form.surchargeAcknowledged?"rgba(91,156,246,0.35)":"rgba(255,255,255,0.07)"}`,
          transition:"all .2s" }}>
        <div style={{ width:22,height:22,borderRadius:6,flexShrink:0,marginTop:1,
          background:form.surchargeAcknowledged?"linear-gradient(135deg,#5b9cf6,#3a7bd5)":"rgba(255,255,255,0.05)",
          border:form.surchargeAcknowledged?"none":"1px solid rgba(255,255,255,0.15)",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:13,color:"#fff",fontWeight:700,transition:"all .2s" }}>
          {form.surchargeAcknowledged?"✓":""}
        </div>
        <span style={{ fontSize:13,color:form.surchargeAcknowledged?"#eef1ff":"rgba(255,255,255,0.45)",lineHeight:1.65,transition:"color .2s" }}>
          I understand that SendMe will collect 10% above my stated funding goal from donors to cover platform and international payment processing costs. My full requested amount will be released to my church upon verified milestone completion — regardless of currency or country.
        </span>
      </div>

      <button onClick={form.surchargeAcknowledged?onSubmit:undefined} disabled={submitting||!form.surchargeAcknowledged}
        style={{ width:"100%",padding:"16px 0",borderRadius:14,border:"none",
          background:submitting||!form.surchargeAcknowledged?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#e8b34b,#c8942b)",
          color:submitting||!form.surchargeAcknowledged?"rgba(255,255,255,0.25)":"#000",fontWeight:700,
          cursor:submitting||!form.surchargeAcknowledged?"default":"pointer",fontSize:16,fontFamily:"Georgia, serif",
          boxShadow:submitting||!form.surchargeAcknowledged?"none":"0 6px 28px rgba(232,179,75,0.44)",transition:"all .2s" }}>
        {submitting?"Submitting...":!form.surchargeAcknowledged?"Please acknowledge the surcharge above":"Submit My Application"}
      </button>
    </div>
  );
};

const validate = (step, form) => {
  if (step===1) {
    if (!form.fullName.trim()) return "Please enter your full name.";
    if (!form.email.trim())    return "Please enter your email address.";
    if (!form.role)            return "Please select your missionary role.";
  }
  if (step===2) {
    if (!form.calling.trim())       return "Please describe your calling.";
    if (!form.testimony.trim())     return "Please share your testimony.";
    if (!form.yearsBeliever.trim()) return "Please enter how long you have been a believer.";
  }
  if (step===3) {
    if (!form.churchName.trim())  return "Please enter or select your church name.";
    if (!form.pastorName.trim())  return "Please enter your pastor's name.";
    if (!form.pastorEmail.trim()) return "Please enter your pastor's email.";
  }
  if (step===4) {
    if (!form.missionTitle.trim())       return "Please enter a mission title.";
    if (!form.targetRegion)              return "Please select a target region.";
    if (!form.targetCountry.trim())      return "Please enter the target country.";
    if (!form.riskLevel)                 return "Please select the field access/conditions level.";
    if (!form.missionDescription.trim()) return "Please describe your mission.";
    if (!form.fundingGoal||Number(form.fundingGoal)<100) return "Please enter a funding goal equivalent to at least $100 USD, and wait for the conversion to complete if using a local currency.";
  }
  if (step===5) {
    if (!form.surchargeAcknowledged) return "Please acknowledge the 10% platform surcharge before submitting.";
  }
  return null;
};

export default function MissionaryApplication({ onBack, user }) {
  const [step, setStep]             = useState(1);
  const [error, setError]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [churches, setChurches]     = useState([]);
  const [churchesLoading, setChurchesLoading] = useState(true);

  const [form, setForm] = useState({
    fullName: user?.user_metadata?.full_name||"", email: user?.email||"",
    phone:"", birthCountry:"", currentCountry:"", address:"", role:"",
    yearsBeliever:"", calling:"", testimony:"", experience:"", shadowMode:false,
    // Church fields — churchId + churchVerified are new
    churchId:"", churchName:"", pastorName:"", pastorEmail:"", pastorPhone:"",
    churchCity:"", churchCountry:"", churchWebsite:"",
    churchNotOnSendMe: false, churchVerified: false,
    // Mission fields
    missionTitle:"", targetRegion:"", targetCountry:"", targetArea:"", riskLevel:"",
    missionDescription:"", fundingGoal:"", localAmount:"", localCurrency:"USD",
    startDate:"", duration:"",
    milestone1:"", milestone2:"", milestone3:"", surchargeAcknowledged:false,
  });

  const set = (key, val) => setForm(f => ({...f,[key]:val}));

  // Load registered churches on mount for Step 3 dropdown
  useEffect(() => {
    const loadChurches = async () => {
      const { data } = await supabase
        .from("churches")
        .select("id, name, city, country, pastor_name, pastor_email, pastor_phone")
        .eq("verified", true)
        .order("name", { ascending: true });
      setChurches(data || []);
      setChurchesLoading(false);
    };
    loadChurches();
  }, []);

  const nextStep = () => {
    const err = validate(step, form);
    if (err) { setError(err); return; }
    setError(""); setStep(s=>Math.min(s+1,5));
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const prevStep = () => { setError(""); setStep(s=>Math.max(s-1,1)); window.scrollTo({top:0,behavior:"smooth"}); };

  const handleSubmit = async () => {
    setSubmitting(true); setError("");
    try {
      const goal = Number(form.fundingGoal);
      const platformSurcharge = Math.round(goal * 0.1);
      const collectionTarget = goal + platformSurcharge;

      const { lat, lng } = await geocodeMissionLocation(form.targetArea, form.targetCountry);

      const { data, error: dbError } = await supabase.from("missions").insert({
        missionary_name:  form.shadowMode ? null : form.fullName,
        missionary_email: form.email,
        missionary_role:  form.role,
        church_name:      form.churchName,
        church_id:        form.churchId || null,
        church_verified:  form.churchVerified,
        pastor_name:      form.pastorName,
        pastor_email:     form.pastorEmail,
        title:            form.missionTitle,
        region:           form.targetRegion,
        country:          form.targetCountry,
        area:             form.targetArea,
        risk_level:       Number(form.riskLevel) || 1,
        lat:              lat,
        lng:              lng,
        blurb:            form.missionDescription,
        goal:             goal,
        local_amount:     form.localCurrency === "USD" ? null : Number(form.localAmount) || null,
        local_currency:   form.localCurrency,
        collection_target: collectionTarget,
        platform_surcharge: platformSurcharge,
        surcharge_acknowledged: form.surchargeAcknowledged,
        start_date:       form.startDate || null,
        duration_months:  form.duration ? Number(form.duration) : null,
        raised:           0,
        status:           form.churchVerified ? "pending" : "pending_church",
        milestone:        0,
        souls:            0,
        bibles:           0,
        churches:         0,
        protected:        form.shadowMode,
        missionary_id:    user?.id || null,
      }).select("id").single();
      if (dbError) throw dbError;
      // Safety net: if the insert silently produced no row (e.g. a DB-side
      // trigger swallowing it without raising an error), don't show the
      // success screen — surface it as a real, visible error instead.
      if (!data?.id) throw new Error("Your application could not be saved. Please try again or contact support.");
      setSubmitted(true);
      notifyAdmin("mission_applied", {
        missionTitle: form.missionTitle,
        missionaryName: form.shadowMode ? "Anonymous (shadow mode)" : (form.fullName || user?.email || "Unknown"),
        country: form.targetCountry,
        churchName: form.churchName || "unregistered",
      });
    } catch (e) {
      setError("Submission failed: " + (e.message || "Please try again."));
    }
    setSubmitting(false);
  };

  return (
    <div style={{ minHeight:"100vh",background:"#060c18",color:"#eef1ff",fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f",borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"16px 24px",display:"flex",alignItems:"center",gap:14,position:"sticky",top:0,zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 16px",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:14,fontFamily:"Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize:18,fontWeight:700 }}>Missionary Application</div>
          <div style={{ fontSize:11,color:"rgba(255,255,255,0.3)",letterSpacing:2,marginTop:2 }}>SENDME GLOBAL MISSION FUND</div>
        </div>
        <div style={{ marginLeft:"auto",fontSize:13,color:"rgba(255,255,255,0.3)" }}>Step {step} of 5</div>
      </div>
      <div style={{ maxWidth:640,margin:"0 auto",padding:"32px 20px 80px" }}>
        <StepBar current={step}/>
        {error && (
          <div style={{ background:"rgba(240,82,82,0.1)",border:"1px solid rgba(240,82,82,0.3)",borderRadius:10,padding:"10px 16px",marginBottom:20,fontSize:13,color:"#f05252" }}>
            {error}
          </div>
        )}
        <div style={{ background:"#0c1628",borderRadius:20,border:"1px solid rgba(255,255,255,0.08)",padding:"28px 24px",marginBottom:20 }}>
          {step===1 && <Step1 form={form} set={set}/>}
          {step===2 && <Step2 form={form} set={set}/>}
          {step===3 && <Step3 form={form} set={set} churches={churches} churchesLoading={churchesLoading}/>}
          {step===4 && <Step4 form={form} set={set}/>}
          {step===5 && <Step5 form={form} set={set} submitted={submitted} submitting={submitting} onSubmit={handleSubmit}/>}
        </div>
        {!submitted && (
          <div style={{ display:"grid",gridTemplateColumns:step>1?"1fr 1fr":"1fr",gap:12 }}>
            {step>1 && (
              <button onClick={prevStep} style={{ padding:"14px 0",borderRadius:14,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.5)",fontWeight:700,cursor:"pointer",fontSize:15,fontFamily:"Georgia, serif" }}>
                Previous
              </button>
            )}
            {step<5 && (
              <button onClick={nextStep} style={{ padding:"14px 0",borderRadius:14,border:"none",background:"linear-gradient(135deg,#e8b34b,#c8942b)",color:"#000",fontWeight:700,cursor:"pointer",fontSize:15,fontFamily:"Georgia, serif",boxShadow:"0 6px 24px rgba(232,179,75,0.4)" }}>
                Continue
              </button>
            )}
          </div>
        )}
        <div style={{ textAlign:"center",padding:"32px 0 0",borderTop:"1px solid rgba(255,255,255,0.05)",marginTop:32 }}>
          <div style={{ fontSize:13,color:"#e8b34b",fontStyle:"italic" }}>"Whom shall I send, and who will go for us?" — Isaiah 6:8</div>
        </div>
      </div>
    </div>
  );
}
