// Regenerates the bundled fonts in src/assets/fonts from the pinned npm packages.
//   node scripts/fonts.mjs           -> writes src/assets/fonts/*.woff2 and fonts.json
//   node scripts/fonts.mjs --check   -> fails if the committed files are not what the packages generate
// The generated files are committed, so a normal build needs none of this tooling: it only inlines them.
//
// Two families, both under private names so a system-installed copy can never stand in for a failed embed:
//   "TST Sans"  Inter (variable weight), every piece of interface text
//   "TST Mono"  JetBrains Mono, Regular and Bold: the ASCII scenes, and anything set in a fixed pitch
// The mono subsets carry no OpenType layout features at all. JetBrains Mono's programming ligatures would
// redraw the art's "--", "==", "->" and "//", so they are left out of the files rather than switched off in CSS.
// The source is the 2.211 build (the one Google Fonts serves): its block glyphs are drawn 10 units wider than
// their cell on each side, which the later builds dropped, and without that sliver side-by-side blocks show
// hairlines between them.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import * as fontkit from "fontkit";
import subsetFont from "subset-font";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src/assets/fonts");
const require = createRequire(import.meta.url);
const check = process.argv.includes("--check");
const fail = msg => { console.error("fonts: " + msg); process.exit(1); };

/* ---------- what each family has to cover ---------- */
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const ASCII = range(0x20, 0x7e);
// what the copy style needs: true minus, curly quotes, ellipsis, en and em dash, middle dot, bullet, no-break space, multiplication sign
const TYPOGRAPHY = [0x2212, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0x2013, 0x2014, 0x00b7, 0x2022, 0x00a0, 0x00d7];
const LATIN_1 = range(0xa0, 0xff);
const BOX_AND_BLOCKS = range(0x2500, 0x259f); // box drawing and block elements, all of them
const ARROWS = range(0x2190, 0x2193);

const SANS = [...ASCII, ...LATIN_1.filter(c => c !== 0xad), ...TYPOGRAPHY, 0x2009, 0x2032, 0x2033, 0x20ac, 0x2122, 0x2191, 0x2193];
const MONO = [...ASCII, ...LATIN_1, ...TYPOGRAPHY, ...ARROWS, ...BOX_AND_BLOCKS];

// Code that draws into the character grid. Every non-ASCII character in these files' strings must be in the mono face.
const SCENE_SOURCES = ["src/legacy/scenes.js", "src/engine/scenes", "src/copy/scenes.js"];
// The two-frame flipbook the game falls back to when the scene engine is missing (never the case in the built
// file). It is the one other place that puts text in a fixed-pitch box.
const FLIPBOOK = { file: "src/legacy/game.jsx", start: "const CUTSCENES={", end: "\n    };" };
// Characters those sources use that the mono face does not have, each with the reason it is tolerated.
// An entry that stops being needed fails the run, so this list cannot go stale.
const MONO_EXCEPTIONS = new Map([
  [0x2614, "umbrella in the fallback flipbook's 'missed' frame (game.jsx); unreachable while the scene engine is bundled"]
]);

const hex = c => "U+" + c.toString(16).toUpperCase().padStart(4, "0");
const show = c => hex(c) + " " + JSON.stringify(String.fromCodePoint(c));
const sha256 = buf => crypto.createHash("sha256").update(buf).digest("hex");
const nonAscii = text => { const out = new Set(); for(const ch of text){ const c = ch.codePointAt(0); if(c > 0x7e) out.add(c); } return out; };

