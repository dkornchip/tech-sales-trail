'use strict';
/*
 * Mutants: small, deliberate changes to the baseline's game logic. The selftest plays the baseline against each
 * one and requires the harness to notice. A harness that cannot tell these apart from the baseline cannot be
 * trusted to gate a refactor.
 *
 * Every mutant is a text patch on the baseline's babel block, applied at route time (the file on disk is never
 * touched). `once(text, find, replacement)` throws unless `find` occurs exactly once, so a mutant can never
 * silently turn into a no-op.
 */

// Swap two adjacent blocks of text. a0 / b0 / end are anchors that must each occur exactly once, in that order.
function swapBlocks(src, a0, b0, end, name) {
  const count = t => src.split(t).length - 1;
  for (const t of [a0, b0, end]) if (count(t) !== 1) throw new Error(`mutant ${name}: expected exactly 1 occurrence of ${JSON.stringify(t.slice(0, 60))}, found ${count(t)}`);
  const i = src.indexOf(a0), j = src.indexOf(b0), k = src.indexOf(end);
  if (!(i < j && j < k)) throw new Error(`mutant ${name}: anchors are out of order`);
  return src.slice(0, i) + src.slice(j, k) + src.slice(i, j) + src.slice(k);
}

const MUTANTS = [
  { name: 'energy-cost', what: 'a constant: Prospect Blitz costs 31 energy instead of 30',
    apply: (s, { replaceOnce: once }) => once(s, 'cost(s,{energy:30,slots:1})', 'cost(s,{energy:31,slots:1})') },

  { name: 'propose-odds', what: 'a probability: Proposals advance a deal at 40% instead of 38%',
    apply: (s, { replaceOnce: once }) => once(s, 'd.stage===2 && Math.random()<0.38', 'd.stage===2 && Math.random()<0.40') },

  { name: 'extra-draw', what: 'one extra Math.random() at the top of End Week',
    apply: (s, { replaceOnce: once }) => once(s, '// End-of-week closes still happen with current modifiers.', 'Math.random(); // one draw too many') },

  { name: 'makedeal-order', what: 'makeDeal draws the mood before the base value (was base, mood, name)',
    apply: (s, { replaceOnce: once }) => once(s,
      '      const base=big?randi(22000,58000):randi(5000,24000);\n      const repMult=0.7+0.6*(state.reputation/100);\n      const mood=warm\n        ?(Math.random()<0.6?"curious":"neutral")\n        :(Math.random()<0.25?"skeptical":"neutral");\n',
      '      const repMult=0.7+0.6*(state.reputation/100);\n      const mood=warm\n        ?(Math.random()<0.6?"curious":"neutral")\n        :(Math.random()<0.25?"skeptical":"neutral");\n      const base=big?randi(22000,58000):randi(5000,24000);\n') },

  { name: 'events-swapped', what: 'two fire() calls in randomEvents trade places (SE fumble and SE save)',
    apply: s => swapBlocks(s,
      '      fire(0.14,st=>{',
      '      fire(0.12,st=>{\n        const candidate=st.deals.find(d=>d.stage>=2);\n        if(!candidate)return st;\n        st.product=clamp(st.product+8,0,100);',
      '      fire(0.10,st=>{\n        setPending({', 'events-swapped') },

  { name: 'sort-leak', what: 'a view sort leaks into s.deals: the clAInk report ranks the live array in place',
    apply: (s, { replaceOnce: once }) => once(s, 'const accts=[...s.deals].sort(ckRank).slice(0,4)', 'const accts=s.deals.sort(ckRank).slice(0,4)') },

  { name: 'claink-fee', what: 'the clAInk weekly retainer is $259 instead of $249',
    apply: (s, { replaceOnce: once }) => once(s, 'RETAINER:249,', 'RETAINER:259,') },

  { name: 'claink-draw-order', what: 'a clAInk run draws "manager?" before "miracle?"',
    apply: (s, { replaceOnce: once }) => once(s, 'const rMiracle=ckR(), rMgr=ckR(), rInc=ckR(), rKind=ckR();', 'const rMgr=ckR(), rMiracle=ckR(), rInc=ckR(), rKind=ckR();') },

  { name: 'qbr-threshold', what: 'the QBR treats 79% of quota as "close enough" (was 80%)',
    apply: (s, { replaceOnce: once }) => once(s, '}else if(perfQ>=0.8){', '}else if(perfQ>=0.79){') },

  { name: 'coffee-risk', what: 'the coffee risk table: the 4th shot is 50% instead of 45%',
    apply: (s, { replaceOnce: once }) => once(s, 'n===2?0.20:n===3?0.45:', 'n===2?0.20:n===3?0.50:') },

  { name: 'manager-drift', what: 'a float: weekly manager drift is multiplied by 4.000001 instead of 4',
    apply: (s, { replaceOnce: once }) => once(s, 'const drift=(perfToDate-0.5)*4;', 'const drift=(perfToDate-0.5)*4.000001;') },

  { name: 'rare-pip-shred', what: 'inside a rarely hit branch: the manager shreds your PIP but leaves pipLevel at 1',
    apply: (s, { replaceOnce: once }) => once(s, 'st.pip=false;\n          st.pipLevel=0;', 'st.pip=false;\n          st.pipLevel=1;') },

  { name: 'rare-politics', what: 'inside a rarely hit branch: "hit quota, fired anyway" needs manager under 24 (was 25)',
    apply: (s, { replaceOnce: once }) => once(s, 'perfQ>=1 && mgr<25 && Math.random()<0.06', 'perfQ>=1 && mgr<24 && Math.random()<0.06') },

  { name: 'hail-odds', what: 'the Hail-Mary miracle is 22% instead of 20%',
    apply: (s, { replaceOnce: once }) => once(s, 'const miracle=Math.random()<0.2;', 'const miracle=Math.random()<0.22;') },

  { name: 'ghost-age', what: 'an off-by-one: deals can go dark from 6 weeks old (was older than 6)',
    apply: (s, { replaceOnce: once }) => once(s, 'const tooOld=d.age>6 && d.stage<2', 'const tooOld=d.age>=6 && d.stage<2') },

  { name: 'event-budget', what: 'an event whose precondition fails no longer uses up one of the two weekly event slots',
    apply: (s, { replaceOnce: once }) => once(s, '        if(Math.random()<prob){\n          s=fn(s);\n          firedCount++;', '        if(Math.random()<prob){\n          const before=s.logs.length; s=fn(s);\n          if(s.logs.length!==before||modal)firedCount++;') }
];

module.exports = { MUTANTS, swapBlocks };
