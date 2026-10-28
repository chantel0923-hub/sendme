// Share images — a 1080 × 1920 picture (the WhatsApp Status size) for a mission or a testimony, with the
// SendMe name, the Message pictures, the key facts and a QR code that opens the right page.
// The drawing functions only need a canvas "2d" context, so they can be tested without a browser.
import { qrMatrix, drawQr } from "./qr";
import { SITE_ORIGIN, missionLink, siteLink } from "./shareConfig";

export const CARD_W = 1080;
export const CARD_H = 1920;
const SERIF = "Georgia, 'DejaVu Serif', 'Times New Roman', serif";
const GOLD = "#e8b34b", GREEN = "#3ecf8e", INK = "#eef1ff", MUTED = "rgba(238,241,255,0.62)";
export const HERO_IMAGES = ["/images/message/cloud-1963.jpg", "/images/message/jesus.jpg", "/images/message/pillar-of-fire.jpg"];

const money = (n) => "$" + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const spacing = (ctx, px) => { try { ctx.letterSpacing = `${px}px`; } catch (_e) { /* older browsers: no letter spacing */ } };

// Cuts text into lines that fit `maxWidth`; if it does not all fit in `maxLines`, the last line ends in "…".
export function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  let used = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (!line || ctx.measureText(test).width <= maxWidth) { line = test; used++; continue; }
    lines.push(line);
    if (lines.length === maxLines) { line = ""; break; }
    line = w; used++;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (used < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1).trimEnd();
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// Draws `img` filling the rounded rectangle, cropping the edges as needed (like CSS object-fit: cover).
const drawCover = (ctx, img, x, y, w, h, r) => {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) * 0.3, dw, dh);
  ctx.restore();
  ctx.strokeStyle = "rgba(232,179,75,0.45)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
};