function walk(p){
  if(!fs.existsSync(p)) return [];
  if(fs.statSync(p).isFile()) return [p];
  return fs.readdirSync(p).sort().flatMap(n => walk(path.join(p, n))).filter(f => /\.(js|jsx|mjs)$/.test(f));
}
// Strings only: esbuild reprints the file without comments and with every \u escape as the character it stands for.
function stringChars(file){
  const src = fs.readFileSync(file, "utf8");
  const out = esbuild.transformSync(src, { loader: file.endsWith(".jsx") ? "jsx" : "js", charset: "utf8", legalComments: "none", minifyWhitespace: true }).code;
  return nonAscii(out);
}
function sceneCodePoints(){
  const used = new Map(); // code point -> where it was seen
  const files = SCENE_SOURCES.flatMap(p => walk(path.join(ROOT, p)));
  if(!files.length) fail("none of the scene sources exist (" + SCENE_SOURCES.join(", ") + "); the coverage gate would pass on nothing");
  for(const f of files) for(const c of stringChars(f)) if(!used.has(c)) used.set(c, path.relative(ROOT, f));
  const fb = path.join(ROOT, FLIPBOOK.file);
  let flipbook = false;
  if(fs.existsSync(fb)){
    const src = fs.readFileSync(fb, "utf8"), a = src.indexOf(FLIPBOOK.start), b = a < 0 ? -1 : src.indexOf(FLIPBOOK.end, a);
    if(a >= 0 && b > a){
      flipbook = true;
      for(const c of nonAscii(src.slice(a, b))) if(!used.has(c)) used.set(c, FLIPBOOK.file + " (fallback flipbook)");
    }
  }
  return { used, files: files.map(f => path.relative(ROOT, f)), flipbook };
}

/* ---------- the faces ---------- */
const FACES = [
  { out: "tst-sans.woff2", family: "TST Sans", weight: "100 900", need: SANS,
    pkg: "@fontsource-variable/inter", file: "files/inter-latin-wght-normal.woff2" },
  { out: "tst-mono-400.woff2", family: "TST Mono", weight: "400", need: MONO, mono: true,
    pkg: "@expo-google-fonts/jetbrains-mono", file: "400Regular/JetBrainsMono_400Regular.ttf" },
  { out: "tst-mono-700.woff2", family: "TST Mono", weight: "700", need: MONO, mono: true,
    pkg: "@expo-google-fonts/jetbrains-mono", file: "700Bold/JetBrainsMono_700Bold.ttf" }
];
// name-table records kept in the subset: the defaults (0-6) plus the licence description and licence URL, so each
// embedded font still carries its own copyright and licence notice
const NAME_IDS = [0, 1, 2, 3, 4, 5, 6, 13, 14];
// the scene grid's line-height (src/styles/legacy.css ".cutbox.crt pre", and aspect() in the scene engine)
const GRID_LINE_HEIGHT = 1.14;
// How far a full block must reach into the row below, in em. Rows sit on whole pixels, so a block that is barely
// taller than the line leaves a dark line between rows at many sizes (measured: 0.05 em gapped at half the sizes
// from 5.5 to 20 px, 0.18 em at none). 0.15 em is most of a pixel at the engine's smallest size.
const MIN_ROW_OVERLAP = 0.15;

function pkgInfo(name){
  const dir = path.dirname(require.resolve(name + "/package.json"));
  return { dir, version: JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version };
}
const nameRecord = (font, key) => { const r = font.name && font.name.records && font.name.records[key]; return r ? String(r.en || Object.values(r)[0] || "").trim() : ""; };
const missing = (font, cps) => cps.filter(c => !font.hasGlyphForCodePoint(c));
function layoutFeatures(font){
  const tags = new Set();
  for(const table of ["GSUB", "GPOS"]){ try{ for(const f of (font[table] && font[table].featureList) || []) tags.add(f.tag); }catch(e){} }
  return [...tags].sort();
}

