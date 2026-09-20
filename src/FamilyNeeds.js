import { useState, useEffect } from "react";
import { startPayfastFamilyNeedDonation } from "./payfast";
import { supabase } from "./supabase";
import { notifyAdmin } from "./notifications";

const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Same currency list and conversion helper as EmergencyRequests.js's
// FundingGoalCurrency — kept in sync so an applicant gets the identical
// local-currency-to-USD experience everywhere in the app.
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

// The R10,000 ceiling (Br Donald's locked-in number, design doc suggested
// R5,000) is a Rand figure, but `goal` is stored in USD like everywhere else
// in the app — so the ceiling is converted live via the same currency API
// rather than hardcoded as a fixed USD number that would drift as the
// exchange rate moves away from what R10,000 is actually worth today.
const CEILING_ZAR = 10000;

const CATEGORY_META = {
  food:        { label: "🍲 Food",              color: "#e8b34b" },
  clothing:    { label: "👕 Clothing",           color: "#5b9cf6" },
  electricity: { label: "💡 Electricity",        color: "#f5a44a" },
  school:      { label: "🎒 School",             color: "#b06cf5" },
  medical:     { label: "🏥 Medical",            color: "#e85b5b" },
  other:       { label: "🤝 Other",              color: "#3ecf8e" },
};

const pct = (r,g) => Math.min(100,Math.round((r/g)*100));
const Bar = ({ raised, goal, color }) => (
  <div style={{ background:"rgba(255,255,255,0.07)", borderRadius:999, height:6, overflow:"hidden" }}>
    <div style={{ width:`${pct(raised,goal)}%`, height:"100%", borderRadius:999, background:color, transition:"width .7s ease" }}/>
  </div>
);

const currencyLabel = { fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7, display: "block" };

