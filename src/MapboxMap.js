import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

import mapboxgl from "mapbox-gl";
if (typeof window !== "undefined") { window.mapboxWorkerCount = 0; }

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN || "pk.eyJ1Ijoic2VuZG1lMDkyMyIsImEiOiJjbXI1anZpOGcwYXJvMzFyMHo2aDU2YnI2In0.CutnKCVEf1SzDpddacdekg";

// Popups are built as HTML text and mission details are typed by applicants, so every value is
// escaped before it goes into a popup.
const esc = (v) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Override Mapbox default white popup styles
const _styleId = "sendme-popup-styles";
if (!document.getElementById(_styleId)) {
  const _s = document.createElement("style");
  _s.id = _styleId;
  _s.innerHTML = `
    .mapboxgl-popup-content {
      background: transparent !important;
      padding: 0 !important;
      border-radius: 14px !important;
      box-shadow: none !important;
    }
    .mapboxgl-popup-tip {
      border-top-color: #0c1628 !important;
      border-bottom-color: #0c1628 !important;
    }
  `;
  document.head.appendChild(_s);
}

// High-Risk Mission Fields — previously this was a static, editorial list of
// 10 illustrative "unreached region" points (the old UNREACHED_REGIONS array,
// unrelated to any real mission data). Replaced with a real, data-driven
// layer: every mission where the missionary selected "🔴 High Risk" for
// Field Access/Conditions during application (Step 4 of MissionaryApplication.js,
// saved to missions.risk_level, read here as m.riskLevel per App.js's mapRow()
// — NOT risk_level, that's the raw DB column name, App.js already renames it).
// Built at the same mount-time closure as the "missions" source below (this
// effect only runs once — see the missions.current guard — so like the
// mission pins themselves, this won't live-update if `missions` changes
// after first mount without a remount).
const buildHighRiskFeatures = (missions) =>
  (missions || [])
    .filter(m => Number(m.riskLevel) === 4 && m.lat && m.lng) // skip ungeocoded (0,0) fallback missions
    .map(m => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [m.lng, m.lat] },
      properties: {
        name:    m.protected ? "Protected Mission" : (m.name || m.title || "Untitled Mission"),
        area:    m.area || "",
        country: m.country || "",
      },
    }));

// Only missions that actually have coordinates can be drawn. A mission without them
// (older records, or a place the lookup couldn't find) is skipped rather than being
// pinned at 0,0 in the Atlantic.
const hasCoords = (m) => Number.isFinite(m.lat) && Number.isFinite(m.lng);

// The properties each mission pin carries (also used to rebuild its popup when a mission card's
// "Show on map" button zooms to it).
const missionProps = (m) => ({
  id:        m.id,
  name:      m.protected ? "Protected Mission" : (m.name || m.title || "Untitled Mission"),
  title:     m.title,
  role:      m.role,
  city:      m.city,
  country:   m.country,
  color:     m.status === "complete" ? "#3ecf8e" : m.protected ? "#b06cf5" : m.color,
  protected: m.protected,
  status:    m.status,
  raised:    m.raised,
  goal:      m.goal,
  fundingTarget: m.fundingTarget || m.goal,
  riskLevel: m.riskLevel,
  fundedOutside: !!m.fundedOutside,
});

