import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

const codeFlagXml = readFileSync(resolve(root, "tests/fixtures/codeflag-sample.xml"), "utf-8");
const templateXml = readFileSync(resolve(root, "tests/fixtures/template-sample.xml"), "utf-8");

describe("getText", () => {
  it("returns trimmed text content of a matching tag", () => {
    const doc = parseXML("<root><Name>  hello  </Name></root>");
    expect(getText(doc.querySelector("root"), "Name")).toBe("hello");
  });

  it("returns empty string for a missing tag", () => {
    const doc = parseXML("<root></root>");
    expect(getText(doc.querySelector("root"), "Missing")).toBe("");
  });

  it("returns empty string when the tag is not found inside a valid element", () => {
    const doc = parseXML("<root></root>");
    // querySelector("nope") returns null — getText is not called with null el by the app
    // (processCodeFlags always queries elements that exist); test with a real but empty el
    expect(getText(doc.querySelector("root"), "Missing")).toBe("");
  });
});

describe("parseXML", () => {
  it("returns a Document object", () => {
    const doc = parseXML("<root/>");
    expect(doc.nodeName).toBe("#document");
  });

  it("parses element text content", () => {
    const doc = parseXML("<root><child>value</child></root>");
    expect(doc.querySelector("child").textContent).toBe("value");
  });

  it("parses multiple elements", () => {
    const doc = parseXML("<root><a>1</a><a>2</a></root>");
    const items = doc.querySelectorAll("a");
    expect(items.length).toBe(2);
  });
});

describe("processCodeFlags", () => {
  it("returns tables array and index Map", () => {
    const { tables, index } = processCodeFlags(parseXML(codeFlagXml));
    expect(Array.isArray(tables)).toBe(true);
    expect(index).toBeInstanceOf(Map);
  });

  it("parses the correct number of distinct tables", () => {
    // fixture has 3 distinct valid table ids: 0.0, 1.0, 3.3
    const { tables } = processCodeFlags(parseXML(codeFlagXml));
    expect(tables.length).toBe(3);
  });

  it("each table has id, type, title, entries", () => {
    const { tables } = processCodeFlags(parseXML(codeFlagXml));
    tables.forEach(t => {
      expect(t).toHaveProperty("id");
      expect(t).toHaveProperty("type");
      expect(t).toHaveProperty("title");
      expect(Array.isArray(t.entries)).toBe(true);
    });
  });

  it("sorts tables numerically by id", () => {
    const { tables } = processCodeFlags(parseXML(codeFlagXml));
    for (let i = 1; i < tables.length; i++) {
      const [pMaj, pMin] = tables[i - 1].id.split(".").map(Number);
      const [cMaj, cMin] = tables[i].id.split(".").map(Number);
      expect(pMaj * 1000 + pMin).toBeLessThanOrEqual(cMaj * 1000 + cMin);
    }
  });

  it("indexes all tables by id", () => {
    const { tables, index } = processCodeFlags(parseXML(codeFlagXml));
    tables.forEach(t => expect(index.get(t.id)).toBe(t));
  });

  it("distinguishes 'Code table' from 'Flag table'", () => {
    const { tables } = processCodeFlags(parseXML(codeFlagXml));
    expect(tables.some(t => t.type === "Flag table")).toBe(true);
    expect(tables.some(t => t.type === "Code table")).toBe(true);
  });

  it("parses entry fields: code, meaning, status", () => {
    const { tables } = processCodeFlags(parseXML(codeFlagXml));
    const entry = tables[0].entries[0];
    expect(entry).toHaveProperty("code");
    expect(entry).toHaveProperty("meaning");
    expect(entry).toHaveProperty("status");
  });

  it("accumulates multiple entries under the same table id", () => {
    // 0.0 has two entries in the fixture
    const { index } = processCodeFlags(parseXML(codeFlagXml));
    expect(index.get("0.0").entries.length).toBe(2);
  });

  it("ignores elements with non-matching title patterns", () => {
    const xml = `<root>
      <GRIB2_CodeFlag_en>
        <Title_en>Not a valid title</Title_en>
        <CodeFlag>0</CodeFlag>
        <MeaningParameterDescription_en>ignored</MeaningParameterDescription_en>
        <Status>Operational</Status>
      </GRIB2_CodeFlag_en>
    </root>`;
    const { tables } = processCodeFlags(parseXML(xml));
    expect(tables).toHaveLength(0);
  });
});

describe("processTemplates", () => {
  it("returns an array", () => {
    const templates = processTemplates(parseXML(templateXml));
    expect(Array.isArray(templates)).toBe(true);
  });

  it("parses the correct number of distinct templates", () => {
    // fixture has 2 distinct templates: 3.0 and 4.0
    const templates = processTemplates(parseXML(templateXml));
    expect(templates.length).toBe(2);
  });

  it("each template has id, type, title, entries", () => {
    const templates = processTemplates(parseXML(templateXml));
    templates.forEach(t => {
      expect(t).toHaveProperty("id");
      expect(t).toHaveProperty("type");
      expect(t).toHaveProperty("title");
      expect(Array.isArray(t.entries)).toBe(true);
    });
  });

  it("sorts templates numerically by id", () => {
    const templates = processTemplates(parseXML(templateXml));
    for (let i = 1; i < templates.length; i++) {
      const [pMaj, pMin] = templates[i - 1].id.split(".").map(Number);
      const [cMaj, cMin] = templates[i].id.split(".").map(Number);
      expect(pMaj * 1000 + pMin).toBeLessThanOrEqual(cMaj * 1000 + cMin);
    }
  });

  it("parses entry fields: octetNo, contents, codeTable, status", () => {
    const templates = processTemplates(parseXML(templateXml));
    const entry = templates[0].entries[0];
    expect(entry).toHaveProperty("octetNo");
    expect(entry).toHaveProperty("contents");
    expect(entry).toHaveProperty("codeTable");
    expect(entry).toHaveProperty("status");
  });

  it("accumulates multiple entries under the same template id", () => {
    // 3.0 has two entries in the fixture
    const templates = processTemplates(parseXML(templateXml));
    const t30 = templates.find(t => t.id === "3.0");
    expect(t30.entries.length).toBe(2);
  });

  it("stores codeTable reference when present", () => {
    const templates = processTemplates(parseXML(templateXml));
    const t40 = templates.find(t => t.id === "4.0");
    expect(t40.entries[0].codeTable).toBe("4.1");
  });

  it("returns empty array for XML with no matching elements", () => {
    const templates = processTemplates(parseXML("<root></root>"));
    expect(templates).toEqual([]);
  });
});