const timeAgo = (dateStr) => {
  const d=new Date(dateStr), now=new Date(), diff=Math.floor((now-d)/1000);
  if(diff<3600)  return `${Math.floor(diff/60)}m ago`;
  if(diff<86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
};

// Same local-currency-to-USD funding input pattern as EmergencyRequests.js's
// FundingGoalCurrency, plus a live R10,000-equivalent ceiling check.
const FundingGoalCurrency = ({ form, set, inp }) => {
  const [converting, setConverting] = useState(false);
  const [rateError, setRateError] = useState(false);
  const [overCeiling, setOverCeiling] = useState(false);

  useEffect(() => {
    if (!form.localAmount || Number(form.localAmount) <= 0) {
      set("goal", "");
      setOverCeiling(false);
      return;
    }
    setConverting(true);
    setRateError(false);
    setOverCeiling(false);
    const timer = setTimeout(async () => {
      const [usd, ceilingUsd] = await Promise.all([
        convertToUSD(form.localAmount, form.localCurrency),
        convertToUSD(CEILING_ZAR, "ZAR"),
      ]);
      if (usd === null || ceilingUsd === null) {
        setRateError(true);
        set("goal", "");
      } else if (usd > ceilingUsd) {
        setOverCeiling(true);
        set("goal", "");
      } else {
        set("goal", Math.round(usd).toString());
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
          <label style={currencyLabel}>Amount Needed *</label>
          <input type="number" placeholder="0" value={form.localAmount}
            onChange={e=>set("localAmount", e.target.value)}
            style={{ ...inp, marginBottom:0 }}/>
        </div>
        <div>
          <label style={currencyLabel}>In Currency *</label>
          <select value={form.localCurrency} onChange={e=>set("localCurrency", e.target.value)}
            style={{ ...inp, marginBottom:0, color:"#eef1ff" }}>
            {CURRENCIES.map(c=>(
              <option key={c.code} value={c.code} style={{background:"#0c1628"}}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ marginTop:10, minHeight:48 }}>
        {Number(form.localAmount) > 0 && (
          <div style={{ background: overCeiling ? "rgba(232,91,91,0.08)" : "rgba(232,179,75,0.07)", borderRadius:10, border:`1px solid ${overCeiling ? "rgba(232,91,91,0.3)" : "rgba(232,179,75,0.2)"}`, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
            {converting ? (
              <span style={{ fontSize:13,color:"rgba(255,255,255,0.45)" }}>Checking amount...</span>
            ) : rateError ? (
              <span style={{ fontSize:13,color:"#f05252" }}>Couldn't fetch a live exchange rate. Please check your connection and try again.</span>
            ) : overCeiling ? (
              <span style={{ fontSize:13,color:"#e85b5b" }}>This request is above the R{fmt(CEILING_ZAR)} (or equivalent) ceiling per family need. Please reduce the amount or split into what's most urgent right now.</span>
            ) : form.goal ? (
              <>
                <span style={{ fontSize:13,color:"rgba(255,255,255,0.5)" }}>≈</span>
                <span style={{ fontSize:18,fontWeight:700,color:"#e8b34b" }}>${Number(form.goal).toLocaleString()} USD</span>
                <span style={{ fontSize:12,color:"rgba(255,255,255,0.35)",marginLeft:"auto" }}>This USD amount will be locked in once you submit</span>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default function FamilyNeeds({ onBack, user, userRole }) {
  const [needs, setNeeds]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    category:"food", household_size:"", description:"",
    city:"", province:"", country:"",
    church_id:"",
    applicant_name:"", applicant_phone:"", applicant_email:"",
    localAmount:"", localCurrency:"USD", goal:"",
    surchargeAcknowledged:false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [churches, setChurches]     = useState([]);
  const [giving, setGiving]         = useState(null);   // need being donated to
  const [gift, setGift]             = useState({ name:"", email:"", amount:"" });
  const [giveSaving, setGiveSaving] = useState(false);
  const [giveError, setGiveError]   = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: needData }, { data: chData }] = await Promise.all([
          // Public browsing goes through the anonymised view ONLY — never
          // the base family_needs table. No applicant name/phone/email ever
          // reaches this screen for a donor to see.
          supabase.from("family_needs_public").select("*").order("created_at",{ascending:false}),
          supabase.from("churches").select("id, name, city, country").eq("verified", true).order("name"),
        ]);
        setNeeds(needData || []);
        if (chData) setChurches(chData);
      } catch { setNeeds([]); }
      setLoading(false);
    };
    load();
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.category || !form.description || !form.city || !form.country || !form.church_id || !form.applicant_name || !form.surchargeAcknowledged || !form.goal) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const goal = Number(form.goal);
      const platformSurcharge = Math.round(goal * 0.1);
      const collectionTarget = goal + platformSurcharge;
      const { error } = await supabase.from("family_needs").insert({
        applicant_id: user?.id || null,
        applicant_name: form.applicant_name,
        applicant_phone: form.applicant_phone || null,
        applicant_email: form.applicant_email || null,
        household_size: form.household_size ? Number(form.household_size) : null,
        category: form.category,
        description: form.description,
        city: form.city,
        province: form.province || null,
        country: form.country,
        goal,
        raised: 0,
        platform_surcharge: platformSurcharge,
        collection_target: collectionTarget,
        church_id: form.church_id,
        status: "submitted",
      });
      // The 60-day cooldown is enforced by a DB trigger (see the Family In
      // Need migration) — if it fires, Postgres returns an error here rather
      // than silently accepting the insert. Surface that plainly instead of
      // the generic catch-all message below.
      if (error) {
        if (String(error.message || "").includes("cooldown_active")) {
          setSubmitError("This applicant has an active cooldown after a recently completed request and can't submit again yet. Please try again later.");
        } else {
          throw error;
        }
      } else {
        setSubmitted(true);
        const notifyData = {
          category: form.category,
          city: form.city,
          country: form.country,
          goal,
        };
        notifyAdmin("family_need_submitted", notifyData);
        // Admin email — fire-and-forget, same pattern as every other
        // submission flow in the app: a slow/failed email must never block
        // the request from completing.
        supabase.functions.invoke("send-notification", {
          body: { type: "family_need_submitted", to: "sendmemissionfund@gmail.com", data: notifyData },
        }).then(({ error: emailError }) => {
          if (emailError) console.error("family_need_submitted admin email failed", emailError);
        }).catch((err) => {
          console.error("family_need_submitted admin email threw", err);
        });
      }
    } catch (e) {
      console.log("family need submit error:", e);
      setSubmitError("Something went wrong submitting this request. Please try again.");
    }
    setSubmitting(false);
  };

  const handleGive = async () => {
    if (!gift.name || !gift.email || !(Number(gift.amount) > 0)) return;
    setGiveSaving(true);
    setGiveError("");
    try {
      // Browser navigates away on success — nothing after this line runs.
      await startPayfastFamilyNeedDonation({
        need: giving,
        amount: Number(gift.amount),
        user,
        guestInfo: user ? null : { name: gift.name, email: gift.email },
      });
    } catch (e) {
      console.log("payfast redirect error:", e);
      setGiveError("Could not start PayFast checkout. Please try again.");
      setGiveSaving(false);
    }
  };

  const inp = { width:"100%", padding:"12px 14px", borderRadius:10, boxSizing:"border-box", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#eef1ff", fontSize:14, fontFamily:"Georgia, serif", outline:"none", marginBottom:12 };

  // "published"/"funded" are still actively fundraising (or just reached
  // goal but not yet paid out) — shown in the main list. "paid"/"complete"
  // move to the Completed section for transparency instead.
  const activeNeeds    = needs.filter(n => n.status === "published" || n.status === "funded");
  const completedNeeds = needs.filter(n => n.status === "paid" || n.status === "complete");

  // ── Give view ─────────────────────────────────────────────────────────
  if (giving) {
    const meta = CATEGORY_META[giving.category] || CATEGORY_META.other;
    const target = giving.collection_target || Math.round((giving.goal||0)*1.1);
    return (
      <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
        <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
          <button onClick={()=>{setGiving(null);setGift({name:"",email:"",amount:""});setGiveError("");}}
            style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
          <div style={{ fontSize:18, fontWeight:700 }}>Give to This Family Need</div>
        </div>
        <div style={{ maxWidth:600, margin:"0 auto", padding:"28px 20px 60px" }}>
          <div style={{ background:`${meta.color}12`, borderRadius:14, border:`1px solid ${meta.color}33`, padding:18, marginBottom:24 }}>
            <div style={{ fontSize:11, color:meta.color, letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>{meta.label}</div>
            <div style={{ fontSize:14, color:"rgba(255,255,255,0.6)", marginBottom:4 }}>{giving.public_summary || "A family in need, endorsed by their local church."}</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)" }}>📍 {giving.city}{giving.province?`, ${giving.province}`:""}, {giving.country} · ${fmt(giving.goal||0)} needed</div>
          </div>
          <div style={{ background:"rgba(62,207,142,0.06)", border:"1px solid rgba(62,207,142,0.2)", borderRadius:10, padding:"12px 14px", marginBottom:20, fontSize:12, color:"rgba(255,255,255,0.5)", lineHeight:1.6 }}>
            🏦 Funds are paid to the family's endorsing church, not directly to the family, and require proof of use before release.
          </div>
          <div style={{ fontSize:15, fontWeight:700, color:"#eef1ff", marginBottom:14 }}>Your Details</div>
          <input placeholder="Your name *" value={gift.name} onChange={e=>setGift(g=>({...g,name:e.target.value}))} style={inp}/>
          <input placeholder="Your email * (we'll send a receipt here)" type="email" value={gift.email} onChange={e=>setGift(g=>({...g,email:e.target.value}))} style={inp}/>
          <input placeholder="Amount to give ($)" type="number" value={gift.amount} onChange={e=>setGift(g=>({...g,amount:e.target.value}))} style={inp}/>
          {giveError && (
            <div style={{ background:"rgba(232,91,91,0.1)", border:"1px solid rgba(232,91,91,0.3)", borderRadius:10, padding:"10px 14px", color:"#e85b5b", fontSize:13, marginBottom:14 }}>
              {giveError}
            </div>
          )}
          <button onClick={handleGive} disabled={giveSaving||!gift.name||!gift.email||!(Number(gift.amount)>0)}
            style={{ width:"100%", padding:"14px 0", borderRadius:14, border:"none",
              background:gift.name&&gift.email&&Number(gift.amount)>0?`linear-gradient(135deg,${meta.color},${meta.color}cc)`:"rgba(255,255,255,0.06)",
              color:gift.name&&gift.email&&Number(gift.amount)>0?"#fff":"rgba(255,255,255,0.25)",
              fontWeight:700, cursor:gift.name&&gift.email&&Number(gift.amount)>0?"pointer":"default",
              fontSize:15, fontFamily:"Georgia, serif" }}>
            {giveSaving ? "Redirecting to PayFast…" : (Number(gift.amount)>0 ? `💝 Give $${gift.amount} via PayFast` : "💝 Give")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>Family In Need</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>CHURCH-ENDORSED, ANONYMOUS, ACCOUNTABLE</div>
        </div>
        {userRole !== "donor" && user && (
          <button onClick={()=>setShowForm(f=>!f)} style={{ marginLeft:"auto", background:"linear-gradient(135deg,#3ecf8e,#2aaf74)", border:"none", borderRadius:10, padding:"8px 16px", color:"#000", cursor:"pointer", fontSize:13, fontWeight:700 }}>
            + Submit a Family Need
          </button>
        )}
      </div>

      <div style={{ maxWidth:680, margin:"0 auto", padding:"28px 20px 60px" }}>

        <div style={{ background:"rgba(62,207,142,0.08)", borderRadius:14, border:"1px solid rgba(62,207,142,0.2)", padding:"14px 18px", marginBottom:24, display:"flex", gap:10 }}>
          <span style={{ fontSize:18, flexShrink:0 }}>🙏</span>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", lineHeight:1.7 }}>
            Every request here is endorsed by the family's own pastor before publication. Families are never named publicly — funds go to the church, which reports back with proof.
          </div>
        </div>

        {/* Submit form */}
        {showForm && (
          <div style={{ background:"#0c1628", borderRadius:16, border:"1px solid rgba(62,207,142,0.25)", padding:"20px", marginBottom:24 }}>
            {submitted ? (
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🙏</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#eef1ff", marginBottom:8 }}>Family Need Submitted</div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)" }}>The family's church will review and endorse this before it's considered for publication.</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize:15, fontWeight:700, color:"#eef1ff", marginBottom:16 }}>Submit a Family Need</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>About the Family</div>
                <input placeholder="Family / applicant name * (kept private — never shown publicly)" value={form.applicant_name} onChange={e=>set("applicant_name", e.target.value)} style={inp}/>
                <input placeholder="Contact phone (optional, private)" type="tel" value={form.applicant_phone} onChange={e=>set("applicant_phone", e.target.value)} style={inp}/>
                <input placeholder="Contact email (optional, private)" type="email" value={form.applicant_email} onChange={e=>set("applicant_email", e.target.value)} style={inp}/>
                <input placeholder="Household size (number of people)" type="number" value={form.household_size} onChange={e=>set("household_size", e.target.value)} style={inp}/>

                <div style={{ height:1, background:"rgba(255,255,255,0.07)", margin:"4px 0 12px" }}/>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>The Need</div>
                <select value={form.category} onChange={e=>set("category", e.target.value)} style={{...inp,color:"#eef1ff"}}>
                  {Object.entries(CATEGORY_META).map(([key,meta])=>(
                    <option key={key} value={key} style={{background:"#0c1628"}}>{meta.label}</option>
                  ))}
                </select>
                <textarea placeholder="Describe the need in detail * (kept private — an admin will write the public-facing summary)" value={form.description} onChange={e=>set("description", e.target.value)} style={{...inp,resize:"vertical",minHeight:90}}/>
                <input placeholder="City *" value={form.city} onChange={e=>set("city", e.target.value)} style={inp}/>
                <input placeholder="Province / Region" value={form.province} onChange={e=>set("province", e.target.value)} style={inp}/>
                <input placeholder="Country *" value={form.country} onChange={e=>set("country", e.target.value)} style={inp}/>

                <select value={form.church_id} onChange={e=>set("church_id", e.target.value)} style={{...inp,color:form.church_id?"#eef1ff":"rgba(255,255,255,0.35)"}}>
                  <option value="" style={{background:"#0c1628"}}>Select the family's church (required for endorsement) *</option>
                  {churches.map(c => (
                    <option key={c.id} value={c.id} style={{background:"#0c1628"}}>{c.name} — {c.city}, {c.country}</option>
                  ))}
                </select>

                <FundingGoalCurrency form={form} set={set} inp={inp}/>

                {/* Platform surcharge disclosure — same 10% pattern as
                    missions and Emergency Requests. */}
                <div style={{ background:"rgba(91,156,246,0.07)", borderRadius:14, border:"1px solid rgba(91,156,246,0.25)", padding:"16px 18px", marginBottom:14 }}>
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.7, marginBottom:12 }}>
                    SendMe operates across multiple countries and currencies. To keep this platform completely free for missionaries, churches, families, and donors worldwide, a <strong style={{color:"#5b9cf6"}}>10% platform surcharge</strong> is applied on top of the amount needed. This covers international payment processing, currency conversion, platform maintenance, and operational costs.
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6 }}>
                    <span style={{ color:"rgba(255,255,255,0.4)" }}>Amount needed</span>
                    <span style={{ color:"#eef1ff" }}>${fmt(Number(form.goal)||0)}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6 }}>
                    <span style={{ color:"rgba(255,255,255,0.4)" }}>Platform surcharge (10%)</span>
                    <span style={{ color:"#5b9cf6" }}>${fmt(Math.round((Number(form.goal)||0)*0.1))}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:14, fontWeight:700, paddingTop:8, borderTop:"1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ color:"rgba(255,255,255,0.6)" }}>Total donors asked for</span>
                    <span style={{ color:"#e8b34b" }}>${fmt(Math.round((Number(form.goal)||0)*1.1))}</span>
                  </div>
                </div>

                <div onClick={()=>set("surchargeAcknowledged", !form.surchargeAcknowledged)}
                  style={{ display:"flex", gap:10, alignItems:"flex-start", cursor:"pointer", padding:"12px 14px", borderRadius:10,
                    background:form.surchargeAcknowledged?"rgba(91,156,246,0.08)":"rgba(255,255,255,0.02)",
                    border:`1px solid ${form.surchargeAcknowledged?"rgba(91,156,246,0.35)":"rgba(255,255,255,0.07)"}`, marginBottom:14 }}>
                  <div style={{ width:20, height:20, borderRadius:6, flexShrink:0, marginTop:1, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13,
                    background:form.surchargeAcknowledged?"linear-gradient(135deg,#5b9cf6,#3a7bd5)":"rgba(255,255,255,0.05)",
                    border:form.surchargeAcknowledged?"none":"1px solid rgba(255,255,255,0.15)" }}>
                    {form.surchargeAcknowledged?"✓":""}
                  </div>
                  <span style={{ fontSize:13, color:form.surchargeAcknowledged?"#eef1ff":"rgba(255,255,255,0.45)", lineHeight:1.65, transition:"color .2s" }}>
                    I understand that SendMe will collect 10% above the stated amount needed from donors to cover platform and international payment processing costs. This request will also be reviewed and must be endorsed by the family's church before it can be published.
                  </span>
                </div>

                {submitError && (
                  <div style={{ background:"rgba(232,91,91,0.1)", border:"1px solid rgba(232,91,91,0.3)", borderRadius:10, padding:"10px 14px", color:"#e85b5b", fontSize:13, marginBottom:14 }}>
                    {submitError}
                  </div>
                )}

                <button onClick={handleSubmit} disabled={submitting||!form.category||!form.description||!form.city||!form.country||!form.church_id||!form.applicant_name||!form.surchargeAcknowledged||!form.goal}
                  style={{ width:"100%", padding:"13px 0", borderRadius:12, border:"none",
                    background:(form.description&&form.city&&form.country&&form.church_id&&form.applicant_name&&form.surchargeAcknowledged&&form.goal)?"linear-gradient(135deg,#3ecf8e,#2aaf74)":"rgba(255,255,255,0.06)",
                    color:(form.description&&form.city&&form.country&&form.church_id&&form.applicant_name&&form.surchargeAcknowledged&&form.goal)?"#000":"rgba(255,255,255,0.25)",
                    fontWeight:700, cursor:"pointer", fontSize:15, fontFamily:"Georgia, serif" }}>
                  {submitting?"Submitting...":!form.surchargeAcknowledged?"Please acknowledge the surcharge above":"Submit Family Need"}
                </button>
              </>
            )}
          </div>
        )}

        {/* Published needs list — "published" and "funded" are still shown
            here (funded ones just lose their donate button); "paid" and
            "complete" move to the Completed section below instead, so an
            already-resolved need doesn't clutter the active list. */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)" }}>Loading...</div>
        ) : activeNeeds.length === 0 ? (
          <div style={{ textAlign:"center", padding:"48px 20px", color:"rgba(255,255,255,0.3)", fontSize:14, background:"rgba(255,255,255,0.02)", borderRadius:16, border:"1px solid rgba(255,255,255,0.06)" }}>
            No published family needs right now — check back soon.
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {activeNeeds.map((n, i) => {
              const meta = CATEGORY_META[n.category] || CATEGORY_META.other;
              const target = n.collection_target || Math.round((n.goal||0)*1.1);
              return (
                <div key={n.id||i} style={{ background:"#0c1628", borderRadius:16, border:`1px solid ${meta.color}33`, borderLeft:`3px solid ${meta.color}`, padding:20 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8, flexWrap:"wrap" }}>
                    <span style={{ fontSize:12, padding:"3px 10px", borderRadius:999, background:`${meta.color}18`, color:meta.color, border:`1px solid ${meta.color}44`, fontWeight:600 }}>{meta.label}</span>
                    <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>📍 {n.city}{n.province?`, ${n.province}`:""}, {n.country} · {timeAgo(n.created_at)}</span>
                  </div>
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.7, marginBottom:14 }}>
                    {n.public_summary || "A family in need, endorsed by their local church."}
                  </div>
                  <Bar raised={n.raised||0} goal={target} color={meta.color}/>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, marginBottom:14 }}>
                    <span style={{ fontSize:13, color:meta.color, fontWeight:700 }}>${fmt(n.raised||0)} raised</span>
                    <span style={{ fontSize:12, color:(n.raised||0)>=target?"#3ecf8e":"rgba(255,255,255,0.3)" }}>
                      {(n.raised||0)>=target ? "✓ Fully Funded" : `$${fmt(target-(n.raised||0))} still needed`}
                    </span>
                  </div>
                  {(n.raised||0) < target && (
                    <button onClick={()=>{setGiving(n);setGift({name:"",email:"",amount:""});setGiveError("");}} style={{ width:"100%", padding:"12px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${meta.color},${meta.color}cc)`, color:"#fff", fontWeight:700, cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>
                      💝 Give to This Family
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Completed section — transparency for requests already paid to
            the church, since these aren't tied to any mission and so don't
            fit TransparencyLedger.js's per-mission design. Deliberately
            minimal: category, city, amount, done — no applicant details,
            same anonymisation as everywhere else this data is shown. */}
        {!loading && completedNeeds.length > 0 && (
          <div style={{ marginTop:32 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"rgba(255,255,255,0.5)", marginBottom:14, letterSpacing:0.5 }}>✓ Completed Family Needs</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {completedNeeds.map((n, i) => {
                const meta = CATEGORY_META[n.category] || CATEGORY_META.other;
                return (
                  <div key={n.id||i} style={{ background:"rgba(255,255,255,0.02)", borderRadius:12, border:"1px solid rgba(255,255,255,0.06)", padding:"12px 16px", display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:13 }}>{meta.label.split(" ")[0]}</span>
                    <span style={{ fontSize:13, color:"rgba(255,255,255,0.5)", flex:1 }}>{meta.label.split(" ").slice(1).join(" ")} need — {n.city}{n.province?`, ${n.province}`:""}, {n.country}</span>
                    <span style={{ fontSize:13, color:meta.color, fontWeight:700 }}>${fmt(n.goal||0)}</span>
                    <span style={{ fontSize:11, color:"#3ecf8e" }}>✓ Done</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
