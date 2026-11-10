// Builds the whole game into one self-contained index.html.
//   node scripts/build.mjs             -> dist/index.html (or $TST_OUT/index.html)
//   node scripts/build.mjs --release   -> also writes ./index.html (the file GitHub Pages serves)
//   node scripts/build.mjs --check     -> fails if ./index.html is not what the source builds to
//   --dev                              -> unminified, for reading the output
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const dev = args.has("--dev");
const outDir = path.resolve(ROOT, process.env.TST_OUT || "dist");

const fail = msg => { console.error("build: " + msg); process.exit(1); };

async function bundle(){
  const common = { bundle: true, write: false, minify: !dev, charset: "utf8", legalComments: "none", logLevel: "warning", absWorkingDir: ROOT };
  const js = await esbuild.build({
    ...common,
    entryPoints: ["src/main.jsx"],
    format: "iife",
    target: ["es2020"],
    jsx: "transform",
    define: { "process.env.NODE_ENV": '"production"' }
  });
  const css = await esbuild.build({
    ...common,
    entryPoints: ["src/styles/index.css"],
    loader: { ".woff2": "dataurl" }
  });
  return { js: js.outputFiles[0].text, css: css.outputFiles[0].text };
}

function assemble({ js, css }){
  // An inline payload must never be able to close its own element.
  if(/<\/script/i.test(js)) fail("the script payload contains </script");
  if(/<!--/.test(js)) fail("the script payload contains <!--");
  if(/<\/style/i.test(css)) fail("the style payload contains </style");
  if(/react-dom\.development|react\.development/.test(js)) fail("React's development build got bundled");

  const template = fs.readFileSync(path.join(ROOT, "src/index.template.html"), "utf8");
  for(const slot of ["/*__TST_CSS__*/", "/*__TST_JS__*/"]){
    if(template.split(slot).length !== 2) fail("the template needs exactly one " + slot);
  }
  return template
    .replace("/*__TST_CSS__*/", () => "\n" + css.trimEnd() + "\n  ")
    .replace("/*__TST_JS__*/", () => "\n" + js.trimEnd() + "\n  ");
}

const html = assemble(await bundle());
const kb = n => (n / 1024).toFixed(0) + " KB";

if(args.has("--check")){
  const committed = fs.existsSync(path.join(ROOT, "index.html")) ? fs.readFileSync(path.join(ROOT, "index.html"), "utf8") : "";
  if(committed !== html) fail("./index.html is stale. Run: npm run release");
  console.log("index.html is up to date (" + kb(Buffer.byteLength(html)) + ")");
}else{
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  console.log(path.relative(ROOT, path.join(outDir, "index.html")) + "  " + kb(Buffer.byteLength(html)));
  if(args.has("--release")){
    if(dev) fail("--release and --dev do not go together");
    fs.writeFileSync(path.join(ROOT, "index.html"), html);
    console.log("index.html  (released)");
  }
}
