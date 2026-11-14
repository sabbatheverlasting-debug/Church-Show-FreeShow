import { describe, expect, it } from "vitest"
import { churchSongFooterItems } from "./ChurchSongFooter"
const colors = { text: "#ffffff", accent: "#d6ba79" }
describe("song footer", () => {
    it("uses current song metadata, including number, with separate credits", () => {
        const items = churchSongFooterItems({ name: "File", meta: { title: "Sång", number: "380", author: "Författare", copyright: "© Upphov" } }, colors)
        expect(items[0].lines?.[0].text[0].value).toBe("380 · Sång")
        expect(items[1].lines?.[0].text[0].value).toBe("Författare · © Upphov")
    })
    it("falls back to the show name and omits absent credits", () => {
        const items = churchSongFooterItems({ name: "Min sång", meta: {} }, colors)
        expect(items).toHaveLength(1)
        expect(items[0].lines?.[0].text[0].value).toBe("Min sång")
    })
})
