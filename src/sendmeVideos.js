// sendmeVideos.js — Central place to manage all SendMe YouTube links
// Just paste your YouTube VIDEO ID (the part after "watch?v=" in the URL)
// Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ  →  "dQw4w9WgXcQ"

export const SENDME_CHANNEL_URL = "https://www.youtube.com/@SendMeGlobalMission";

export const FEATURED_VIDEOS = {
  missionVision: "",   // ← Mission & Vision video ID
  missionaryHowTo: "", // ← Missionary walkthrough video ID
  churchHowTo: "",     // ← Church walkthrough video ID
  donorHowTo: "",      // ← Donor walkthrough video ID
};

// Field testimony videos — one entry per mission.
// Key = mission id (matches missions.id in Supabase), value = YouTube video ID
export const MISSION_VIDEOS = {
  // 1: "abc123XYZ",
  // 2: "def456UVW",
};
