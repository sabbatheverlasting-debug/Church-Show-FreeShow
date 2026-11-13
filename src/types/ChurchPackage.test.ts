import { describe, expect, it } from "vitest"
import { splitChurchText, validateChurchPackage } from "./ChurchPackage"
const packet = () => ({ format: "church-show-package", version: 1, id: "sample", title: "Studium", resources: [{ id: "one", kind: "question", title: "Fråga", sections: [{ text: "Vem?", answer: "Svar", source: "Källa" }] }] })
describe("shared Church Show content", () => {
    it("retains sources and separate answers for consumers", () => {
        const p = validateChurchPackage(packet())
        expect(p.resources[0].sections[0]).toEqual({ text: "Vem?", answer: "Svar", source: "Källa" })
    })
    it("rejects unsupported versions instead of guessing", () => {
        expect(() => validateChurchPackage({ ...packet(), version: 2 })).toThrow()
    })
    it("rejects duplicate identities and malformed sections", () => {
        const p = packet()
        p.resources.push(p.resources[0])
        expect(() => validateChurchPackage(p)).toThrow()
        expect(() => validateChurchPackage({ ...packet(), resources: [{ id: "bad", title: "Bad", kind: "book", sections: [{ text: 1 }] }] })).toThrow()
    })
    it("preserves word order across automatic slide breaks", () => {
        const text = Array.from({ length: 200 }, (_, i) => "ord" + i).join(" ")
        const slides = splitChurchText(text)
        expect(slides.length).toBeGreaterThan(1)
        expect(slides.every((slide) => slide.length <= 420)).toBe(true)
        expect(slides.join(" ")).toBe(text)
    })
})
