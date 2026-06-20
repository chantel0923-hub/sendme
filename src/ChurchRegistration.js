import { useState } from "react";
import { supabase } from "./supabase";

const inp = {
  width:"100%", padding:"13px 16px", borderRadius:12, boxSizing:"border-box",
  background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
  color:"#eef1ff", fontSize:15, fontFamily:"Georgia, serif", outline:"none",
  marginBottom:14, transition:"border .2s",
};
const inpFocus = { border:"1px solid rgba(232,179,75,0.6)", background:"rgba(232,179,75,0.05)" };
const textarea = { ...inp, resize:"vertical", minHeight:100, lineHeight:1.7 };
const label = { fontSize:12, color:"rgba(255,255,255,0.4)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:7, display:"block" };
const sectionTitle = { fontSize:16, fontWeight:700, color:"#eef1ff", marginBottom:18, paddingBottom:10, borderBottom:"1px solid rgba(255,255,255,0.07)" };

const STEPS = [
  { number:1, label:"Church Info", icon:"⛪" },
  { number:2, label:"Leadership",  icon:"✝"  },
  { number:3, label:"Doctrine",    icon:"📖" },
  { number:4, label:"Review",      icon:"🙏" },
  { number:5, label:"Banking",     icon:"🏦" },
];

const COUNTRIES = ["South Africa","Nigeria","Kenya","Ghana","Ethiopia","Zimbabwe","Uganda","Tanzania","Zambia","Mozambique","USA","UK","Canada","Australia","Brazil","India","Philippines","Indonesia","South Korea","Germany","France","Netherlands","Other"];
const SIZES     = ["Under 50","50 – 100","100 – 300","300 – 500","500 – 1,000","Over 1,000"];

// Same hardcoded fallback used in MapboxMap.js — Vercel renames REACT_APP_
// prefixed env vars, so process.env.REACT_APP_MAPBOX_TOKEN is undefined in
// production. This caused new church registrations to always save with
// lat: null, lng: null. Do not remove this hardcoded fallback.
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN ||
  "pk.eyJ1Ijoic2VuZG1lMDkyMyIsImEiOiJjbXB6enh5ZmwwazhxMnNzZHd2dGx6YndvIn0.odqKTeH4YCXXk8m_T7JyEQ";

const geocodeLocation = async (city, country) => {
  try {
    const token = MAPBOX_TOKEN;
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

const FInput = ({ label: lbl, ...props }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {lbl && <label style={label}>{lbl}</label>}
      <input {...props} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
        style={{ ...inp, ...(focused?inpFocus:{}) }}/>
    </div>
  );
};

const FSelect = ({ label: lbl, children, value, onChange }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {lbl && <label style={label}>{lbl}</label>}
      <select value={value} onChange={onChange} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
        style={{ ...inp, color:value?"#eef1ff":"rgba(255,255,255,0.35)", ...(focused?inpFocus:{}) }}>
        {children}
      </select>
    </div>
  );
};

const Toggle = ({ value, onChange, label: lbl, description }) => (
  <div style={{ background:"rgba(232,179,75,0.06)",borderRadius:14,border:"1px solid rgba(232,179,75,0.2)",padding:"14px 18px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",gap:16 }}>
    <div>
      <div style={{ fontSize:14,fontWeight:700,color:"#eef1ff",marginBottom:3 }}>{lbl}</div>
      {description && <div style={{ fontSize:12,color:"rgba(255,255,255,0.4)",lineHeight:1.6 }}>{description}</div>}
    </div>
    <div onClick={()=>onChange(!value)}
      style={{ width:48,height:28,borderRadius:999,cursor:"pointer",flexShrink:0,
        background:value?"linear-gradient(135deg,#e8b34b,#c8942b)":"rgba(255,255,255,0.1)",
        position:"relative",transition:"background .25s",
        border:value?"none":"1px solid rgba(255,255,255,0.15)" }}>
      <div style={{ position:"absolute",top:3,width:22,height:22,borderRadius:"50%",background:"#fff",transition:"left .25s",left:value?23:3,boxShadow:"0 1px 4px rgba(0,0,0,0.4)" }}/>
    </div>
  </div>
);

const StepBar = ({ current, totalSteps }) => (
  <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:0,marginBottom:32,padding:"0 8px" }}>
    {STEPS.slice(0, totalSteps).map((s,i) => {
      const done=s.number<current, active=s.number===current;
      return (
        <div key={s.number} style={{ display:"flex",alignItems:"center",flex:i<totalSteps-1?1:"none" }}>
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:5,flexShrink:0 }}>
            <div style={{ width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,transition:"all .3s",
              background:done||active?"linear-gradient(135deg,#e8b34b,#c8942b)":"rgba(255,255,255,0.05)",
              border:done||active?"none":"1px solid rgba(255,255,255,0.1)",
              color:done||active?"#000":"rgba(255,255,255,0.25)",
              boxShadow:active?"0 0 18px rgba(232,179,75,0.5)":"none" }}>
              {done?"✓":s.icon}
            </div>
            <span style={{ fontSize:10,letterSpacing:1,whiteSpace:"nowrap",color:active?"#e8b34b":done?"rgba(232,179,75,0.6)":"rgba(255,255,255,0.2)",fontWeight:active?700:400 }}>{s.label}</span>
          </div>
          {i<totalSteps-1 && <div style={{ flex:1,height:2,margin:"0 4px",marginBottom:18,background:done?"linear-gradient(90deg,#e8b34b,#c8942b)":"rgba(255,255,255,0.07)",transition:"background .4s" }}/>}
        </div>
      );
    })}
  </div>
);

