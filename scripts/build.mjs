// Builds the whole game into one self-contained index.html that makes no network requests.
//   node scripts/build.mjs             -> dist/index.html (or $TST_OUT/index.html)
//   node scripts/build.mjs --release   -> also writes ./index.html (the file GitHub Pages serves)
//   node scripts/build.mjs --check     -> fails if ./index.html is not what the source builds to
//   --dev                              -> unminified and with React's development build: for reading the output and
//                                         for hearing React's warnings. Never for release (the size check is skipped).
// For a preview page (never a release), three variables swap the inputs:
//   TST_ENTRY=<script entry>  TST_CSS=<style entry>  TST_TEMPLATE=<html template>
// The fonts are inlined from src/assets/fonts, which is committed (regenerate it with: npm run fonts).
import * as esbuild from "esbuild";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const dev = args.has("--dev");
const outDir = path.resolve(ROOT, process.env.TST_OUT || "dist");
const MAX_RAW = 800 * 1024;
const ENTRY = process.env.TST_ENTRY || "src/main.jsx";
const CSS_ENTRY = process.env.TST_CSS || "src/styles/index.css";
const TEMPLATE = process.env.TST_TEMPLATE || "src/index.template.html";
const PREVIEW = !!(process.env.TST_ENTRY || process.env.TST_CSS || process.env.TST_TEMPLATE);

const fail = msg => { console.error("build: " + msg); process.exit(1); };
const readJSON = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const sha256 = buf => crypto.createHash("sha256").update(buf).digest("hex");

async function bundle(){
  const common = { bundle: true, write: false, minify: !dev, charset: "utf8", legalComments: "none", logLevel: "warning", absWorkingDir: ROOT };
  const js = await esbuild.build({
    ...common,
    entryPoints: [ENTRY],
    format: "iife",
    target: ["es2020"],
    jsx: "transform",
    metafile: true,
    // --dev bundles React's development build, so its warnings (duplicate keys, updates during render) reach the console
    define: { "process.env.NODE_ENV": dev ? '"development"' : '"production"' }
  });
  const css = await esbuild.build({
    ...common,
    entryPoints: [CSS_ENTRY],
    loader: { ".woff2": "dataurl" }
  });
  // every npm package whose code ended up in the script
  const packages = new Set();
  for(const [file, info] of Object.entries(js.metafile.inputs)){
    const m = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(file);
    if(m && info.bytes > 0) packages.add(m[1]);
  }
  // every source file that went into the script (the icon scan reads these)
  const sources = Object.keys(js.metafile.inputs).filter(f => !/(^|\/)node_modules\//.test(f));
  return { js: js.outputFiles[0].text, css: css.outputFiles[0].text, packages: [...packages].sort(), sources };
}

/* ---------- icons ---------- */
// The interface names its icons as <Icon name="phone"/> or as icon:"phone" in a table (or picks between quoted
// names in an expression after icon: or name=). Every name found in the
// bundled source is taken from lucide-static and inlined once as an SVG symbol; <Icon> then points at it with
// <use href="#i-phone">. A name Lucide does not have stops the build.
function iconSprite(sources){
  const names = new Set();
  for(const file of sources){
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    for(const m of text.matchAll(/<Icon\b[^>]*?\bname="([a-z0-9-]+)"/g)) names.add(m[1]);
    // an icon can also be chosen by an expression (icon: up ? "trending-up" : "trending-down", name={...}):
    // every quoted name in that expression is taken
    for(const m of text.matchAll(/\bicon:\s*([^,}\n]+)/g)) for(const q of m[1].matchAll(/"([a-z0-9-]+)"/g)) names.add(q[1]);
    for(const m of text.matchAll(/<Icon\b[^>]*?\bname=\{([^}]+)\}/g)) for(const q of m[1].matchAll(/"([a-z0-9-]+)"/g)) names.add(q[1]);
  }
  if(!names.size) return { svg: "", names: [] };
  const symbols = [...names].sort().map(name => {
    const file = path.join(ROOT, "node_modules/lucide-static/icons", name + ".svg");
    if(!fs.existsSync(file)) fail('the source uses an icon Lucide does not have: "' + name + '"');
    const raw = fs.readFileSync(file, "utf8");
    const inner = raw.slice(raw.indexOf(">", raw.indexOf("<svg")) + 1, raw.lastIndexOf("</svg>")).replace(/\s+/g, " ").replace(/> </g, "><").replace(/ \/>/g, "/>").trim();
    return '<symbol id="i-' + name + '" viewBox="0 0 24 24">' + inner + "</symbol>";
  });
  return { svg: '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + symbols.join("") + "</svg>", names: [...names].sort() };
}

