/* Day-math contract for site/lib/day.js — the seam this repo was missing:
   six inline copies of "what day is it" existed, three correct, three UTC-broken,
   none testable. A day is the LOCAL calendar day, never the UTC one — toISOString
   is a day behind before 05:30 IST, which is how the timeline once counted a
   completed deadline as "in 3 days". Note: on a UTC-timezone runner local and
   UTC coincide, so the 00:30/23:59 cases are only load-bearing west of UTC. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { dayIso, today, daysUntil } from "./day.js";

test("dayIso reads the local calendar day, not UTC", () => {
  assert.equal(dayIso(new Date(2026, 8, 26, 0, 30)), "2026-09-26");
  assert.equal(dayIso(new Date(2026, 8, 26, 23, 59)), "2026-09-26");
  assert.equal(dayIso(new Date(2026, 8, 1, 0, 0)), "2026-09-01");
});

test("today() accepts the instant — dependency in, day out", () => {
  assert.equal(today(new Date(2026, 8, 26, 0, 30)), "2026-09-26");
});

test("daysUntil: signed whole days, zero on the day itself", () => {
  assert.equal(daysUntil("2026-09-26", "2026-09-23"), 3);
  assert.equal(daysUntil("2026-09-23", "2026-09-23"), 0);
  assert.equal(daysUntil("2026-09-20", "2026-09-23"), -3);
});

test("daysUntil with the default reference counts from the current day", () => {
  assert.equal(daysUntil(today()), 0);
});
