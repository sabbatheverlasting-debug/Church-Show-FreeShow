import { describe, expect, it } from "vitest"
import { parseUsxBook, parseUsxBibles } from "./ChurchUsx"
const content = '<usx version="2.0"><book code="GEN">GEN SFB15</book><para style="h">Första Moseboken</para><chapter number="1"/><para style="s">Rubrik</para><para style="p"><verse number="1"/>I <char style="nd">begynnelsen</char><note>En fotnot</note> skapade Gud.</para><para style="s">Nästa rubrik</para><para style="p"><verse number="2-3"/>Nästa vers.</para></usx>'
describe("USX personal import", () => {
    it("preserves inline words but separates headings and notes", () => {
        const parsed = parseUsxBook(content)
        expect(parsed.book.chapters[0].verses).toEqual([
            { number: 1, text: "I begynnelsen skapade Gud." },
            { number: 2, endNumber: 3, text: "Nästa vers." }
        ])
        expect(parsed.notes["GEN.1.1"]).toEqual(["En fotnot"])
    })
    it("keeps alternate lettered verses in notes without replacing the main verse", () => {
        const result = parseUsxBook(content.replace('number="2-3"', 'number="1a"'))
        expect(result.book.chapters[0].verses).toHaveLength(1)
        expect(result.notes["GEN.1.1a"]).toEqual(["Nästa vers."])
    })
    it("groups translations separately", () => {
        expect(parseUsxBibles([content, content.replaceAll("SFB15", "STB")].map((content) => ({ extension: "usx", content })))).toHaveLength(2)
    })
    it("rejects duplicate books and unsafe XML", () => {
        expect(() => parseUsxBibles([1, 2].map(() => ({ extension: "usx", content })))).toThrow("Dubblerad")
        expect(() => parseUsxBook("<!DOCTYPE usx><usx/>")).toThrow()
    })
})
