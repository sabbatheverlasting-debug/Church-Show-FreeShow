import { describe, expect, it } from "vitest"
import { parseChurchBible } from "./ChurchBible"

describe("personal offline Bible import", () => {
    it("preserves SRB verse text, numbering and rights", () => {
        const bible = parseChurchBible({
            format: "church-show-bible",
            name: "SRB26",
            metadata: { copyright: "Privat import" },
            books: [
                {
                    nr: 1,
                    name: "1 Moseboken",
                    abbr: "1 Mos",
                    chapters: [
                        [
                            [1, "I begynnelsen"],
                            [3, "Varde ljus!"]
                        ]
                    ]
                }
            ]
        })!
        expect(bible.books[0].chapters[0].verses).toEqual([
            { number: 1, text: "I begynnelsen" },
            { number: 3, text: "Varde ljus!" }
        ])
        expect(bible.metadata.copyright).toBe("Privat import")
    })
    it("converts Pure Words numbering and retains source", () => {
        const bible = parseChurchBible({ source: "KJV 1769", books: [{ book: "Genesis", chapters: [{ chapter: "1", verses: [{ verse: "1", text: "In the beginning" }] }] }] }, "KJV.json")!
        expect(bible.name).toBe("KJV")
        expect(bible.books[0].chapters[0].number).toBe(1)
        expect(bible.metadata.source).toBe("KJV 1769")
    })
    it("does not mistake a book inventory for a Bible", () => {
        expect(parseChurchBible({ books: [{ title: "Book", file: "book.epub" }] })).toBeNull()
    })
    it("rejects malformed verses", () => {
        expect(() => parseChurchBible({ books: [{ book: "Genesis", chapters: [{ verses: [{ verse: "bad", text: "text" }] }] }] })).toThrow()
    })
})
