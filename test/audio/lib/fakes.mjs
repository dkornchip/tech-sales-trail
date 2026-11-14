// Stand-ins for the browser's speakers, so the sound engine's decisions can be tested in Node: an AudioContext that
// accepts anything and plays nothing, and a speechSynthesis that keeps time on the test's clock and remembers what
// it was asked to say. Install them BEFORE importing src/engine/audio (the engine looks for them on the global
// object, which is `window` in a browser).
import { mock } from "node:test";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// A node of the audio graph: every method works, every property can be set, nothing happens.
const anything = () => {
  const fn = function () {};
  return new Proxy(fn, {
    get(t, k) {
      if (k === "then" || typeof k === "symbol") return undefined;
      if (k in t) return t[k];
      return (t[k] = anything());
    },
    set(t, k, v) { t[k] = v; return true; },
    apply() { return anything(); }
  });
};
class FakeAudioContext {
  constructor() { this.state = "running"; this.sampleRate = 8000; this.destination = anything(); this.t0 = Date.now(); }
  get currentTime() { return (Date.now() - this.t0) / 1000; }
  resume() { return Promise.resolve(); }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
}
for (const m of ["createGain", "createOscillator", "createBiquadFilter", "createBufferSource", "createDynamicsCompressor", "createWaveShaper", "createDelay", "createStereoPanner", "createConvolver"]) FakeAudioContext.prototype[m] = () => anything();

// speechSynthesis: one utterance at a time, 300 ms plus 60 ms a character (the parity harness's figures).
export const speech = { said: [], cancels: 0 };
class Utterance { constructor(text) { this.text = text; this.volume = 1; } }
const synth = {
  speaking: false, pending: false, paused: false, current: null,
  getVoices() { return [{ name: "Google UK English Male", lang: "en-GB", localService: true }, { name: "Microsoft Aria", lang: "en-US", localService: true }]; },
  speak(u) {
    if (!String(u.text).trim()) { setTimeout(() => { if (u.onend) u.onend(); }, 1); return; }      // the unlock primer
    const rec = { text: u.text, voice: u.voice ? u.voice.name : null, at: Date.now(), until: Date.now() + 300 + 60 * u.text.length, cut: null, overlapped: !!synth.current };
    speech.said.push(rec);
    synth.speaking = true; synth.current = u; u.rec = rec;
    u.timer = setTimeout(() => { if (synth.current === u) { synth.current = null; synth.speaking = false; } if (u.onend) u.onend(); }, rec.until - rec.at);
  },
  cancel() {
    speech.cancels++;
    const u = synth.current; if (!u) return;
    clearTimeout(u.timer); u.rec.cut = Date.now(); synth.current = null; synth.speaking = false;
    if (u.onerror) u.onerror({ error: "interrupted" });
  },
  resume() {}
};

let audio = null;
// Returns the engine's own interface (what the page knows as window.TST_AUDIO), with the clock under test control.
export async function soundEngine() {
  if (audio) return audio;
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: 1_800_000_000_000 });
  globalThis.AudioContext = FakeAudioContext;
  globalThis.speechSynthesis = synth;
  globalThis.SpeechSynthesisUtterance = Utterance;
  await import(pathToFileURL(path.join(ROOT, "src/engine/audio/index.js")).href);
  const T = globalThis.TST_AUDIO;
  const plays = [], captions = [];
  T._A.onPlay = name => plays.push({ name, at: Date.now() });
  T.onCaption = c => captions.push({ ...c, at: Date.now() });
  T.unlock();
  mock.timers.tick(2000);                       // the unlock primer and its watchdog
  audio = { T, plays, captions, speech, tick: ms => mock.timers.tick(ms), now: () => Date.now(),
    reset() { T.hush(); mock.timers.tick(20000); plays.length = 0; captions.length = 0; speech.said.length = 0; speech.cancels = 0; T.setOn(true); T.setVoice(true); T.setCaptions(true); } };
  return audio;
}
// Two lines spoken at once: the one thing the announcer must never do.
export const overlaps = said => said.filter((r, i) => i > 0 && r.at < (said[i - 1].cut === null ? said[i - 1].until : said[i - 1].cut));
