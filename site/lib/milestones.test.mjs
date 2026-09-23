/* Black-box test for the milestone grammar (site/lib/milestones.js).
   Locks the completion rule: a section carrying **Done: YYYY-MM-DD** is a
   COMPLETED milestone — it reports the real completion date, flags `done`,
   and must be excluded from "next/upcoming" selection. Regression for the
   26 Sep bug: Joining & Registration was submitted 23 Sep (today) but the
   timeline still rendered it as an upcoming "26 Sep · in 3d" deadline. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMilestones } from "./milestones.js";
import { daysUntil } from "./day.js";

const TODAY = "2026-09-23";

const fixture = `---
reg: 2026-09-23
reg-note: "FINAL"
---

# Milestones

## 1 · Joining & Registration — 🔴 reg + 3 days
**Target:** reg + 3 days
**Done:** 2026-09-23
- Submitted the joining report

## 2 · Register Coursework — 🟡 reg + 1 week
**Target:** reg + 1 week
- Register immediately
`;

test("Done section reports the completion date, not the target offset", () => {
  const { items } = parseMilestones(fixture);
  const joining = items.find((i) => i.title.includes("Joining"));
  assert.equal(joining.date, "2026-09-23");
  assert.equal(joining.done, true);
});

test("upcoming selection skips done milestones", () => {
  const { items } = parseMilestones(fixture);
  const next = items.find((i) => !i.done && daysUntil(i.date, TODAY) >= 0);
  assert.equal(next.title, "Register Coursework");
});

test("undone sections parse exactly as before (no Done line)", () => {
  const { items } = parseMilestones(fixture);
  const cw = items.find((i) => i.title.includes("Coursework"));
  assert.equal(cw.done, undefined);
  assert.equal(cw.date, "2026-09-30");
});

test("Done wins even when the section keeps its Target line", () => {
  const { items } = parseMilestones(fixture);
  const joining = items.find((i) => i.title.includes("Joining"));
  assert.notEqual(joining.date, "2026-09-26");
});