const Step1 = ({ form, set }) => (
  <div>
    <div style={sectionTitle}>Church Information</div>
    <FInput label="Church Name *" placeholder="e.g. Eagle Ministry Tabernacle" value={form.churchName} onChange={e=>set("churchName",e.target.value)}/>
    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
      <FInput label="City *" placeholder="e.g. Benoni" value={form.city} onChange={e=>set("city",e.target.value)}/>
      <FInput label="Province / State" placeholder="e.g. Gauteng" value={form.province} onChange={e=>set("province",e.target.value)}/>
    </div>
    <FSelect label="Country *" value={form.country} onChange={e=>set("country",e.target.value)}>
      <option value="" style={{background:"#0c1628"}}>Select country...</option>
      {COUNTRIES.map(c=><option key={c} value={c} style={{background:"#0c1628"}}>{c}</option>)}
    </FSelect>
    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
      <FInput label="Church Phone" type="tel" placeholder="+27 11 000 0000" value={form.phone} onChange={e=>set("phone",e.target.value)}/>
      <FInput label="Church Email *" type="email" placeholder="info@yourchurch.org" value={form.email} onChange={e=>set("email",e.target.value)}/>
    </div>
    <FInput label="Church Website (optional)" placeholder="https://www.yourchurch.org" value={form.website} onChange={e=>set("website",e.target.value)}/>
    <FSelect label="Congregation Size" value={form.size} onChange={e=>set("size",e.target.value)}>
      <option value="" style={{background:"#0c1628"}}>Approximate size...</option>
      {SIZES.map(s=><option key={s} value={s} style={{background:"#0c1628"}}>{s}</option>)}
    </FSelect>
  </div>
);