// Cell metrics that make the art tile: one advance for every glyph, a full block that covers its whole cell at
// the grid's line-height and overlaps its neighbours on every side, and box-drawing strokes that reach the cell
// edges they join.
function cellMetrics(font, label){
  const upm = font.unitsPerEm, problems = [];
  const adv = new Set(MONO.map(c => font.glyphForCodePoint(c).advanceWidth));
  if(adv.size !== 1) problems.push("glyph advances differ: " + [...adv].join(", "));
  const w = [...adv][0];
  // where a line box of GRID_LINE_HEIGHT em sits around the baseline (the font's own ascent and descent, centred)
  const asc = font.hhea.ascent, desc = -font.hhea.descent;
  const top = (GRID_LINE_HEIGHT * upm + asc - desc) / 2, bottom = GRID_LINE_HEIGHT * upm - top;
  const box = c => font.glyphForCodePoint(c).bbox;
  const spansX = b => b.minX <= 0 && b.maxX >= w, spansY = b => b.maxY >= top && -b.minY >= bottom;
  const want = (ok, what) => { if(!ok) problems.push(what); };
  const blk = box(0x2588), rowOverlap = (blk.maxY - blk.minY) / upm - GRID_LINE_HEIGHT;
  want(spansX(blk) && spansY(blk), "full block U+2588 does not cover its cell");
  want(blk.minX < 0 && blk.maxX > w, "full block U+2588 is exactly as wide as its cell: side-by-side blocks will show hairlines between them");
  want(rowOverlap >= MIN_ROW_OVERLAP, "full block U+2588 reaches only " + rowOverlap.toFixed(3) + " em into the next row (need " + MIN_ROW_OVERLAP + "): stacked blocks will show gaps");
  want(box(0x258c).minX <= 0 && spansY(box(0x258c)), "left half block U+258C does not reach the cell's left, top and bottom edges");
  want(box(0x2580).maxY >= top, "upper half block U+2580 does not reach the top of the cell");
  want(-box(0x2584).minY >= bottom, "lower half block U+2584 does not reach the bottom of the cell");
  for(const c of [0x2500, 0x2550, 0x2501]) want(spansX(box(c)), "horizontal rule " + hex(c) + " does not reach both sides of the cell");
  for(const c of [0x2502, 0x2551, 0x2503]) want(spansY(box(c)), "vertical rule " + hex(c) + " does not reach the top and bottom of the cell");
  for(const c of [0x250c, 0x2510, 0x2514, 0x2518, 0x253c]){
    const b = box(c), right = c === 0x250c || c === 0x2514 || c === 0x253c, left = c === 0x2510 || c === 0x2518 || c === 0x253c;
    const down = c === 0x250c || c === 0x2510 || c === 0x253c, up = c === 0x2514 || c === 0x2518 || c === 0x253c;
    want((!right || b.maxX >= w) && (!left || b.minX <= 0) && (!down || -b.minY >= bottom) && (!up || b.maxY >= top), "corner " + hex(c) + " does not reach the cell edges it joins");
  }
  if(problems.length) fail(label + ": " + problems.join("; "));
  return { unitsPerEm: upm, advance: w, ascent: asc, descent: desc, lineHeight: GRID_LINE_HEIGHT,
    blockOverlap: { row: +rowOverlap.toFixed(4), side: +((blk.maxX - blk.minX - w) / upm).toFixed(4) } };
}

