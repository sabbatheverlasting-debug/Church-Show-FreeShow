// Platform-neutral content contract shared by desktop and future mobile products.
// Karaoke timing belongs in a future, versioned extension; it is not implemented here.
export type ChurchResourceKind = "book" | "study" | "question" | "cue"
export interface ChurchResource {
    id: string
    kind: ChurchResourceKind
    title: string
    sections: { text: string; title?: string; source?: string; answer?: string }[]
    source?: string
}
export interface ChurchPackage {
    format: "church-show-package"
    version: 1
    id: string
    title: string
    resources: ChurchResource[]
}

export function validateChurchPackage(value: unknown): ChurchPackage {
    const p = value as ChurchPackage
    if (!p || p.format !== "church-show-package" || p.version !== 1 || typeof p.id !== "string" || !p.id.trim() || typeof p.title !== "string" || !Array.isArray(p.resources)) throw new Error("Paketformatet stöds inte. Förväntar Church Show-paket version 1.")
    if (p.resources.length > 10000) throw new Error("Paketet innehåller för många resurser.")
    const ids = new Set<string>()
    for (const r of p.resources) {
        if (!r || typeof r.id !== "string" || !r.id.trim() || ids.has(r.id) || !["book", "study", "question", "cue"].includes(r.kind) || typeof r.title !== "string" || !r.title.trim() || !Array.isArray(r.sections) || !r.sections.length || r.sections.length > 10000) throw new Error("En resurs har felaktig struktur eller dubbelt ID.")
        ids.add(r.id)
        if (r.source !== undefined && typeof r.source !== "string") throw new Error("Ogiltig källhänvisning.")
        for (const s of r.sections) {
            if (!s || typeof s.text !== "string" || s.text.length > 1000000 || [s.title, s.source, s.answer].some((v) => v !== undefined && typeof v !== "string")) throw new Error("En textsektion är ogiltig.")
        }
    }
    return p
}

// Split at words, preserving paragraph order. Used for readable projector slides.
export function splitChurchText(text: string, limit = 420): string[] {
    const pages: string[] = []
    for (const paragraph of text.trim().split(/\n\s*\n/)) {
        let page = ""
        for (const word of paragraph.split(/\s+/).filter(Boolean)) {
            if (page && page.length + word.length + 1 > limit) {
                pages.push(page)
                page = ""
            }
            page += (page ? " " : "") + word
        }
        if (page) pages.push(page)
    }
    return pages
}
