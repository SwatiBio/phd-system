/* Day identity and day distance, in one place.
 *
 * A "day" is the viewer's LOCAL calendar day, never the UTC day: toISOString
 * runs a day behind before 05:30 IST (and ahead of local midnight west of UTC),
 * which is how a completed deadline once rendered as "in 3 days". Six inline
 * copies of this rule existed — three correct, three UTC-broken — and none was
 * testable. Cross this seam instead of re-deriving it.
 *
 * Interface (everything a caller must know):
 *   dayIso(date)                  local calendar day as "YYYY-MM-DD"
 *   today(now?)                   dayIso of the given instant (default: now)
 *   daysUntil(dateIso, ref?)      signed whole days from ref; today if omitted,
 *                                 so a tab left open overnight cannot keep
 *                                 yesterday's countdown
 *
 * Both dates are anchored at local noon so a DST shift can't round a partial
 * day. Tests pin `ref`/`now`; production omits them. */
export const dayIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const today = (now = new Date()) => dayIso(now);

export const daysUntil = (dStr, ref = today()) =>
  Math.round((new Date(dStr + "T12:00:00") - new Date(ref + "T12:00:00")) / 86400000);
