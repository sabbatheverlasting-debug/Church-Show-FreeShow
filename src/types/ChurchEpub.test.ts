import { describe, expect, it } from "vitest"
import { parseChurchEpub } from "./ChurchEpub"
const entries = [
    { name: "META-INF/container.xml", content: '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>' },
    { name: "OPS/book.opf", content: '<package xmlns:dc="urn:dc"><metadata><dc:title>Min bok</dc:title><dc:creator>Författare</dc:creator><dc:identifier>book-1</dc:identifier></metadata><manifest><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>' },
    { name: "OPS/a.xhtml", content: "<html><body><h1>Första kapitlet</h1><p>En <em>viktig</em> text.</p><script>alert(1)</script></body></html>" },
    { name: "OPS/b.xhtml", content: "<html><body><h1>Andra kapitlet</h1><p>Nästa text.</p></body></html>" }
]
describe("EPUB book import", () => {
    it("reads spine order, inline text and source without executable markup", () => {
        const book = parseChurchEpub(entries, "fallback")
        expect(book.title).toBe("Min bok")
        expect(book.sections.map((section) => section.title)).toEqual(["Första kapitlet", "Andra kapitlet"])
        expect(book.sections[0].text).toContain("En viktig text.")
        expect(book.sections[0].text).not.toContain("alert")
        expect(book.sections[0].source).toBe("Författare — Min bok — Första kapitlet")
    })
    it("reports missing content instead of silently losing chapters", () => {
        expect(() => parseChurchEpub(entries.slice(0, 3), "fallback")).toThrow("saknar")
    })
    it("rejects external chapter references", () => {
        expect(() =>
            parseChurchEpub(
                entries.map((entry) => ({ ...entry, content: entry.content.replace('href="a.xhtml"', 'href="https://example.org/a.xhtml"') })),
                "fallback"
            )
        ).toThrow("sökväg")
    })
})
