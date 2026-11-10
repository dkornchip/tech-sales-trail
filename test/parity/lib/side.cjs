'use strict';
/*
 * One build, in one browser context of its own (so its localStorage and sessionStorage are private), driven
 * through window.__parity (lib/inpage.cjs) and window.__drv (the driver's inPage()).
 *
 * A Side also listens for everything that must fail a run no matter what the states look like:
 * page errors, console.error, requests that are not on the allow list, exceptions out of timer callbacks.
 */
const inPage = require('./inpage.cjs');
const { ORIGIN, route } = require('./serve.cjs');

const EPOCH = Date.UTC(2026, 0, 5, 9, 0, 1);      // every run starts at Mon 5 Jan 2026 09:00:01 UTC, on a paused clock
const AUTOSAVE_KEY = 'tst-autosave-v4-3';

class Side {
  /*
   * opts:
   *   label        'A' or 'B'
   *   build        from serve.loadBuild()
   *   driver       from drivers/interface.loadDriver()
   *   seed         seed of the mechanical stream (Math.random)
   *   fx           { mode: 'seeded', seed } | { mode: 'const', value }: the cosmetic stream
   *   flavor       the constant clAInk's joke stream is pinned to (0.5 everywhere except one selftest)
   *   motion       'full' | 'reduce'  (prefers-reduced-motion)
   *   roundMs      fake milliseconds per settle round
   *   maxRounds    give up settling after this many rounds
   */
  constructor(opts) {
    Object.assign(this, opts);
    this.url = `${ORIGIN}/${opts.label.toLowerCase()}/index.html`;
    this.net = { unexpected: [], fonts: 0, cdn: 0 };
    this.trouble = [];
    this.reloads = 0;
    this.boots = [];
  }

  async open(browser, startSave) {
    this.context = await browser.newContext({
      viewport: { width: 1440, height: 900 }, locale: 'en-US', timezoneId: 'UTC',
      reducedMotion: this.motion === 'reduce' ? 'reduce' : 'no-preference'
    });
    await route(this.context, this.build, this.url, this.net);
    const cfg = { seed: this.seed >>> 0, fx: this.fx, epoch: EPOCH, autosaveKey: AUTOSAVE_KEY };
    await this.context.addInitScript(`(${inPage.toString()})(${JSON.stringify(cfg)});`);
    await this.context.addInitScript(`window.__drv = (${this.driver.inPage.toString()})();`);
    this.page = await this.context.newPage();
    this.page.on('pageerror', e => this.trouble.push('pageerror: ' + String(e && e.message || e).slice(0, 300)));
    this.page.on('console', m => { if (m.type() === 'error') this.trouble.push('console.error: ' + m.text().slice(0, 300)); });
    this.page.on('crash', () => this.trouble.push('page crashed'));
    if (startSave) {
      // A crafted save, in place before the game's first script runs.
      await this.page.goto(ORIGIN + '/blank.html');
      await this.page.evaluate(json => window.__parity.writeSave('autosave', json), JSON.stringify(startSave));
    }
    await this.page.goto(this.url, { waitUntil: 'load' });
    return this._afterLoad();
  }

  // Shared by the first load and every reload: wait for the app, dismiss the boot overlay, reset the dice, pin
  // the flavor stream, hook the sound trace, settle, read.
  async _afterLoad() {
    const boot = await this.page.evaluate(([r, m]) => window.__parity.boot(r, m), [this.roundMs, this.maxRounds]);
    if (!boot.mounted) throw new Error(`${this.label} (${this.build.label}): the game never mounted. ${this.drainTrouble().join(' ; ') || 'No page error was reported.'}`);
    if (boot.bootStillOpen) throw new Error(`${this.label}: the boot overlay could not be dismissed`);
    if (!boot.settled) this.trouble.push('the page did not settle after loading');
    this.boots.push(boot);
    // seed ^ reloadIndex: the same dice in both builds after every reload, and not the dice of the previous load
    const arm = await this.page.evaluate(([s, f]) => window.__parity.arm(s, f, true), [(this.seed ^ this.reloads) >>> 0, this.flavor]);
    this.audio = arm.audio;
    return this.page.evaluate(() => window.__parity.snapshot());
  }

  step(move, queue) {
    return this.page.evaluate(([m, q, r, x]) => window.__parity.step(m, q, r, x), [move, queue || null, this.roundMs, this.maxRounds]);
  }
  extra(n) { return this.page.evaluate(([k, r]) => window.__parity.extra(k, r), [n, this.roundMs]); }

  async reload() {
    this.reloads++;
    await this.page.reload({ waitUntil: 'load' });
    const snap = await this._afterLoad();
    snap.rounds = 0; snap.settled = true; snap.actError = null;
    return snap;
  }

  // Put a crafted save where the Load button will find it, and restart the dice from `dice`.
  inject(save, dice) {
    return this.page.evaluate(([j, d]) => { window.__parity.writeSave('manual', j); window.__rngReset(d); return true; }, [JSON.stringify(save), dice >>> 0]);
  }

  // Everything that went wrong on this side since the last call.
  drainTrouble() {
    const t = this.trouble.splice(0);
    for (const u of this.net.unexpected.splice(0)) t.push('unexpected request: ' + u);
    return t;
  }

  async close() { try { if (this.context) await this.context.close(); } catch (_) {} }
}

module.exports = { Side, EPOCH, AUTOSAVE_KEY };