const Step2 = ({ form, set }) => (
  <div>
    <div style={sectionTitle}>Church Leadership</div>
    <div style={{ background:"rgba(232,179,75,0.07)",borderRadius:12,border:"1px solid rgba(232,179,75,0.2)",padding:"12px 16px",marginBottom:20 }}>
      <div style={{ fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.7 }}>The <strong style={{color:"#e8b34b"}}>Senior Pastor</strong> will receive all missionary endorsement requests from your church.</div>
    </div>
    <FInput label="Senior Pastor — Full Name *" placeholder="e.g. Pastor Dewet Engelbrecht" value={form.pastorName} onChange={e=>set("pastorName",e.target.value)}/>
    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
      <FInput label="Pastor's Email *" type="email" placeholder="pastor@yourchurch.org" value={form.pastorEmail} onChange={e=>set("pastorEmail",e.target.value)}/>
      <FInput label="Pastor's Phone" type="tel" placeholder="+27 82 000 0000" value={form.pastorPhone} onChange={e=>set("pastorPhone",e.target.value)}/>
    </div>
    <Toggle value={form.canEndorse} onChange={v=>set("canEndorse",v)}
      label="Endorsement Authority"
      description="This church can endorse missionary applications on SendMe."/>
  </div>
);

const Step3 = ({ form, set }) => (
  <div>
    <div style={sectionTitle}>Doctrinal Statement</div>
    <div style={{ background:"rgba(232,179,75,0.07)",borderRadius:12,border:"1px solid rgba(232,179,75,0.2)",padding:"12px 16px",marginBottom:20 }}>
      <div style={{ fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.7 }}>SendMe is for <strong style={{color:"#e8b34b"}}>Message-believing churches</strong>. Please confirm your church's position:</div>
    </div>
    {[
      {key:"believesMessage",   text:"We believe in the end-time Message as delivered through Rev. William Marrion Branham."},
      {key:"believesTrinity",   text:"We believe in the Name of the Lord Jesus Christ (Acts 2:38)."},
      {key:"believesBible",     text:"We hold the King James Bible as the inspired, infallible Word of God."},
      {key:"believesMission",   text:"We are committed to the Great Commission (Mark 16:15) and global evangelism."},
      {key:"agreesEscrow",      text:"We agree to the SendMe escrow policy — funds released only on verified milestone proof."},
      {key:"agreesAccountability",text:"We agree to be accountable for missionaries we endorse on this platform."},
    ].map(({key,text}) => (
      <div key={key} onClick={()=>set(key,!form[key])}
        style={{ display:"flex",gap:14,alignItems:"flex-start",padding:"14px 16px",borderRadius:12,marginBottom:10,cursor:"pointer",
          background:form[key]?"rgba(232,179,75,0.08)":"rgba(255,255,255,0.02)",
          border:`1px solid ${form[key]?"rgba(232,179,75,0.35)":"rgba(255,255,255,0.07)"}`,
          transition:"all .2s" }}>
        <div style={{ width:22,height:22,borderRadius:6,flexShrink:0,marginTop:1,
          background:form[key]?"linear-gradient(135deg,#e8b34b,#c8942b)":"rgba(255,255,255,0.05)",
          border:form[key]?"none":"1px solid rgba(255,255,255,0.15)",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:13,color:"#000",fontWeight:700,transition:"all .2s" }}>
          {form[key]?"✓":""}
        </div>
        <span style={{ fontSize:14,color:form[key]?"#eef1ff":"rgba(255,255,255,0.45)",lineHeight:1.65,transition:"color .2s" }}>{text}</span>
      </div>
    ))}
  </div>
);

