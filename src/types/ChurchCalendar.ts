import type { Event } from "./Calendar"
export interface ChurchCalendarShare { enabled: boolean; calendar: string; name: string; includeNotes: boolean; token: string }
export function calendarIcs(events: Record<string, Event>, share: ChurchCalendarShare, now = new Date()): string {
    const escape = (s: string) => String(s).replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,")
    const utc = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")
    const day = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("")
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Church Show Pro 2//Calendar//SV", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:" + escape(share.name)]
    // Native recurring events are already expanded into dated occurrences.
    for (const [id, event] of Object.entries(events).sort(([, a], [, b]) => new Date(a.from).getTime() - new Date(b.from).getTime())) {
        if (!["event", "show"].includes(event.type) || (event.origin || "__unassigned__") !== share.calendar) continue
        const from = new Date(event.from), to = new Date(event.to)
        if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) continue
        lines.push("BEGIN:VEVENT", "UID:" + encodeURIComponent(id) + "@church-show", "DTSTAMP:" + utc(now), "SUMMARY:" + escape(event.name))
        if (event.time) { lines.push("DTSTART:" + utc(from)); if (to > from) lines.push("DTEND:" + utc(to)) }
        else { const end = new Date(to > from ? to : from); end.setDate(end.getDate() + 1); lines.push("DTSTART;VALUE=DATE:" + day(from), "DTEND;VALUE=DATE:" + day(end)) }
        if (event.location) lines.push("LOCATION:" + escape(event.location))
        if (share.includeNotes && event.notes) lines.push("DESCRIPTION:" + escape(event.notes))
        lines.push("END:VEVENT")
    }
    lines.push("END:VCALENDAR")
    return lines.map((line) => { let result = "", bytes = 0; for (const char of line) { const size = new TextEncoder().encode(char).length; if (bytes + size > 73) { result += "\r\n "; bytes = 1 } result += char; bytes += size } return result }).join("\r\n") + "\r\n"
}