function drawBackground(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
  g.addColorStop(0, "#060c18"); g.addColorStop(0.55, "#0b1528"); g.addColorStop(1, "#08101f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = ctx.createRadialGradient(CARD_W / 2, 120, 20, CARD_W / 2, 120, 700);
  glow.addColorStop(0, "rgba(232,179,75,0.16)"); glow.addColorStop(1, "rgba(232,179,75,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, 900);
  ctx.strokeStyle = "rgba(232,179,75,0.35)";
  ctx.lineWidth = 3;
  roundRect(ctx, 28, 28, CARD_W - 56, CARD_H - 56, 36);
  ctx.stroke();
}

function drawHeader(ctx) {
  ctx.textBaseline = "alphabetic";
  ctx.font = `bold 96px ${SERIF}`;
  const a = ctx.measureText("Send").width, b = ctx.measureText("Me").width;
  const x0 = (CARD_W - (a + b)) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff"; ctx.fillText("Send", x0, 170);
  ctx.fillStyle = GOLD;      ctx.fillText("Me", x0 + a, 170);
  ctx.textAlign = "center";
  ctx.font = `26px ${SERIF}`; spacing(ctx, 9);
  ctx.fillStyle = "rgba(238,241,255,0.4)"; ctx.fillText("GLOBAL MISSION FUND", CARD_W / 2 + 4, 216);
  ctx.font = `bold 28px ${SERIF}`; spacing(ctx, 6);
  ctx.fillStyle = GOLD; ctx.fillText("FOR MESSAGE BELIEVERS", CARD_W / 2 + 3, 272);
  spacing(ctx, 0);
  ctx.textAlign = "left";
}

// The three Message pictures in a row (or a gold divider if they could not be loaded).
function drawTrio(ctx, hero, y, h) {
  const loaded = (hero || []).filter(Boolean);
  if (loaded.length === 0) {
    ctx.fillStyle = "rgba(232,179,75,0.4)"; ctx.fillRect(CARD_W / 2 - 80, y + h / 2, 160, 3);
    return;
  }
  const w = 300, gap = 20, x0 = (CARD_W - (w * 3 + gap * 2)) / 2;
  (hero || []).forEach((img, i) => {
    const x = x0 + i * (w + gap);
    if (img) drawCover(ctx, img, x, y, w, h, 24);
    else { ctx.fillStyle = "#0a1322"; roundRect(ctx, x, y, w, h, 24); ctx.fill(); }
  });
}

function drawQrPanel(ctx, qrRows, caption, panelY = 1470) {
  const x = 80, y = panelY, w = 920, h = 330;
  ctx.fillStyle = "rgba(255,255,255,0.05)"; roundRect(ctx, x, y, w, h, 30); ctx.fill();
  ctx.strokeStyle = "rgba(232,179,75,0.35)"; ctx.lineWidth = 2; roundRect(ctx, x, y, w, h, 30); ctx.stroke();
  if (qrRows) {
    ctx.save(); roundRect(ctx, x + 30, y + 30, 270, 270, 18); ctx.clip();
    drawQr(ctx, qrRows, x + 30, y + 30, 270);
    ctx.restore();
  }
  const tx = x + 335;
  ctx.fillStyle = INK; ctx.font = `bold 42px ${SERIF}`; ctx.textAlign = "left";
  wrapLines(ctx, caption, w - 335 - 30, 2).forEach((l, i) => ctx.fillText(l, tx, y + 100 + i * 52));
  ctx.fillStyle = GOLD; ctx.font = `bold 38px ${SERIF}`;
  ctx.fillText("sendmeglobalmission.org".replace("https://", ""), tx, y + 214);
  ctx.fillStyle = MUTED; ctx.font = `28px ${SERIF}`;
  ctx.fillText("Give by card or bank transfer", tx, y + 262);
}

// Small gold dot + place text, then "by …"
function drawMeta(ctx, y, place, by) {
  ctx.font = `34px ${SERIF}`;
  if (place) {
    ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(94, y - 12, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = MUTED; ctx.fillText(place, 116, y);
    y += 50;
  }
  if (by) { ctx.fillStyle = MUTED; ctx.fillText(by, 80, y); y += 50; }
  return y;
}

// One rounded number tile: big value on top, small label under it.
function drawStatTile(ctx, x, y, w, h, value, label, color) {
  ctx.fillStyle = "rgba(255,255,255,0.04)"; roundRect(ctx, x, y, w, h, 22); ctx.fill();
  ctx.strokeStyle = color + "66"; ctx.lineWidth = 2; roundRect(ctx, x, y, w, h, 22); ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = color; ctx.font = `bold 54px ${SERIF}`; ctx.fillText(String(value), x + w / 2, y + h * 0.56);
  ctx.fillStyle = MUTED; ctx.font = `25px ${SERIF}`; ctx.fillText(label, x + w / 2, y + h - 22);
  ctx.textAlign = "left";
}

// The monthly report picture: this month's numbers, the running totals, churches registered, a call to
// forward it and give, and a QR code.  data: { title, raised, gifts, month:{missions,souls,bibles,churches},
// total:{missions,souls,bibles,churches}, churchesRegistered, link }
function renderReportCard(ctx, data, qrRows) {
  drawBackground(ctx);
  drawHeader(ctx);
  const num = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const m = data.month || {}, t = data.total || {};
  ctx.textAlign = "left";
  ctx.font = `bold 28px ${SERIF}`; spacing(ctx, 6); ctx.fillStyle = GOLD;
  ctx.fillText("MONTHLY REPORT", 80, 350); spacing(ctx, 0);
  ctx.fillStyle = INK; ctx.font = `bold 76px ${SERIF}`;
  wrapLines(ctx, data.title || "", 920, 1).forEach((l) => ctx.fillText(l, 80, 432));

  // ── this month ──
  ctx.font = `bold 26px ${SERIF}`; spacing(ctx, 5); ctx.fillStyle = MUTED; ctx.fillText("THIS MONTH", 80, 500); spacing(ctx, 0);
  drawStatTile(ctx, 80, 520, 920, 128, money(data.raised), `raised from ${num(data.gifts)} gift${Number(data.gifts) === 1 ? "" : "s"}`, GREEN);
  const half = 448, gap = 24, x2 = 80 + half + gap;
  drawStatTile(ctx, 80, 672, half, 128, num(m.missions), "Missions completed", GOLD);
  drawStatTile(ctx, x2, 672, half, 128, num(m.souls), "Souls reached", GOLD);
  drawStatTile(ctx, 80, 824, half, 128, num(m.bibles), "Bibles-Message Books", GOLD);
  drawStatTile(ctx, x2, 824, half, 128, num(m.churches), "Churches planted", GOLD);

  // ── so far in total ──
  ctx.font = `bold 26px ${SERIF}`; spacing(ctx, 5); ctx.fillStyle = MUTED; ctx.fillText("SO FAR IN TOTAL", 80, 1022); spacing(ctx, 0);
  if (Number(t.selfFunded) > 0) {   // some of the completed missions were paid for from outside SendMe
    ctx.textAlign = "right"; ctx.font = `24px ${SERIF}`; ctx.fillStyle = MUTED;
    ctx.fillText(`includes ${num(t.selfFunded)} self-funded`, 1000, 1022);
    ctx.textAlign = "left";
  }
  drawStatTile(ctx, 80, 1042, half, 128, num(t.missions), "Missions completed", "#5b9cf6");
  drawStatTile(ctx, x2, 1042, half, 128, num(t.souls), "Souls reached", "#5b9cf6");
  drawStatTile(ctx, 80, 1194, half, 128, num(t.bibles), "Bibles-Message Books", "#5b9cf6");
  drawStatTile(ctx, x2, 1194, half, 128, num(t.churches), "Churches planted", "#5b9cf6");
  drawStatTile(ctx, 80, 1346, 920, 128, num(data.churchesRegistered), "Churches registered on SendMe", GREEN);

  ctx.textAlign = "center"; ctx.fillStyle = INK; ctx.font = `bold 32px ${SERIF}`;
  ctx.fillText("Please forward this to a fellow believer", CARD_W / 2, 1516);
  ctx.textAlign = "left";
  drawQrPanel(ctx, qrRows, "Scan to give and read the testimonies", 1538);
}

// kind: "mission" | "testimony" | "report". images: { hero: [Image|null ×3], photo: Image|null }
export function renderCard(ctx, kind, data, images = {}, qrRows = null) {
  if (kind === "report") return renderReportCard(ctx, data, qrRows);
  drawBackground(ctx);
  drawHeader(ctx);
  const isTestimony = kind === "testimony";
  const photo = isTestimony ? images.photo : null;
  const hasHero = (images.hero || []).some(Boolean);
  let y;
  if (photo)        { drawCover(ctx, photo, 80, 330, 920, 380, 28); y = 770; }
  else if (hasHero) { drawTrio(ctx, images.hero, 330, 290);         y = 700; }
  else              { drawTrio(ctx, null, 330, 40);                 y = 430; }   // pictures unavailable: no big gap

  ctx.textAlign = "left";
  ctx.font = `bold 28px ${SERIF}`; spacing(ctx, 6);
  ctx.fillStyle = isTestimony ? GREEN : GOLD;
  ctx.fillText(isTestimony ? "PRAISE REPORT" : "SUPPORT THIS MISSION", 80, y);
  spacing(ctx, 0);
  y += 26;

  ctx.fillStyle = INK; ctx.font = `bold 64px ${SERIF}`;
  const titleLines = wrapLines(ctx, data.title || "", 920, photo ? 3 : 4);
  titleLines.forEach((l, i) => ctx.fillText(l, 80, y + 64 + i * 74));
  y += 64 + (titleLines.length - 1) * 74 + 56;

  y = drawMeta(ctx, y, data.place, data.by) + 20;

  // the story/blurb gets as many lines as fit above the numbers/progress area (last line must end by y = 1290)
  ctx.fillStyle = "rgba(238,241,255,0.8)"; ctx.font = `36px ${SERIF}`;
  const body = isTestimony ? data.story : data.blurb;
  const room = Math.max(1, Math.min(isTestimony ? 7 : 6, Math.floor((1290 - (y + 38)) / 52) + 1));
  wrapLines(ctx, body || "", 920, room).forEach((l, i) => ctx.fillText(l, 80, y + 38 + i * 52));

  if (isTestimony) {
    const stats = (data.stats || []).filter((s) => Number(s.n) > 0).slice(0, 3);
    if (stats.length) {
      const bw = 290, gap = 25, x0 = (CARD_W - (bw * stats.length + gap * (stats.length - 1))) / 2;
      stats.forEach((s, i) => {
        const x = x0 + i * (bw + gap);
        ctx.fillStyle = "rgba(62,207,142,0.1)"; roundRect(ctx, x, 1320, bw, 130, 22); ctx.fill();
        ctx.strokeStyle = "rgba(62,207,142,0.35)"; ctx.lineWidth = 2; roundRect(ctx, x, 1320, bw, 130, 22); ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillStyle = GREEN; ctx.font = `bold 52px ${SERIF}`; ctx.fillText(String(s.n), x + bw / 2, 1378);
        ctx.fillStyle = MUTED; ctx.font = `24px ${SERIF}`; ctx.fillText(s.label, x + bw / 2, 1420);
      });
      ctx.textAlign = "left";
    }
  } else if (data.target > 0) {
    const pct = Math.min(100, Math.round(((data.raised || 0) / data.target) * 100));
    const first = !(Number(data.raised) > 0);   // nothing raised yet: invite people to be first, rather than showing "$0"
    ctx.fillStyle = GOLD; ctx.font = `bold 46px ${SERIF}`; ctx.textAlign = "left";
    ctx.fillText(first ? "Be the first to give" : `${money(data.raised)} raised`, 80, 1350);
    ctx.fillStyle = MUTED; ctx.font = `34px ${SERIF}`; ctx.textAlign = "right";
    ctx.fillText(first ? `Goal ${money(data.target)}` : `${pct}% of ${money(data.target)}`, 1000, 1350);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.1)"; roundRect(ctx, 80, 1380, 920, 28, 14); ctx.fill();
    if (pct > 0) { ctx.fillStyle = GOLD; roundRect(ctx, 80, 1380, Math.max(28, (920 * pct) / 100), 28, 14); ctx.fill(); }
  }

  drawQrPanel(ctx, qrRows, isTestimony ? "Scan to read the full testimony" : "Scan to see this mission");
}

// ───────── in the browser ─────────
const browserLoadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = "anonymous";     // a photo that can't be read this way is simply left out (never breaks the card)
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

export async function renderCardToCanvas(canvas, kind, data, env = {}) {
  const loadImage = env.loadImage || browserLoadImage;
  const getQr = env.qrMatrix || qrMatrix;
  canvas.width = CARD_W; canvas.height = CARD_H;
  const [hero, photo, qrRows] = await Promise.all([
    kind === "report" ? Promise.resolve([]) : Promise.all(HERO_IMAGES.map((s) => loadImage(s))),
    kind === "testimony" && data.photo ? loadImage(data.photo) : Promise.resolve(null),
    getQr(data.link).catch(() => null),
  ]);
  renderCard(canvas.getContext("2d"), kind, data, { hero, photo }, qrRows);
  return canvas;
}

const slug = (s) => String(s || "sendme").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "sendme";

// Makes the picture and the caption that goes with it.
export async function buildShareImage(kind, data, env = {}) {
  const canvas = env.createCanvas ? env.createCanvas() : document.createElement("canvas");
  await renderCardToCanvas(canvas, kind, data, env);
  const blob = await new Promise((resolve, reject) => {
    if (canvas.toBlob) canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/jpeg", 0.92);
    else reject(new Error("no image"));
  });
  const caption = kind === "report"
    ? `SendMe monthly report — ${data.title} ✝\n\nSee what God is doing through faithful believers worldwide. Please forward this to a fellow believer, and give toward the work:\n${data.link}`
    : kind === "testimony"
    ? `Praise report: ${data.title} 🙏\n\nRead the full testimony and be part of what God is doing:\n${data.link}`
    : `Help support this mission: ${data.title} 🙏\n\nGive by card or bank transfer:\n${data.link}`;
  return { blob, filename: kind === "report" ? `sendme-report-${slug(data.title)}.jpg` : `sendme-${slug(data.title)}.jpg`, caption };
}

// Opens the phone's share sheet with the picture (choose WhatsApp → My status or a chat). Where that isn't
// possible (computers, some browsers) the picture is saved to the device instead.
// Returns "shared" | "cancelled" | "downloaded" | "needs-tap".
// "needs-tap": the phone refused to open the share sheet because too much time passed since the tap
// (making the picture takes a few seconds). The picture is ready — the button asks for one more tap,
// and that tap calls shareCardImage again with allowDownload = true.
export async function shareCardImage(blob, { filename, caption }, allowDownload = false) {
  try {
    const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: caption }); return "shared"; }
      catch (e) {
        if (e && e.name === "AbortError") return "cancelled";
        if (!allowDownload && e && e.name === "NotAllowedError") return "needs-tap";
      }
    }
  } catch (_e) { /* fall through to the download */ }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}

