import type { Project, ProjectShowRef } from "./Projects"
export interface ProgramRow {
    id: string
    kind: "song" | "study" | "cue"
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
        if (row.kind !== "cue" && !resource) throw new Error(`Välj innehåll för punkt ${index + 1}.`)
        const title = row.title.trim() || resource?.name
        if (!title) throw new Error(`Skriv en rubrik för punkt ${index + 1}.`)
        const notes = [row.person.trim() ? `Ansvarig: ${row.person.trim()}` : "", row.notes.trim()].filter(Boolean).join("\n")
        shows.push({ id: `program_section_${row.id}`, type: "section", name: title + (row.person.trim() ? ` · ${row.person.trim()}` : ""), notes })
        if (row.kind !== "cue") shows.push({ id: row.resourceId, type: "show", name: resource.name, notes })
    }
    return { name: draft.title.trim(), created: now, parent: "/", shows }
}