/* ---------- third-party notices ---------- */
// Licences this build knows how to credit. Anything else stops the build until someone adds its notice here.
const FONT_LICENCES = [{ match: /open font license|openfontlicense\.org|scripts\.sil\.org\/OFL/i, name: "SIL Open Font License 1.1" }];
function notices(packages, iconNames){
  const lines = [];
  const byNotice = new Map();
  for(const name of packages){
    const dir = path.join(ROOT, "node_modules", name), pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    if(pkg.license !== "MIT") fail("the script bundles " + name + " (" + pkg.license + "); add its notice to scripts/build.mjs");
    const licence = fs.existsSync(path.join(dir, "LICENSE")) ? fs.readFileSync(path.join(dir, "LICENSE"), "utf8") : "";
    const copyright = (/^Copyright .+$/m.exec(licence) || [""])[0].trim();
    if(!copyright) fail("no copyright line found in node_modules/" + name + "/LICENSE");
    if(!byNotice.has(copyright)) byNotice.set(copyright, []);
    byNotice.get(copyright).push(name + " " + pkg.version);
  }
  for(const [copyright, names] of byNotice) lines.push(names.join(", ") + ". " + copyright.replace(/\.$/, "") + ". MIT License.");

  const fonts = readJSON("src/assets/fonts/fonts.json").faces, seen = new Map();
  for(const f of fonts){
    const licence = FONT_LICENCES.find(l => l.match.test(f.font.licence + " " + f.font.licenceURL));
    if(!licence) fail("no known licence for " + f.file + "; add its notice to scripts/build.mjs");
    const family = f.font.name.replace(/ (Regular|Bold|Italic|Medium|Light)$/, ""), key = family + "|" + f.font.copyright;
    if(!seen.has(key)) seen.set(key, family + " " + f.font.version.replace(/^Version /, "") + ', a subset, as "' + f.family + '". ' + f.font.copyright.replace(/\.$/, "") + ". " + licence.name + ".");
  }
  lines.push(...seen.values());

  if(iconNames.length){
    const dir = path.join(ROOT, "node_modules/lucide-static"), pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    if(pkg.license !== "ISC") fail("lucide-static is now " + pkg.license + "; update its notice in scripts/build.mjs");
    const copyright = (/^Copyright .+$/m.exec(fs.readFileSync(path.join(dir, "LICENSE"), "utf8")) || [""])[0].trim();
    if(!copyright) fail("no copyright line found in node_modules/lucide-static/LICENSE");
    lines.push("Lucide " + pkg.version + " (" + iconNames.length + " icons). " + copyright.replace(/\.$/, "") + ". ISC License.");
  }

  const pkg = readJSON("package.json");
  const text = [
    "Tech Sales Trail " + pkg.version + ". One self-contained file: it makes no network requests.",
    "",
    "Third-party notices",
    ...lines.map(l => "  " + l),
    "Licence texts: https://opensource.org/license/mit" + (iconNames.length ? ", https://opensource.org/license/isc-license-txt" : "") + " and https://openfontlicense.org"
  ].join("\n");
  if(/--|>/.test(text)) fail("the notices text would break out of its HTML comment");
  return "<!--\n" + text + "\n-->\n";
}

