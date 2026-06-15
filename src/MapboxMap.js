import { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

import mapboxgl from "mapbox-gl";
if (typeof window !== "undefined") { window.mapboxWorkerCount = 0; }

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN || "pk.eyJ1Ijoic2VuZG1lMDkyMyIsImEiOiJjbXB6enh5ZmwwazhxMnNzZHd2dGx6YndvIn0.odqKTeH4YCXXk8m_T7JyEQ";

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

const UNREACHED_REGIONS = [
  { name: "North Africa",         lat: 25.0,  lng: 17.0  },
  { name: "Arabian Peninsula",    lat: 23.0,  lng: 45.0  },
  { name: "Central Asia",         lat: 40.0,  lng: 63.0  },
  { name: "Himalayan Belt",       lat: 28.0,  lng: 84.0  },
  { name: "W. Africa Interior",   lat: 13.0,  lng: 2.0   },
  { name: "Southeast Asia",       lat: 20.0,  lng: 100.0 },
];

export default function MapboxMap({ missions, churches = [], onMissionClick }) {
  const mapContainer = useRef(null);
  const map          = useRef(null);
  const popup        = useRef(null);

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

      map.current.addSource("unreached", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: UNREACHED_REGIONS.map(r => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [r.lng, r.lat] },
            properties: { name: r.name },
          })),
        },
      });

      map.current.addLayer({
        id: "unreached-glow",
        type: "circle",
        source: "unreached",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 28, 4, 70],
          "circle-color": "#e85b5b",
          "circle-opacity": 0.08,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#e85b5b",
          "circle-stroke-opacity": 0.25,
        },
      });

      map.current.addLayer({
        id: "unreached-labels",
        type: "symbol",
        source: "unreached",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 10,
          "text-anchor": "center",
        },
        paint: {
          "text-color": "#e85b5b",
          "text-opacity": 0.55,
          "text-halo-color": "#060c18",
          "text-halo-width": 1.5,
        },
      });

      map.current.addSource("missions", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: (missions || []).map(m => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [m.lng, m.lat] },
            properties: {
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
            },
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
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
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

      map.current.on("mouseenter", "mission-circle", (e) => {
        map.current.getCanvas().style.cursor = "pointer";
        const props = e.features[0].properties;
        const coords = e.features[0].geometry.coordinates.slice();
        const pct = Math.min(100, Math.round((props.raised / props.goal) * 100));
        popup.current
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:Georgia,serif;background:#0c1628;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px 16px;min-width:200px;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
              <div style="font-size:11px;color:${props.color};letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">${props.role}</div>
              <div style="font-size:14px;font-weight:700;color:#eef1ff;margin-bottom:3px">${props.name}</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:10px">${props.protected ? "Location Protected" : props.city + ", " + props.country}</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:6px">${props.title}</div>
              <div style="background:rgba(255,255,255,0.07);border-radius:999px;height:5px;overflow:hidden;margin-bottom:6px">
                <div style="width:${pct}%;height:100%;background:${props.color};border-radius:999px"></div>
              </div>
              <div style="display:flex;justify-content:space-between">
                <span style="font-size:12px;color:${props.color};font-weight:700">$${String(Math.round(props.raised)).replace(/\B(?=(\d{3})+(?!\d))/g,",")} raised</span>
                <span style="font-size:11px;color:rgba(255,255,255,0.3)">${pct}%</span>
              </div>
              <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:8px;text-align:center">Click to open mission</div>
            </div>
          `)
          .addTo(map.current);
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
    <div style={{ position:"relative", borderRadius:20, overflow:"hidden",
      border:"1px solid rgba(255,255,255,0.08)", height:400 }}>
      <div ref={mapContainer} style={{ width:"100%", height:"100%" }} />
      <div style={{ position:"absolute", bottom:16, left:16, zIndex:10,
        background:"rgba(6,12,24,0.88)", borderRadius:12,
        border:"1px solid rgba(255,255,255,0.1)", padding:"10px 14px",
        backdropFilter:"blur(8px)", display:"flex", flexDirection:"column", gap:7 }}>
        {[["✝","#e8b34b","Active Mission"],["✝","#3ecf8e","Completed Mission"],
          ["🔒","#b06cf5","Protected Mission"],["⛪","#5b9cf6","Verified Church"],
          ["●","#e85b5b","Unreached Region"]].map(([icon,color,label]) => (
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
          {missions?.length || 0} active missions · click a pin to explore
        </div>
      </div>
    </div>
  );
}
