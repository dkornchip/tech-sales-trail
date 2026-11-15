#!/bin/bash
# The pictures for the before-and-after pairs of 2.1.1: the same states, the same sizes, one build at a time.
#   qa/2.1.1/tools/pairs.sh <before|after> <release.html> <test.html> <out dir> <repo root>
# <test.html> is a test build of the same version (scripted dice), for the one picture that needs a deal to sign.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
WHEN=$1; REL=$2; TEST=$3; OUT=$4; ROOT=$5
mkdir -p "$OUT"; cd "$ROOT"
G=test/saves/fixtures/generated
shot() { local name=$1; shift; node test/e2e/tools/shot.cjs --build "$REL" --out "$OUT/$name-$WHEN.jpg" "$@" > /dev/null 2>&1 || echo "FAILED $name-$WHEN"; }
MID='{"week":6,"cash":900,"energy":80,"closedQuarter":30000,"closedWon":30000,"deals":[[3,42000,"happy"],[2,14000,"curious"],[0,6000]]}'
shot 01-cards-nothing-to-work-on --state '{"week":2,"cash":3000}' --size 1366x768 --clip .left --scale 1.5
shot 02-short-window-1366x657 --state "$MID" --size 1366x657
shot 03-short-window-1280x720 --state "$MID" --size 1280x720
shot 04-two-line-hint --state "$MID" --size 1366x768 --clip .left --scale 1.5 --do 'hover:[data-ui="hail"]'
shot 05-press-that-ends-the-run --state '{"week":8,"cash":2000,"energy":60,"stress":98,"deals":[[0,6000]]}' --size 1366x768 --clip .left --scale 1.5 --do 'hover:[data-act="prospect"]'
shot 06-rent-would-trigger-collections --state '{"week":9,"cash":-950,"energy":70,"stress":40,"deals":[[0,6000]]}' --size 1366x768 --clip .left --scale 1.5 --do 'hover:[data-ui="end"]'
shot 07-stat-cards --state '{"week":6,"cash":900,"energy":80,"closedQuarter":6342,"closedWon":6342}' --size 1366x768 --clip .kpis --scale 2
shot 08-stat-cards-at-quota --state '{"week":11,"cash":9000,"closedQuarter":170000,"closedWon":170000}' --size 1366x768 --clip .kpis --scale 2
shot 09-claink-policy --save $G/ck-ad-week-3.json --size 1366x768 --clip .claink-ad --scale 2 --do click:.claink-cta
shot 10-log-chips --state '{"week":3,"cash":3000}' --size 1280x720 --clip .activity --scale 1.5 --do 'click:[data-act="politics"]'
shot 11-handbook --state "$MID" --size 1440x900 --do 'click:[data-ui="rules"]' wait:400
shot 12-reduced-motion-change-chip --state '{"week":3,"cash":3000,"energy":40}' --size 1366x768 --clip .kpis --scale 2 --reduced --do 'click:[data-act="recharge"]'
shot 13-cash-below-zero --state '{"week":6,"cash":-200,"energy":80}' --size 1366x768 --clip .kpis --scale 2
shot 14-phone-first-screen --state '{"week":2,"cash":3000}' --size 390x844 --touch --scale 2 --full
# a signed $42,000 deal, 0.7 s after the press (scripted dice: the test build)
node "$HERE/frames.cjs" "$TEST" "$OUT/.feel-$WHEN" close42 "$MID" '[data-act="close"]' 0 > /dev/null 2>&1 || echo "FAILED feel-$WHEN"
cp "$OUT/.feel-$WHEN/close42-700ms.png" "$OUT/15-signed-42000-$WHEN.png" 2>/dev/null || echo "no signing frame for $WHEN"
rm -rf "$OUT/.feel-$WHEN"
ls "$OUT" | wc -l
