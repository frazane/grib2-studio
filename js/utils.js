// ─────────────────────────────────────────────
// Pure utility functions — shared by all modules
// Loaded first; all functions are globals for browser use.
// For tests: loaded via tests/setup.js into globalThis.
// ─────────────────────────────────────────────

// ── XML helpers ──────────────────────────────

function getText(el, tag) {
  return el.querySelector(tag)?.textContent?.trim() ?? "";
}

function parseXML(text) {
  return new DOMParser().parseFromString(text, "application/xml");
}

function processCodeFlags(doc) {
  const tables = new Map();

  const entries = doc.querySelectorAll("GRIB2_CodeFlag_en");
  entries.forEach(el => {
    const rawTitle = getText(el, "Title_en");
    const m = rawTitle.match(/^(Code table|Flag table)\s+(\d+\.\d+)\s+-\s+(.+)$/i);
    if (!m) return;

    const type       = m[1].toLowerCase().includes("flag") ? "Flag table" : "Code table";
    const id         = m[2];
    const tableTitle = m[3];

    if (!tables.has(id)) {
      tables.set(id, { id, type, title: tableTitle, entries: [] });
    }

    tables.get(id).entries.push({
      subTitle: getText(el, "SubTitle_en"),
      code:     getText(el, "CodeFlag"),
      meaning:  getText(el, "MeaningParameterDescription_en"),
      status:   getText(el, "Status"),
    });
  });

  const sorted = Array.from(tables.values()).sort((a, b) => {
    const [aMaj, aMin] = a.id.split(".").map(Number);
    const [bMaj, bMin] = b.id.split(".").map(Number);
    return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
  });

  const index = new Map();
  sorted.forEach(t => index.set(t.id, t));

  return { tables: sorted, index };
}

function processTemplates(doc) {
  const tables = new Map();

  const entries = doc.querySelectorAll("GRIB2_Template_en");
  entries.forEach(el => {
    const rawTitle = getText(el, "Title_en");
    const m = rawTitle.match(/^(.+?template)\s+(\d+\.\d+)\s+-\s+(.+)$/i);
    if (!m) return;

    const type       = m[1];
    const id         = m[2];
    const tableTitle = m[3];

    if (!tables.has(id)) {
      tables.set(id, { id, type, title: tableTitle, entries: [] });
    }

    tables.get(id).entries.push({
      octetNo:   getText(el, "OctetNo"),
      contents:  getText(el, "Contents_en"),
      note:      getText(el, "Note_en"),
      noteIDs:   getText(el, "noteIDs"),
      codeTable: getText(el, "codeTable"),
      flagTable: getText(el, "flagTable"),
      status:    getText(el, "Status"),
    });
  });

  const sorted = Array.from(tables.values()).sort((a, b) => {
    const [aMaj, aMin] = a.id.split(".").map(Number);
    const [bMaj, bMin] = b.id.split(".").map(Number);
    return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
  });

  return sorted;
}

// ── Binary utilities ─────────────────────────

function parseOctetRange(octetStr) {
  if (!octetStr) return { start: 0, length: 0 };
  const m = String(octetStr).match(/^(\d+)(?:\s*[-–]\s*(\d+))?/);
  if (!m) return { start: 0, length: 0 };
  const start = parseInt(m[1], 10);
  const end   = m[2] ? parseInt(m[2], 10) : start;
  if (end < start) return { start: 0, length: 0 };
  return { start, length: end - start + 1 };
}

function detectFieldType(contents) {
  const s = contents || "";
  if (/reference\s*value/i.test(s) || /referenceValue/i.test(s) || /IEEE/i.test(s))
    return "ieeefloat";
  if (/\bLa1\b/.test(s) || /\bLa2\b/.test(s) || /\bLaD\b/.test(s) ||
      /\bLatin1\b/.test(s) || /\bLatin2\b/.test(s) ||
      /latitude/i.test(s) || /forecastTime/i.test(s) || /forecast\s+time/i.test(s) ||
      /scale\s*factor/i.test(s) || /scaleFactor/i.test(s) ||
      /binary\s*scale/i.test(s) || /decimal\s*scale/i.test(s) ||
      /latitude.*pole/i.test(s) || /angle.*rotation/i.test(s))
    return "signed";
  return "unsigned";
}

function writeUintN(view, offset, value, n) {
  let v = Math.round(isNaN(value) ? 0 : Math.max(0, value));
  for (let i = n - 1; i >= 0; i--) {
    view.setUint8(offset + i, v & 0xff);
    v = Math.floor(v / 256);
  }
}

function writeSintN(view, offset, value, n) {
  let v = Math.round(isNaN(value) ? 0 : value);
  const minVal = -Math.pow(2, n * 8 - 1);
  const maxVal =  Math.pow(2, n * 8 - 1) - 1;
  v = Math.max(minVal, Math.min(maxVal, v));
  if (v < 0) v += Math.pow(2, n * 8);
  writeUintN(view, offset, v, n);
}

// templateTables param is optional; falls back to global state.templateTables in browser
function flattenTemplateEntries(templateId, visited, templateTables) {
  // eslint-disable-next-line no-undef
  templateTables = templateTables || (typeof state !== "undefined" ? state.templateTables : []);
  visited = visited || new Set();
  if (visited.has(templateId)) return [];
  visited.add(templateId);
  const tmpl = templateTables.find(t => t.id === templateId);
  if (!tmpl) return [];
  const result = [];
  tmpl.entries.forEach(entry => {
    const m = /same\s+as\s+.*?(\d+\.\d+)/i.exec(entry.contents);
    if (m) {
      const sub = flattenTemplateEntries(m[1], visited, templateTables);
      if (sub.length) { sub.forEach(e => result.push(e)); return; }
    }
    result.push(entry);
  });
  return result;
}

