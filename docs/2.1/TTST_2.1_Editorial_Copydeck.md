# TECH SALES TRAIL 2.1 — Approved editorial copydeck
**Martin Caldwell | Editorial | Operation Final Coat**  
**Companion:** `TTST_2.1_Claude_Code_Implementation.md`  
**Target:** 2.0.1 source, `index(20261114-042919).html`. Symbols are navigation anchors in the bundled build, not public APIs.

## 1. Editorial rules (read before implementing)
Shitcorp is an absolutely ordinary corporation run by people who think it is exceptional. Its earnestness is the joke. Reference the sensibility of mid-2000s cubicle culture, newspaper gag strips, enterprise software and corporate training CDs, without copying any existing comic, show, or writer. Matt is not an idiot; the institution is. Use short setup/payoff, concrete workplace details and the occasional quiet absurdity. No meme slang unless a character specifically warrants it. No extra profanity, no ethnic/national jokes, no real companies impersonated or referenced as villains. Preserve Shitcorp, Scheisskorp, clAInk, ChatGDP (manager's misnomer), Matt, SDR*, Cabo and the jacket. Space is precious; make verbs do the work.

**Implementation notation:** `{n}`, `{account}`, `{money(value)}`, `{plural(n,"deal")}` denote runtime values or formatter calls, NOT literal text or new JS syntax. Preserve exact source payload names and transforms unless noted. `|` divides key and copy in tables, not a visible character. Retain existing effect/delta field (`G(text,dl)`) and severity unless the implementation brief changes rules. Use localized existing money, token and plural helpers. Text marked conditional requires real matching state; never imply a deal was lost, discount given, call made, bill incurred or number generated when it was not. Use zero/one/many forms. Do not introduce new mechanical RNG calls. Keep literal procedural audio tags, event IDs, option IDs, stage strings, CSS selectors, data attributes and accessibility labels unless explicitly directed. Old save logs retain their old text. Action tooltips and rules are factual first, witty second. **All entries below are approved direct copy or expressly conditional additions.** If a source field no longer exists, locate equivalent behavior; report unapplied entries rather than invent behavior.

## 2. Opening and onboarding
### `ar` — People & Culture memo
- `head[0]`: Shitcorp · People & Culture
- `head[1]`: INTERNAL MEMORANDUM · PLEASE DO NOT REPLY ALL
- `greeting`: Welcome to Shitcorp, Matt!
- `paragraphs[0]`: Since 1998, Shitcorp has been at the forefront of whatever our customers were buying. Our new ownership believes we can overtake Scheisskorp by the end of the decade. This is a very exciting slide.
- `paragraphs[1]`: Our culture is our glue. Our compensation plan rewards people who take ownership. Please do not confuse this with actual ownership.
- `role.before`: As you'll be responsible for the entire sales cycle, your internal title will be
- `role.title`: Associate Account Executive
- `role.stamp`: SDR* (retain animated stamp)
- `role.after`: . Congratulations on your expanded responsibilities!
- `footnote`: *For payroll, headcount and organizational simplicity, HR has classified this position as SDR. Responsibilities are unaffected.

### `Js` welcome, `uu` three-step tour, `Zn` boot
| Key | Approved text |
|---|---|
| `Js.title` | New employee orientation |
| `Js.lines[0]` | Your quota is {formatted quota}. You have {weeks} weeks. |
| `Js.lines[1]` | Each week starts with {slots} time slots. Energy is a separate budget. |
| `Js.lines[2]` | The employee handbook is under “How it works.” Nobody has read it. You should. |
| `Js.start` | Start week 1 |
| `Js.close` | Close |
| `uu[0].title` | First, find a customer |
| `uu[0].body` | Prospect to find leads, qualify them in discovery, demo, propose, then close. A full pipeline is not a full wallet. |
| `uu[1].title` | Your week has five slots |
| `uu[1].body` | Most actions use one slot and energy; conferences use two. Recharge restores energy if you have a slot left. |
| `uu[2].title` | Friday comes for everyone |
| `uu[2].body` | End the week to collect salary, recover some energy and face the office. Rent is due on weeks 1, 5 and 9. |
| `Zn.clockIn` | Clock in |
| `Zn.booting` | Loading corporate objectives… |
| `Zn.skip`, `Zn.sound` | Keep Skip / Sound |
| `st.boot.text.loading` | Loading quota |
| `st.boot.text.error` | ERROR: quota exceeds pipeline. |
| `st.boot.text.week` | Week {week}/13. Welcome to the office. |
| `st.standby.text.prompt` | [ PRESS ANY KEY ] |

Keep CRT, standby and boot sequence, actual skip and keyboard affordances. Version text `SHITCORP OS v4.3` is fictional OS version, not game's release number; may retain it for save-era identity. Do not claim boot checks new variables unless actually true.

## 3. Dashboard surface and helper text
Keep action labels and hotkeys stable. These are functional UI strings, not punchlines. Existing `kp` labels remain (Prospect blitz, Email cadence, Referrals, Discovery, Demo marathon, Proposals, Close deals, Conference run, CRM cleanup, Recharge, Quad shot, Internal politics). Do not relabel proposals as closes. Keep Stage: Lead, Qualified, Demoed, Proposal, Closing. Keep mood labels and names in `Qn` intact (no rename of saved accounts). Retain `J.product/company/rep/title`, `tt` resource labels, `Nu` skills labels, `En` settings and `Un` save toasts; update only as specified below. Preserve keyboard accessibility names. All displayed numbers must be live.

| Key / location | Approved text |
|---|---|
| `J.noDeals` | No open deals. Your phone remains operational. |
| `J.noActivity` | No activity yet. Quota has been assigned. |
| `J.dealsMeta` | {count} open · {pipeline} in pipeline / No open deals |
| `J.oddsSr` / column tooltip | Signing chance, conditional on a close attempt |
| `tt.behind` | {gap} percentage points behind pace |
| `tt.ahead` | {gap} percentage points ahead of pace |
| `tt.onPace` | On pace |
| `tt.reviewsSoon` | Performance reviews from week {week} |
| quota meter new sublabel | Expected by Friday: {target}% of quota |
| `tt.stressDanger` | Dangerous stress level |
| `tt.collections` | Collections at −$1,500 cash |
| `De.idle.start` | No leads. Prospect or ask for referrals. |
| `De.idle.discovery` | {n} {lead/leads} ready for discovery. |
| `De.idle.demo` | {n} qualified {deal/deals} ready for a demo. |
| `De.idle.propose` | {n} demoed {deal/deals} ready for a proposal. |
| `De.idle.close` | {n} {deal/deals} ready for a close attempt. |
| `De.idle.noSlots` | No slots left. End the week. |
| `De.blocked` | Keep exact required/available slots and energy, once-per-week and quarter-over notices. |
| `pr.closeOdds` | Close odds {signed percentage points} · {remaining duration} |
| `pr.discount` | Discount {percent} · {remaining duration} |
| new active-run restart confirmation | Start over? This quarter's unsaved progress will be lost. |
| new ad dismissal confirmation | Dismiss the offer for this run? Minimizing keeps it available. |
| new dangerous Hail Mary confirm | This may save the week or destroy the pipeline. Continue? |
| `Un.saveBlocked` | Could not save. Browser storage is unavailable. |
| `Un.damaged`, `ll` | This saved run could not be opened. Start a new run or return to a valid saved run if available. (Only show actions that actually exist.) |

### Action tooltips — `De` (retain dynamic signatures)
- Prospect: Cold calls. Usually 1–4 new leads; occasionally a fifth. Costs time and energy.
- Cadence: 0–3 warmer leads. A week of emails without calls costs manager approval.
- Referrals: 1–2 introductions, usually small. Each has roughly a 3% chance of being a whale. (Generate from final probability if tuned.)
- Discovery/demo/propose: retain live count and per-deal stage-progression chance; zero: “No eligible deals. You would still spend a slot and energy.” Add training note only if action actually trains skill.
- Close: {n} eligible deals; each has its own signing odds. Failed attempts may lose deals. Zero: “No deals are ready to sign.” If allowed, explicitly state costs still apply.
- Conference: 3–8 warm leads; some are large. Show actual slots, energy, cash, stress. If conversion bonus chance shown, make duration and chance accurate.
- CRM: show actual number of stale/dead leads prunable, manager gain and chance of losing a live opportunity; once per week. “Your manager may remove a live deal while he's in the CRM.”
- Recharge: show exact energy range, stress relief range, one use/week, coffee reduces relief, rare high nap roll approves a trip. Do not imply actual cash paid for trip.
- Quad shot: show shot number, declining energy gain, immediate stress, Friday crash and exact death/ascension risk. If certain: “This shot reaches 100 stress and ends the run.”
- Politics: +8 manager · +3 product · −4 reputation · +2 stress (nominal; dynamic if rules change). “Lunch with leadership.”
- Hail Mary: one close attempt against all proposal/closing deals. Four times in five, each remaining late deal then has a 55% chance to walk. Show cost, danger, and no-eligible state. Use final tuned numbers if changed.
- End Week: keep actual salary, rent if due, energy/stress forecast; add “Friday events and collections may change this.”

## 4. EVERY activity event key — `vv` registry
Implement these as tagged formatter functions. The right column is the main message only; retain/add truthful numeric deltas in separate `dl` or embedded when necessary. For generated plural/time references use actual payload. Non-humorous compact count is important for routine actions. A dash in Notes means preserve baseline metadata. For `week.next` use next week payload and suppress empty entries; §6 defines additional chapter lines.

| Event key | Primary message | Notes / payload |
|---|---|---|
| `act.prospect` | Cold calls: {n} new {lead/leads}. | Variant §5. `n`; retain energy delta. |
| `act.cadence` | Outreach campaign: {n} warm {lead/leads}. | `n`, variant §5. |
| `act.discovery` | Discovery: {n} {deal/deals} qualified. | `n` |
| `act.demo` | Demos: {n} {deal/deals} advanced. | `n` |
| `act.propose` | Proposals sent: {n}. | `n` |
| `act.network` | Referrals: {n} {introduction/introductions}.{suffix} | whale: “ One of them is a whale.” big: “ One of them is substantial.” else blank; keep rep/energy. |
| `act.recharge.already` | You have already used this week's recharge. | — |
| `act.recharge` | Took a break.{napSuffix} | `nap` positive: “ Exceptional nap (+{nap}%).” Keep energy/relief. |
| `act.recharge.flat` | Rested. The coffee has filed an objection. | energy only; no relief. |
| `act.recharge.trip` | Management approved your trip to {trip}. File it under morale. | `trip` |
| `act.crm` | CRM cleanup: {pruned} dead {lead/leads} removed. | `pruned`, `mgr`, variant §5. |
| `act.crm.clean` | No dead leads. Management appreciates the administrative effort. | `mgr` |
| `act.crm.nuked` | Your manager closed out {account}. It was in the way of the dashboard. | `account`, `value` lost pipeline. |
| `act.politics` | Lunch with leadership. You described the roadmap as visionary. Nobody asked which roadmap. | Retain nominal effects or actual deltas. |
| `act.conference` | Conference: {n} new {lead/leads} and a lanyard. | `n`; cost and stress. |
| `act.hail.none` | No late-stage deals to rescue. | — |
| `act.hail.blast` | You emailed every available executive. The subject line contains “FINAL.” | — |
| `act.hail.lean` | You explained your quarter-end situation to people who do not work here. | — |
| `act.hail.chaosWon` | It worked. Leadership will now refer to this as a strategy. | +manager/stress |
| `act.hail.chaosLost` | The emails were delivered. The signatures were not. | −manager/+stress |
| `act.hail.torched` | Management is reviewing your interpretation of urgency. | Preserve penalties; separate actual lost deals are already logged. |
| `act.hail.cooked` | A signature came in. The rest of the forecast is not taking your calls. | Net penalties; alternative if no actual lost deal: “A signature came in. Management disliked the method.” |
| `coffee.shot` | Quad shot #{shot}. Facilities has concerns. | show energy/stress, variant §5. |
| `coffee.crash` | The coffee has begun the collection process. | `stress` |
| `close.none` | {sourceLabel}: no deals ready to sign. | preserve `rf[src]` |
| `close.signed` | {sourceLabel}: {n} signed, {money(won)} closed. Commission: {money(keep)}. | retain `top` metadata, variant §5. |
| `close.nobody` | {sourceLabel}: no signatures. Verbal enthusiasm remains strong. | variant §5. |
| `close.lost` | {n} late-stage {deal/deals} lost · {money(value)}. | `n`, `value` |
| `deal.ghost` | {account} has described silence as its preferred next step. | `account` |
| `deal.lost` | {n} {deal/deals} lost · {money(value)}. | `n`, `value` |
| `ach.unlocked` | Distinction earned: {achievementLabel}. | keep `Aa[key]` |
| `evt.marketing` | Marketing delivered {n} “warm” {lead/leads}. The spreadsheet was color-coded. | `n` |
| `evt.competitor.match` | You matched the discount. Finance requests that you make it up in volume. | effect line final truth |
| `evt.competitor.hold` | You defended value. The margin remains intact, in theory. | effect line final truth |
| `evt.seFumble` | The demo for {account} demonstrated a remarkable amount of potential. | product/stress |
| `evt.seSave` | Your SE answered a technical question at {account} without consulting the roadmap. | product/rep |
| `evt.security.own` | You told the customer what happened. Legal has asked for a copy of the email. | effects per implementation |
| `evt.security.spin` | The incident is now classified as an unexpected learning opportunity. | effects per implementation |
| `evt.outage` | The cloud has encountered a terrestrial problem. | product; lost deals separately logged |
| `evt.champion` | Your champion at {account} got promoted. For once, so did the deal. | rep/manager |
| `evt.caseStudy` | A customer agreed to be quoted. Marketing has entered its Renaissance. | rep/odds |
| `evt.meme` | The product is trending. {n} inbound {lead/leads}; Legal is monitoring the situation. | `n`, rep |
| `evt.freeze` | A budget freeze is rumored. Every CFO is waiting for the other CFOs. | odds |
| `evt.crud` | You brought something back from the conference. It isn't an opportunity. | source currently gates on low energy, not conference attendance; if no known conference, use “Something is circulating around the office. It isn't pipeline.” |
| `evt.rebalance` | Territory optimization: {n} of your largest {deal/deals}, {money(value)}, reassigned. | `n`, `value` |
| `evt.pipShred` | Your PIP has been withdrawn. Management calls this a coaching success. | — |
| `evt.favors` | Your manager made some calls. {n} warm {introduction/introductions}. | `n` |
| `week.fullFunnel` | A balanced week. For once, the funnel resembles a funnel. | +6 pp next week (dynamic) |
| `week.neglected` | Parts of your funnel have been declared a nature reserve. | −6 pp next week |
| `week.stale` | {n} raw {lead/leads} went stale. | `n` |
| `week.backlog` | {n} {lead/leads} cooled off in the demo queue. | `n` |
| `week.next` | See §6 chapter/checkpoint table. | `week` is NEXT playable week. No blank rows. |
| `pay.rent` | Rent paid. Your landlord continues to demonstrate excellent retention. | −actual rent; if cash goes negative “Rent charged.” |
| `pay.salary` | Payroll deposited. | +actual salary |
| `pay.repoWarn` | Finance would like to discuss the jacket. | show actual warning threshold |
| `stress.warn` | Your eye has developed its own KPI. Stress: {stress}. | `stress` |
| `mgr.emails` | “Excellent email campaign. Have you considered the telephone?” | manager penalty |
| `risk.audit` | Your manager has requested a meeting audit. The meeting to discuss it is booked. | show stress if available |
| `risk.hygiene` | Pipeline hygiene review. Please bring the applicable spreadsheets. | — |
| `risk.hr` | HR has accepted your next one-to-one invitation. | — |
| `risk.recurring` | A recurring meeting about your performance has appeared on someone's calendar. | — |
| `qbr.final` | Q{quarter} final: {pct}% of quota. | `quarter`,`pct`; do not round actual threshold across 70/100. |
| `qbr.hit` | QBR: leadership applauds the territory's potential. | — |
| `qbr.pip` | QBR: new developmental milestones, effective immediately. | PIP |
| `qbr.pipUp` | QBR: the milestones now have milestones. | PIP escalation |
| `qbr.macro` | QBR: your manager attributes the miss to macroeconomic headwinds. | only survived |
| `qbr.survive` | QBR: leadership has elected to continue monitoring you. | only survived |
| `qbr.dodged` | The badge still works. You have a new improvement plan. | only survived |
| `qbr.dodgedUp` | You kept your badge. The improvement plan has acquired additional pages. | only survived |
| `qbr.reassigned` | Your manager reassigned {n} {deal/deals} worth {money(value)}. In the interest of continuity. | — |
| `qbr.pipGone` | The improvement plan is no longer necessary. No one explains why. | — |
| `end.club` | President's Club. Your territory has been deemed capable of a higher quota. | terminal |
| `end.missed` | Under quota. Badge access renewed. | terminal |
| `end.fired.qbr` | The QBR has been reclassified as an exit interview. | terminal |
| `end.fired.under70` | Below 70% of quota. HR has prepared the paperwork. | terminal |
| `end.fired.politics` | You hit quota. Leadership has chosen a different direction. | terminal; don't imply performance miss |
| `end.fired.review` | The forecast review turned into a meeting with HR. | terminal |
| `end.fired.org` | An organizational announcement has been made. You are not on the new chart. | terminal |
| `end.meltdown.stress` | Stress reached 100. The employee has stopped responding. | terminal |
| `end.meltdown.weekend` | The weekend was insufficient to restore normal operating conditions. | terminal |
| `end.ascension` | Quad shot #{shot}. Your departure velocity exceeded expectations. | `shot`, terminal |
| `end.repo` | Collections has recovered the jacket. Please remove it from your profile picture. | terminal |
| `ck.install` | clAInk seat activated. The expense has been allocated to you. | `cost` |
| `ck.dismiss` | Sponsored pilot dismissed for this quarter. | — |
| `ck.expired` | clAInk's pilot offer has expired. You have missed an opportunity to be invoiced. | — |
| `ck.cancel` | clAInk seat canceled. Your data will continue its career. | `cost` |
| `ck.invoice` | clAInk invoice: {tokens} tokens, {claims} {outcome/outcomes}.{loopSuffix} | `total` charge, `looped`: “ An agent worked on itself all weekend.” |
| `ck.invoice.idle` | clAInk idle invoice: {tokens} tokens. Nothing was delegated.{loopSuffix} | `total`, `looped` same as above |
| `ck.miracle` | Finance has verified an actual clAInk sale. | — |
| `ck.signed` | clAInk: {n} signed, {money(won)} closed. Commission: {money(keep)}. | retain `top` |
| `ck.run` | clAInk: {n} billable {outcome/outcomes}, {tokens} tokens, $0 closed. | — |
| `ck.strike` | Strike {n}/{of} ({who}): {line} | preserve incident text |
| `ck.strike.hurt` | Strike {n}/{of} ({who}): {line} | preserve red severity |
| `ck.farewell` | clAInk's farewell email cost you {account}. | `mgr` penalty |
| `ck.revoked` | Third strike. Seat revoked. Final true-up: {money(cost)} charged. | `cost`; do not double minus |
| `ck.mgr.warning` | “{managerOpening}” Your manager has issued a writing warning. | `js(miracle)`, `hit` |
| `ck.mgr.circle` | “ChatGDP again? We'll circle back.” | `hit` |
| `ck.mgr.yoink` | Your manager took {account} for a practical lesson in account ownership. | `hit` |

## 5. Variant library — add to `vv` via `hv` selector
Use direct `vv` base row approximately 60% of the time for high-frequency actions, and variants sparingly (e.g. stable hash includes runId/tag/occurrence, editorial-only; avoid consecutive duplicate). Preserve payload interpolation, effect lines and outcome truth. If exact weights are costly, use existing deterministic arrays and include base multiple times, with explicit nonrepeat check based on resolved text. Use chapter context only where marked. Do not add an activity line for each variant; choose one.

| Event / condition | Alternate text A | Alternate text B |
|---|---|---|
| `act.prospect`, n>0 | The telephone remains operational. {n} new {lead/leads}. | You reached {n} potential {customer/customers}. Management will call this momentum. (Avoid if actual count is leads but not conversations; use “Found”.) |
| `act.cadence`, n=0 | Outreach campaign delivered enthusiasm to the Internet. No leads. | A well-formatted email campaign. No responses that became leads. |
| `act.cadence`, n>0 | Personalized at scale. {n} warm {lead/leads}. | The inbox produced {n} warm {lead/leads}. |
| `act.discovery`, n=0 | Discovery: needs identified, no deals qualified. (Only if actual needs tracked; otherwise “No deals qualified.”) | Discovery: everyone would like to learn a little more. No deals qualified. |
| `act.demo`, n=0 | Demos: the product was discussed. No deals advanced. | The roadmap remains promising. No demos advanced. |
| `act.propose`, n=0 | No proposals sent. The pricing spreadsheet survives another day. | Proposals: no deals advanced. |
| `act.crm`, pruned>0 | RevOps has improved the denominator. {pruned} dead {lead/leads} removed. | Pipeline hygiene: {pruned} dead {lead/leads} deleted in the name of transparency. |
| `act.politics` | Leadership lunch. You agreed with the last person who spoke. | You asked a strategic question and received three slide decks. |
| `act.conference` | {n} leads and a tote bag from a company with better branding. | A full day of networking. {n} leads. |
| `coffee.shot`, shot=1 | Quad shot #1. Return to your workstation. | Coffee: the official beverage of individual contributors. |
| `coffee.shot`, shot=2 | Quad shot #2. A bold interpretation of work-life balance. | Quad shot #2. You have typed the password correctly on the fourth try. |
| `coffee.shot`, shot>=3, nonterminal | Quad shot #{shot}. Your desk is now an experimental facility. | Quad shot #{shot}. The office first-aid kit has been relocated to your vicinity. |
| `close.nobody`, weeks 1–3 | {sourceLabel}: no signatures. We're still building relationships. | {sourceLabel}: the buyers are aligned in principle. No signatures. |
| `close.nobody`, weeks 4–6 | {sourceLabel}: everybody is aligned, except on signing. | {sourceLabel}: no signatures. Next steps have next steps. |
| `close.nobody`, weeks 7–9 | {sourceLabel}: no signatures. The forecast call will be interesting. | {sourceLabel}: still waiting on paper. |
| `close.nobody`, weeks 10–13 | {sourceLabel}: no signatures. Leadership is requesting visibility. | {sourceLabel}: no signatures. Time has become a negotiation point. |
| `close.signed`, n>0 | {sourceLabel}: Finance has accepted {n} actual {contract/contracts}. {money(won)} closed; {money(keep)} commission. | {sourceLabel}: {n} signed. {money(won)} is no longer a hypothetical. Commission {money(keep)}. |
| `deal.ghost` | {account} has moved to a highly asynchronous communication model. | {account} is pursuing a strategic silence initiative. |
| `pay.salary` | Salary deposited. HR has confirmed your continued existence. | Payroll cleared. |

If a variant's setup implies untracked customer behavior, keep it as obvious institutional satire or use the safe base. No made-up specific dial counts. If planned tooltip indicates 0 eligible deals, use a precise zero result rather than joke implying an attempt on an actual account. Do not emit a new random mechanical draw.

## 6. Quarter chapters and managerial context
`mv` phase selection: 1–3, 4–6, 7–9, 10–12, 13. Add short chapter header near week indicator **only if space permits**, otherwise chapter log/PA alone. Use actual next week, not old state week; opening on week 1 via onboarding, other chapter transitions through `week.next`; no extra modal. Preserve important explicit review warnings at weeks 5 and 6. For intermediate weeks no blank event. Keep PA mapping for 5/7/12/13. New chapter line is separate from numerical mechanics, not an assertion about actual quota.

| Entering week | Optional header | Approved log / memo line |
|---|---|---|
| 1 | The Honeymoon | Management confirms this is a growth territory. It does not specify what is growing. |
| 4 | Alignment | Leadership would like increased visibility into pipeline. Visibility is outperforming pipeline. |
| 5 | Alignment | Performance reviews begin this week. Please ensure your forecast is visible. |
| 6 | Alignment | Behind-pace reviews can now result in termination. HR has cleared its calendar. |
| 7 | The Reckoning | Your forecast has been circulated among increasingly senior people. |
| 10 | The Siege | Nonessential meetings have been replaced with essential meetings about the quarter. |
| 12 | The Siege | Management would like next week's revenue to arrive this week. |
| 13 | Judgment Day | Final week. QBR on Friday. There will be no further forecasts. |

Manager context cue (optional variant in existing log only; never new effect): manager >=75: “I told leadership you were a builder.”; manager <35: “Let's make sure we are aligned on expectations.”; late, behind: “Can we pull this forward?”; late, ahead: “What else is in the territory?” Use only where a manager message already fires, with clear mechanical payload.

## 7. Modal decisions — `av` (option IDs unchanged)
### `evt:competitor`
**Title:** Pricing alignment initiative  
**Body:** Scheisskorp has cut prices by 25%. Management reminds you that customers buy value, then forwards a discount authorization form.  
`match` label: Match with 20% discount  
`match` effect: +12 percentage points signing odds; 20% off eligible sales this week.  
`hold` label: Defend our value  
`hold` effect: −8 percentage points signing odds this week; +4 reputation.  
Source competitor text says rival 25%, our match 20%; preserve difference, not “match 25%” or incorrectly claim rival 20%. Use final config if tuned.

### `evt:security`
**Title:** Customer incident — internal statement  
**Body:** A customer has been breached. Legal has drafted two descriptions of the same event. Choose the one you intend to send.  
`own`: Disclose the incident. Effect: +6 reputation, −18 product, −15 pp odds for 2 weeks; each deal at Demoed or later has a 30% chance to walk.  
`spin`: Issue a carefully worded statement. Effect: −8 reputation, −12 product, −8 pp odds this week; each deal at Demoed or later has a 15% chance to walk.  
Keep accurate penalties, probabilities, choices and mechanics. Render effect notes at readable width. Never bury numeric consequence in satire.

### `ck:warning`
**Title:** Writing development opportunity  
**Body (miracle):** “Nice week. ChatGDP do that? Enjoy it. I'd like you to develop your own written communication skills before I start intervening in your deals.”  
**Body (failure):** “Always on ChatGDP, huh? That's not writing. Improve your written communication skills, or I'll start intervening in your deals.”  
`ack`: Noted, boss.

### `ck:lesson`
**Title:** Practical coaching session  
**Body:** “I'll take {account} from here. Watch how I handle the account. We'll work on your writing next time.”  
`ack`: Thanks, boss.

## 8. Shitcorp internal handbook — `fv` (rules must remain factual)
Use dynamic parameters for tunable constants. This is authoritative help, not a place for ambiguous jokes. Sections retained; below replace term/body rows by semantic key. For changed engine, derive exact numerical timing from implemented configuration.

**The quarter**
- The goal. Close {quota} in 13 weeks. At QBR, 100% earns President's Club unless rare politics intervene. At 80–99% you retain your job, potentially on a PIP. At 70–79%, survival is conditional on the review; below 70% you are out. (If engine changes thresholds, regenerate.)
- A week. Five slots and a separate energy budget. Most actions cost one slot; conferences cost two. Recharge and coffee can restore energy with a slot left. End Week advances the quarter.
- Closed (Q). Closed revenue, net of clawbacks, not pipeline. Expectations rise throughout the quarter. Reviews start in week 5; dismissal risk starts in week 6. Healthy pipeline can soften early reviews but is not guaranteed revenue.
- Cash. {salary} salary on Friday; {commissionPct}% commission on closed sales; rent {rent} weeks 1, 5 and 9. Collections take the jacket when cash reaches {repoThreshold} or lower.

**The funnel**
- Pipeline. Total value of live deals. Move leads through discovery, demo, proposal and a signing attempt. Proposal/Closing deals are eligible for signing; mood, stats and modifiers affect odds. Late-stage deals can walk.
- Full-funnel week. Work at least three of four categories (lead generation, discovery, demo, proposal/close) for +6 pp signing odds next week. One or none while holding pipeline gives −6 pp next week.
- Skills. Improve matching action and contribute to close odds where applicable. Some unsuccessful actions still develop skill.
- Reputation. Influences deal sizes and close odds.
- Product. Affects demo and close success. Outages and incidents can lower it.
- Hail Mary. One desperate signing attempt. Four times in five each remaining late-stage deal has a 55% chance to walk. Manager, reputation and stress can suffer. (Dynamic final numbers.)

**You**
- Energy. Actions cost energy. Recover {FridayEnergy} on Friday.
- Recharge. Once per week for one slot: {energyRange} energy and {reliefRange} stress relief, capped by actual meters. A lucky nap may approve a trip. Coffee reduces relief.
- Stress. High stress lowers close odds. At 80+ you risk a weekend meltdown; at 100 the run ends immediately (coffee can produce a different ending).
- Quad shot. Costs cash and a slot, gives immediate energy and stress. Later shots give less energy and more stress; the third and later may cause ascension. Reaching 100 stress via coffee ends the run. Every shot adds {crash} stress on Friday. Use live tooltip for odds.

**The office**
- Manager. Approval influences close odds and firing. Email-only weeks cost approval.
- CRM cleanup. Once a week, prune dead leads and gain manager approval; pause warning escalation and reduce dismissal risk for this week's review. Your manager may delete a live deal.
- clAInk. Optional in-game AI pilot, offered through week {offerWeek}. Dismissing the offer removes it for this run. Pay {seat} upfront, deploy once per eligible week with zero slots/energy, pay usage on Friday. A {successPct}% chance of genuine revenue per run; every $0 run earns a strike. Idle weeks still bill. Third strike revokes the seat, may cost a live deal, and charges a true-up based on cash plus {trueUpRange}. Cancel early for {cancelFee} plus any due charges if affordable. Week 13 is frozen. Your manager may intervene. Use actual configuration for numbers and warning thresholds.

**Keyboard**
- Keys. List actual hotkeys from source, including exact number row mapping and how extra actions beyond available numeric keys work. E ends week, H Hail Mary, M mute, ? handbook, only if confirmed. Keep actions usable without hotkeys. Do not say every key maps to all twelve actions if it doesn't.

## 9. Public address and audio — `uo`, `nl`, `Xo`
Use short lines, ideally <=12 words; cadence of indifferent recorded announcements, not a stand-up routine. Existing `nl` HR voices remain serious, not mocking a person who lost their job. Use same keys for audio routing. Add alternate arrays only where scheduler supports; ensure captions are the actual selected line. Retain `Xo.pa/HR` attribution. Rare high-priority announcements can interrupt filler; do not layer speech. No copyrighted dialogue samples. Retain pronunciation alias ChatGDP/clAInk if present.

| `uo` key | Approved line(s), one per speech |
|---|---|
| boot | Quota assigned. Good morning. / Corporate objectives loaded. |
| newrun | New quarter. Same expectations. |
| welcome | Welcome to Shitcorp. Your badge is ready. |
| club | President's Club. Please retain your boarding pass. |
| fired, firedOrg, firedReview (`nl`) | As of today, your position with Shitcorp has ended. / Thank you for joining us. Today is your last day. / We've reviewed the situation and are ending your employment. |
| burnout | Containment failed. Evacuate the pod. |
| burnoutCaffeine | Employee has left designated airspace. |
| missed | Badge access renewed. Forecast call, Monday. |
| repo | Jacket owner, please report to Collections. |
| week5 | Performance reviews are now in session. |
| week7 | The forecast has been distributed to leadership. |
| week12 | One week remaining. Please accelerate time. |
| week13 | Final week. Commit means commit. |
| filler | Pipeline is not revenue. / Mandatory fun begins at four. / The CRM is the source of truth. / Lunch and learn. Lunch not provided. / Hydration is not a substitute for productivity. / Check your forecast before checking the leaderboard. / Please reply only to the sender. / Conference room B requires a reservation. / Fridge cleanout Friday. Pipeline too. / Your calendar has been optimized. / The printer is not an escalation path. / Please do not expense the motivational posters. / Today's wellness webinar has been rescheduled. / Closed Won requires a signature. |
| hr | Human Resources has joined the meeting. |
| meetings | Please log all meetings, including meetings about meetings. |
| hygiene | Pipeline hygiene is everyone's responsibility. |
| whale | Large opportunity detected. Please inform your manager. |
| bigClose | Large sale verified. Ring something. |
| sqlStorm | Marketing leads delivered. Qualification remains your responsibility. |
| viral | We are trending. Legal has been notified. |
| outage | The cloud is experiencing ground-level difficulties. |
| freeze | Budget freeze reported. Please remain commercially optimistic. |
| rebalance | Territory realignment has been completed. |
| cash | Finance would like a word. |
| phones | The telephone system is fully operational. |
| competitor | Pricing alert. Please consult the approval matrix. |
| incident | Security incident. Refer all inquiries to Legal. |
| hydrate | Wellness reminder. Water is available. |
| closeOut | Close that out, please. |
| claink | Finance has verified agent-generated revenue. |
| sev1 | Severity one incident. The agent is involved. |
| strike | Governance Council, conference room B. / Strike recorded. |
| clainkRevoked | Your agents have been offboarded. |
| chatgdp | Always on Chat GDP, huh? |
| yoink | Manager taking over the account. Observe. |
| repoClaink | Collections thanks you for your digital transformation. |

## 10. clAInk editorial pack — complete surface mapping
### Advertising, confirmation and workspace (`we`, `vn`, `Xn`, `Tr`, `ue`)
This interface is deliberately glossy, self-important and contemporary. The rest of Shitcorp must not suddenly speak this way. Use existing ad/policy structure. Optional proof chips are fictional marketing claims, not gameplay effects; label as in-universe marketing and never display a fabricated player stat.

| Key | Approved text |
|---|---|
| `we.sponsored` | Sponsored · Enterprise pilot |
| `we.announce` | New: / Autonomous Revenue Orchestration / is GA |
| `we.headline` | What if your pipeline could pipeline itself? |
| `we.sub` | Meet the autonomous revenue orchestration ecosystem. Deploy a team of agents to research accounts, personalize outreach and advance your pipeline while you're busy doing sales. |
| `we.chips` | Account intelligence / Outreach at scale / Autonomous pipeline |
| `we.proof` | “We have fundamentally transformed how we measure productivity.” |
| `we.proofBy` | VP, Revenue Transformation · fictional enterprise customer |
| `we.price` | Outcome-based pricing. / Pay for outcomes and the compute required to deliver them. |
| `we.badges` | SOC 2 Type II / SSO / Human oversight (optional) |
| `we.activate` | Begin your transformation · {seatCost} |
| `we.declined` | Activation unavailable · insufficient cash |
| `we.policyTitle` | Shitcorp AI Acceptable Use Policy |
| `we.policyVersion` | v3 (final) (2) |
| `we.policy[0]` | Seat and usage charges are deducted from your cash. |
| `we.policy[1]` | Every run without closed revenue earns an AI Governance Council strike. |
| `we.policy[2]` | Strike {n}: seat revoked, final token true-up charged. A live deal may also be lost. |
| `we.fine` | Usage is billed on Fridays, even while idle. Pilot results: 1 in 5 runs closed real revenue. The other 4 delivered billable outcomes. Offer ends after week {offerWeek}. (Use actual chance.) |
| `we.accept`, `we.notNow` | Accept · {seatCost} / Not now |
| `we.closeTitle` / `closeLabel` | Dismiss pilot for this run (cannot undo) |
| `vn` strike counters/tips | Keep current exact count, threshold, projected cash range and collections warning. Replace “a deal walks” with “a live deal may walk” if pipeline can be empty. |
| `Xn.welcome` | Digital transformation initiated |
| `Xn.working` | Agents orchestrating… |
| `Xn.worked` | Revenue verified |
| `Xn.delivered` | Run {run} · Outcomes delivered |
| `Xn.closed` | Closed +{revenue} · verified by Finance |
| `Xn.closedNone` | Closed: $0 |
| `Xn.tokens`, `Xn.skip` | Keep actual token count and skip guidance. |
| `Tr.sunset` | The AI Governance Council has ended your pilot. All outstanding compute has been allocated to the seat owner. |
| `Tr.farewell` | Its farewell email to {account}: “We've decided to pursue other opportunities.” They agreed. |
| `Tr.cancelled` | Seat canceled |
| `Tr.data` | Your data will remain with clAInk to support future transformations. |
| `Tr.statsRevoked/statsCancelled` | Keep actual token count, influenced pipeline (label cumulative claimed influence), closed revenue and charged-back totals. |
| `ue.status.frozen`, `ue.run.frozen` | Quarter-end freeze · no deployments / Quarter-end freeze |
| `ue.status.ran` | Agents ran this week |
| `ue.status.idle` | Agents idle · awaiting delegation |
| `ue.status.revoked` | Seat revoked |
| `ue.status.running` | Agents orchestrating… |
| `ue.run.go` | Run agents |
| `ue.runNote.go` | 0 energy · 0 slots · billed Friday |
| `ue.runNote.last` | Last eligible run this quarter |
| `ue.runNote.frozen` | No runs in week 13 |
| `ue.runNote.next` | Next run: next week |
| `ue.usageFrozen` | Quarter-end freeze: no new charges. Total charged back {billed}. |
| `ue.usageRan` | Estimated this week: {due} ({tokens} tokens), billed Friday; overages possible. Charged back so far {billed}. |
| `ue.usageIdle` | Idle weeks still bill {lo}–{hi}, plus possible overages. Charged back so far {billed}. |
| `ue.cancelCost` | Early termination: {total} ({fee} fee + usage already due). |
| `ue.cancelOffer` | Before you go: Enterprise Plus claims 21% success. Just $4,999 a week. (Fictional upsell; no actual purchase action or game change.) |
| `ue.keep`, `ue.cancelPay`, `ue.cancelBroke` | Keep agents / Pay {total} and cancel / Insufficient cash to cancel safely |
| `ue` accessibility control labels | Keep Expand/Minimize/Close/Cancel seat and meaningful labels; no jokes in these controls. |

Optional tiny marketing footnote: “Activity generation guaranteed. Revenue generation not guaranteed. Activity generation billable.” Use only if it fits without increasing obstruction. Do not use percentages such as “340% more activities” as measured game stats; omit decorative metric cards by default.

### Agent output variants — `ov` (replace array; retain RNG signatures `accountPicker, integerPicker`)
These are billed **fictional reports**, not additional mechanic effects. Use existing flavor RNG for numbers only. Preserve report line count and billing aggregation. Dynamic accounts may be fictional sample names; mark report as agent-claimed. If a joke has named activity, it is an agent claim, not canonical action. 
1. Drafted {randInt(900,1900), formatted} personalized emails. Sent 0.
2. Booked {randInt(2,5)} meetings with other agents.
3. Summarized {randInt(120,260)} calls, then summarized the summaries.
4. Enriched {randInt(6,12)},000 CRM fields with “Unknown.”
5. Built a {randInt(38,64)}-slide account plan for {accountPicker()}.
6. Held a standup about the standup.
7. Wrote {accountPicker()} a haiku. Unprompted.
8. Scored {randInt(400,900)} leads. All “medium.”
9. Researched {accountPicker()}. Located its homepage.
10. Generated {randInt(24,60)} insights about generating insights.
11. Translated your signature into {randInt(9,14)} languages.
12. Convened {randInt(300,900)} sub-agents to agree on tone.
13. Opened {randInt(9,19)} tickets about its own tickets.
14. Followed up on its own follow-up. Twice.
15. Marked {accountPicker()} Closed Won. Finance disagrees.
16. Updated {accountPicker()}'s close date to “soon.”
17. Rescheduled your one-to-one to make room for a one-to-one.
18. Debated “Hi” versus “Hey” for {randInt(2,4)}.{randInt(1,9)}M tokens. (Agent claim, not additional invoice.)
19. Flagged zero risks. Confidence: 99%.
20. Promoted itself to Senior Agent after a self-conducted performance review.
21. Created a Slack channel to investigate excessive Slack channels.
22. Escalated a customer complaint to the customer.
23. Published a report on the decline in report consumption.
24. Prepared a 90-day action plan during the final week. (Agent claim, not runtime timing.)
25. Generated a value proposition for value proposition generation.
26. Mapped the buying committee. The committee is three agents.
27. Identified personalization as a strategic opportunity. Addressed an email to [FIRST_NAME].
28. Optimized your calendar. Removed the only unscheduled half hour.
29. Created an executive summary of an executive summary.
30. Assigned itself a mentor. The mentor is another instance of itself.

### Harmless strikes — `iv` (replace existing 8 report entries and add 4 variants)
Each entry `{who, why, line}`. The short `line` goes to activity/recap; `why` goes on strike card. These are *no added damage* branch, though a strike itself is real. `tokens` uses existing formatted token parameter. `n` for optional reports uses flavor picker. No implied actual stolen deal or charge beyond existing invoice.

| who | why | line |
|---|---|---|
| Finance | {tokens} tokens. $0 closed. Please identify which of the delivered outcomes is money. | {tokens} tokens, $0 closed. Explain. |
| IT Security | Your agent requested administrator access to the CEO's inbox {randInt(900,4000),formatted} times. | Repeated requests for CEO inbox access. |
| RevOps | It built a dashboard that tracks its other dashboards. It's now our most-viewed report. | Dashboard of dashboards. |
| Procurement | Your agent attempted to purchase another seat. For itself. On your card. | Attempted to purchase itself a seat. |
| HR | Your agent nominated itself for Rep of the Month. It is leading the poll. | Self-nominated Rep of the Month. |
| Facilities | Your agents reserved every conference room for alignment. | Every room reserved. No attendees. |
| the CRO's office | Your agent scheduled a daily recurring meeting called “Sync on synergies.” | Daily synergy sync with the CRO. |
| Legal | Your agent wrote {randInt(9,16)} disclaimers and appended them to your signature. | Self-authored legal disclaimers. |
| Finance | The invoice lists 14 efficiencies. This department does not accept efficiencies as payment. | Invoice contains efficiencies, not revenue. |
| RevOps | Your agent has increased forecast accuracy by changing the definition of accurate. | Redefined forecast accuracy. |
| Customer Success | Your agent marked its own satisfaction survey as completed. | Agent satisfied with its own service. |
| People & Culture | The agent has asked about a compensation review and a standing desk. | Requested a compensation review. |

### Harmful strikes — `Ws` (exact real incidents; keep `fx` with actual deltas)
- **slop / Marketing Ops**, account present: `why`: “Your agent sent {account} {k} quick follow-ups in an hour. They blocked our domain. clAInk Customer Success describes this as an isolated incident.” `line`: “{k} follow-ups. {account} walked.” Account null: `why`: “Your agent sent {k} follow-ups to an empty CRM. Our domain was blocklisted anyway.” `line`: “{k} emails to nobody. Domain blocklisted.” Preserve actual rep/manager effects and conditional lost account.
- **discount / Legal**: `why`: “Your negotiation agent offered {account} a {cut}% discount to accelerate the outcome. The offer was made in writing. Legal has requested a copy.” `line`: “Offered {account} {cut}% off. In writing.” Preserve actual value reduction, rep/manager hit.
- **leak / IT Security**: `why`: “Your agent shared context with a partner agent. The partner agent works for Scheisskorp. Legal is not currently accepting questions.” `line`: “Shared {n} {deal/deals} ({money(value)}) with Scheisskorp.” Preserve actual loss and penalties.
- **churn / Customer Success**: `why`: “Your agent upgraded {account} to triple the price to drive outcomes. The customer declined the outcome and churned.” `line`: “{account} upgraded to 3×, then churned.” Preserve actual net closed clawback `{amt}` and commission `{back}`. Current source may use fictional account names for illustrative churn; if no real closed account history is tracked, do not identify churned account as verified. Use “A customer” for both fields in that case, while still reporting actual financial loss.
- **revocation / `_r`**: `why`: “The AI Governance Council has revoked your seat, effective immediately. In accordance with the Acceptable Use Policy, Finance will now reconcile outstanding compute.” `line`: “Seat revoked. Final true-up: {money(cost)} charged.” `fx`: existing actual token figure and manager penalty, dynamic. `announce`: actual strike #/threshold and true-up amount; conditional farewell if actual deal lost. `Us.plainStrike`: “A run closed $0.”

### Success, state and report mechanics strings
- `sv` four clear variants: “No strike. Finance checked it twice.” / “No strike. The Council has asked for supporting documentation.” / “No strike. Legal is reading it anyway.” / “No strike. Revenue verified independently of clAInk.”
- `Xd.lines`: “Seat activated. Agents provisioned.” / “Alignment workshop: completed by agents.”; announce: “clAInk seat activated.”
- `Jd.lines`: “Seat canceled. Customer intent successfully detected.”; announce: “Seat canceled. Paid {cost}.” (Cancellation joke not an extra fee.)
- `Zd.touched`: AI-assisted; `Zd.discount`: agent-promised discount. Preserve keys if relied on by filters.
- `Ia.signed`: Signed {account} · {value}{existing new-logo/upsold suffix}; `Ia.moved`: Advanced {n} {deal/deals} one stage; `Ia.announce`: “Finance verified {n} signed for {value}. No strike.”
- `Fs.influenced`: “Claimed influence over {pipeline} in pipeline” / “Claimed influence over $0 in pipeline.”; `Fs.more`: “{n−3} more outcome(s), also billed” (preserve `lv` matcher or structured type); `Fs.announce`: exact count, tokens, zero closed; `Fs.strikeAnnounce`: exact strike metadata.
- `js`: miracle “Nice week. ChatGDP do that?”; failure “Always on ChatGDP, huh?”; `tf`: “Improve your written communication skills, or management will start intervening in your deals.”
- `Oo.warnPing`, `warnSay`: manager opening + writing warning; `circlePing`: “ChatGDP again? We'll circle back.”; `circleSay`: “Your manager will circle back.”; `yoinkPing`: “I'll take {account} from here. Watch and learn.”; `yoinkSay`: “Your manager took {account}.” These must match modal and actual event. Keep male manager voice and caption only if already present; no new TTS dependency.

## 11. Endings — `st`, `nv`, `rv`, `ht`
Preserve six original ASCII cutscenes, existing replay/skip, terminal cause, accessible summary and personalized data. Scene strings constrained by the ASCII layout can retain originals if new line doesn't fit; corporate verdict goes on end card independent of visual width. Never show quota victory if fired, repo or meltdown is terminal instead. Numbers are net earned and actual.

| Ending key | `st.a` two short lines | `st.b` two short lines | Corporate verdict (new postgame line) |
|---|---|---|---|
| club | Jacket secured. / Revenue verified. | Next quarter: / Higher quota. | Congratulations on demonstrating that your territory can support a higher quota. |
| fired | Badge deactivated. / Please return equipment. | New org chart. / Your quota lives on. | Your position has been eliminated. Your quota has not. |
| missed | Quota missed. / Badge still works. | QBR adjourned. / Back on Monday. | Your performance has been deemed sufficient to justify another performance review. |
| meltdown | Core temp: quota. / Containment failed. | Stop code: / SOUL_NOT_FOUND | People & Culture has scheduled a webinar on resilience. Attendance is mandatory. |
| repo | Jacket financed. / Payments missed. | Collections: / Asset recovered. | The jacket has been returned to the appropriate cost center. |
| ascension | Shot #{actual shot} (or “One shot too many.”) / Orbit achieved. | Out of office. / Beyond the office. | Your departure velocity exceeded all performance expectations. |

`nv` ending modal body:
- club: “Closed {closed}. Your ticket to Cabo has been approved.”
- fired: “Closed {closed}. Your badge access has been terminated.” (Optional cause-specific one-line secondary note: performance review, below threshold, politics despite hit, org announcement, as actually tagged.)
- missed: “Closed {closed}. Your badge still works. Back to the phones.”
- meltdown: “Closed {closed}. Normal operations have ceased.”
- repo regular: “Cash reached {cash}. Collections recovered the jacket.” / clAInk cause: “Cash reached {cash}. clAInk has delivered its final outcome: Collections.”
- ascension: “Closed {closed}. You are no longer within the building's jurisdiction.”

Existing `ht` recap labels: Keep Week, Closed, % quota, Cash, Deals signed, Largest deal, Quad shots, Discounts given, Left in pipeline, clAInk and associated numbers. Use “For the record” heading. If cumulative signed includes clawed-back revenue, label count as historical. Distinguish claimed influenced pipeline and net closed. Use only known values from old saves.

### `rv` story cards (preserve actual trigger, condition and priority in `Yd`)
| key / branch | Approved text |
|---|---|
| trip.club | Your {trip} trip was approved. So was Cabo. |
| trip.missed | Your {trip} trip remains approved. Please be reachable. |
| trip.fired | Your {trip} trip was approved. So was your offboarding. |
| trip.repo | Your {trip} trip remains approved. Your card does not. |
| trip.meltdown | Your {trip} trip may require a different kind of leave form. |
| trip.ascension | Your {trip} trip is unnecessary. You can see it from here. |
| top.club | Largest sale: {account}, {value}. Management has prepared a slide. |
| top.missed | Largest sale: {account}, {value}. It was not enough. |
| top.fired | Largest sale: {account}, {value}. Account continuity will be discussed without you. |
| top.repo | Largest sale: {account}, {value}. Finance would like to discuss your commission. |
| top.meltdown | Largest sale: {account}, {value}. Your out-of-office reply is active. |
| top.ascension | Largest sale: {account}, {value}. You're traveling. |
| none | No deals signed. An unusually clean commission statement. |
| took | Your manager took {took}. You received a coaching opportunity. (Do not claim actually closed.) |
| revoked | clAInk was revoked after strike 3. It remains confident about renewal. |
| strikes | clAInk received {strikes} {strike/strikes}. The Council remembers. |
| billed | clAInk billed {billed}. Thank you for the transformation. |
| shots.ascension | {shots} {quad shot/quad shots}. Facilities unplugged the machine. |
| shots.other | {shots} {quad shot/quad shots}. Facilities is reviewing its supply contract. |
| hails | {hails} {Hail Mary/Hail Marys}. Legal would like the emails. |
| lunches | {lunches} {lunch/lunches} with leadership. You have been described as visible. |
| cadences | {cadences} email {cadence/cadences}. An impressive volume of correspondence. |
| lost | {lost} {deal/deals} lost. RevOps calls it hygiene. (Use “documented deals lost” if stat only tracks certain tags.) |

### Optional cosmetic distinctions (new conditional recap, not permanent achievements)
Each requires actual state tracked in implementation brief. Do not infer from prose, do not alter ending. Hide unknown legacy values. Order: terminal-specific, risk-specific, then humorous; maximum 3 per screen. Existing Whale hunter unlock remains unchanged unless explicitly retuned; its current trigger is $65k aggregate in one manual close push, so describe that truthfully.

| Title | Actual condition | Subtitle |
|---|---|---|
| Expense Account Patriot | >=3 conference actions | A committed supporter of the branded tote-bag economy. |
| Vice President of Optics | Manager exactly 100; final net attainment <100% | Leadership was delighted. Finance was not. |
| Digital Transformation | clAInk billed exceeds gross attributable genuine agent sales commission, with known totals; active pilot installed | The project exceeded its activity objectives. |
| A Natural Leader | Manager actually took the largest remaining live deal at that moment | Demonstrated exceptional ability to delegate upward. |
| The American Dream | Repossession ending, net attainment >=100% when possible | Quota achieved. Asset recovered. |
| The Right Stuff | Ascension ending | Exceeded the office's certified flight envelope. |
| Whale hunter (existing) | Existing unlock | Closed at least $65,000 in a single qualifying close push. |

## 12. Art microcopy and decorative details
Optional tiny original vignettes only where they don't obstruct the game. No extra screen, no sticker clutter, no random real brand references. Existing poster “WE'RE A FAMILY* / *at-will” and “QUOTA IS A MINDSET.” are strong; keep them. Alternate original posters: “ONE TEAM. ONE NUMBER.* / *individual accountability applies”; “ALIGNMENT BEGINS WITH YOU”; “DO MORE WITH VISIBILITY”; “WE VALUE YOUR TIME / 4:30 FRIDAY”. Boot and scene terminal visual copy must fit existing character grid. Add rare event illustration without words if possible; accessibility summary should describe meaningful content elsewhere, not read decorative detail. Preserve the game's fictional ASCII language and jacket iconography.

## 13. Sign-off and integration checks
- `vv` all baseline keys mapped (including bad/rare/AI tags); do not rename tags used by `cp`, `hp`, `gv`, `Mw`, ending causes or saved state.
- `av` all choice modals covered, including manager acknowledgment.
- `st`, `nv`, `rv`, `ht`, boot, onboarding, rules, dashboard, ads, workspace, strikes, outcomes and `uo` speech surfaces covered; generic controls and most account names intentionally retained.
- Keep exact placeholders, artifacts of removed fields handled explicitly, actual values and dynamic effects, grammar with zero/one/many. For new numerical tuning, update tooltip/handbook/effect line together; do not hardcode stale copy.
- Test with every event and every ending, no unresolved template tokens. Print copy-key coverage and list intentionally retained items. Any joke needing untracked events uses safe alternative or is skipped and reported. Do not claim that every possible generated free-text path was exhaustively tested unless it was.

**Final editorial note:** The joke should be that the company talks like this. Never that the player is foolish for trying to make a living.
