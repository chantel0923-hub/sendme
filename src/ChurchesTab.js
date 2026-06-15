import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Demo churches shown until real data exists
const DEMO_CHURCHES = [
  { id:1,  name:"Branham Tabernacle",            pastor_name:"Pastor William Steyn",    pastor_email:"pastor@branhamtab.org",    city:"Johannesburg", country:"South Africa", size:"100 – 300", verified:true, year_established:1987, phone:"+27 11 000 0000", website:"branhamtabernacle.org", lat:-26.20, lng:28.05 },
  { id:2,  name:"Voice of God Fellowship",        pastor_name:"Pastor James Okafor",     pastor_email:"james@vogfellowship.org",  city:"Lagos",        country:"Nigeria",      size:"300 – 500", verified:true, year_established:1994, phone:"+234 1 000 0000", website:"vogfellowship.org", lat:6.52, lng:3.38 },
  { id:3,  name:"End Time Message Church",        pastor_name:"Pastor David Kimotho",    pastor_email:"david@etmc.co.ke",         city:"Nairobi",      country:"Kenya",        size:"100 – 300", verified:true, year_established:2001, phone:"+254 20 000 000",  website:"etmc.co.ke", lat:-1.29, lng:36.82 },
  { id:4,  name:"Message Believers Assembly",     pastor_name:"Pastor John Swanson",     pastor_email:"john@mba.org.au",          city:"Sydney",       country:"Australia",    size:"50 – 100",  verified:true, year_established:1999, phone:"+61 2 0000 0000",  website:"mba.org.au", lat:-33.87, lng:151.21 },
  { id:5,  name:"Spoken Word Church",             pastor_name:"Pastor Emmanuel Asante",  pastor_email:"emmanuel@swc.gh",          city:"Accra",        country:"Ghana",        size:"100 – 300", verified:true, year_established:2005, phone:"+233 30 000 000",  website:"swc.gh", lat:5.60, lng:-0.19 },
  { id:6,  name:"Latter Rain Tabernacle",         pastor_name:"Pastor Paul Muller",      pastor_email:"paul@lrt.co.za",           city:"Cape Town",    country:"South Africa", size:"50 – 100",  verified:true, year_established:2008, phone:"+27 21 000 0000",  website:"lrt.co.za", lat:-33.92, lng:18.42 },
  { id:7,  name:"Harvest Time Fellowship",        pastor_name:"Pastor Samuel Achebe",    pastor_email:"samuel@htf.ng",            city:"Abuja",        country:"Nigeria",      size:"50 – 100",  verified:true, year_established:2010, phone:"+234 9 000 0000",  website:"htf.ng", lat:9.06, lng:7.49 },
  { id:8,  name:"Word Tabernacle",                pastor_name:"Pastor George Dlamini",   pastor_email:"george@wordtab.sz",        city:"Mbabane",      country:"Eswatini",     size:"Under 50",  verified:true, year_established:2015, phone:"+268 2 000 0000",  website:"", lat:-26.32, lng:31.13 },
  { id:9,  name:"Amazon River Message Church",    pastor_name:"Pastor Carlos Mendes",    pastor_email:"carlos@armc.br",           city:"Manaus",       country:"Brazil",       size:"50 – 100",  verified:true, year_established:2003, phone:"+55 92 0000 0000", website:"armc.br", lat:-3.10, lng:-60.00 },
  { id:10, name:"Grace Message Assembly",         pastor_name:"Pastor Philip Raj",       pastor_email:"philip@gma.in",            city:"Chennai",      country:"India",        size:"100 – 300", verified:true, year_established:1998, phone:"+91 44 0000 0000", website:"gma.in", lat:13.08, lng:80.27 },
  { id:11, name:"Spoken Word Tabernacle Berlin",  pastor_name:"Pastor Hans Weber",       pastor_email:"hans@swt-berlin.de",       city:"Berlin",       country:"Germany",      size:"Under 50",  verified:true, year_established:2012, phone:"+49 30 0000 0000", website:"swt-berlin.de", lat:52.52, lng:13.40 },
  { id:12, name:"End Time Message Fellowship",    pastor_name:"Pastor Andrew Kim",       pastor_email:"andrew@etmf.kr",           city:"Seoul",        country:"South Korea",  size:"50 – 100",  verified:true, year_established:2007, phone:"+82 2 0000 0000",  website:"etmf.kr", lat:37.57, lng:126.98 },
];

