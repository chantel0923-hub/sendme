import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

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

// ── CHURCHES MAP (Leaflet — no Mapbox WebWorker issues) ─────────────────────
const ChurchesMap = ({ churches, onChurchClick }) => {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Dynamically load Leaflet CSS + JS
    const loadLeaflet = () => new Promise((resolve) => {
      if (window.L) { resolve(); return; }
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = resolve;
      document.head.appendChild(script);
    });

    loadLeaflet().then(() => {
      const L = window.L;

      // Inject styles to hide Leaflet default blue markers + dark popups
      const style = document.createElement("style");
      style.textContent = `
        .leaflet-container { background: #060c18 !important; font-family: Georgia, serif; }
        .leaflet-tile-pane { filter: brightness(0.85) saturate(0.7); }
        .sendme-popup .leaflet-popup-content-wrapper {
          background: #0c1628 !important;
          border: 1px solid rgba(232,179,75,0.3) !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.7) !important;
          color: #eef1ff !important;
          padding: 0 !important;
        }
        .sendme-popup .leaflet-popup-content { margin: 0 !important; }
        .sendme-popup .leaflet-popup-tip { background: #0c1628 !important; }
        .sendme-popup .leaflet-popup-close-button { color: rgba(255,255,255,0.4) !important; font-size:18px !important; top:6px !important; right:10px !important; }
        .sendme-popup .leaflet-popup-close-button:hover { color: #e8b34b !important; }
        .leaflet-control-zoom a { background:#0c1628 !important; color:#e8b34b !important; border-color:rgba(232,179,75,0.2) !important; }
        .leaflet-control-attribution { background:rgba(6,12,24,0.7) !important; color:rgba(255,255,255,0.3) !important; }
        .leaflet-control-attribution a { color:rgba(255,255,255,0.4) !important; }
      `;
      document.head.appendChild(style);

      mapRef.current = L.map(mapContainer.current, {
        center: [10, 10],
        zoom: 2,
        zoomControl: false,
      });

      // Leaflet's default zoom control renders top-left, which sits directly
      // under our "WORLD CHURCH MAP" info box (also top-left). Move it to
      // top-right instead — matches the layout already used on the Mission
      // Map (MapboxMap.js), where the nav control and info box don't collide.
      L.control.zoom({ position: "topright" }).addTo(mapRef.current);

      // Dark tile layer — CartoDB Dark Matter (free, no token)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(mapRef.current);

      // Add church markers
      churches.forEach(c => {
        if (typeof c.lat !== "number" || typeof c.lng !== "number") return;

        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:20px; height:20px; border-radius:50%;
            background: radial-gradient(circle at 35% 35%, #f5d07a, #c8942b);
            border: 2px solid #060c18;
            box-shadow: 0 0 10px rgba(232,179,75,0.8), 0 0 20px rgba(232,179,75,0.3);
            cursor:pointer;
          "></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          popupAnchor: [0, -14],
        });

        const popupHtml = `
          <div style="font-family:Georgia,serif; min-width:190px; padding:14px 16px;">
            <div style="font-size:10px; color:#e8b34b; letter-spacing:1.5px; font-weight:700; margin-bottom:6px; text-transform:uppercase;">⛪ Verified Church</div>
            <div style="font-weight:700; font-size:14px; color:#eef1ff; margin-bottom:4px; line-height:1.3;">${c.name}</div>
            <div style="font-size:12px; color:rgba(255,255,255,0.5); margin-bottom:6px;">📍 ${c.city}, ${c.country}</div>
            <div style="font-size:12px; color:#e8b34b; margin-bottom:3px;">✝ ${c.pastor_name || ""}</div>
            ${c.size ? `<div style="font-size:11px; color:rgba(255,255,255,0.35); margin-top:3px;">👥 ${c.size} members</div>` : ""}
            ${c.website ? `<div style="font-size:11px; color:#5b9cf6; margin-top:4px;">🌐 ${c.website}</div>` : ""}
          </div>`;

        const marker = L.marker([c.lat, c.lng], { icon })
          .bindPopup(popupHtml, { className: "sendme-popup", maxWidth: 240 })
          .addTo(mapRef.current);

        marker.on("mouseover", () => marker.openPopup());
        marker.on("mouseout", () => marker.closePopup());
        marker.on("click", () => {
          if (onChurchClick) onChurchClick(c.id);
        });

        markersRef.current.push(marker);
      });
    });

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // Update markers when churches change
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    churches.forEach(c => {
      if (typeof c.lat !== "number" || typeof c.lng !== "number") return;
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#f5d07a,#c8942b);border:2px solid #060c18;box-shadow:0 0 10px rgba(232,179,75,0.8);cursor:pointer;"></div>`,
        iconSize: [20,20], iconAnchor: [10,10], popupAnchor: [0,-14],
      });
      const popupHtml = `<div style="font-family:Georgia,serif;min-width:190px;padding:14px 16px;"><div style="font-size:10px;color:#e8b34b;letter-spacing:1.5px;font-weight:700;margin-bottom:6px;text-transform:uppercase;">⛪ Verified Church</div><div style="font-weight:700;font-size:14px;color:#eef1ff;margin-bottom:4px;">${c.name}</div><div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:6px;">📍 ${c.city}, ${c.country}</div><div style="font-size:12px;color:#e8b34b;">✝ ${c.pastor_name || ""}</div>${c.size?`<div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:3px;">👥 ${c.size} members</div>`:""}</div>`;
      const marker = L.marker([c.lat, c.lng], { icon })
        .bindPopup(popupHtml, { className:"sendme-popup", maxWidth:240 })
        .addTo(mapRef.current);
      marker.on("mouseover", () => marker.openPopup());
      marker.on("mouseout", () => marker.closePopup());
      marker.on("click", () => { if (onChurchClick) onChurchClick(c.id); });
      markersRef.current.push(marker);
    });
  }, [churches, onChurchClick]);

  return (
    <div style={{ position:"relative", borderRadius:18, overflow:"hidden", border:"1px solid rgba(232,179,75,0.2)", marginBottom:24, boxShadow:"0 8px 40px rgba(0,0,0,0.5)" }}>
      <div ref={mapContainer} style={{ width:"100%", height:420 }} />
      <div style={{
        position:"absolute", top:14, left:14, zIndex:1000,
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

        const verified = (data || []).filter(c => c.verified === true || c.verified == null);
        setChurches(verified);
      } catch {
        setChurches([]);
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
          <div style={{ fontSize:18, fontWeight:700 }}>Message Church &amp; Organization Directory</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>SENDME GLOBAL MISSION FUND</div>
        </div>
        <div style={{ marginLeft:"auto", fontSize:13, color:"rgba(255,255,255,0.3)" }}>
          {churches.length} listed · {countryCount} countries
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
          <div style={{ fontSize:20, fontWeight:700, color:"#eef1ff", marginBottom:6 }}>Message Believing Churches &amp; Organizations Worldwide</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)", lineHeight:1.7 }}>
            Find a fellowship or sending organization of Message believers near you. Everyone listed here is a<br/>
            <strong style={{ color:"#e8b34b" }}>verified, endorsed</strong> part of the end-time Message.
          </div>
        </div>

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
            ["⛪", churches.length,    "Verified Listings",  "#e8b34b"],
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
            <div style={{ fontSize:32, marginBottom:12 }}>{churches.length === 0 ? "⛪" : "🔍"}</div>
            {churches.length === 0
              ? "No verified churches yet — register and verify a church to appear here."
              : "No churches found for this filter."}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {visible.map(c => {
              const open = expanded === c.id;
              const isOrgRow = c.entity_type === "organization";
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
                        {isOrgRow ? "🌍" : "⛪"}
                      </div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                          <div style={{ fontSize:15, fontWeight:700, color:"#eef1ff",
                            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                            {c.name}
                          </div>
                          {isOrgRow && (
                            <span style={{ padding:"2px 8px", borderRadius:999, fontSize:9, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase", whiteSpace:"nowrap",
                              background:"rgba(91,156,246,0.12)", color:"#5b9cf6", border:"1px solid rgba(91,156,246,0.3)" }}>
                              Org
                            </span>
                          )}
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
                        <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{c.size} {isOrgRow ? "team" : "members"}</span>
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
                          {isOrgRow ? "Leader Details" : "Pastor Details"}
                        </div>
                        {[
                          [isOrgRow ? "✝ Leader" : "✝ Pastor",  c.pastor_name],
                          ["📧 Email",  c.pastor_email || c.email],
                          ["📞 Phone",  c.show_phone_public ? (c.pastor_phone || c.phone) : null],
                          ["🌐 Website",c.website],
                          ["📍 Address",c.address],
                          ["👥 Size",   c.size ? c.size + (isOrgRow ? " team" : " members") : null],
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
                          {isOrgRow ? "Contact This Organization" : "Contact This Church"}
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
