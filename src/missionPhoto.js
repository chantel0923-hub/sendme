// missionPhoto.js
// Shared by the missionary application form and the admin mission editor.
//   shrinkPhoto(file)             -> Promise<Blob>  a JPEG of at most 1600px (rejects with a readable message)
//   uploadMissionPhoto(blob, uid) -> Promise<string> public link, stored in a folder named after the
//                                    signed-in user (the storage rule only allows your own folder)
import { supabase } from "./supabase";

const PHOTO_MAX_INPUT_BYTES = 15 * 1024 * 1024;   // refuse anything bigger than this before processing
const PHOTO_MAX_EDGE = 1600;

export const shrinkPhoto = (file) => new Promise((resolve, reject) => {
  if (!file || !/^image\//.test(file.type || "")) { reject(new Error("Please choose a picture (JPG, PNG or WebP).")); return; }
  if (file.size > PHOTO_MAX_INPUT_BYTES) { reject(new Error("That picture is too large. Please choose one under 15 MB.")); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    try {
      const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);   // PNGs with transparency become white, not black
      ctx.drawImage(img, 0, 0, w, h);
      const attempt = (q) => canvas.toBlob((blob) => {
        if (!blob) { URL.revokeObjectURL(url); reject(new Error("That picture could not be prepared. Please try another one.")); return; }
        if (blob.size > 2 * 1024 * 1024 && q > 0.5) { attempt(0.6); return; }
        URL.revokeObjectURL(url); resolve(blob);
      }, "image/jpeg", q);
      attempt(0.82);
    } catch (e) { URL.revokeObjectURL(url); reject(new Error("That picture could not be prepared. Please try another one.")); }
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That picture could not be opened. Please try a JPG or PNG.")); };
  img.src = url;
});

export const uploadMissionPhoto = async (blob, userId) => {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from("mission-photos")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
  if (error) throw error;
  const { data } = supabase.storage.from("mission-photos").getPublicUrl(path);
  if (!data || !data.publicUrl) throw new Error("The picture was uploaded but its link could not be created.");
  return data.publicUrl;
};
