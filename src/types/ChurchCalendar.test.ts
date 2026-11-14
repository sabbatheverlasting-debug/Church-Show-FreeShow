import { expect, it } from "vitest"
import { calendarIcs } from "./ChurchCalendar"
import type { Event } from "./Calendar"
it("exports only selected calendar and excludes private notes by default", () => {
 const event: Event = { name: "Sabbat, sång", from: "2026-11-14T09:30:00Z", to: "2026-11-14T10:30:00Z", time: true, repeat: false, type: "event", color: null, origin: "home", notes: "Privat" }
 const settings = { enabled: true, calendar: "home", name: "Hemma", includeNotes: false, token: "abc" }
 const ics = calendarIcs({ one: event, other: { ...event, origin: "work", name: "Work" } }, settings)
 expect(ics).toContain("DTSTART:20261114T093000Z")
 expect(ics).toContain("SUMMARY:Sabbat\\, sång")
 expect(ics).not.toContain("Privat")
 expect(ics).not.toContain("Work")
 expect(calendarIcs({ one: event }, { ...settings, includeNotes: true })).toContain("DESCRIPTION:Privat")
})
