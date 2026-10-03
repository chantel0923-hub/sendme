// simpleXlsx.js
// A tiny, dependency-free writer for a single-sheet .xlsx workbook, so admin
// screens can offer a real Excel download without adding a library to the app.
//
// An .xlsx file is a ZIP of XML parts. This builds those parts and packs them
// into an uncompressed ZIP (which every spreadsheet app accepts).
//
//   const bytes = buildXlsx({
//     sheetName: "Members",
//     headers: ["Name", "Number"],
//     rows: [["Paul", "+27692777458"], ...],
//     widths: [28, 18],            // optional column widths
//   });
//
// Every cell is written as text. That's deliberate: phone numbers keep their "+"
// and every digit, and a name like "=SUM(1)" is just text and can never run as
// a formula.

const enc = new TextEncoder();

// ── CRC-32 (required by the ZIP format) ─────────────────────────────────────
let CRC_TABLE = null;
const crc32 = (bytes) => {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

// ── Minimal ZIP writer (stored / no compression) ────────────────────────────
const zip = (files) => {
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = (Math.max(now.getFullYear() - 1980, 0) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const parts = [];
  const central = [];
  let offset = 0;

  files.forEach(({ name, data }) => {
    const nameBytes = enc.encode(name);
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);        // version needed
    lv.setUint16(6, 0, true);         // flags
    lv.setUint16(8, 0, true);         // method 0 = stored
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    parts.push(local, data);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);        // version made by
    cv.setUint16(6, 20, true);        // version needed
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);        // extra
    cv.setUint16(32, 0, true);        // comment
    cv.setUint16(34, 0, true);        // disk
    cv.setUint16(36, 0, true);        // internal attrs
    cv.setUint32(38, 0, true);        // external attrs
    cv.setUint32(42, offset, true);   // local header offset
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length + data.length;
  });

  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const all = [...parts, ...central, end];
  const total = all.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  all.forEach(a => { out.set(a, pos); pos += a.length; });
  return out;
};

// ── XML helpers ─────────────────────────────────────────────────────────────
// Strips characters XML 1.0 can't contain, then escapes the special ones.
const esc = (v) =>
  String(v ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const colLetter = (i) => {
  let n = i + 1, s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

// Sheet names: max 31 chars, none of  \ / ? * [ ] :
const cleanSheetName = (n) => (String(n || "Sheet1").replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Sheet1");

export const buildXlsx = ({ sheetName = "Sheet1", headers = [], rows = [], widths = [] }) => {
  // Shared strings table (each distinct text stored once)
  const strings = [];
  const index = new Map();
  let refCount = 0;
  const sst = (text) => {
    const t = String(text ?? "");
    refCount += 1;
    if (!index.has(t)) { index.set(t, strings.length); strings.push(t); }
    return index.get(t);
  };

  const colCount = Math.max(headers.length, ...rows.map(r => r.length), 1);
  const cell = (r, c, value, style) => {
    const t = String(value ?? "");
    if (t === "") return "";
    return `<c r="${colLetter(c)}${r}"${style ? ` s="${style}"` : ""} t="s"><v>${sst(t)}</v></c>`;
  };

  let sheetData = "";
  if (headers.length) {
    sheetData += `<row r="1">${headers.map((h, c) => cell(1, c, h, 1)).join("")}</row>`;
  }
  rows.forEach((row, i) => {
    const r = i + (headers.length ? 2 : 1);
    sheetData += `<row r="${r}">${row.map((v, c) => cell(r, c, v, 0)).join("")}</row>`;
  });

  const lastRow = Math.max(rows.length + (headers.length ? 1 : 0), 1);
  const cols = widths.length
    ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const frozen = headers.length
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews>'
    : "";
  const filter = headers.length && rows.length ? `<autoFilter ref="A1:${colLetter(colCount - 1)}${lastRow}"/>` : "";

  const sheetXml =
    XML_HEAD +
    `<worksheet xmlns="${NS}">${frozen}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${sheetData}</sheetData>${filter}</worksheet>`;

  const sharedXml =
    XML_HEAD +
    `<sst xmlns="${NS}" count="${refCount}" uniqueCount="${strings.length}">` +
    strings.map(s => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("") +
    "</sst>";

  const stylesXml =
    XML_HEAD +
    `<styleSheet xmlns="${NS}">` +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE8B34B"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>";

  const workbookXml =
    XML_HEAD +
    `<workbook xmlns="${NS}" xmlns:r="${REL_NS}"><sheets><sheet name="${esc(cleanSheetName(sheetName))}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const workbookRels =
    XML_HEAD +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
    "</Relationships>";

  const rootRels =
    XML_HEAD +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    "</Relationships>";

  const contentTypes =
    XML_HEAD +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
    "</Types>";

  return zip([
    { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
    { name: "_rels/.rels", data: enc.encode(rootRels) },
    { name: "xl/workbook.xml", data: enc.encode(workbookXml) },
    { name: "xl/_rels/workbook.xml.rels", data: enc.encode(workbookRels) },
    { name: "xl/worksheets/sheet1.xml", data: enc.encode(sheetXml) },
    { name: "xl/styles.xml", data: enc.encode(stylesXml) },
    { name: "xl/sharedStrings.xml", data: enc.encode(sharedXml) },
  ]);
};

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
