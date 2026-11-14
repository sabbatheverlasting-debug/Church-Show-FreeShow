import { expect, it } from "vitest"
import { uniqueAudioMatches } from "./ChurchAudioMatch"
it("matches a unique song and numbered audio filename", () => {
    expect(uniqueAudioMatches([{ id: "s", name: "380 Mer, mera av Jesus" }], [{ path: "/song.m4a", name: "380 - Mer mera av Jesus.m4a" }]).matches).toEqual([{ id: "s", path: "/song.m4a" }])
})
it("never overwrites an existing pair or guesses among versions", () => {
    expect(uniqueAudioMatches([{ id: "s", name: "Sång", paired: true }], [{ path: "/one.mp3", name: "Sång.mp3" }]).matches).toEqual([])
    expect(uniqueAudioMatches([{ id: "s", name: "Sång" }], [{ path: "/one.mp3", name: "Sång.mp3" }, { path: "/two.mp3", name: "Sång.mp3" }]).ambiguous).toEqual(["Sång"])
    expect(uniqueAudioMatches([{ id: "s", name: "Sång" }, { id: "t", name: "Sång" }], [{ path: "/one.mp3", name: "Sång.mp3" }]).matches).toEqual([])
})