const Step4 = ({ form, submitting, onSubmit }) => {
  const allChecked = ["believesMessage","believesTrinity","believesBible","believesMission","agreesEscrow","agreesAccountability"].every(k=>form[k]);
  const summary = [
    ["Church Name", form.churchName],
    ["City",        form.city],
    ["Country",     form.country],
    ["Email",       form.email],
    ["Pastor",      form.pastorName],
    ["Pastor email",form.pastorEmail],
    ["Size",        form.size],
    ["Endorsements",form.canEndorse?"Enabled":"Disabled"],
    ["Doctrine",    allChecked?"All confirmed":"Incomplete"],
  ];

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
      <div style={sectionTitle}>Review & Submit</div>
      <div style={{ background:"rgba(255,255,255,0.02)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"18px 20px" }}>
        <div style={{ fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:14,letterSpacing:1,textTransform:"uppercase" }}>Registration Summary</div>
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {summary.map(([k,v]) => v && (
            <div key={k} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,borderBottom:"1px solid rgba(255,255,255,0.05)",paddingBottom:8 }}>
              <span style={{ fontSize:12,color:"rgba(255,255,255,0.35)",flexShrink:0,minWidth:120 }}>{k}</span>
              <span style={{ fontSize:13,color:v==="Incomplete"?"#f05252":"#eef1ff",textAlign:"right" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      {!allChecked && (
        <div style={{ background:"rgba(240,82,82,0.08)",borderRadius:12,border:"1px solid rgba(240,82,82,0.25)",padding:"12px 16px",fontSize:13,color:"#f05252",display:"flex",gap:10 }}>
          <span>Please go back to Step 3 and confirm all doctrinal statements.</span>
        </div>
      )}
      <button onClick={allChecked?onSubmit:undefined} disabled={submitting||!allChecked}
        style={{ width:"100%",padding:"16px 0",borderRadius:14,border:"none",
          background:!allChecked||submitting?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#e8b34b,#c8942b)",
          color:!allChecked||submitting?"rgba(255,255,255,0.25)":"#000",
          fontWeight:700,cursor:!allChecked||submitting?"default":"pointer",
          fontSize:16,fontFamily:"Georgia, serif",
          boxShadow:!allChecked||submitting?"none":"0 6px 28px rgba(232,179,75,0.44)",transition:"all .2s" }}>
        {submitting?"Finding your location & submitting...":"Register My Church"}
      </button>
    </div>
  );
};

// Step 5 — Banking details for the pastor.
// Only shown after the church has been successfully registered (churchId is set).
// The pastor can skip this and come back later via PayoutSetup.
const Step5 = ({ form, set, churchId, bankSaving, bankDone, bankError, onSaveBank, onSkip }) => {
  if (bankDone) {
    return (
      <div style={{ textAlign:"center",padding:"20px 0 10px",display:"flex",flexDirection:"column",alignItems:"center",gap:20 }}>
        <div style={{ width:80,height:80,borderRadius:"50%",background:"rgba(62,207,142,0.12)",border:"2px solid rgba(62,207,142,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:38 }}>⛪</div>
        <div>
          <div style={{ fontSize:26,fontWeight:700,color:"#eef1ff",marginBottom:10 }}>All Done!</div>
          <div style={{ fontSize:14,color:"rgba(255,255,255,0.5)",lineHeight:1.8,maxWidth:380 }}>
            <strong style={{color:"#e8b34b"}}>{form.churchName}</strong> has been registered and your banking details have been saved.<br/><br/>
            When missionaries you support receive funds, SendMe will pay out to this account.
          </div>
        </div>
        <div style={{ background:"rgba(232,179,75,0.08)",borderRadius:16,border:"1px solid rgba(232,179,75,0.2)",padding:"16px 24px",width:"100%" }}>
          <div style={{ fontSize:14,color:"#e8b34b",fontStyle:"italic",marginBottom:4 }}>"Go ye into all the world and preach the gospel to every creature."</div>
          <div style={{ fontSize:12,color:"rgba(255,255,255,0.3)" }}>Mark 16:15</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
      <div style={sectionTitle}>Church Banking Details</div>

      <div style={{ background:"rgba(91,156,246,0.07)",borderRadius:14,border:"1px solid rgba(91,156,246,0.25)",padding:"14px 18px",marginBottom:18,fontSize:13,color:"rgba(255,255,255,0.55)",lineHeight:1.7 }}>
        🏦 When a missionary your church supports reaches a funding milestone, SendMe will transfer the released funds to this church account. This information is kept strictly private and never shown publicly.
      </div>

      <div style={{ background:"rgba(232,179,75,0.07)",borderRadius:12,border:"1px solid rgba(232,179,75,0.2)",padding:"12px 16px",marginBottom:20,fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.7 }}>
        ✋ Not the pastor? Or banking details not ready yet? You can <strong style={{color:"#e8b34b"}}>skip this step</strong> and submit them later from your profile.
      </div>

      <FInput label="Full Name of Account Holder *" placeholder="e.g. Eagle Ministry Tabernacle NPC" value={form.bankAccountHolder} onChange={e=>set("bankAccountHolder",e.target.value)}/>
      <FInput label="Bank Name *" placeholder="e.g. Standard Bank, FNB, Capitec" value={form.bankName} onChange={e=>set("bankName",e.target.value)}/>
      <FInput label="Account Number *" placeholder="Account number" value={form.bankAccountNumber} onChange={e=>set("bankAccountNumber",e.target.value)}/>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
        <FInput label="Branch Code" placeholder="e.g. 051001" value={form.bankBranchCode} onChange={e=>set("bankBranchCode",e.target.value)}/>
        <div>
          <label style={label}>Account Type</label>
          <select value={form.bankAccountType} onChange={e=>set("bankAccountType",e.target.value)}
            style={{ ...inp, color:"#eef1ff" }}>
            <option value="cheque" style={{background:"#0c1628"}}>Cheque / Current</option>
            <option value="savings" style={{background:"#0c1628"}}>Savings</option>
          </select>
        </div>
      </div>
      <FInput label="Country of Bank Account" placeholder="e.g. South Africa" value={form.bankCountry} onChange={e=>set("bankCountry",e.target.value)}/>
      <FInput label="SWIFT / IBAN (for international transfers, if applicable)" placeholder="Only needed for international payouts" value={form.bankSwift} onChange={e=>set("bankSwift",e.target.value)}/>

      {bankError && (
        <div style={{ background:"rgba(232,91,91,0.1)",border:"1px solid rgba(232,91,91,0.3)",borderRadius:10,padding:"10px 14px",color:"#e85b5b",fontSize:13,marginBottom:4 }}>
          {bankError}
        </div>
      )}

      <button onClick={onSaveBank} disabled={bankSaving}
        style={{ width:"100%",padding:"16px 0",borderRadius:14,border:"none",
          background:bankSaving?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#e8b34b,#c8942b)",
          color:bankSaving?"rgba(255,255,255,0.25)":"#000",fontWeight:700,
          cursor:bankSaving?"default":"pointer",fontSize:16,fontFamily:"Georgia, serif",
          boxShadow:bankSaving?"none":"0 6px 28px rgba(232,179,75,0.44)",marginBottom:10 }}>
        {bankSaving?"Saving...":"Save Banking Details"}
      </button>

      <button onClick={onSkip}
        style={{ width:"100%",padding:"14px 0",borderRadius:14,border:"1px solid rgba(255,255,255,0.1)",
          background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.45)",fontWeight:700,
          cursor:"pointer",fontSize:14,fontFamily:"Georgia, serif" }}>
        Skip for now — I'll add banking details later
      </button>
    </div>
  );
};

const validate = (step, form) => {
  if (step===1) {
    if (!form.churchName.trim()) return "Please enter your church name.";
    if (!form.city.trim())       return "Please enter your city.";
    if (!form.country)           return "Please select your country.";
    if (!form.email.trim())      return "Please enter your church email.";
  }
  if (step===2) {
    if (!form.pastorName.trim())  return "Please enter your pastor's name.";
    if (!form.pastorEmail.trim()) return "Please enter your pastor's email.";
  }
  if (step===3) {
    const allChecked = ["believesMessage","believesTrinity","believesBible","believesMission","agreesEscrow","agreesAccountability"].every(k=>form[k]);
    if (!allChecked) return "Please confirm all doctrinal statements to continue.";
  }
  return null;
};

export default function ChurchRegistration({ onBack, user }) {
  const [step,setStep]               = useState(1);
  const [error,setError]             = useState("");
  const [submitting,setSubmitting]   = useState(false);
  const [submitted,setSubmitted]     = useState(false);  // church row saved
  const [churchId,setChurchId]       = useState(null);   // id of the saved church row
  const [bankSaving,setBankSaving]   = useState(false);
  const [bankDone,setBankDone]       = useState(false);
  const [bankError,setBankError]     = useState("");

  const [form, setForm] = useState({
    // Church fields
    churchName:"", city:"", province:"", country:"", phone:"", email:"", website:"", size:"",
    pastorName:"", pastorEmail:"", pastorPhone:"", canEndorse:true,
    believesMessage:false, believesTrinity:false, believesBible:false,
    believesMission:false, agreesEscrow:false, agreesAccountability:false,
    // Banking fields (step 5)
    bankAccountHolder:"", bankName:"", bankAccountNumber:"",
    bankBranchCode:"", bankAccountType:"cheque", bankCountry:"South Africa", bankSwift:"",
  });

  const set = (key,val) => setForm(f=>({...f,[key]:val}));

  // Total steps shown depends on whether church has been submitted yet.
  // Before submit: show 4 steps. After submit: show 5 (reveal banking step).
  const totalSteps = submitted ? 5 : 4;

  const nextStep = () => {
    const err = validate(step, form);
    if (err) { setError(err); return; }
    setError(""); setStep(s=>Math.min(s+1, totalSteps));
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const prevStep = () => { setError(""); setStep(s=>Math.max(s-1,1)); window.scrollTo({top:0,behavior:"smooth"}); };

  // Step 4 submit — saves the church row, then advances to step 5 (banking)
  const handleSubmit = async () => {
    setSubmitting(true); setError("");
    try {
      const { lat, lng } = await geocodeLocation(form.city, form.country);

      const { data, error: dbError } = await supabase.from("churches").insert({
        name:         form.churchName,
        city:         form.city,
        country:      form.country,
        phone:        form.phone,
        email:        form.email,
        size:         form.size,
        province:     form.province,
        website:      form.website,
        pastor_name:  form.pastorName,
        pastor_email: form.pastorEmail,
        pastor_phone: form.pastorPhone,
        can_endorse:  form.canEndorse,
        verified:     false,
        user_id:      user?.id || null,
        lat,
        lng,
      }).select("id").single();
      if (dbError) throw dbError;
      setChurchId(data.id);
      setSubmitted(true);
      // Advance to banking step
      setStep(5);
      window.scrollTo({top:0,behavior:"smooth"});
    } catch (e) {
      setError("Submission failed: " + (e.message || "Please try again."));
    }
    setSubmitting(false);
  };

  // Step 5 — save banking details keyed to church_id
  const handleSaveBank = async () => {
    setBankError("");
    if (!form.bankAccountHolder.trim() || !form.bankName.trim() || !form.bankAccountNumber.trim()) {
      setBankError("Please fill in Account Holder, Bank Name, and Account Number.");
      return;
    }
    setBankSaving(true);
    try {
      const { error: dbError } = await supabase.from("payout_details").upsert({
        church_id:      churchId,
        mission_id:     null,
        recipient_name: form.bankAccountHolder,
        recipient_type: "church",
        bank_name:      form.bankName,
        account_holder: form.bankAccountHolder,
        account_number: form.bankAccountNumber,
        branch_code:    form.bankBranchCode,
        account_type:   form.bankAccountType,
        country:        form.bankCountry,
        swift_code:     form.bankSwift,
        notes:          "",
        updated_at:     new Date().toISOString(),
      }, { onConflict: "church_id" });
      if (dbError) throw dbError;
      setBankDone(true);
    } catch (e) {
      setBankError("Could not save banking details: " + (e.message || "Please try again."));
    }
    setBankSaving(false);
  };

  // Skip banking — just show the final done state without saving bank details
  const handleSkipBank = () => {
    setBankDone(true);
  };

  return (
    <div style={{ minHeight:"100vh",background:"#060c18",color:"#eef1ff",fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f",borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"16px 24px",display:"flex",alignItems:"center",gap:14,position:"sticky",top:0,zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 16px",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:14,fontFamily:"Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize:18,fontWeight:700 }}>Church Registration</div>
          <div style={{ fontSize:11,color:"rgba(255,255,255,0.3)",letterSpacing:2,marginTop:2 }}>SENDME GLOBAL MISSION FUND</div>
        </div>
        <div style={{ marginLeft:"auto",fontSize:13,color:"rgba(255,255,255,0.3)" }}>Step {step} of {totalSteps}</div>
      </div>
      <div style={{ maxWidth:640,margin:"0 auto",padding:"32px 20px 80px" }}>
        <StepBar current={step} totalSteps={totalSteps}/>
        {error && (
          <div style={{ background:"rgba(240,82,82,0.1)",border:"1px solid rgba(240,82,82,0.3)",borderRadius:10,padding:"10px 16px",marginBottom:20,fontSize:13,color:"#f05252" }}>
            {error}
          </div>
        )}
        <div style={{ background:"#0c1628",borderRadius:20,border:"1px solid rgba(255,255,255,0.08)",padding:"28px 24px",marginBottom:20 }}>
          {step===1 && <Step1 form={form} set={set}/>}
          {step===2 && <Step2 form={form} set={set}/>}
          {step===3 && <Step3 form={form} set={set}/>}
          {step===4 && <Step4 form={form} submitting={submitting} onSubmit={handleSubmit}/>}
          {step===5 && (
            <Step5
              form={form} set={set}
              churchId={churchId}
              bankSaving={bankSaving}
              bankDone={bankDone}
              bankError={bankError}
              onSaveBank={handleSaveBank}
              onSkip={handleSkipBank}
            />
          )}
        </div>
        {/* Navigation buttons — hidden on step 4 (has its own submit button)
            and step 5 (has its own save/skip buttons) */}
        {!submitted && step < 4 && (
          <div style={{ display:"grid",gridTemplateColumns:step>1?"1fr 1fr":"1fr",gap:12 }}>
            {step>1 && (
              <button onClick={prevStep} style={{ padding:"14px 0",borderRadius:14,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.5)",fontWeight:700,cursor:"pointer",fontSize:15,fontFamily:"Georgia, serif" }}>
                Previous
              </button>
            )}
            <button onClick={nextStep} style={{ padding:"14px 0",borderRadius:14,border:"none",background:"linear-gradient(135deg,#e8b34b,#c8942b)",color:"#000",fontWeight:700,cursor:"pointer",fontSize:15,fontFamily:"Georgia, serif",boxShadow:"0 6px 24px rgba(232,179,75,0.4)" }}>
              Continue
            </button>
          </div>
        )}
        {/* On step 4, show Previous button only */}
        {!submitted && step === 4 && (
          <div style={{ display:"grid",gridTemplateColumns:"1fr",gap:12,marginTop:0 }}>
            <button onClick={prevStep} style={{ padding:"14px 0",borderRadius:14,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.5)",fontWeight:700,cursor:"pointer",fontSize:15,fontFamily:"Georgia, serif" }}>
              Previous
            </button>
          </div>
        )}
        <div style={{ textAlign:"center",padding:"32px 0 0",borderTop:"1px solid rgba(255,255,255,0.05)",marginTop:32 }}>
          <div style={{ fontSize:13,color:"#e8b34b",fontStyle:"italic" }}>"Go ye into all the world and preach the gospel to every creature." — Mark 16:15</div>
        </div>
      </div>
    </div>
  );
}