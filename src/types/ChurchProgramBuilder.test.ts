import { describe, it, expect } from "vitest"
import { buildChurchProgram, type ProgramDraft } from "./ChurchProgramBuilder"
describe("programbyggare", () => {
    const draft: ProgramDraft = {
        title: " Sabbat ",
        rows: [
            { id: "1", kind: "cue", title: "Välkommen", person: "Eva", notes: "Hälsa gästerna", resourceId: "" },
            { id: "2", kind: "song", title: "", person: "Kören", notes: "Två verser", resourceId: "song1" },
            { id: "3", kind: "study", title: "Hopp", person: "Håkan", notes: "", resourceId: "study1" }
        ]
    }
    it("bevarar ordning, ansvariga och befintliga innehållsreferenser", () => {
        const project = buildChurchProgram(draft, { song1: { name: "Tryggare kan ingen vara" }, study1: { name: "Bibelstudium" } }, 123)
        expect(project.name).toBe("Sabbat")
        expect(project.created).toBe(123)
        expect(project.shows.map((s) => s.type)).toEqual(["section", "section", "show", "section", "show"])
        expect(project.shows[2]).toMatchObject({ id: "song1", notes: "Ansvarig: Kören\nTvå verser" })
        expect(project.shows[3].name).toBe("Hopp · Håkan")
        expect(project.shows[4].id).toBe("study1")
    })
    it("stoppar saknat innehåll utan att skapa ett ofullständigt project", () => {
        expect(() => buildChurchProgram(draft, {})).toThrow("Välj innehåll för punkt 2")
        expect(() => buildChurchProgram({ title: "", rows: [] }, {})).toThrow("rubrik")
        expect(() => buildChurchProgram({ title: "Sabbat", rows: [] }, {})).toThrow("minst en")
    })
})

it("keeps uploaded files as native project items in the chosen order", () => {
    const project = buildChurchProgram({ title: "Studium", rows: [{ id: "pdf", kind: "study", resourceId: "", title: "", person: "Eva", notes: "Sida 3", file: { path: "/studium.pdf", name: "Studium.pdf", type: "pdf" } }] }, {})
    expect(project.shows[1]).toEqual({ id: "/studium.pdf", name: "Studium.pdf", type: "pdf", notes: "Ansvarig: Eva\nSida 3" })
})
