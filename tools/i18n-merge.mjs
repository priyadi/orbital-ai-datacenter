// Merge translation batches into lang-id.js and check that numbers, math and markup survived the translation.
// usage: node tools/i18n-merge.mjs [batch.json ...]   (each: {"english key": "terjemahan"}; later files win; no files = just re-check)
import fs from "node:fs";
const cur = (() => { try { const s = fs.readFileSync("lang-id.js", "utf8"); return JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)); } catch { return {}; } })();
for (const f of process.argv.slice(2)) Object.assign(cur, JSON.parse(fs.readFileSync(f, "utf8")));
const count = (s, re) => (s.match(re) || []).length;
// ⟦math⟧ must be the same on both sides, apart from quoted words and the decimal sign
const math = s => (s.match(/⟦[^⟧]*⟧/g) || []).map(m => m.replace(/[“"][^”"]*[”"]/g, "“”").replace(/(\d),(\d)/g, "$1.$2").replace(/\s+/g, "")).sort().join("\n");
let bad = 0;
const problem = (what, k, v) => { bad++; console.log(what + "\n  " + JSON.stringify(k) + "\n  " + JSON.stringify(v)); };
for (const [k, v] of Object.entries(cur)) {
  if (typeof v !== "string" || !v.trim()) { problem("EMPTY", k, v); continue; }
  if (k.includes("#")) {                           // number template: every # must come back, in order or by index
    const a = count(k, /#/g), b = count(v, /#\d?/g), idx = (v.match(/#\d/g) || []).map(x => +x[1]);
    if (a !== b || (idx.length && (idx.length !== b || Math.max(...idx) > a))) problem("PLACEHOLDERS", k, v);
  }
  if (math(k) !== math(v)) problem("MATH", k, v);
  for (const tag of ["<b>", "</b>", "⟦", "⟧", "&amp;"]) if (count(k, new RegExp(tag, "g")) !== count(v, new RegExp(tag, "g"))) { problem("MARKUP " + tag, k, v); break; }
  if (/^\s|\s$/.test(v) !== /^\s|\s$/.test(k)) problem("WHITESPACE", k, v);
}
const keys = Object.keys(cur).sort((a, b) => a.localeCompare(b));
fs.writeFileSync("lang-id.js", "// Indonesian translations for i18n.js. A key is the English text: either exactly as it is in index.html,\n// or as the page produces it with every number replaced by # (\"#2\" in a translation = the second number).\n// Edit by hand, or collect what is missing with tools/i18n-collect.mjs and merge it with tools/i18n-merge.mjs.\nwindow.I18N_ID=" + JSON.stringify(Object.fromEntries(keys.map(k => [k, cur[k]])), null, 0).replace(/","/g, '",\n"') + ";\n");
console.log(keys.length, "entries;", bad, "problems");
