import { describe, expect, it } from "vitest"
import { loadChurchThemes } from "./churchThemes"
import { defaultThemes } from "./defaultThemes"
describe("Church Show theme upgrade", () => {
    it("replaces an old saved default instead of keeping FreeShow pink", () => {
        const old = { default: { ...defaultThemes.default, colors: { ...defaultThemes.default.colors, secondary: "#F0008C" } } }
        expect(loadChurchThemes(old).default.colors.secondary).toBe("#C6A45D")
        expect(old.default.colors.secondary).toBe("#F0008C")
    })
    it("preserves custom themes and customized light colors", () => {
        const custom = { ...defaultThemes.light, colors: { ...defaultThemes.light.colors, primary: "#123456" } }
        const loaded = loadChurchThemes({ custom, light: custom })
        expect(loaded.custom).toEqual(custom)
        expect(loaded.light).toEqual(custom)
    })
})
