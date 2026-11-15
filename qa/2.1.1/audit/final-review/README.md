# The final review of the 2.1.1 diff

Before promotion, the diff against 2.1 was reviewed in three slices by three reviewers working read-only on the
release candidate, and each set of findings was then given to a second reviewer told to doubt it: reproduce it,
decide whether it is real and whether this diff introduced it, say whether it must be fixed before release, and name
the smallest fix.

| File | Slice |
|---|---|
| `rules.json` | the rules, selectors and words (`src/game`, `src/copy`, the engine tests and tools) |
| `interface.json` | the interface (`src/ui`, the sound director) |
| `layout.json` | the layout, the build's notices and the browser gates (`src/styles`, `scripts`, `test/e2e`) |

Each file holds `review` (summary, what was checked and found sound, findings with evidence and a proposal) and
`recheck` (a verdict for each finding) as they were returned. Absolute paths were made relative to the repository.
The reviewers' own probe scripts and pictures were scratch files and were not kept; paths that begin
`test-results/review/` point at them.

What was done about each finding is in `TTST_2.1.1_QA_REPORT.md`, §8, "The final review of the diff".
