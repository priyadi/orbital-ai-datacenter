// Load the page in Indonesian mode, exercise it, and list every text that has no translation yet.
// usage: node tools/i18n-collect.mjs [out.json]
//   static  — prose that is translated as a whole (descriptions, slider labels and notes, presets, model notes, popup titles);
//             the key is the English text exactly as it is in index.html
//   dynamic — everything else, as the page produced it, with numbers replaced by # (see i18n.js)
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
const require = createRequire(path.join(execSync("npm root -g").toString().trim(), "x.js"));
const puppeteer = require("puppeteer");
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome-stable", headless: "new", args: ["--no-sandbox", "--allow-file-access-from-files"] });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1000 });
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.goto("file://" + path.resolve("index.html") + "?lang=id", { waitUntil: "load", timeout: 240000 });
await new Promise(r => setTimeout(r, 1500));
const res = await page.evaluate(async source => {
  const tick = () => new Promise(r => setTimeout(r, 0));
  const tips = () => document.querySelectorAll("[data-tip]").forEach(e => { const d = document.createElement("div"); d.innerHTML = e.dataset.tip; const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT); while (w.nextNode()) I18N.tr(w.currentNode.nodeValue); });
  // every reference popup
  for (const id of Object.keys(REFS)) { openRefs(id); await tick(); }
  closeRefs();
  // presets
  for (let i = 0; i < PRESETS.length; i++) { applyPreset(i); await tick(); tips(); }
  // random scenarios, to reach every verdict, flag and wording variant
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const scenario = fix => {
    CTLS.forEach(c => { const el = document.getElementById("in_" + c.id); const r = rnd(); el.value = c.id in fix ? fix[c.id] : r < 0.15 ? c.min : r > 0.85 ? c.max : +c.min + (c.max - c.min) * rnd(); delete exact[c.id]; });
    document.getElementById("incl").value = Math.round(rnd() * 98);
    update();
  };
  for (let k = 0; k < 400; k++) {
    scenario(k % 7 === 0 ? { offset: 1, oqual: 1 } : k % 7 === 1 ? { offset: 0 } : k % 7 === 2 ? { tval: 0 } : k % 7 === 3 ? { cost: 1.7, buscost: 2, life: 20 } : {});
    await tick(); if (k % 10 === 0) tips();
  }
  applyPreset(0); await tick();
  // texts that only appear in the animation, on hover, or on an event
  ["Sun is behind you — you are looking at the day side", "Sun is behind Earth — you are looking at the night side", "☀ Sun directly behind you — looking at the day side", "Sun directly behind Earth — looking at the night side",
    "● IN ECLIPSE — on batteries", "☀ SUNLIT — array charging", "above your horizon · elevation 12° · range 1,234 km", "below your horizon (-12°)", "you", "Sun",
    "sim t = 1 h 2 m · orbit 3 · i = 53° · Ω = 12° · 480× real time",
    "estimated from your timezone (Asia/Jakarta)", "could not determine location (timezone Asia/Jakarta unknown) — still Starbase", "from browser geolocation (±12 km)", "lat, lon · SpaceX HQ, Starbase TX", "lat, lon · from this link",
    "custom — edited from: " + PRESETS[0].n, "copied", "Copy this link:", "propellant / yr: 1.5 %", "lifetime: 1.5 yr", "lifetime: 12 d", "lifetime: 12 h", "1.5 yr @ 550 km",
    "current design (35,786 km) is beyond this chart", "effectively never", "n/a", "⚠ β unreachable at this i",
  ].forEach(x => I18N.tr(x));
  // static prose, keyed exactly
  const notes = [...new DOMParser().parseFromString(source, "text/html").querySelectorAll(".notes li")].map(li => li.innerHTML);
  const statics = [...new Set([...Object.values(DESC), ...CTLS.flatMap(c => [c.label, c.note]), ...PRESETS.flatMap(p => [p.n, p.d]), ...Object.values(REFS).map(r => r.t), ...notes].filter(Boolean))];
  const dict = I18N.dict, all = new Set(I18N.missing);
  I18N.missing.clear(); statics.forEach(s => I18N.tr(s)); const fromStatic = new Set(I18N.missing);
  return { static: statics.filter(s => dict[s] === undefined), dynamic: [...all].filter(k => !fromStatic.has(k)), entries: Object.keys(dict).length };
}, fs.readFileSync("index.html", "utf8"));
await browser.close();
const out = process.argv[2];
if (out) fs.writeFileSync(out, JSON.stringify({ static: res.static, dynamic: res.dynamic }, null, 1));
console.log(res.entries, "entries in lang-id.js;", res.static.length, "static and", res.dynamic.length, "dynamic texts untranslated;", errs.length ? "ERRORS: " + errs.join(" | ") : "no page errors");
if (!out) console.log([...res.static.map(s => s.length > 100 ? s.slice(0, 100) + "…" : s), ...res.dynamic].join("\n"));
