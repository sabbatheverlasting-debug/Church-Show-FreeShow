import type { Bible } from "json-bible/lib/Bible"

/** Converts personal Church Show and Pure Words JSON without rewriting verse text. */
export function parseChurchBible(raw: any, filename = "Bibel"): Bible | null {
    if (!Array.isArray(raw?.books) || !raw.books.length || !raw.books.every((book: any) => Array.isArray(book.chapters))) return null
    const compact = raw.format === "church-show-bible"
    const name = raw.name || raw.metadata?.name || filename.replace(/\.json$/i, "")
    const metadata = { ...raw.metadata, language: raw.metadata?.language || raw.language || "", source: raw.metadata?.source || raw.source || "" }
    const books = raw.books.map((book: any, index: number) => ({
        name: book.name || book.book,
        abbreviation: book.abbreviation || book.abbr || book.code || book.name || book.book,
        number: Number(book.number || book.nr || index + 1),
        chapters: book.chapters.map((chapter: any, chapterIndex: number) => ({
            number: Number(compact ? chapterIndex + 1 : chapter.number || chapter.chapter || chapterIndex + 1),
            verses: (compact ? chapter : chapter.verses).map((verse: any) => {
                const number = Number(compact ? verse[0] : verse.number || verse.verse)
                const text = compact ? verse[1] : verse.text
                if (!Number.isInteger(number) || number < 1 || typeof text !== "string") throw new Error("Ogiltig bibelvers")
                return { number, text }
            })
        }))
    }))
    if (books.some((book: any) => typeof book.name !== "string" || !book.name || !Number.isInteger(book.number) || book.chapters.some((chapter: any) => !Number.isInteger(chapter.number) || chapter.number < 1))) throw new Error("Ogiltig bibelbok eller kapitel")
    return { name, metadata, books } as Bible
}
