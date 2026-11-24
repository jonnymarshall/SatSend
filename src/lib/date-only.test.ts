import { describe, it, expect } from "vitest";
import { dateOnlyToUtc, utcToCalendarDate, calendarDateToDateOnly } from "./date-only";

// v1.5.34: a due date is a calendar day ("2026-11-03"), not a moment. The form's
// date picker works in the browser's own time zone, while the server builds
// dates in UTC. Converting with toISOString() or reading a UTC-midnight Date in
// the browser's zone shifted the day by one for anyone not on UTC (the US saw
// the day before when editing; the UK in summer saved the day before).
//
// These run in every time zone the suite is started in; the release check runs
// them under TZ=America/Los_Angeles, Europe/London (summer) and Pacific/Auckland.

describe("date-only helpers", () => {
  it("dateOnlyToUtc makes UTC midnight of that day, wherever the server is", () => {
    expect(dateOnlyToUtc("2026-11-03").toISOString()).toBe("2026-11-03T00:00:00.000Z");
  });

  it("utcToCalendarDate gives the same day in the browser's own zone", () => {
    const d = utcToCalendarDate(dateOnlyToUtc("2026-11-03"));
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 11, 3]);
  });

  it("calendarDateToDateOnly reads the picked day in the browser's zone, not UTC", () => {
    // A picker hands back local midnight. In summer in the UK that is 23:00 UTC
    // the day before, which toISOString() turned into the wrong day.
    expect(calendarDateToDateOnly(new Date(2026, 5, 3))).toBe("2026-06-03");
    expect(calendarDateToDateOnly(new Date(2026, 11, 31))).toBe("2026-12-31");
    expect(calendarDateToDateOnly(new Date(2026, 0, 1))).toBe("2026-01-01");
  });

  it("a stored date survives a load and a save unchanged", () => {
    for (const day of ["2026-01-01", "2026-06-03", "2026-11-03", "2026-12-31", "2028-02-29"]) {
      expect(calendarDateToDateOnly(utcToCalendarDate(dateOnlyToUtc(day)))).toBe(day);
    }
  });
});
