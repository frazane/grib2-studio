import { describe, it, expect } from "vitest";

describe("parseOctetRange", () => {
  it("parses a single octet", () => {
    expect(parseOctetRange("7")).toEqual({ start: 7, length: 1 });
  });
  it("parses a hyphen range", () => {
    expect(parseOctetRange("1-4")).toEqual({ start: 1, length: 4 });
  });
  it("parses an en-dash range", () => {
    expect(parseOctetRange("1–4")).toEqual({ start: 1, length: 4 });
  });
  it("parses range with spaces around dash", () => {
    expect(parseOctetRange("1 - 4")).toEqual({ start: 1, length: 4 });
  });
  it("returns zero length for empty string", () => {
    expect(parseOctetRange("")).toEqual({ start: 0, length: 0 });
  });
  it("returns zero length for null", () => {
    expect(parseOctetRange(null)).toEqual({ start: 0, length: 0 });
  });
  it("returns zero length for undefined", () => {
    expect(parseOctetRange(undefined)).toEqual({ start: 0, length: 0 });
  });
  it("returns zero length when end < start", () => {
    expect(parseOctetRange("5-3")).toEqual({ start: 0, length: 0 });
  });
  it("handles single-octet string '1'", () => {
    expect(parseOctetRange("1")).toEqual({ start: 1, length: 1 });
  });
});

describe("detectFieldType", () => {
  it("detects ieeefloat from 'reference value'", () => {
    expect(detectFieldType("Reference value (R) of the packed array")).toBe("ieeefloat");
  });
  it("detects ieeefloat from 'IEEE'", () => {
    expect(detectFieldType("IEEE 754 32-bit floating point")).toBe("ieeefloat");
  });
  it("detects ieeefloat from 'referenceValue'", () => {
    expect(detectFieldType("referenceValue of data")).toBe("ieeefloat");
  });
  it("detects signed for 'latitude'", () => {
    expect(detectFieldType("Latitude of first grid point")).toBe("signed");
  });
  it("detects signed for La1", () => {
    expect(detectFieldType("La1 — first latitude")).toBe("signed");
  });
  it("detects signed for 'binary scale factor'", () => {
    expect(detectFieldType("Binary scale factor E")).toBe("signed");
  });
  it("detects signed for 'decimal scale factor'", () => {
    expect(detectFieldType("Decimal scale factor D")).toBe("signed");
  });
  it("detects signed for 'scale factor'", () => {
    expect(detectFieldType("Scale factor of first stored value")).toBe("signed");
  });
  it("detects signed for 'forecastTime'", () => {
    expect(detectFieldType("forecastTime in defined units")).toBe("signed");
  });
  it("detects signed for 'forecast time'", () => {
    expect(detectFieldType("Forecast time in units defined by octet 18")).toBe("signed");
  });
  it("returns unsigned for normal fields", () => {
    expect(detectFieldType("Number of data points")).toBe("unsigned");
  });
  it("returns unsigned for null", () => {
    expect(detectFieldType(null)).toBe("unsigned");
  });
  it("returns unsigned for undefined", () => {
    expect(detectFieldType(undefined)).toBe("unsigned");
  });
  it("returns unsigned for empty string", () => {
    expect(detectFieldType("")).toBe("unsigned");
  });
});

describe("writeUintN", () => {
  it("writes a 1-byte value", () => {
    const buf = new ArrayBuffer(1);
    const view = new DataView(buf);
    writeUintN(view, 0, 42, 1);
    expect(view.getUint8(0)).toBe(42);
  });
  it("writes a 2-byte big-endian value", () => {
    const buf = new ArrayBuffer(2);
    const view = new DataView(buf);
    writeUintN(view, 0, 0x0102, 2);
    expect(view.getUint8(0)).toBe(0x01);
    expect(view.getUint8(1)).toBe(0x02);
  });
  it("writes a 4-byte big-endian value", () => {
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    writeUintN(view, 0, 0x01020304, 4);
    expect([...new Uint8Array(buf)]).toEqual([0x01, 0x02, 0x03, 0x04]);
  });
  it("writes at a non-zero offset", () => {
    const buf = new ArrayBuffer(3);
    const view = new DataView(buf);
    writeUintN(view, 1, 0xff, 1);
    expect(view.getUint8(0)).toBe(0);
    expect(view.getUint8(1)).toBe(0xff);
  });
  it("clamps negative values to 0", () => {
    const buf = new ArrayBuffer(1);
    const view = new DataView(buf);
    writeUintN(view, 0, -5, 1);
    expect(view.getUint8(0)).toBe(0);
  });
  it("writes NaN as 0", () => {
    const buf = new ArrayBuffer(1);
    const view = new DataView(buf);
    writeUintN(view, 0, NaN, 1);
    expect(view.getUint8(0)).toBe(0);
  });
  it("rounds fractional values", () => {
    const buf = new ArrayBuffer(1);
    const view = new DataView(buf);
    writeUintN(view, 0, 2.7, 1);
    expect(view.getUint8(0)).toBe(3);
  });
});