/* ---------- no URLs in the payload ---------- */
// Third-party code carries a few URLs that are names, not addresses: XML namespace identifiers the DOM APIs need
// verbatim, and the link React prints inside a minified error message. Nothing ever fetches them. They are written
// with escaped slashes (the string's value is unchanged), so the shipped file contains no "http://" or "https://"
// outside the notices and that can be asserted on the whole output. Any URL that is not on this list fails the build.
const INERT_URLS = new Set([
  "http://www.w3.org/1999/xhtml", "http://www.w3.org/2000/svg", "http://www.w3.org/1998/Math/MathML",
  "http://www.w3.org/1999/xlink", "http://www.w3.org/XML/1998/namespace",
  "https://reactjs.org/docs/error-decoder.html?invariant="
]);
function escapeInertUrls(js){
  if(dev) return js;   // React's development build names documentation pages in its warnings; a --dev build is never released
  return js.replace(/https?:\/\/[^\s"'`\\]*/g, (url, at) => {
    if(!INERT_URLS.has(url)) fail("the script payload contains a URL: " + url + "\n       The game must not reference the network. (If this is an identifier that nothing fetches, add it to INERT_URLS.)");
    if(!/["'`]/.test(js[at - 1])) fail("expected " + url + " to be a whole string literal; cannot rewrite it safely");
    return url.replace("://", ":\\/\\/");
  });
}

/* ---------- embedded fonts ---------- */
// Every face in the manifest must be in the stylesheet as a data: URL holding exactly the committed bytes,
// and the stylesheet must not point anywhere else.
function checkFonts(css){
  const faces = readJSON("src/assets/fonts/fonts.json").faces;
  const blocks = (css.match(/@font-face\s*\{[^}]*\}/g) || []).map(b => ({
    family: (/font-family:\s*["']?([^;"'}]+)/.exec(b) || [])[1],
    weight: ((/font-weight:\s*([^;}]+)/.exec(b) || [])[1] || "").trim(),
    data: (/url\(\s*["']?data:font\/woff2;base64,([A-Za-z0-9+/=]+)/.exec(b) || [])[1]
  }));
  for(const f of faces){
    const onDisk = fs.readFileSync(path.join(ROOT, "src/assets/fonts", f.file));
    if(sha256(onDisk) !== f.sha256) fail("src/assets/fonts/" + f.file + " does not match fonts.json. Run: npm run fonts");
    const b = blocks.find(x => x.family === f.family && x.weight === f.weight);
    if(!b) fail('no @font-face for "' + f.family + '" ' + f.weight + " in the stylesheet (src/styles/fonts.css)");
    if(!b.data) fail('"' + f.family + '" ' + f.weight + " is not embedded as data:font/woff2");
    if(sha256(Buffer.from(b.data, "base64")) !== f.sha256) fail('"' + f.family + '" ' + f.weight + " embeds something other than src/assets/fonts/" + f.file);
  }
  for(const family of ["TST Sans", "TST Mono"]) if(!faces.some(f => f.family === family)) fail('fonts.json has no "' + family + '" face');
  if(blocks.length !== faces.length) fail("the stylesheet has " + blocks.length + " @font-face rules, fonts.json has " + faces.length + " faces");
  const elsewhere = (css.match(/url\(\s*["']?(?!data:)[^)]{0,60}/g) || []);
  if(elsewhere.length) fail("the stylesheet points outside the file: " + elsewhere[0]);
  if(/@import/i.test(css)) fail("the stylesheet still has an @import that was not inlined");
  return faces;
}

function assemble({ js, css, packages, sources }){
  // An inline payload must never be able to close its own element.
  if(/<\/script/i.test(js)) fail("the script payload contains </script");
  if(/<!--/.test(js)) fail("the script payload contains <!--");
  if(/<\/style/i.test(css)) fail("the style payload contains </style");
  if(!dev && /react-dom\.development|react\.development/.test(js)) fail("React's development build got bundled");
  if(/https?:\/\//i.test(css)) fail("the style payload contains a URL: " + /https?:\/\/[^\s"')]*/i.exec(css)[0]);
  checkFonts(css);
  js = escapeInertUrls(js);

  const template = fs.readFileSync(path.join(ROOT, TEMPLATE), "utf8");
  const icons = iconSprite(sources);
  const ICON_SLOT = "<!--__TST_ICONS__-->";
  if(icons.names.length && template.split(ICON_SLOT).length !== 2) fail("the source uses icons, so the template needs exactly one " + ICON_SLOT);
  for(const slot of ["/*__TST_CSS__*/", "/*__TST_JS__*/"]){
    if(template.split(slot).length !== 2) fail("the template needs exactly one " + slot);
  }
  const header = notices(packages, icons.names);
  const page = template
    .replace(ICON_SLOT, () => icons.svg)
    .replace("/*__TST_CSS__*/", () => "\n" + css.trimEnd() + "\n  ")
    .replace("/*__TST_JS__*/", () => "\n" + js.trimEnd() + "\n  ");
  const html = header + page;

  // Without an inline icon a browser asks the host for /favicon.ico. (In an SVG data: URI, write the namespace as
  // http%3A//www.w3.org/2000/svg: same image, and the file stays free of anything that reads as a URL.)
  const head = page.slice(0, page.indexOf("<style>"));
  if(!/<link rel="icon" href="data:image\/svg\+xml[;,][^"]+"/.test(head)) fail('the template needs <link rel="icon" href="data:image/svg+xml,...">');
  for(const name of ["description", "theme-color"]) if(!new RegExp('<meta name="' + name + '" content="[^"]+"').test(head)) fail('the template needs <meta name="' + name + '">');
  if(!/<title>[^<]+<\/title>/.test(head)) fail("the template needs a <title>");
  if(/<link\b(?![^>]*\brel="icon")/i.test(page.replace(/<script>[\s\S]*<\/script>/, ""))) fail("the template links to something other than the inline icon");

  if(!dev && /https?:\/\//i.test(page)) fail("the output contains a URL outside the notices: " + /https?:\/\/[^\s"'<)]*/i.exec(page)[0]);
  // the encoding declaration has to sit inside the first 1024 bytes, notices included
  const charset = html.indexOf('<meta charset="utf-8"');
  if(charset < 0 || Buffer.byteLength(html.slice(0, charset)) + 24 > 1024) fail('<meta charset="utf-8"> must end within the first 1024 bytes; shorten the notices');
  return html;
}

const html = assemble(await bundle());
const raw = Buffer.byteLength(html), gzip = zlib.gzipSync(html, { level: 9 }).length;
const kb = n => (n / 1024).toFixed(0) + " KB";
const sizes = kb(raw) + " raw, " + kb(gzip) + " gzip";
if(!dev && raw > MAX_RAW) fail("the output is " + sizes + "; the limit is " + kb(MAX_RAW) + " raw");

if(args.has("--check")){
  if(PREVIEW) fail("--check compares the game, not a preview: unset TST_ENTRY, TST_CSS and TST_TEMPLATE");
  const committed = fs.existsSync(path.join(ROOT, "index.html")) ? fs.readFileSync(path.join(ROOT, "index.html"), "utf8") : "";
  if(committed !== html) fail("./index.html is stale. Run: npm run release");
  console.log("index.html is up to date (" + sizes + ")");
}else{
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  console.log(path.relative(ROOT, path.join(outDir, "index.html")) + "  " + sizes);
  if(args.has("--release")){
    if(dev) fail("--release and --dev do not go together");
    if(PREVIEW) fail("--release builds the game, not a preview: unset TST_ENTRY, TST_CSS and TST_TEMPLATE");
    fs.writeFileSync(path.join(ROOT, "index.html"), html);
    console.log("index.html  (released)");
  }
}
