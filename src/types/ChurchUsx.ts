import { XMLParser, XMLValidator } from "fast-xml-parser"
import type { Bible, Book, Chapter, Verse } from "json-bible/lib/Bible"
const canon = "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV".split(" ")
export function orderedXml(text: string): any[] {
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("XML med externa entiteter stöds inte")
    if (XMLValidator.validate(text) !== true) throw new Error("Ogiltig XML")
    return new XMLParser({ preserveOrder: true, ignoreAttributes: false, trimValues: false, parseTagValue: false, removeNSPrefix: true }).parse(text)
}
export function xmlText(nodes: any[]): string {
    return nodes
        .map(
            (node) =>
                node["#text"] ??
                Object.entries(node)
                    .filter(([key]) => key !== ":@")
                    .map(([, value]) => (Array.isArray(value) ? xmlText(value) : ""))
                    .join("")
        )
        .join("")
}
export function parseUsxBook(content: string): { version: string; book: Book; notes: Record<string, string[]> } {
    const root = orderedXml(content).find((node) => node.usx)?.usx
    if (!root) throw new Error("USX saknar bibeltext")
    const header = root.find((node: any) => node.book)
    const code = header?.[":@"]?.["@_code"]
    const number = canon.indexOf(code) + 1
    if (!number) throw new Error("Okänd bibelbok: " + code)
    const version = xmlText(header.book).trim().split(/\s+/).slice(1).join(" ") || "USX"
    const title = root.find((node: any) => node.para && node[":@"]?.["@_style"] === "h")
    const book: Book = { number, id: code, name: title ? xmlText(title.para).trim() : code, abbreviation: code, chapters: [] }
    const notes: Record<string, string[]> = {}
    const variants: { reference: string; verse: Verse }[] = []
    let verseLabel = ""
    let chapter: Chapter | undefined, verse: Verse | undefined
    function visit(nodes: any[]) {
        for (const node of nodes) {
            const key = Object.keys(node).find((key) => key !== ":@")!
            const attrs = node[":@"] || {}
            if (key === "chapter") {
                verse = undefined
                if (attrs["@_number"]) {
                    chapter = { number: Number(attrs["@_number"]), verses: [] }
                    book.chapters.push(chapter)
                }
            } else if (key === "verse") {
                verse = undefined
                if (attrs["@_number"] && chapter) {
                    const label = String(attrs["@_number"])
                    verseLabel = label
                    const parts = label
                        .replace(/[a-z]$/i, "")
                        .split("-")
                        .map(Number)
                    if (parts.some((n) => !Number.isInteger(n) || n < 1)) throw new Error("Ogiltigt versnummer")
                    verse = { number: parts[0], text: "", ...(parts[1] ? { endNumber: parts[1] } : {}) }
                    if (/[a-z]$/i.test(label)) variants.push({ reference: `${code}.${chapter.number}.${label}`, verse })
                    else chapter.verses.push(verse)
                }
            } else if (key === "note") {
                if (chapter && verse) {
                    const id = `${code}.${chapter.number}.${verseLabel}`
                    ;(notes[id] ||= []).push(xmlText(node.note).trim())
                }
            } else if (key === "#text") {
                if (verse) verse.text += String(node[key])
            } else if (key === "para") {
                const style = attrs["@_style"] || ""
                if (/^(s\d*|ms\d*|r|d|sp|h|toc\d*|mt\d*|imt\d*|i.*)$/.test(style)) {
                    verse = undefined
                    continue
                }
                if (verse) verse.text += " "
                visit(node[key])
            } else if (Array.isArray(node[key]) && !["book", "figure"].includes(key)) visit(node[key])
        }
    }
    visit(root)
    for (const chapter of book.chapters) for (const verse of chapter.verses) verse.text = verse.text.replace(/\s+/g, " ").trim()
    for (const variant of variants) (notes[variant.reference] ||= []).unshift(variant.verse.text.replace(/\s+/g, " ").trim())
    return { version, book, notes }
}
export function parseUsxBibles(files: { name?: string; content: string; extension?: string }[]): Bible[] {
    const groups = new Map<string, Bible>()
    for (const file of files.filter((file) => file.extension === "usx" && !/(^|\/)(__MACOSX|\._)/.test(file.name || ""))) {
        const { version, book, notes } = parseUsxBook(file.content)
        const name = version.includes("SFB15") ? "Svenska Folkbibeln 2015" : version.includes("STB") ? "Svenska Standardbibeln (NT)" : version
        let bible = groups.get(name)
        if (!bible) {
            bible = { name, metadata: { identifier: version, language: "sv", copyright: /SFB15|STB/.test(version) ? "Stiftelsen Svenska Folkbibeln" : "", source: file.name || "USX", notes: {} }, books: [] }
            groups.set(name, bible)
        }
        if (bible.books.some((existing) => existing.number === book.number)) throw new Error("Dubblerad bibelbok: " + book.name)
        bible.books.push(book)
        Object.assign(bible.metadata.notes, notes)
    }
    for (const bible of groups.values()) {
        bible.books.sort((a, b) => a.number - b.number)
        const sourceRoot = String(bible.metadata.source).split("/")[0]
        const metadata = files.find((file) => file.name?.startsWith(sourceRoot + "/") && /(^|\/)metadata\.xml$/i.test(file.name))
        if (metadata) {
            const root = orderedXml(metadata.content).find((node) => node.metadata)?.metadata || []
            const copyright = root.find((node: any) => node.copyright)
            if (copyright) bible.metadata.copyright = xmlText(copyright.copyright).trim()
            bible.metadata.originalMetadataXml = metadata.content
        }
    }
    return [...groups.values()]
}
