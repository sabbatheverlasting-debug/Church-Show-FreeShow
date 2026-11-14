import { afterEach, expect, it, vi } from "vitest"
import fs from "fs"
import os from "os"
import path from "path"
vi.mock("electron", () => ({ shell: { trashItem: vi.fn(async () => {}) } }))
import { shell } from "electron"
import { churchAudioFiles } from "./churchAudioFiles"
const directories: string[] = []
afterEach(() => { for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); vi.clearAllMocks() })
function files() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "church-audio-test-")); directories.push(dir); const paths = ["a.mp3", "b.mp3", "c.mp3"].map((name) => path.join(dir, name)); paths.forEach((file, index) => fs.writeFileSync(file, index === 2 ? "other" : "music")); return paths }
it("finds identical bytes, not merely equal sizes", async () => {
    const [a,b,c] = files()
    expect((await churchAudioFiles({ paths: [a,b,c] })).groups).toEqual([[a,b]])
    expect(shell.trashItem).not.toHaveBeenCalled()
})
it("rechecks copies before moving to trash", async () => {
    const [a,b,c] = files()
    await expect(churchAudioFiles({ remove: a, keep: c })).rejects.toThrow("identiska")
    expect(shell.trashItem).not.toHaveBeenCalled()
    await churchAudioFiles({ remove: a, keep: b })
    expect(shell.trashItem).toHaveBeenCalledWith(a)
    expect(fs.existsSync(b)).toBe(true)
})
