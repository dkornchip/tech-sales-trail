#!/usr/bin/env python3
# What is in the file that ships: links, network calls, test hooks, diagnostics, personal traces.
#   python3 hygiene.py <release.html>
import re, sys, hashlib, collections
p = sys.argv[1]; raw = open(p, "rb").read(); s = raw.decode("utf8")
print(f"{p}: {len(raw):,} bytes, sha256 {hashlib.sha256(raw).hexdigest()}")
def show(title, items, limit=40):
    items = list(items); print(f"\n{title}: {len(items)}")
    for i in items[:limit]: print("   " + str(i)[:200])
urls = collections.Counter(re.findall(r"https?://[^\s\"'<>)\\`]+", s))
show("URLs anywhere in the file (distinct, with count)", [f"{n}x {u}" for u, n in sorted(urls.items())])
calls = {k: len(re.findall(k, s)) for k in [r"\bfetch\s*\(", r"XMLHttpRequest", r"WebSocket", r"EventSource", r"sendBeacon", r"importScripts", r"<script[^>]+src=", r"<link[^>]+href=[\"']?https?:", r"<img[^>]+src=[\"']?https?:", r"@import\s+url", r"url\(\s*[\"']?https?:", r"navigator\.serviceWorker", r"\.src\s*=\s*[\"']https?:"]}
show("ways to reach the network (pattern: occurrences)", [f"{k}: {v}" for k, v in calls.items()])
hooks = collections.Counter(re.findall(r"__TST_[A-Z_]+|\bTST_[A-Z_]+\b|__REACT_DEVTOOLS[A-Z_]*", s))
show("test hooks and developer handles (name: occurrences)", [f"{k}: {v}" for k, v in sorted(hooks.items())])
cons = collections.Counter(re.findall(r"console\.(\w+)", s))
show("console calls (method: occurrences)", [f"console.{k}: {v}" for k, v in sorted(cons.items())])
show("debugger statements / source maps", re.findall(r"\bdebugger\b|sourceMappingURL=[^\s*]+", s))
show("e-mail addresses", sorted(set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", s))))
show("local paths and hosts", sorted(set(re.findall(r"/home/[\w./-]+|/Users/[\w./-]+|[A-Z]:\\\\[\w\\\\.-]+|localhost[:\d]*|127\.0\.0\.1[:\d]*|file://[\w./-]+", s))))
show("notes to self", sorted(set(re.findall(r"\b(?:TODO|FIXME|XXX|HACK)\b[^\n]{0,60}", s))))
keys = sorted(set(re.findall(r"(?:api[_-]?key|secret|token|password|passwd|bearer|authorization)\s*[:=]\s*[\"'][^\"']{6,}[\"']", s, flags=re.I)))
show("things shaped like credentials", keys)
show("storage keys the game uses", sorted(set(re.findall(r"[\"'](tst-[a-z0-9-]+)[\"']", s))))
stmt = "Tech Sales Trail is an independently developed fictional satire of the technology sales industry. It is not affiliated with or endorsed by any employer or technology vendor."
print("\nthe studio's statement, word for word, is in the file:", stmt in s)
