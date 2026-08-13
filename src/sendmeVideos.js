// sendmeVideos.js — Central place to manage all SendMe YouTube links
//
// Rebuilt to match the actual 10-video tutorial set (previously this only
// had 4 generic placeholder slots — missionVision/missionaryHowTo/
// churchHowTo/donorHowTo — that never matched the real recorded videos).
// Each key below is consumed somewhere specific in the app:
//   - missionVision  → Home screen (App.js)
//   - all others     → Video Tutorials library on the FAQ screen (FAQScreen.js)
//
// Just paste your YouTube VIDEO ID (the part after "watch?v=" or after
// "youtu.be/") — e.g. https://youtu.be/T3z7EJU_FJs → "T3z7EJU_FJs"

export const SENDME_CHANNEL_URL = "https://www.youtube.com/@SendMeGlobalMission";

export const FEATURED_VIDEOS = {
  missionVision:    "T3z7EJU_FJs", // SendMe - Vision & Mission
  registerAccount:  "ppZs0Kwk9wQ", // SendMe Tutorial - How to Create a SendMe Account
  churchRegister:   "Std2BCzL_M0", // SendMe Tutorial - Registering Your Church (Pastors Only)
  churchDirectory:  "UB-p3LH70mQ", // SendMe Tutorial - Finding a Message Believing Church
  missionaryApply:  "zUFsifXsD1s", // SendMe Tutorial - Applying as a Missionary
  donate:           "2NzAHuYBwzw", // SendMe Tutorial - How to Donate to a Mission
  sendWorker:       "phIz25cWMNA", // SendMe Tutorial - Requesting a Worker for Your Church
  emergencyRequest: "IZ37xaKK2io", // SendMe Tutorial - Submitting an Emergency Request
  proofCycle:       "ssW6LQDCVH0", // SendMe Tutorial - Submitting & Approving Milestone Proof
  testimonies:      "ZyYiwZxfEoA", // SendMe Tutorial - Verified Mission Testimonies
};

// Field testimony videos — one entry per mission.
// Key = mission id (matches missions.id in Supabase), value = YouTube video ID
export const MISSION_VIDEOS = {
  // 1: "abc123XYZ",
  // 2: "def456UVW",
};
