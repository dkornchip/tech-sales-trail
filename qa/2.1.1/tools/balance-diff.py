#!/usr/bin/env python3
# Did the simulated quarters come out as they did in 2.1?  python3 balance-diff.py <2.1.json> <2.1.1.json>
import json, sys
a = json.load(open(sys.argv[1])); b = json.load(open(sys.argv[2]))
print(f"2.1:   {sys.argv[1]}  seeds {a['seeds']['from']}..{a['seeds']['from']+a['seeds']['count']-1}, tuning {json.dumps(a.get('tuning'))[:80]}")
print(f"2.1.1: {sys.argv[2]}  seeds {b['seeds']['from']}..{b['seeds']['from']+b['seeds']['count']-1}, tuning {json.dumps(b.get('tuning'))[:80]}")
pa, pb = a["policies"], b["policies"]
assert list(pa) == list(pb), "the policies differ"
same, differ = [], []
def strip(d):  # everything that was counted, timings aside
    return {k: v for k, v in d.items() if k not in ("seconds", "ms")}
for name in pa:
    (same if json.dumps(strip(pa[name]), sort_keys=True) == json.dumps(strip(pb[name]), sort_keys=True) else differ).append(name)
print(f"\n{len(same)} of {len(pa)} policies: every count identical ({', '.join(same)})")
pc = lambda x: f"{100*x:.1f}%"
for name in differ:
    x, y = pa[name], pb[name]
    print(f"\n{name}: differs")
    print(f"   survival  {pc(x['survival'])} -> {pc(y['survival'])}   endings {json.dumps(x['endings'])} -> {json.dumps(y['endings'])}")
    keys = [k for k in x if k not in ("seconds",) and json.dumps(x[k], sort_keys=True) != json.dumps(y.get(k), sort_keys=True)]
    print("   fields that moved: " + ", ".join(keys))
for name in ("balanced",):
    x, y = pa[name], pb[name]
    club = lambda d: d["endings"]["club"] / d["n"]
    print(f"\n{name}: survival {pc(x['survival'])} -> {pc(y['survival'])}, President's Club {pc(club(x))} -> {pc(club(y))}, n={y['n']}")
