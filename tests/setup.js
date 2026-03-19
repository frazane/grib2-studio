import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load utils.js into the test global scope.
// We use a Function wrapper that returns all declared names, then assign
// them to globalThis so every test file can call them without imports.
const code = readFileSync(resolve(root, "js/utils.js"), "utf-8");
const fns = new Function(`
  ${code}
  return {
    getText, parseXML, processCodeFlags, processTemplates,
    parseOctetRange, detectFieldType, writeUintN, writeSintN,
    flattenTemplateEntries, buildTemplateBytes, hexDump,
    escHtml, escAttr, highlight, matchesQuery,
  };
`)();
Object.assign(globalThis, fns);