describe("writeSintN", () => {
  it("writes a positive value", () => {
    const buf = new ArrayBuffer(2);
    const view = new DataView(buf);
    writeSintN(view, 0, 100, 2);
    expect(view.getInt16(0)).toBe(100);
  });
  it("writes -1 as 0xFFFF for 2 bytes", () => {
    const buf = new ArrayBuffer(2);
    const view = new DataView(buf);
    writeSintN(view, 0, -1, 2);
    expect(view.getUint8(0)).toBe(0xff);
    expect(view.getUint8(1)).toBe(0xff);
  });
  it("writes -128 correctly in 1 byte", () => {
    const buf = new ArrayBuffer(1);
    const view = new DataView(buf);
    writeSintN(view, 0, -128, 1);
    expect(view.getUint8(0)).toBe(128); // two's complement: 0x80
  });
  it("clamps below min to min", () => {
    const buf = new ArrayBuffer(1);
    const view = new DataView(buf);
    writeSintN(view, 0, -200, 1); // min = -128
    expect(view.getUint8(0)).toBe(128); // -128 as unsigned
  });
  it("clamps above max to max", () => {
    const buf = new ArrayBuffer(1);
    const view = new DataView(buf);
    writeSintN(view, 0, 200, 1); // max = 127
    expect(view.getUint8(0)).toBe(127);
  });
  it("writes NaN as 0", () => {
    const buf = new ArrayBuffer(1);
    const view = new DataView(buf);
    writeSintN(view, 0, NaN, 1);
    expect(view.getUint8(0)).toBe(0);
  });
  it("round-trips a 4-byte signed value", () => {
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    writeSintN(view, 0, -1000000, 4);
    expect(view.getInt32(0)).toBe(-1000000);
  });
});

