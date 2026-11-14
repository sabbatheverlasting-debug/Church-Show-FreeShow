import type { Project, ProjectShowRef } from "./Projects"
export interface ProgramRow {
    id: string
    kind: "song" | "study" | "cue"
    file?: { path: string; name: string; type: "pdf" | "image" | "video" | "audio" }
    text?: string
    resourceId: string
    title: string
    person: string
    notes: string
}
export interface ProgramDraft {
    title: string
    rows: ProgramRow[]
}
export function buildChurchProgram(draft: ProgramDraft, resources: Record<string, { name: string }>, now = Date.now()): Project {
    if (!draft.title.trim()) throw new Error("Skriv en rubrik för programmet.")
    if (!draft.rows.length) throw new Error("Lägg till minst en programpunkt.")
    const shows: ProjectShowRef[] = []
    for (const [index, row] of draft.rows.entries()) {
        const resource = resources[row.resourceId]
        if (row.kind !== "cue" && !resource && !row.file) throw new Error(`Välj innehåll för punkt ${index + 1}.`)
        const title = row.title.trim() || row.file?.name || resource?.name
        if (!title) throw new Error(`Skriv en rubrik för punkt ${index + 1}.`)
        const notes = [row.person.trim() ? `Ansvarig: ${row.person.trim()}` : "", row.notes.trim()].filter(Boolean).join("\n")
        shows.push({ id: `program_section_${row.id}`, type: "section", name: title + (row.person.trim() ? ` · ${row.person.trim()}` : ""), notes })
        if (row.file) shows.push({ id: row.file.path, type: row.file.type, name: row.file.name, notes })
        else if (row.kind !== "cue") shows.push({ id: row.resourceId, type: "show", name: resource.name, notes })
    }
    return { name: draft.title.trim(), created: now, parent: "/", shows }
}

export function programFileType(name: string): "pdf" | "image" | "video" | "audio" | null {
    const extension = name.split(".").pop()?.toLowerCase() || ""
    if (extension === "pdf") return "pdf"
    if (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(extension)) return "image"
    if (["mp4", "mov", "webm", "m4v"].includes(extension)) return "video"
    if (["mp3", "m4a", "wav", "ogg", "flac", "aac", "aiff", "aif"].includes(extension)) return "audio"
    return null
}