const CONTINENTS = ["All","Africa","Asia","Europe","Americas","Oceania"];

const regionFor = (country) => {
  const africa   = ["South Africa","Nigeria","Kenya","Ghana","Ethiopia","Uganda","Tanzania","Zambia","Zimbabwe","Mozambique","Eswatini","Malawi","Rwanda","Cameroon"];
  const asia     = ["India","China","South Korea","Philippines","Indonesia","Myanmar","Lebanon","Israel","Pakistan","Bangladesh","Vietnam"];
  const europe   = ["Germany","UK","France","Netherlands","Sweden","Norway","Switzerland","Belgium","Poland","Ukraine"];
  const americas = ["USA","Canada","Brazil","Mexico","Colombia","Argentina","Chile","Peru"];
  const oceania  = ["Australia","New Zealand","Papua New Guinea","Fiji"];
  if (africa.includes(country))   return "Africa";
  if (asia.includes(country))     return "Asia";
  if (europe.includes(country))   return "Europe";
  if (americas.includes(country)) return "Americas";
  if (oceania.includes(country))  return "Oceania";
  return "Other";
};

// ── CHURCHES MAP ────────────────────────────────────────────────────────────
const ChurchesMap = ({ churches, onChurchClick }) => {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v10",
      center: [10, 10],
      zoom: 1.3,
      attributionControl: true,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Inject dark popup styles to match home screen
    const style = document.createElement("style");
    style.textContent = `
      .sendme-church-popup .mapboxgl-popup-content {
        background: #0c1628 !important;
        border: 1px solid rgba(232,179,75,0.3) !important;
        border-radius: 12px !important;
        padding: 14px 16px !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.7) !important;
        color: #eef1ff !important;
      }
      .sendme-church-popup .mapboxgl-popup-tip {
        border-top-color: #0c1628 !important;
        border-bottom-color: #0c1628 !important;
      }
      .sendme-church-popup .mapboxgl-popup-close-button {
        color: rgba(255,255,255,0.4) !important;
        font-size: 16px !important;
        padding: 4px 8px !important;
      }
      .sendme-church-popup .mapboxgl-popup-close-button:hover {
        color: #e8b34b !important;
        background: transparent !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    churches.forEach(c => {
      if (typeof c.lat !== "number" || typeof c.lng !== "number") return;

      // Church pin element
      const el = document.createElement("div");
      el.style.cssText = `
        width: 20px; height: 20px; border-radius: 50%;
        background: radial-gradient(circle at 35% 35%, #f5d07a, #c8942b);
        border: 2px solid #060c18;
        box-shadow: 0 0 10px rgba(232,179,75,0.8), 0 0 20px rgba(232,179,75,0.3);
        cursor: pointer;
        transition: transform 0.15s;
      `;
      el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.4)"; });
      el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });

      const popupHtml = `
        <div style="font-family:Georgia,serif; min-width:190px;">
          <div style="font-size:10px; color:#e8b34b; letter-spacing:1.5px; font-weight:700; margin-bottom:6px; text-transform:uppercase;">⛪ Verified Church</div>
          <div style="font-weight:700; font-size:14px; color:#eef1ff; margin-bottom:4px; line-height:1.3;">${c.name}</div>
          <div style="font-size:12px; color:rgba(255,255,255,0.5); margin-bottom:6px;">📍 ${c.city}, ${c.country}</div>
          <div style="font-size:12px; color:#e8b34b; margin-bottom:3px;">✝ ${c.pastor_name || ""}</div>
          ${c.size ? `<div style="font-size:11px; color:rgba(255,255,255,0.35); margin-top:3px;">👥 ${c.size} members</div>` : ""}
          ${c.website ? `<div style="font-size:11px; color:#5b9cf6; margin-top:4px;">🌐 ${c.website}</div>` : ""}
        </div>`;

      const popup = new mapboxgl.Popup({
        offset: 16,
        closeButton: true,
        className: "sendme-church-popup",
        maxWidth: "240px",
      }).setHTML(popupHtml);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([c.lng, c.lat])
        .setPopup(popup)
        .addTo(mapRef.current);

      el.addEventListener("click", () => {
        marker.togglePopup();
        if (onChurchClick) onChurchClick(c.id);
      });

      markersRef.current.push(marker);
    });
  }, [churches, onChurchClick]);

  return (
    <div style={{ position:"relative", borderRadius:18, overflow:"hidden", border:"1px solid rgba(232,179,75,0.2)", marginBottom:24, boxShadow:"0 8px 40px rgba(0,0,0,0.5)" }}>
      <div ref={mapContainer} style={{ width:"100%", height:420 }} />
      <div style={{
        position:"absolute", top:14, left:14,
        background:"rgba(6,12,24,0.88)", borderRadius:10,
        border:"1px solid rgba(232,179,75,0.25)",
        padding:"10px 14px", fontFamily:"Georgia, serif",
        backdropFilter:"blur(4px)",
      }}>
        <div style={{ fontSize:12, color:"#e8b34b", letterSpacing:1, fontWeight:700 }}>WORLD CHURCH MAP</div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:2 }}>
          {churches.filter(c => typeof c.lat === "number" && typeof c.lng === "number").length} churches · tap a pin
        </div>
      </div>
    </div>
  );
};

export default function ChurchesTab({ onBack }) {
  const [churches, setChurches]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);
  const [continent, setContinent] = useState("All");
  const [search, setSearch]       = useState("");
  const [expanded, setExpanded]   = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("churches")
          .select("*")
          .order("name", { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          // Show rows where verified = true OR verified is null/missing (legacy demo rows)
          const verified = data.filter(c => c.verified === true || c.verified == null);
          if (verified.length > 0) {
            setChurches(verified);
            setUsingDemo(false);
          } else {
            setChurches(DEMO_CHURCHES);
            setUsingDemo(true);
          }
        } else {
          setChurches(DEMO_CHURCHES);
          setUsingDemo(true);
        }
      } catch {
        setChurches(DEMO_CHURCHES);
        setUsingDemo(true);
      }
      setLoading(false);
    };
    load();
  }, []);

  const visible = churches.filter(c => {
    const matchRegion = continent === "All" || regionFor(c.country) === continent;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      c.name?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.country?.toLowerCase().includes(q) ||
      c.pastor_name?.toLowerCase().includes(q);
    return matchRegion && matchSearch;
  });

  const countryCount = new Set(churches.map(c => c.country)).size;

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>

      {/* Header */}
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>
          Back
        </button>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>Message Church Directory</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>SENDME GLOBAL MISSION FUND</div>
        </div>
        <div style={{ marginLeft:"auto", fontSize:13, color:"rgba(255,255,255,0.3)" }}>
          {churches.length} churches · {countryCount} countries
        </div>
      </div>

      <div style={{ maxWidth:860, margin:"0 auto", padding:"28px 20px 60px" }}>

        {/* World map */}
        {!loading && (
          <ChurchesMap
            churches={visible}
            onChurchClick={(id) => {
              setExpanded(prev => prev === id ? null : id);
              setTimeout(() => {
                const el = document.getElementById(`church-${id}`);
                if (el) el.scrollIntoView({ behavior:"smooth", block:"center" });
              }, 100);
            }}
          />
        )}

        {/* Hero banner */}
        <div style={{ background:"rgba(232,179,75,0.08)", borderRadius:18, border:"1px solid rgba(232,179,75,0.2)", padding:"20px 24px", marginBottom:24, textAlign:"center" }}>
          <div style={{ fontSize:28, marginBottom:8 }}>⛪</div>
          <div style={{ fontSize:20, fontWeight:700, color:"#eef1ff", marginBottom:6 }}>Message Believing Churches Worldwide</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)", lineHeight:1.7 }}>
            Find a fellowship of Message believers near you. Every church listed here is a<br/>
            <strong style={{ color:"#e8b34b" }}>verified, endorsed congregation</strong> holding to the end-time Message.
          </div>
        </div>

        {/* Demo notice */}
        {usingDemo && !loading && (
          <div style={{ background:"rgba(232,179,75,0.06)", borderRadius:12, border:"1px solid rgba(232,179,75,0.15)", padding:"10px 16px", marginBottom:16, display:"flex", gap:10, alignItems:"center" }}>
            <span style={{ fontSize:16 }}>📋</span>
            <span style={{ fontSize:13, color:"rgba(255,255,255,0.4)" }}>
              Showing <strong style={{ color:"#e8b34b" }}>demo directory</strong> — no verified churches in database yet. Register and verify a church to appear here.
            </span>
          </div>
        )}

        {/* Search */}
        <div style={{ position:"relative", marginBottom:16 }}>
          <input
            type="text"
            placeholder="Search by church name, city, country or pastor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width:"100%", padding:"13px 16px 13px 44px", borderRadius:12, boxSizing:"border-box",
              background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
              color:"#eef1ff", fontSize:14, fontFamily:"Georgia, serif", outline:"none" }}
          />
          <span style={{ position:"absolute", left:15, top:"50%", transform:"translateY(-50%)", fontSize:16, opacity:0.4 }}>🔍</span>
        </div>

        {/* Continent filter */}
        <div style={{ display:"flex", gap:8, marginBottom:24, flexWrap:"wrap" }}>
          {CONTINENTS.map(c => (
            <button key={c} onClick={() => setContinent(c)} style={{ padding:"7px 16px", borderRadius:999,
              border:`1px solid ${continent===c?"#e8b34b":"rgba(255,255,255,0.1)"}`,
              background:continent===c?"rgba(232,179,75,0.15)":"rgba(255,255,255,0.03)",
              color:continent===c?"#e8b34b":"rgba(255,255,255,0.5)",
              cursor:"pointer", fontSize:13, fontWeight:600, transition:"all .15s" }}>
              {c}
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:24 }}>
          {[
            ["⛪", churches.length,    "Verified Churches", "#e8b34b"],
            ["🌍", countryCount,       "Countries",         "#5b9cf6"],
            ["✝",  visible.length,     "Showing",           "#3ecf8e"],
          ].map(([icon,val,label,c]) => (
            <div key={label} style={{ background:"rgba(255,255,255,0.03)", borderRadius:14,
              border:"1px solid rgba(255,255,255,0.07)", padding:"14px 12px", textAlign:"center" }}>
              <div style={{ fontSize:20 }}>{icon}</div>
              <div style={{ fontSize:20, fontWeight:700, color:c, marginTop:4 }}>{val}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Church list */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"rgba(255,255,255,0.3)" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>⛪</div>
            Loading churches...
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"rgba(255,255,255,0.3)" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🔍</div>
            No churches found for this filter.
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {visible.map(c => {
              const open = expanded === c.id;
              return (
                <div key={c.id} id={`church-${c.id}`}
                  style={{ background:"#0c1628", borderRadius:16,
                    border:`1px solid ${open?"rgba(232,179,75,0.35)":"rgba(255,255,255,0.07)"}`,
                    borderLeft:`3px solid #e8b34b`,
                    overflow:"hidden", transition:"border .2s" }}>

                  {/* Card header */}
                  <div
                    onClick={() => setExpanded(open ? null : c.id)}
                    style={{ padding:"18px 20px", cursor:"pointer", display:"flex",
                      justifyContent:"space-between", alignItems:"center", gap:16 }}>
                    <div style={{ display:"flex", gap:14, alignItems:"center", flex:1, minWidth:0 }}>
                      <div style={{ width:46, height:46, borderRadius:13, flexShrink:0,
                        background:"rgba(232,179,75,0.12)", border:"1.5px solid rgba(232,179,75,0.3)",
                        display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>
                        ⛪
                      </div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:15, fontWeight:700, color:"#eef1ff",
                          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {c.name}
                        </div>
                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:3 }}>
                          📍 {c.city}, {c.country}
                          {c.year_established ? ` · Est. ${c.year_established}` : ""}
                        </div>
                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:2 }}>
                          ✝ {c.pastor_name}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, flexShrink:0 }}>
                      <span style={{ padding:"3px 10px", borderRadius:999, fontSize:11,
                        background:"rgba(62,207,142,0.12)", color:"#3ecf8e",
                        border:"1px solid rgba(62,207,142,0.25)", whiteSpace:"nowrap" }}>
                        ✓ Verified
                      </span>
                      {c.size && (
                        <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{c.size} members</span>
                      )}
                      <span style={{ fontSize:18, color:"rgba(255,255,255,0.25)", lineHeight:1 }}>
                        {open ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {open && (
                    <div style={{ padding:"0 20px 20px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ paddingTop:16, display:"flex", flexDirection:"column", gap:10 }}>
                        <div style={{ fontSize:13, color:"rgba(255,255,255,0.35)",
                          letterSpacing:1.5, textTransform:"uppercase", marginBottom:4 }}>
                          Pastor Details
                        </div>
                        {[
                          ["✝ Pastor",  c.pastor_name],
                          ["📧 Email",  c.pastor_email || c.email],
                          ["📞 Phone",  c.pastor_phone || c.phone],
                          ["🌐 Website",c.website],
                          ["📍 Address",c.address],
                          ["👥 Size",   c.size ? c.size + " members" : null],
                        ].map(([lbl, val]) => val ? (
                          <div key={lbl} style={{ display:"flex", gap:12, alignItems:"flex-start",
                            padding:"10px 14px", borderRadius:10,
                            background:"rgba(255,255,255,0.02)",
                            border:"1px solid rgba(255,255,255,0.05)" }}>
                            <span style={{ fontSize:12, color:"rgba(255,255,255,0.35)",
                              minWidth:90, flexShrink:0 }}>{lbl}</span>
                            <span style={{ fontSize:13, color:"#eef1ff", wordBreak:"break-word" }}>
                              {lbl.includes("Email") ? (
                                <a href={`mailto:${val}`} style={{ color:"#e8b34b", textDecoration:"none" }}>{val}</a>
                              ) : lbl.includes("Website") ? (
                                <a href={`https://${val}`} target="_blank" rel="noreferrer"
                                  style={{ color:"#5b9cf6", textDecoration:"none" }}>{val}</a>
                              ) : val}
                            </span>
                          </div>
                        ) : null)}
                        <button
                          onClick={() => window.location.href = `mailto:${c.pastor_email || c.email}`}
                          style={{ marginTop:6, padding:"11px 0", borderRadius:12, border:"none",
                            background:"linear-gradient(135deg,#e8b34b,#c8942b)",
                            color:"#000", fontWeight:700, cursor:"pointer",
                            fontSize:14, fontFamily:"Georgia, serif",
                            boxShadow:"0 4px 20px rgba(232,179,75,0.3)" }}>
                          Contact This Church
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ textAlign:"center", padding:"40px 0 0",
          borderTop:"1px solid rgba(255,255,255,0.05)", marginTop:32 }}>
          <div style={{ fontSize:13, color:"#e8b34b", fontStyle:"italic" }}>
            "Go ye into all the world and preach the gospel to every creature." — Mark 16:15
          </div>
        </div>
      </div>
    </div>
  );
}