export default function MapboxMap({ missions, churches = [], onMissionClick, focus }) {
  const mapContainer = useRef(null);
  const map          = useRef(null);
  const popup        = useRef(null);
  const missionsRef  = useRef(missions);
  missionsRef.current = missions;
  const showPopupRef = useRef(null);
  const [zoomedIn, setZoomedIn] = useState(false);

  // A "Show on map" tap on a mission card arrives as a new `focus` ({ id, n } — n changes on every
  // tap so tapping the same mission twice zooms again). Fly to that pin, ring it and open its popup.
  // A protected mission is only zoomed to region level — never to its exact spot.
  useEffect(() => {
    const mp = map.current;
    if (!focus || !mp) return;
    let src;
    try { src = mp.getSource("missions"); } catch (_e) { return; }
    if (!src) return;
    const m = (missionsRef.current || []).find(x => String(x.id) === String(focus.id));
    if (!m || !hasCoords(m)) return;
    try { mp.setFilter("mission-focus", ["==", ["get", "id"], m.id]); } catch (_e) {}
    setZoomedIn(true);
    const coords = [m.lng, m.lat];
    mp.flyTo({ center: coords, zoom: m.protected ? 5 : 11, speed: 1.2, curve: 1.2 });
    const openIt = () => { if (showPopupRef.current) showPopupRef.current(missionProps(m), coords); };
    mp.once("moveend", openIt);
    const t = setTimeout(openIt, 2500); // in case the map was already there and never "moves"
    return () => clearTimeout(t);
  }, [focus]);

  const showAll = () => {
    const mp = map.current;
    if (!mp) return;
    if (popup.current) popup.current.remove();
    try { mp.setFilter("mission-focus", ["==", ["get", "id"], ""]); } catch (_e) {}
    mp.flyTo({ center: [20, 10], zoom: 2.2 });
    setZoomedIn(false);
  };

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v10",
      center: [20, 10],
      zoom: 2.2,
      attributionControl: false,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }), "top-right"
    );
    map.current.addControl(
      new mapboxgl.AttributionControl({ compact: true }), "bottom-right"
    );

    popup.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 20,
      className: "sendme-popup",
    });

    map.current.on("load", () => {

      map.current.addSource("high-risk-fields", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: buildHighRiskFeatures(missions),
        },
      });

      map.current.addLayer({
        id: "high-risk-glow",
        type: "circle",
        source: "high-risk-fields",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 28, 4, 70],
          "circle-color": "#e85b5b",
          "circle-opacity": 0.08,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#e85b5b",
          "circle-stroke-opacity": 0.25,
        },
      });

      // No persistent labels here (unlike the old static regions) — with
      // real per-mission data this could get crowded fast, and would put
      // extra always-visible text over a shadow-mode/protected mission's
      // exact map position. Hover popup only, same pattern as mission pins.
      map.current.on("mouseenter", "high-risk-glow", (e) => {
        map.current.getCanvas().style.cursor = "default";
        const props = e.features[0].properties;
        const coords = e.features[0].geometry.coordinates.slice();
        const location = [props.area, props.country].filter(Boolean).join(", ");
        popup.current
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:Georgia,serif;background:#0c1628;border:1px solid rgba(232,91,91,0.3);border-radius:12px;padding:12px 14px;min-width:180px;max-width:240px;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
              <div style="font-size:11px;color:#e85b5b;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">High-Risk Mission Field</div>
              <div style="font-size:14px;font-weight:700;color:#eef1ff;margin-bottom:4px">${esc(props.name)}</div>
              ${location ? `<div style="font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:6px">${esc(location)}</div>` : ""}
              <div style="font-size:12px;color:rgba(255,255,255,0.55);line-height:1.5">Flagged by the missionary during application — security, political, or persecution risk in this field.</div>
            </div>
          `)
          .addTo(map.current);
      });
      map.current.on("mouseleave", "high-risk-glow", () => {
        map.current.getCanvas().style.cursor = "";
        popup.current.remove();
      });

      map.current.addSource("missions", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: (missions || []).filter(hasCoords).map(m => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [m.lng, m.lat] },
            properties: missionProps(m),
          })),
        },
      });

      map.current.addLayer({
        id: "mission-glow",
        type: "circle",
        source: "missions",
        paint: {
          "circle-radius": 22,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.18,
          "circle-blur": 0.6,
        },
      });

      map.current.addLayer({
        id: "mission-circle",
        type: "circle",
        source: "missions",
        paint: {
          "circle-radius": 14,
          "circle-color": ["get", "color"],
          // High-risk missions (riskLevel 4) get a red ring instead of the
          // default white one, so a flagged mission's own pin is visibly
          // distinct even before hovering the glow layer beneath it.
          "circle-stroke-width": 2.5,
          "circle-stroke-color": ["case", ["==", ["get", "riskLevel"], 4], "#e85b5b", "#ffffff"],
          "circle-opacity": 1,
        },
      });

      map.current.addLayer({
        id: "mission-symbol",
        type: "symbol",
        source: "missions",
        layout: {
          "text-field": [
            "case",
            ["==", ["get", "protected"], true], "🔒",
            "✝"
          ],
          "text-size": 13,
          "text-anchor": "center",
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: { "text-color": "#ffffff" },
      });

      // Gold ring around the mission that "Show on map" zoomed to (empty id = nothing ringed).
      map.current.addLayer({
        id: "mission-focus",
        type: "circle",
        source: "missions",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "circle-radius": 22,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#e8b34b",
          "circle-stroke-opacity": 0.95,
        },
      });

      const showMissionPopup = (props, coords) => {
        const pct = Math.min(100, Math.round((props.raised / props.fundingTarget) * 100));
        popup.current
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:Georgia,serif;background:#0c1628;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px 16px;min-width:200px;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
              <div style="font-size:11px;color:${props.color};letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">${esc(props.role)}${props.status === "complete" ? ' <span style="color:#3ecf8e;letter-spacing:1px;">· ✓ Completed</span>' : ""}</div>
              <div style="font-size:14px;font-weight:700;color:#eef1ff;margin-bottom:3px">${esc(props.name)}${props.riskLevel === 4 ? ' <span style="color:#e85b5b;font-size:11px;">🔴 High Risk</span>' : ""}</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:10px">${props.protected ? "Location Protected" : esc([props.city, props.country].filter(Boolean).join(", "))}</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:6px">${esc(props.title)}</div>
              ${props.fundedOutside ? '<div style="font-size:12px;color:#3ecf8e;font-weight:700">✓ Completed with funding from outside SendMe</div>' : `<div style="background:rgba(255,255,255,0.07);border-radius:999px;height:5px;overflow:hidden;margin-bottom:6px">
                <div style="width:${pct}%;height:100%;background:${props.color};border-radius:999px"></div>
              </div>
              <div style="display:flex;justify-content:space-between">
                <span style="font-size:12px;color:${props.color};font-weight:700">$${String(Math.round(props.raised)).replace(/\B(?=(\d{3})+(?!\d))/g,",")} raised</span>
                <span style="font-size:11px;color:rgba(255,255,255,0.3)">${pct}%</span>
              </div>`}
              <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:8px;text-align:center">Click to open mission</div>
            </div>
          `)
          .addTo(map.current);
      };
      showPopupRef.current = showMissionPopup;

      map.current.on("mouseenter", "mission-circle", (e) => {
        map.current.getCanvas().style.cursor = "pointer";
        showMissionPopup(e.features[0].properties, e.features[0].geometry.coordinates.slice());
      });

      map.current.on("mouseleave", "mission-circle", () => {
        map.current.getCanvas().style.cursor = "";
        popup.current.remove();
      });

      map.current.on("click", "mission-circle", (e) => {
        const props = e.features[0].properties;
        const coords = e.features[0].geometry.coordinates.slice();
        map.current.flyTo({ center: coords, zoom: 6, speed: 1.4, curve: 1.2 });
        if (onMissionClick) {
          const mission = (missions || []).find(m => m.id === props.id);
          if (mission) onMissionClick(mission);
        }
      });

      const churchFeatures = (churches || [])
        .filter(c => c.lat && c.lng)
        .map(c => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [c.lng, c.lat] },
          properties: { name: c.name, city: c.city, country: c.country },
        }));

      if (churchFeatures.length > 0) {
        map.current.addSource("churches", {
          type: "geojson",
          data: { type: "FeatureCollection", features: churchFeatures },
        });
        map.current.addLayer({
          id: "church-circle", type: "circle", source: "churches",
          paint: { "circle-radius": 11, "circle-color": "#5b9cf6", "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" },
        });
        map.current.addLayer({
          id: "church-symbol", type: "symbol", source: "churches",
          layout: { "text-field": "⛪", "text-size": 11, "text-anchor": "center", "text-allow-overlap": true },
        });
      }
    });

    return () => {
      popup.current?.remove();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  return (
    <div id="world-map" style={{ position:"relative", borderRadius:20, overflow:"hidden",
      border:"1px solid rgba(255,255,255,0.08)", height:400, scrollMarginTop:92 }}>
      <div ref={mapContainer} style={{ width:"100%", height:"100%" }} />
      {zoomedIn && (
        <button onClick={showAll}
          style={{ position:"absolute", bottom:40, right:16, zIndex:10, background:"rgba(6,12,24,0.92)",
            border:"1px solid rgba(232,179,75,0.4)", borderRadius:10, padding:"8px 14px", color:"#e8b34b",
            fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Georgia, serif" }}>
          🌍 Show all missions
        </button>
      )}
      <div style={{ position:"absolute", bottom:16, left:16, zIndex:10,
        background:"rgba(6,12,24,0.88)", borderRadius:12,
        border:"1px solid rgba(255,255,255,0.1)", padding:"10px 14px",
        backdropFilter:"blur(8px)", display:"flex", flexDirection:"column", gap:7 }}>
        {[["✝","#e8b34b","Active Mission"],["✝","#3ecf8e","Completed Mission"],
          ["🔒","#b06cf5","Protected Mission"],["⛪","#5b9cf6","Verified Church"],
          ["●","#e85b5b","High-Risk Mission Field"]].map(([icon,color,label]) => (
          <div key={label} style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:13, color, width:18, textAlign:"center" }}>{icon}</span>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>{label}</span>
          </div>
        ))}
      </div>
      <div style={{ position:"absolute", top:16, left:16, zIndex:10,
        background:"rgba(6,12,24,0.82)", borderRadius:10,
        border:"1px solid rgba(232,179,75,0.25)", padding:"8px 14px", backdropFilter:"blur(8px)" }}>
        <div style={{ fontSize:12, fontWeight:700, color:"#e8b34b", letterSpacing:2, fontFamily:"Georgia, serif" }}>WORLD MISSION MAP</div>
        <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginTop:2 }}>
          {(missions || []).filter(x => x.status !== "complete").length} active
          {(missions || []).some(x => x.status === "complete") ? ` · ${(missions || []).filter(x => x.status === "complete").length} completed` : ""} · click a pin to explore
        </div>
      </div>
    </div>
  );
}