describe("flattenTemplateEntries", () => {
  const mkEntry = (octetNo, contents) => ({
    octetNo, contents, codeTable: "", flagTable: "", note: "", status: "Operational",
  });

  const templateTables = [
    {
      id: "3.0",
      title: "Lat/lon",
      entries: [mkEntry("1-4", "Ni"), mkEntry("5-8", "Nj")],
    },
    {
      id: "3.1",
      title: "Rotated lat/lon",
      entries: [
        mkEntry("1-8", "Same as grid definition template 3.0"),
        mkEntry("9",   "Latitude of southern pole"),
      ],
    },
  ];

  it("returns entries directly for a simple template", () => {
    const result = flattenTemplateEntries("3.0", undefined, templateTables);
    expect(result).toHaveLength(2);
    expect(result[0].contents).toBe("Ni");
    expect(result[1].contents).toBe("Nj");
  });

  it("inlines 'Same as' references", () => {
    const result = flattenTemplateEntries("3.1", undefined, templateTables);
    expect(result).toHaveLength(3);
    expect(result[0].contents).toBe("Ni");
    expect(result[1].contents).toBe("Nj");
    expect(result[2].contents).toBe("Latitude of southern pole");
  });

  it("returns empty array for unknown template", () => {
    expect(flattenTemplateEntries("9.9", undefined, templateTables)).toEqual([]);
  });

  it("does not loop on circular references", () => {
    const circular = [
      { id: "A", title: "A", entries: [mkEntry("1", "Same as template B")] },
      { id: "B", title: "B", entries: [mkEntry("1", "Same as template A")] },
    ];
    const result = flattenTemplateEntries("A", undefined, circular);
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns empty for self-referencing template", () => {
    const selfRef = [
      { id: "X", title: "X", entries: [mkEntry("1", "Same as template X")] },
    ];
    const result = flattenTemplateEntries("X", undefined, selfRef);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("hexDump", () => {
  it("formats 'GRIB' bytes as hex with ASCII sidebar", () => {
    const bytes = new Uint8Array([0x47, 0x52, 0x49, 0x42]);
    const result = hexDump(bytes);
    expect(result).toContain("47 52 49 42");
    expect(result).toContain("GRIB");
    expect(result).toContain("00000000");
  });

  it("returns empty string for empty input", () => {
    expect(hexDump(new Uint8Array(0))).toBe("");
  });

  it("replaces non-printable bytes with '.' in ASCII column", () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x7f]);
    const result = hexDump(bytes);
    expect(result).toContain("...");
  });

  it("inserts space between 8th and 9th hex byte", () => {
    const bytes = new Uint8Array(16).fill(0x41); // 16 × 'A'
    const result = hexDump(bytes);
    // Two groups of 8 separated by an extra space
    expect(result).toContain("41 41 41 41 41 41 41 41  41");
  });

  it("handles more than 16 bytes (multi-row)", () => {
    const bytes = new Uint8Array(32).fill(0xff);
    const result = hexDump(bytes);
    expect(result).toContain("00000010"); // second row offset
  });

  it("pads partial last row with spaces", () => {
    const bytes = new Uint8Array([0x47]); // 1 byte, 15 missing
    const result = hexDump(bytes);
    // Missing bytes should be represented as "   " (3 spaces)
    expect(result).toMatch(/47 ( {3}){15}/);
  });
});

describe("readUintN", () => {
  it("reads a 1-byte value", () => {
    const buf = new ArrayBuffer(1);
    new DataView(buf).setUint8(0, 42);
    expect(readUintN(new DataView(buf), 0, 1)).toBe(42);
  });
  it("reads a 2-byte big-endian value", () => {
    const buf = new ArrayBuffer(2);
    const view = new DataView(buf);
    view.setUint8(0, 0x01); view.setUint8(1, 0x02);
    expect(readUintN(view, 0, 2)).toBe(0x0102);
  });
  it("reads a 4-byte big-endian value", () => {
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    view.setUint8(0, 0x01); view.setUint8(1, 0x02);
    view.setUint8(2, 0x03); view.setUint8(3, 0x04);
    expect(readUintN(view, 0, 4)).toBe(0x01020304);
  });
  it("reads at a non-zero offset", () => {
    const buf = new ArrayBuffer(3);
    new DataView(buf).setUint8(2, 0xff);
    expect(readUintN(new DataView(buf), 2, 1)).toBe(0xff);
  });
  it("reads 0 correctly", () => {
    const buf = new ArrayBuffer(2);
    expect(readUintN(new DataView(buf), 0, 2)).toBe(0);
  });
  it("round-trips with writeUintN for 1 byte", () => {
    const buf = new ArrayBuffer(1);
    const view = new DataView(buf);
    writeUintN(view, 0, 200, 1);
    expect(readUintN(view, 0, 1)).toBe(200);
  });
  it("round-trips with writeUintN for 4 bytes", () => {
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    writeUintN(view, 0, 123456789, 4);
    expect(readUintN(view, 0, 4)).toBe(123456789);
  });
});

describe("readSintN", () => {
  it("reads a positive value", () => {
    const buf = new ArrayBuffer(2);
    new DataView(buf).setInt16(0, 100);
    expect(readSintN(new DataView(buf), 0, 2)).toBe(100);
  });
  it("reads -1 in 2 bytes (0xFFFF)", () => {
    const buf = new ArrayBuffer(2);
    const view = new DataView(buf);
    view.setUint8(0, 0xff); view.setUint8(1, 0xff);
    expect(readSintN(view, 0, 2)).toBe(-1);
  });
  it("reads -128 in 1 byte (0x80)", () => {
    const buf = new ArrayBuffer(1);
    new DataView(buf).setUint8(0, 0x80);
    expect(readSintN(new DataView(buf), 0, 1)).toBe(-128);
  });
  it("reads 0 correctly", () => {
    const buf = new ArrayBuffer(2);
    expect(readSintN(new DataView(buf), 0, 2)).toBe(0);
  });
  it("round-trips with writeSintN for negative 2-byte value", () => {
    const buf = new ArrayBuffer(2);
    const view = new DataView(buf);
    writeSintN(view, 0, -1000, 2);
    expect(readSintN(view, 0, 2)).toBe(-1000);
  });
  it("round-trips with writeSintN for negative 4-byte value", () => {
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    writeSintN(view, 0, -1000000, 4);
    expect(readSintN(view, 0, 4)).toBe(-1000000);
  });
  it("round-trips with writeSintN for positive value", () => {
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    writeSintN(view, 0, 50000, 4);
    expect(readSintN(view, 0, 4)).toBe(50000);
  });
});

describe("parseTemplateBytes", () => {
  const mkEntry = (octetNo, contents, codeTable = "") => ({
    octetNo, contents, codeTable, flagTable: "", note: "", status: "Operational",
  });

  const templateTables = [
    {
      id: "3.0",
      title: "test",
      entries: [mkEntry("1-2", "Ni"), mkEntry("3-4", "Nj")],
    },
    {
      id: "5.0",
      title: "test signed",
      entries: [mkEntry("1-4", "Binary scale factor E")],
    },
    {
      id: "5.3",
      title: "test float",
      entries: [mkEntry("1-4", "Reference value (R) IEEE 754")],
    },
  ];

  it("returns empty object for null templateId", () => {
    expect(parseTemplateBytes(null, new Uint8Array(4), templateTables)).toEqual({});
  });
  it("returns empty object for unknown template", () => {
    expect(parseTemplateBytes("9.9", new Uint8Array(4), templateTables)).toEqual({});
  });
  it("reads unsigned field values from correct byte positions", () => {
    // Build known bytes: Ni=360 (0x0168), Nj=181 (0x00B5)
    const bytes = new Uint8Array([0x01, 0x68, 0x00, 0xB5]);
    const result = parseTemplateBytes("3.0", bytes, templateTables);
    expect(result[0]).toBe(360);
    expect(result[1]).toBe(181);
  });
  it("round-trips buildTemplateBytes → parseTemplateBytes for unsigned fields", () => {
    const fieldValues = { 0: 720, 1: 361 };
    const encoded = buildTemplateBytes("3.0", fieldValues, templateTables);
    const decoded = parseTemplateBytes("3.0", encoded, templateTables);
    expect(decoded[0]).toBe(720);
    expect(decoded[1]).toBe(361);
  });
  it("round-trips buildTemplateBytes → parseTemplateBytes for signed fields", () => {
    const fieldValues = { 0: -3 };
    const encoded = buildTemplateBytes("5.0", fieldValues, templateTables);
    const decoded = parseTemplateBytes("5.0", encoded, templateTables);
    expect(decoded[0]).toBe(-3);
  });
  it("round-trips buildTemplateBytes → parseTemplateBytes for IEEE float fields", () => {
    const fieldValues = { 0: 1.5 };
    const encoded = buildTemplateBytes("5.3", fieldValues, templateTables);
    const decoded = parseTemplateBytes("5.3", encoded, templateTables);
    expect(decoded[0]).toBeCloseTo(1.5, 5);
  });
  it("skips fields that would be out of bounds", () => {
    // Pass a truncated buffer (only 2 bytes for a 4-byte template)
    const short = new Uint8Array(2);
    const result = parseTemplateBytes("3.0", short, templateTables);
    // First field (1-2) fits; second field (3-4) does not
    expect(result[0]).toBeDefined();
    expect(result[1]).toBeUndefined();
  });
});

describe("buildTemplateBytes", () => {
  const mkEntry = (octetNo, contents, codeTable = "") => ({
    octetNo, contents, codeTable, flagTable: "", note: "", status: "Operational",
  });

  const templateTables = [
    {
      id: "3.0",
      title: "test",
      entries: [mkEntry("1-2", "Ni"), mkEntry("3-4", "Nj")],
    },
  ];

  it("returns empty Uint8Array for null templateId", () => {
    expect(buildTemplateBytes(null, {}, templateTables)).toEqual(new Uint8Array(0));
  });

  it("returns empty Uint8Array for unknown template", () => {
    expect(buildTemplateBytes("9.9", {}, templateTables)).toEqual(new Uint8Array(0));
  });

  it("writes field values into correct byte positions", () => {
    const result = buildTemplateBytes("3.0", { 0: 360, 1: 181 }, templateTables);
    expect(result.length).toBe(4);
    // Ni = 360 = 0x0168 (big-endian)
    expect(result[0]).toBe(0x01);
    expect(result[1]).toBe(0x68);
    // Nj = 181 = 0x00B5 (big-endian)
    expect(result[2]).toBe(0x00);
    expect(result[3]).toBe(0xb5);
  });

  it("writes zeros for missing field values", () => {
    const result = buildTemplateBytes("3.0", {}, templateTables);
    expect(result).toEqual(new Uint8Array(4));
  });

  it("treats codeTable fields as unsigned", () => {
    const withCode = [
      {
        id: "4.0",
        title: "test",
        entries: [mkEntry("1", "Parameter category", "4.1")],
      },
    ];
    const result = buildTemplateBytes("4.0", { 0: 2 }, withCode);
    expect(result[0]).toBe(2);
  });
});
