# Orbital AI Datacenter Calculator

Interactive calculator comparing orbital (satellite-based) AI datacenters against ground-based ones: power, fleet size, launch mass, cost, carbon, water, and time-to-power under permitting and political constraints.

Live: https://priyadi.github.io/orbital-ai-datacenter/

Single static page (`index.html`), no build step. Uses D3 and TopoJSON from cdnjs.

## Languages

English and Bahasa Indonesia, switched with the EN / ID buttons (`?lang=id`; the choice is remembered and travels with the permalink). The page renders English; `i18n.js` translates the text on its way to the page using the dictionary in `lang-id.js`, which is only loaded in Indonesian mode. Reference links keep their English titles.

A dictionary key is the English text, either exactly as written in `index.html` or as the page produces it with every number replaced by `#`. After changing any text:

```
node tools/i18n-collect.mjs missing.json    # lists what has no translation yet (needs puppeteer and Chrome)
node tools/i18n-merge.mjs batch.json        # merges {"english": "terjemahan"} and checks numbers, math and markup
```

Text without a translation stays English, so the page never breaks.