// ───────── turning a mission / testimony from the app into card data ─────────
// Protected missions never show the missionary's name or exact place — only their role and region.
export function missionCardData(m) {
  const place = m.protected ? (m.region || "") : [m.city || m.area, m.country].map((v) => String(v || "").trim()).filter(Boolean).join(", ");
  return {
    title: m.protected ? (m.role || "Protected Mission") : (m.title || m.name || "Mission"),
    place,
    by: m.protected ? "by a faithful missionary" : (m.name ? `by ${m.name}` : ""),
    blurb: m.blurb || "",
    raised: m.raised || 0,
    target: m.fundingTarget || m.goal || 0,
    link: missionLink(m.id),
  };
}

export function testimonyCardData(t) {
  const photos = Array.isArray(t.allMediaUrls) ? t.allMediaUrls.filter(Boolean) : [];
  const isMission = t.missionRow && !t.isAdminTestimony && !t.isGeneralFund;
  return {
    title: t.mission || "Testimony",
    place: [t.country, t.region].filter((v) => v && v !== "General Fund").filter((v, i, a) => a.indexOf(v) === i).join(", "),
    by: t.missionary && t.missionary !== "SendMe" ? `by ${t.missionary}` : "",
    story: t.story || "",
    stats: t.hideStats ? [] : [
      { n: t.souls, label: "Souls reached" }, { n: t.bibles, label: "Bibles-Message Books" }, { n: t.churches, label: "Churches planted" },
    ],
    photo: photos[0] || null,
    link: isMission && t.id ? missionLink(t.id) : siteLink(),
  };
}

// The monthly report numbers (from the Admin → Monthly Report screen) as card data.
export function reportCardData({ title, raised, gifts, fruit, churchesRegistered }) {
  const z = { missions: 0, souls: 0, bibles: 0, churches: 0 };
  return {
    title, raised: raised || 0, gifts: gifts || 0,
    month: (fruit && fruit.month) || z, total: (fruit && fruit.total) || z,
    churchesRegistered: churchesRegistered || 0,
    link: siteLink(),
  };
}

export { SITE_ORIGIN };
