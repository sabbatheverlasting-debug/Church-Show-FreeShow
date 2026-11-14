import { app } from "electron"
import fs from "fs"
import path from "path"
import http from "http"
import os from "os"
import { randomBytes } from "crypto"
import { calendarIcs, type ChurchCalendarShare } from "../../types/ChurchCalendar"
import { getDataFolderPath } from "../utils/files"
import { getStore } from "./store"
let server: http.Server | null = null
let share: ChurchCalendarShare = { enabled: false, calendar: "__unassigned__", name: "Church Show", includeNotes: false, token: "" }
let loaded = false
let error = ""
let opening: Promise<void> | null = null
const port = 5514
function settingsFile() { return path.join(getDataFolderPath("imports", "Church Show calendar"), "sharing.json") }
function load() { if (loaded) return; loaded = true; try { const saved = JSON.parse(fs.readFileSync(settingsFile(), "utf8")); if (/^[a-f0-9]{64}$/.test(saved.token)) share = saved } catch { /* first use */ } }
async function start() {
    if (server?.listening) return
    if (opening) return opening
    error = ""
    server = http.createServer((req, res) => {
        res.setHeader("Cache-Control", "no-store")
        res.setHeader("X-Content-Type-Options", "nosniff")
        if (!share.enabled || req.url !== `/calendar/${share.token}.ics` || !["GET", "HEAD"].includes(req.method || "")) { res.writeHead(404); res.end(); return }
        try { const body = calendarIcs(getStore("EVENTS"), share); res.setHeader("Content-Type", "text/calendar; charset=utf-8"); res.end(req.method === "HEAD" ? undefined : body) }
        catch { res.writeHead(503); res.end("Kalendern kunde inte läsas") }
    })
    opening = new Promise<void>((resolve) => {
        server!.once("error", (e) => { error = "Kalenderdelningen kunde inte startas: " + e.message; server = null; resolve() })
        server!.listen(port, "0.0.0.0", resolve)
    }).finally(() => { opening = null })
    await opening
}
export async function churchCalendar(data?: { action?: "status" | "enable" | "disable"; calendar?: string; name?: string; includeNotes?: boolean }) {
    load()
    if (data?.action === "disable") {
        share.enabled = false
        await opening
        server?.close(); server = null
    } else if (data?.action === "enable") {
        share = { enabled: true, calendar: String(data.calendar || "__unassigned__"), name: String(data.name || "Church Show").slice(0, 150), includeNotes: data.includeNotes === true, token: randomBytes(32).toString("hex") }
    }
    if (data?.action && data.action !== "status") { const file = settingsFile(); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(share), { mode: 0o600 }) }
    if (share.enabled) await start()
    const ips = Object.values(os.networkInterfaces()).flat().filter((entry) => entry && !entry.internal && entry.family === "IPv4").map((entry) => entry!.address)
    return { enabled: share.enabled && !!server?.listening, calendar: share.calendar, name: share.name, includeNotes: share.includeNotes, error, urls: server?.listening ? ips.map((ip) => `http://${ip}:${port}/calendar/${share.token}.ics`) : [] }
}
app.on("before-quit", () => server?.close())
