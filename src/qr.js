// A thin wrapper around the vendored QR code generator (src/vendor/qrcode.js — "QR Code Generator for
// JavaScript", MIT licence, Kazuhiko Arase). Loaded only when a QR code is actually needed.
export async function qrMatrix(text, ecc = "M") {
  const mod = await import("./vendor/qrcode");
  const qrcode = mod.default || mod;
  const qr = qrcode(0, ecc);
  qr.addData(String(text));
  qr.make();
  const n = qr.getModuleCount();
  const rows = [];
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) row.push(!!qr.isDark(r, c));
    rows.push(row);
  }
  return rows;
}

// One SVG path made of squares — crisp at any size, good for printing. `quiet` is the blank border (in modules)
// that scanners need around a QR code.
export function qrSvgPath(rows, quiet = 4) {
  const n = rows.length;
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (rows[r][c]) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return { size: n + quiet * 2, d };
}

// Draws the QR code onto a canvas context inside the square (x, y, size). Draws its own white quiet zone.
export function drawQr(ctx, rows, x, y, size, { dark = "#0a1322", light = "#ffffff", quiet = 4 } = {}) {
  const total = rows.length + quiet * 2;
  const cell = size / total;
  ctx.fillStyle = light;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = dark;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows.length; c++) {
      if (rows[r][c]) ctx.fillRect(Math.floor(x + (c + quiet) * cell), Math.floor(y + (r + quiet) * cell), Math.ceil(cell), Math.ceil(cell));
    }
  }
}
