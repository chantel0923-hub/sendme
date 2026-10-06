// missionGeocode.js
// Turns a mission's place (area / city / country) into map coordinates.
// Shared by the missionary application form and the admin "Edit Mission" screen.
//
// Why it works differently from before: the country comes from a fixed list
// (see countries.js) so we always know its ISO code, and Mapbox is asked to
// search ONLY inside that country. Previously the lookup tried to match country
// *names*, and a province typed in the country box ("Gauteng") made it reject the
// result — the mission got no coordinates and was drawn at 0°, 0° in the Atlantic.
//
// Same public Mapbox token fallback used in MapboxMap.js (Vercel renames
// REACT_APP_ env vars at build time, so process.env may be undefined in production).
import { countryIso } from "./countries";

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN ||
  "pk.eyJ1Ijoic2VuZG1lMDkyMyIsImEiOiJjbXI1anZpOGcwYXJvMzFyMHo2aDU2YnI2In0.CutnKCVEf1SzDpddacdekg";

// Returns { lat, lng, place, precise } — or { lat: null, lng: null, ... } if nothing was found.
//   place   : the name Mapbox matched (shown to the admin so they can sanity-check it)
//   precise : true if the specific area/city was found, false if only the country was
export const geocodeMissionLocation = async (area, city, country) => {
  const none = { lat: null, lng: null, place: "", precise: false };
  try {
    const iso = countryIso(country);
    if (!MAPBOX_TOKEN || !country || !iso) return none;

    const search = async (text) => {
      const q = encodeURIComponent(String(text).trim());
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${MAPBOX_TOKEN}&limit=1&country=${iso}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data?.features?.[0] || null;
    };

    // 1) the most specific place we have, searched only inside the chosen country
    const specific = [area, city].map(v => String(v || "").trim()).filter(Boolean).join(", ");
    let feature = specific ? await search(specific) : null;
    let precise = !!feature;

    // 2) otherwise the country itself, so the pin at least lands in the right country
    if (!feature) feature = await search(country);
    if (!feature) return none;

    const [lng, lat] = feature.center;
    return { lat, lng, place: feature.place_name || "", precise };
  } catch (e) {
    console.warn("Mission geocoding failed:", e);
    return none;
  }
};