async function generate(){
  const scenes = sceneCodePoints();
  const files = {}, manifest = { note: "Generated by scripts/fonts.mjs (npm run fonts). Do not edit.", faces: [] };
  let monoCell = null;
  for(const face of FACES){
    const pkg = pkgInfo(face.pkg), srcPath = path.join(pkg.dir, face.file);
    if(!fs.existsSync(srcPath)) fail(face.pkg + "@" + pkg.version + " has no " + face.file);
    const src = fs.readFileSync(srcPath), original = fontkit.create(src);
    const label = face.out + " (" + face.pkg + "@" + pkg.version + ")";

    // gate 1: the source font has everything this family must cover
    let need = [...new Set(face.need)];
    if(face.mono){
      const uncovered = [...scenes.used.keys()].filter(c => !original.hasGlyphForCodePoint(c));
      const unexplained = uncovered.filter(c => !MONO_EXCEPTIONS.has(c));
      if(unexplained.length) fail(label + " lacks characters the scenes draw: " + unexplained.map(c => show(c) + " in " + scenes.used.get(c)).join(", "));
      for(const c of MONO_EXCEPTIONS.keys()) if(!uncovered.includes(c)) fail("MONO_EXCEPTIONS lists " + hex(c) + ", which is no longer used or is now covered. Remove the entry.");
      need = [...new Set([...need, ...[...scenes.used.keys()].filter(c => !MONO_EXCEPTIONS.has(c))])];
    }
    need.sort((a, b) => a - b);
    const lacks = missing(original, need);
    if(lacks.length) fail(label + " lacks required characters: " + lacks.map(show).join(", "));

    // the mono faces: no hinting program (the same outlines on every system) and no layout features (no ligatures)
    const options = { targetFormat: "woff2", preserveNameIds: NAME_IDS, ...(face.mono ? { noHinting: true, keepFeatures: [] } : {}) };
    const woff2 = await subsetFont(src, need.map(c => String.fromCodePoint(c)).join(""), options);

    // gate 2: so does the file that will actually ship
    const font = fontkit.create(woff2), lost = missing(font, need);
    if(lost.length) fail(label + ": the subset lost " + lost.map(show).join(", "));
    const copyright = nameRecord(font, "copyright"), licence = nameRecord(font, "license"), licenceURL = nameRecord(font, "licenseURL");
    if(!copyright) fail(label + ": the subset lost its copyright notice");
    if(!licence && !licenceURL) fail(label + ": the subset lost its licence notice");
    const entry = {
      file: face.out, family: face.family, weight: face.weight,
      source: { package: face.pkg, version: pkg.version, file: face.file, sha256: sha256(src) },
      font: { name: nameRecord(original, "fullName") || original.fullName, version: String(original.version || "").replace(/;.*/, ""), copyright, licence, licenceURL },
      codePoints: need.length, glyphs: font.numGlyphs, bytes: woff2.length, sha256: sha256(woff2)
    };
    if(face.mono){
      const features = layoutFeatures(font);
      if(features.length) fail(label + ": the mono subset still carries layout features (" + features.join(" ") + "); ligatures would redraw the art");
      entry.cell = cellMetrics(font, label);
      if(monoCell && (monoCell.advance !== entry.cell.advance || monoCell.unitsPerEm !== entry.cell.unitsPerEm || monoCell.ascent !== entry.cell.ascent || monoCell.descent !== entry.cell.descent))
        fail("the mono weights do not share one cell: " + JSON.stringify(monoCell) + " vs " + JSON.stringify(entry.cell));
      monoCell = entry.cell;
    }else{
      const axis = font.variationAxes && font.variationAxes.wght;
      if(!axis || axis.min > 400 || axis.max < 800) fail(label + ": the weight axis must span at least 400 to 800 (the weights the styles use)");
      entry.axis = { wght: [axis.min, axis.max] };
    }
    files[face.out] = woff2;
    manifest.faces.push(entry);
  }
  files["fonts.json"] = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  return { files, manifest, scenes };
}

const { files, manifest, scenes } = await generate();
const kb = n => (n / 1024).toFixed(1) + " KB";
console.log("scene sources scanned: " + scenes.files.join(", ") + (scenes.flipbook ? ", " + FLIPBOOK.file + " (fallback flipbook)" : ""));
console.log("non-ASCII characters they draw: " + ([...scenes.used.keys()].sort((a, b) => a - b).map(show).join(", ") || "none"));
for(const [c, why] of MONO_EXCEPTIONS) console.log("  not in the mono face, tolerated: " + show(c) + " - " + why);
for(const f of manifest.faces){
  console.log(f.file.padEnd(19) + kb(f.bytes).padStart(8) + "  " + f.family + " " + f.weight + "  <- " + f.font.name + " " + f.font.version + " (" + f.source.package + "@" + f.source.version + "), " +
    f.codePoints + " code points, " + f.glyphs + " glyphs" + (f.cell ? ", cell " + f.cell.advance + "/" + f.cell.unitsPerEm + " em wide, a block overlaps the next row by " + f.cell.blockOverlap.row + " em and its neighbours by " + f.cell.blockOverlap.side + " em" : ""));
}

if(check){
  const stale = Object.keys(files).filter(n => { const p = path.join(OUT, n); return !fs.existsSync(p) || !fs.readFileSync(p).equals(files[n]); });
  const extra = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter(n => !(n in files)) : [];
  if(stale.length || extra.length) fail("src/assets/fonts is stale" + (stale.length ? "; differs: " + stale.join(", ") : "") + (extra.length ? "; unexpected: " + extra.join(", ") : "") + ". Run: npm run fonts");
  console.log("src/assets/fonts is up to date");
}else{
  fs.mkdirSync(OUT, { recursive: true });
  for(const [n, buf] of Object.entries(files)) fs.writeFileSync(path.join(OUT, n), buf);
  console.log("wrote " + Object.keys(files).length + " files to " + path.relative(ROOT, OUT));
}
