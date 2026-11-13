import { orderedXml, xmlText } from "./ChurchUsx"
import type { ChurchResource } from "./ChurchPackage"
type Entry = { name: string; content: string }
function elements(nodes: any[], tag: string): any[] {
    return nodes.flatMap((node) => Object.entries(node).flatMap(([key, value]) => (key === tag ? [node] : key !== ":@" && Array.isArray(value) ? elements(value, tag) : [])))
}
function resolvePath(base: string, href: string) {
    if (/^[a-z]+:|^\/|\\/i.test(href)) throw new Error("Ogiltig EPUB-sökväg")
    const parts = base.split("/").slice(0, -1)
    for (const part of decodeURIComponent(href.split("#")[0]).split("/")) {
        if (part === "..") {
            if (!parts.length) throw new Error("Ogiltig EPUB-sökväg")
            parts.pop()
        } else if (part && part !== ".") parts.push(part)
    }
    return parts.join("/")
}
export function parseChurchEpub(entries: Entry[], fallback: string): ChurchResource {
    const files = new Map(entries.map((entry) => [entry.name, entry.content]))
    function read(name: string) {
        const text = files.get(name)
        if (!text) throw new Error("EPUB saknar " + name)
        // EPUB XHTML commonly declares a standard HTML doctype. Never accept entity declarations.
        return orderedXml(text.replace(/<!DOCTYPE[^>\[]*>/gi, ""))
    }
    const container = read("META-INF/container.xml")
    const opf = elements(container, "rootfile")[0]?.[":@"]?.["@_full-path"]
    if (!opf) throw new Error("EPUB saknar bokförteckning")
    const document = read(opf)
    const title = xmlText(elements(document, "title")[0]?.title || []).trim() || fallback
    const author = elements(document, "creator")
        .map((node) => xmlText(node.creator).trim())
        .filter(Boolean)
        .join(", ")
    const identifier = xmlText(elements(document, "identifier")[0]?.identifier || []).trim() || title
    const source = [author, title].filter(Boolean).join(" — ")
    const manifest = new Map(elements(document, "item").map((node) => [node[":@"]?.["@_id"], node[":@"]]))
    const sections: ChurchResource["sections"] = []
    let total = 0
    for (const item of elements(document, "itemref")) {
        if (item[":@"]?.["@_linear"] === "no") continue
        const attrs = manifest.get(item[":@"]?.["@_idref"])
        if (!attrs || !/html/.test(attrs["@_media-type"] || "")) continue
        const chapter = read(resolvePath(opf, attrs["@_href"]))
        const body = elements(chapter, "body")[0]?.body || []
        function plain(nodes: any[]): string {
            return nodes
                .map((node) =>
                    Object.entries(node)
                        .filter(([key]) => key !== ":@")
                        .map(([key, value]) => {
                            if (["script", "style", "svg", "nav"].includes(key)) return ""
                            if (key === "#text") return String(value)
                            if (key === "br") return "\n"
                            const text = Array.isArray(value) ? plain(value) : ""
                            return /^(p|div|h[1-6]|li|section|blockquote)$/.test(key) ? "\n\n" + text + "\n\n" : text
                        })
                        .join("")
                )
                .join("")
        }
        const text = plain(body)
            .replace(/[\t ]+/g, " ")
            .replace(/ *\n */g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
        if (!text) continue
        total += text.length
        if (total > 20000000 || sections.length >= 10000) throw new Error("Boken är för stor")
        const heading = ["h1", "h2", "h3"].flatMap((tag) => elements(body, tag).map((node) => xmlText(node[tag]).trim())).find(Boolean) || text.split("\n")[0].slice(0, 120)
        sections.push({ title: heading, text, source: source + " — " + heading })
    }
    if (!sections.length) throw new Error("EPUB saknar läsbar text")
    return { id: identifier, kind: "book", title, source, sections }
}
