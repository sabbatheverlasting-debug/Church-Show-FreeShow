import fs from "fs"
import { describe, expect, it } from "vitest"
import { churchBackgroundSvg, validateChurchStylePack } from "./ChurchStylePack"
const sample = () => JSON.parse(fs.readFileSync("packages/sangstund/manifest.json", "utf8"))
function luminance(hex: string) {
    const rgb = hex
        .slice(1)
        .match(/../g)!
        .map((v) => parseInt(v, 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}
function contrast(a: string, b: string) {
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (values[0] + 0.05) / (values[1] + 0.05)
}
describe("shared song backgrounds and UI themes", () => {
    it("validates all ten designs and both theme modes", () => {
        const p = validateChurchStylePack(sample())
        expect(p.backgrounds).toHaveLength(10)
        expect(p.themes.filter((t) => t.mode === "light")).toHaveLength(5)
        expect(p.themes.filter((t) => t.mode === "dark")).toHaveLength(5)
        for (const t of p.themes) {
            expect(contrast(t.colors.ink, t.colors.surface)).toBeGreaterThanOrEqual(4.5)
            expect(contrast(t.colors.card, t.colors.accent)).toBeGreaterThanOrEqual(4.5)
        }
        for (const b of p.backgrounds) {
            expect(contrast(b.text, b.top)).toBeGreaterThanOrEqual(4.5)
            expect(contrast(b.text, b.bottom)).toBeGreaterThanOrEqual(4.5)
        }
    })
    it("rejects paths, injected markup and unknown versions", () => {
        const p = sample()
        p.id = "../outside"
        expect(() => validateChurchStylePack(p)).toThrow()
        const q = sample()
        q.backgrounds[0].top = 'red"/><script>alert(1)</script>'
        expect(() => validateChurchStylePack(q)).toThrow()
        expect(() => validateChurchStylePack({ ...sample(), version: 2 })).toThrow()
    })
    it("creates standalone vector backgrounds without external links or words", () => {
        const svg = churchBackgroundSvg(sample().backgrounds[0])
        expect(svg).toContain('viewBox="0 0 3840 2160"')
        expect(svg).not.toMatch(/<script|<text|href=/)
    })
})
