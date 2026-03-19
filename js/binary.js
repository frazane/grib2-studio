// ─────────────────────────────────────────────
// parseOctetRange, detectFieldType, writeUintN, writeSintN,
// flattenTemplateEntries, buildTemplateBytes, hexDump are in js/utils.js
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// Builder — GRIB2 binary assembly
// ─────────────────────────────────────────────
function buildGrib2() {
  const bs = builderState;

  // Section 1 — 21 bytes
  const s1buf = new ArrayBuffer(21);
  const s1v   = new DataView(s1buf);
  writeUintN(s1v, 0, 21, 4);
  s1v.setUint8(4, 1);
  writeUintN(s1v, 5, bs.s1.originatingCentre,     2);
  writeUintN(s1v, 7, bs.s1.originatingSubCentre,  2);
  s1v.setUint8(9,  bs.s1.masterTablesVersion);
  s1v.setUint8(10, bs.s1.localTablesVersion);
  s1v.setUint8(11, bs.s1.significanceOfRefTime);
  writeUintN(s1v, 12, bs.s1.year, 2);
  s1v.setUint8(14, bs.s1.month);
  s1v.setUint8(15, bs.s1.day);
  s1v.setUint8(16, bs.s1.hour);
  s1v.setUint8(17, bs.s1.minute);
  s1v.setUint8(18, bs.s1.second);
  s1v.setUint8(19, bs.s1.productionStatus);
  s1v.setUint8(20, bs.s1.typeOfData);

  // Section 2 — 5 bytes (empty)
  const s2 = new Uint8Array([0, 0, 0, 5, 2]);

  // Section 3 — 14-byte header + template bytes
  const gridBytes = buildTemplateBytes(bs.s3.templateId, bs.s3.fields);
  const s3len = 14 + gridBytes.length;
  const s3buf = new ArrayBuffer(s3len);
  const s3v   = new DataView(s3buf);
  writeUintN(s3v, 0, s3len, 4);
  s3v.setUint8(4, 3);
  s3v.setUint8(5, bs.s3.sourceOfGridDef);
  writeUintN(s3v, 6, bs.s3.numberOfDataPoints, 4);
  s3v.setUint8(10, 0);
  s3v.setUint8(11, bs.s3.interpretationOfListOfNumbers);
  writeUintN(s3v, 12, bs.s3.templateId ? parseInt(bs.s3.templateId.split(".")[1], 10) : 0, 2);
  new Uint8Array(s3buf).set(gridBytes, 14);

  // Section 4 — 9-byte header + template bytes
  const prodBytes = buildTemplateBytes(bs.s4.templateId, bs.s4.fields);
  const s4len = 9 + prodBytes.length;
  const s4buf = new ArrayBuffer(s4len);
  const s4v   = new DataView(s4buf);
  writeUintN(s4v, 0, s4len, 4);
  s4v.setUint8(4, 4);
  writeUintN(s4v, 5, bs.s4.numberOfCoordValues, 2);
  writeUintN(s4v, 7, bs.s4.templateId ? parseInt(bs.s4.templateId.split(".")[1], 10) : 0, 2);
  new Uint8Array(s4buf).set(prodBytes, 9);

  // Section 5 — 11-byte header + template bytes
  const drtBytes = buildTemplateBytes(bs.s5.templateId, bs.s5.fields);
  const s5len = 11 + drtBytes.length;
  const s5buf = new ArrayBuffer(s5len);
  const s5v   = new DataView(s5buf);
  writeUintN(s5v, 0, s5len, 4);
  s5v.setUint8(4, 5);
  writeUintN(s5v, 5, bs.s5.numberOfPackedValues, 4);
  writeUintN(s5v, 9, bs.s5.templateId ? parseInt(bs.s5.templateId.split(".")[1], 10) : 0, 2);
  new Uint8Array(s5buf).set(drtBytes, 11);

  // Section 6 — 6 bytes
  const s6 = new Uint8Array([0, 0, 0, 6, 6, bs.s6.bitmapIndicator]);

  // Section 7 — 5 bytes (empty data)
  const s7 = new Uint8Array([0, 0, 0, 5, 7]);

  // Section 8 — "7777"
  const s8 = new Uint8Array([0x37, 0x37, 0x37, 0x37]);

  const parts   = [new Uint8Array(s1buf), s2, new Uint8Array(s3buf),
                   new Uint8Array(s4buf), new Uint8Array(s5buf), s6, s7, s8];
  const bodyLen = parts.reduce((a, p) => a + p.length, 0);
  const totalLen = 16 + bodyLen;

  // Section 0 — 16 bytes (needs total length)
  const s0buf = new ArrayBuffer(16);
  const s0v   = new DataView(s0buf);
  s0v.setUint8(0, 0x47); s0v.setUint8(1, 0x52); // "GR"
  s0v.setUint8(2, 0x49); s0v.setUint8(3, 0x42); // "IB"
  s0v.setUint8(4, 0);    s0v.setUint8(5, 0);    // reserved
  s0v.setUint8(6, bs.s0.discipline);
  s0v.setUint8(7, 2);                            // edition 2
  writeUintN(s0v, 8,  0,        4);              // high 32 bits of total length
  writeUintN(s0v, 12, totalLen, 4);              // low  32 bits of total length

  const allParts = [new Uint8Array(s0buf), ...parts];
  const result   = new Uint8Array(totalLen);
  let pos = 0;
  allParts.forEach(p => { result.set(p, pos); pos += p.length; });
  return result;
}

// ─────────────────────────────────────────────
// Builder — download & hex dump toggle (DOM-dependent)
// hexDump() is in js/utils.js
// ─────────────────────────────────────────────
function downloadGrib2() {
  const bytes = buildGrib2();
  const blob  = new Blob([bytes], { type: "application/octet-stream" });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement("a");
  a.href = url;
  a.download = "output.grib2";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toggleHexDump() {
  const container = document.getElementById("hex-dump-container");
  const dumpEl    = document.getElementById("hex-dump");
  if (!container || !dumpEl) return;
  if (container.style.display === "none") {
    dumpEl.innerHTML = hexDump(buildGrib2());
    container.style.display = "block";
  } else {
    container.style.display = "none";
  }
}
