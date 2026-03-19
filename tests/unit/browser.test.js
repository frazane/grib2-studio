import { describe, it, expect } from "vitest";

describe("escHtml", () => {
  it("escapes ampersand", () => {
    expect(escHtml("a & b")).toBe("a &amp; b");
  });
  it("escapes less-than", () => {
    expect(escHtml("<script>")).toBe("&lt;script&gt;");
  });
  it("escapes greater-than", () => {
    expect(escHtml("a > b")).toBe("a &gt; b");
  });
  it("escapes double quote", () => {
    expect(escHtml('"hello"')).toBe("&quot;hello&quot;");
  });
  it("escapes all special chars in one string", () => {
    expect(escHtml('<a href="x">&</a>')).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;"
    );
  });
  it("returns empty string for null", () => {
    expect(escHtml(null)).toBe("");
  });
  it("returns empty string for undefined", () => {
    expect(escHtml(undefined)).toBe("");
  });
  it("leaves plain strings unchanged", () => {
    expect(escHtml("hello world")).toBe("hello world");
  });
});

describe("escAttr", () => {
  it("escapes single quotes", () => {
    expect(escAttr("it's")).toBe("it\\'s");
  });
  it("escapes multiple single quotes", () => {
    expect(escAttr("it's a 'test'")).toBe("it\\'s a \\'test\\'");
  });
  it("returns empty string for null", () => {
    expect(escAttr(null)).toBe("");
  });
  it("returns empty string for undefined", () => {
    expect(escAttr(undefined)).toBe("");
  });
  it("leaves strings without single quotes unchanged", () => {
    expect(escAttr("hello")).toBe("hello");
  });
});

describe("highlight", () => {
  it("wraps a match in <mark>", () => {
    expect(highlight("hello world", "world")).toBe("hello <mark>world</mark>");
  });
  it("is case-insensitive", () => {
    expect(highlight("Hello World", "hello")).toBe("<mark>Hello</mark> World");
  });
  it("highlights all occurrences", () => {
    expect(highlight("foo bar foo", "foo")).toBe(
      "<mark>foo</mark> bar <mark>foo</mark>"
    );
  });
  it("escapes special regex chars in query without throwing", () => {
    expect(() => highlight("test (value)", "(value)")).not.toThrow();
    expect(highlight("test (value)", "(value)")).toContain("<mark>(value)</mark>");
  });
  it("returns unchanged text when query does not match", () => {
    expect(highlight("hello", "xyz")).toBe("hello");
  });
  it("handles empty query (empty regex matches everywhere — callers never pass empty)", () => {
    // An empty pattern matches between every character, inserting empty <mark> tags.
    // The function is always called with a non-empty query in practice.
    const result = highlight("hello", "");
    expect(result).toContain("<mark></mark>");
  });
});

describe("matchesQuery", () => {
  const table = {
    id: "0.0",
    title: "Discipline of processed data",
    entries: [
      { meaning: "Meteorological products", code: "0", contents: "" },
      { meaning: "Hydrological products",   code: "1", contents: "" },
    ],
  };

  it("matches by title substring", () => {
    expect(matchesQuery(table, "discipline")).toBe(true);
  });
  it("matches by id", () => {
    expect(matchesQuery(table, "0.0")).toBe(true);
  });
  it("matches partial id", () => {
    expect(matchesQuery(table, "0")).toBe(true);
  });
  it("matches by entry meaning", () => {
    expect(matchesQuery(table, "meteorological")).toBe(true);
  });
  it("matches by exact entry code", () => {
    expect(matchesQuery(table, "1")).toBe(true);
  });
  it("returns false when no field matches", () => {
    expect(matchesQuery(table, "oceanographic")).toBe(false);
  });
  it("callers pre-lowercase the query before passing it", () => {
    // matchesQuery lowercases the table fields but not q itself.
    // The caller (renderSidebar / onSearch) always passes q.toLowerCase().
    expect(matchesQuery(table, "discipline")).toBe(true);
    expect(matchesQuery(table, "hydrological")).toBe(true);
  });
  it("works with template-style entries (contents field)", () => {
    const tplTable = {
      id: "3.0",
      title: "Lat/lon",
      entries: [{ contents: "Number of grid points", code: "", meaning: "" }],
    };
    expect(matchesQuery(tplTable, "grid points")).toBe(true);
  });
});