// templateTables param is optional; falls back to global state.templateTables in browser
function buildTemplateBytes(templateId, fieldValues, templateTables) {
  // eslint-disable-next-line no-undef
  templateTables = templateTables || (typeof state !== "undefined" ? state.templateTables : []);
  if (!templateId) return new Uint8Array(0);
  const tmpl = templateTables.find(t => t.id === templateId);
  if (!tmpl) return new Uint8Array(0);

  const fields = [];
  let minOctet = Infinity;
  let maxOctet = 0;

  flattenTemplateEntries(templateId, undefined, templateTables).forEach((entry, idx) => {
    const range = parseOctetRange(entry.octetNo);
    if (range.length > 0 && range.start > 0) {
      fields.push({ ...range, entry, idx });
      minOctet = Math.min(minOctet, range.start);
      maxOctet = Math.max(maxOctet, range.start + range.length - 1);
    }
  });

  if (!fields.length || minOctet === Infinity) return new Uint8Array(0);

  const buf  = new ArrayBuffer(maxOctet - minOctet + 1);
  const view = new DataView(buf);

  fields.forEach(({ start, length, entry, idx }) => {
    const rawVal   = fieldValues[idx];
    const parsed   = (rawVal !== undefined && rawVal !== "") ? parseFloat(rawVal) : NaN;
    const value    = isNaN(parsed) ? 0 : parsed;
    const tableRef = entry.codeTable || entry.flagTable;
    const ftype    = tableRef ? "unsigned" : detectFieldType(entry.contents);
    const offset   = start - minOctet;

    if (ftype === "ieeefloat" && length === 4) {
      view.setFloat32(offset, value, false); // big-endian
    } else if (ftype === "signed") {
      writeSintN(view, offset, value, length);
    } else {
      writeUintN(view, offset, Math.max(0, value), length);
    }
  });

  return new Uint8Array(buf);
}

function readUintN(view, offset, n) {
  let value = 0;
  for (let i = 0; i < n; i++) value = value * 256 + view.getUint8(offset + i);
  return value;
}

function readSintN(view, offset, n) {
  const unsigned = readUintN(view, offset, n);
  const signBit = Math.pow(2, n * 8 - 1);
  return unsigned >= signBit ? unsigned - Math.pow(2, n * 8) : unsigned;
}

// templateTables param is optional; falls back to global state.templateTables in browser
function parseTemplateBytes(templateId, bytes, templateTables) {
  // eslint-disable-next-line no-undef
  templateTables = templateTables || (typeof state !== "undefined" ? state.templateTables : []);
  if (!templateId) return {};
  const tmpl = templateTables.find(t => t.id === templateId);
  if (!tmpl) return {};

  const fields = [];
  let minOctet = Infinity;

  flattenTemplateEntries(templateId, undefined, templateTables).forEach((entry, idx) => {
    const range = parseOctetRange(entry.octetNo);
    if (range.length > 0 && range.start > 0) {
      fields.push({ ...range, entry, idx });
      minOctet = Math.min(minOctet, range.start);
    }
  });

  if (!fields.length || minOctet === Infinity) return {};

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const result = {};

  fields.forEach(({ start, length, entry, idx }) => {
    const offset = start - minOctet;
    if (offset < 0 || offset + length > bytes.byteLength) return;
    const tableRef = entry.codeTable || entry.flagTable;
    const ftype = tableRef ? "unsigned" : detectFieldType(entry.contents);
    if (ftype === "ieeefloat" && length === 4) {
      result[idx] = view.getFloat32(offset, false);
    } else if (ftype === "signed") {
      result[idx] = readSintN(view, offset, length);
    } else {
      result[idx] = readUintN(view, offset, length);
    }
  });

  return result;
}

function hexDump(bytes) {
  let html = "";
  for (let i = 0; i < bytes.length; i += 16) {
    const off = i.toString(16).padStart(8, "0").toUpperCase();
    let hexPart = "";
    let asciiPart = "";
    for (let j = 0; j < 16; j++) {
      if (i + j < bytes.length) {
        const b = bytes[i + j];
        hexPart += b.toString(16).padStart(2, "0").toUpperCase() + " ";
        asciiPart += (b >= 32 && b < 127) ? String.fromCharCode(b) : ".";
      } else {
        hexPart += "   ";
        asciiPart += " ";
      }
      if (j === 7) hexPart += " ";
    }
    html += `<span class="hex-offset">${off}</span>  <span class="hex-byte">${hexPart}</span> <span class="hex-ascii">|${asciiPart}|</span>\n`;
  }
  return html;
}

// ── Browser string utilities ─────────────────

function escHtml(s) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(s) {
  return (s ?? "").replace(/'/g, "\\'");
}

function highlight(text, query) {
  const q = escHtml(query);
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return text.replace(re, `<mark>$1</mark>`);
}

function matchesQuery(table, q) {
  if (table.searchable) return table.searchable.includes(q);
  if (table.title.toLowerCase().includes(q)) return true;
  if (table.id.includes(q)) return true;
  return table.entries.some(e =>
    (e.meaning || e.contents || "").toLowerCase().includes(q) ||
    (e.code || "").toLowerCase() === q ||
    (e.code || "").toLowerCase().includes(q)
  );
}
