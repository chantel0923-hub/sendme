import { useState, useEffect } from "react";
import { startPaystackGeneralFundDonation } from "./paystack";
import { supabase } from "./supabase";

const fmt = (n) => String(Math.round(n||0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const timeAgo = (dateStr) => {
  const d=new Date(dateStr), now=new Date(), diff=Math.floor((now-d)/1000);
  if(diff<3600)  return `${Math.floor(diff/60)}m ago`;
  if(diff<86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
};

export default function GeneralFund({ onBack, user }) {
  const [loading, setLoading]   = useState(true);
  const [raised, setRaised]     = useState(0);
  const [disbursed, setDisbursed] = useState(0);
  const [impact, setImpact]     = useState([]);
  const [giving, setGiving]     = useState(false);
  const [gift, setGift]         = useState({ name:"", email:"", amount:"" });
  const [giveError, setGiveError] = useState("");
  const [giveSaving, setGiveSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Public RLS only allows reading type='disbursement' rows directly
        // (see the migration) — donation totals are read via this same
        // table but only donation-type rows are summed for the balance
        // display below, disbursement rows for the impact log.
        const { data } = await supabase.from("general_fund_log").select("*").order("created_at", { ascending:false });
        const rows = data || [];
        const disbursementRows = rows.filter(r => r.type === "disbursement");
        setImpact(disbursementRows);
        setDisbursed(disbursementRows.reduce((s,r)=>s+(r.amount||0),0));
        // Donation rows aren't visible to the public (RLS), so total raised
        // comes from a lightweight admin-scoped view instead — but since
        // this screen has no admin context, we fall back to computing
        // "available" from disbursements alone plus whatever the RPC
        // reports back; simplest honest approach: show disbursed total and
        // let the donate button always stay open (never a "goal reached"
        // state, since this fund never closes).
      } catch { setImpact([]); }
      setLoading(false);
    };
    load();
  }, []);

  const handleGive = async () => {
    if (!(Number(gift.amount) > 0)) return;
    if (!user && (!gift.name || !gift.email)) return;
    setGiveSaving(true);
    setGiveError("");
    try {
      await startPaystackGeneralFundDonation({
        amount: Number(gift.amount),
        user,
        guestInfo: user ? null : { name: gift.name, email: gift.email },
      });
    } catch (e) {
      setGiveError("Could not start Paystack checkout. Please try again.");
      setGiveSaving(false);
    }
  };

  const inp = { width:"100%", padding:"12px 14px", borderRadius:10, boxSizing:"border-box", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#eef1ff", fontSize:14, fontFamily:"Georgia, serif", outline:"none", marginBottom:12 };

  if (giving) {
    return (
      <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
        <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
          <button onClick={()=>{setGiving(false);setGift({name:"",email:"",amount:""});setGiveError("");}}
            style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
          <div style={{ fontSize:18, fontWeight:700 }}>Give to the General Fund</div>
        </div>
        <div style={{ maxWidth:600, margin:"0 auto", padding:"28px 20px 60px" }}>
          {!user && (
            <>
              <input placeholder="Your name *" value={gift.name} onChange={e=>setGift(g=>({...g,name:e.target.value}))} style={inp}/>
              <input placeholder="Your email *" type="email" value={gift.email} onChange={e=>setGift(g=>({...g,email:e.target.value}))} style={inp}/>
            </>
          )}
          <input placeholder="Amount to give ($)" type="number" value={gift.amount} onChange={e=>setGift(g=>({...g,amount:e.target.value}))} style={inp}/>
          {giveError && (
            <div style={{ background:"rgba(232,91,91,0.1)", border:"1px solid rgba(232,91,91,0.3)", borderRadius:10, padding:"10px 14px", color:"#e85b5b", fontSize:13, marginBottom:14 }}>
              {giveError}
            </div>
          )}
          <button onClick={handleGive} disabled={giveSaving||!(Number(gift.amount)>0)||(!user&&(!gift.name||!gift.email))}
            style={{ width:"100%", padding:"14px 0", borderRadius:14, border:"none",
              background:(Number(gift.amount)>0)?"linear-gradient(135deg,#3ecf8e,#2aaf74)":"rgba(255,255,255,0.06)",
              color:(Number(gift.amount)>0)?"#000":"rgba(255,255,255,0.25)",
              fontWeight:700, cursor:"pointer", fontSize:15, fontFamily:"Georgia, serif" }}>
            {giveSaving ? "Redirecting to Paystack…" : (Number(gift.amount)>0 ? `💝 Give $${gift.amount} via Paystack` : "💝 Give")}
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
          <div style={{ fontSize:18, fontWeight:700 }}>🌐 SendMe General Fund</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>ALWAYS OPEN — SENDME DECIDES WHERE IT GOES</div>
        </div>
      </div>

      <div style={{ maxWidth:680, margin:"0 auto", padding:"28px 20px 60px" }}>

        <div style={{ background:"rgba(62,207,142,0.08)", borderRadius:16, border:"1px solid rgba(62,207,142,0.25)", padding:"22px 24px", marginBottom:24 }}>
          <div style={{ fontSize:14, color:"rgba(255,255,255,0.6)", lineHeight:1.8, marginBottom:18 }}>
            This fund covers all kinds of costs — platform operations, urgent needs not yet listed, and
            especially <strong style={{color:"#3ecf8e"}}>whenever there's no specific mission or need open to give to</strong>.
            Your gift here is always available, and SendMe decides where it's needed most — toward any
            mission, emergency, or family need, or toward keeping SendMe running.
          </div>
          <button onClick={()=>setGiving(true)} style={{ width:"100%", padding:"14px 0", borderRadius:14, border:"none", background:"linear-gradient(135deg,#3ecf8e,#2aaf74)", color:"#000", fontWeight:700, cursor:"pointer", fontSize:15, fontFamily:"Georgia, serif" }}>
            💝 Give to the General Fund
          </button>
        </div>

        <div style={{ fontSize:16, fontWeight:700, color:"#eef1ff", marginBottom:16 }}>How This Has Helped</div>
        {loading ? (
          <div style={{ textAlign:"center", padding:"30px 0", color:"rgba(255,255,255,0.3)" }}>Loading...</div>
        ) : impact.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 20px", color:"rgba(255,255,255,0.3)", fontSize:14, background:"rgba(255,255,255,0.02)", borderRadius:16, border:"1px solid rgba(255,255,255,0.06)" }}>
            Nothing given from the fund yet — every gift here is ready and waiting for wherever it's needed most.
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {impact.map(entry => (
              <div key={entry.id} style={{ background:"#0c1628", borderRadius:16, border:"1px solid rgba(62,207,142,0.2)", borderLeft:"3px solid #3ecf8e", padding:20 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:"#3ecf8e" }}>${fmt(entry.amount)} given</span>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{timeAgo(entry.created_at)}</span>
                </div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.7, marginBottom: entry.media_urls?.length ? 12 : 0 }}>
                  {entry.description}
                </div>
                {entry.media_urls?.length > 0 && (
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {entry.media_urls.map((url,i)=>(
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="" style={{ width:90, height:90, objectFit:"cover", borderRadius:10, border:"1px solid rgba(255,255,255,0.15)" }}/>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
