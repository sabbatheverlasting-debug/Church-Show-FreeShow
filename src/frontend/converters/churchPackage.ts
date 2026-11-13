import { parseUsxBibles } from "../../types/ChurchUsx"
import type { Bible } from "json-bible/lib/Bible"
import { parseChurchBible } from "../../types/ChurchBible"
import { scriptures, scripturesCache } from "../stores"
import { setActiveScripture } from "./bible"
import { installChurchStylePack } from "./churchStylePack"
import { get } from "svelte/store"
import { uid } from "uid"
import { splitChurchText, validateChurchPackage, type ChurchResource } from "../../types/ChurchPackage"
import { ShowObj } from "../classes/Show"
import { history } from "../components/helpers/history"
import { activePopup, alertMessage, categories, shows } from "../stores"

export const churchCategories = { book: "church_books", study: "church_studies", question: "church_questions", cue: "church_cues" }
const labels = { book: "Böcker", study: "Studier", question: "Frågor · Bibelmanna", cue: "Hållpunkter" }

export function installChurchResource(resource: ChurchResource, packageId: string) {
    const id = "church_" + encodeURIComponent(packageId) + "_" + encodeURIComponent(resource.id)
    if (get(shows)[id]) return false // Reinstalling never overwrites the user's edits.
    const category = churchCategories[resource.kind]
    if (!get(categories)[category]) history({ id: "UPDATE", newData: { data: { name: labels[resource.kind], icon: "shows" } }, oldData: { id: category }, location: { page: "drawer", id: "category_shows" } })
    const show = new ShowObj(false, category, uid(), Date.now(), false)
    show.name = resource.title
    show.origin = "church-package"
    show.meta = { publisher: resource.source || "" }
    const layout = show.layouts[show.settings.activeLayout]
    if (resource.kind === "book") {
        show.churchBook = { sections: resource.sections }
        const slideId = uid()
        show.slides[slideId] = { group: resource.title, color: null, settings: { color: "#122c38" }, notes: resource.source || "", items: [{ style: "left:100px;top:200px;width:1720px;height:680px;", lines: [{ text: [{ value: resource.title, style: "font-size:64px;color:#fff7e4;" }] }] }] }
        layout.slides.push({ id: slideId })
    }
    for (const section of resource.kind === "book" ? [] : resource.sections) {
        const source = section.source || resource.source || ""
        for (const text of splitChurchText(section.text)) {
            const slideId = uid()
            const items = resource.kind === "cue" ? [] : [{ style: "left:100px;top:110px;width:1720px;height:780px;", align: "center", lines: [{ align: "center", text: [{ value: text, style: "font-size:64px;color:#fff7e4;" }] }] }]
            if (source && items.length) items.push({ style: "left:100px;top:940px;width:1720px;height:90px;", align: "center", lines: [{ align: "center", text: [{ value: source, style: "font-size:28px;color:#d6ba79;" }] }] })
            show.slides[slideId] = { group: section.title || resource.title, color: null, settings: { color: "#122c38" }, notes: [resource.kind === "cue" ? text : "", source, section.answer ? "Svar: " + section.answer : ""].filter(Boolean).join("\n"), items }
            layout.slides.push({ id: slideId })
        }
        // An answer is a separate slide: advancing deliberately reveals it.
        if (section.answer) {
            const slideId = uid()
            show.slides[slideId] = { group: "Svar", color: "#C6A45D", settings: { color: "#122c38" }, notes: source, items: [{ style: "left:100px;top:110px;width:1720px;height:780px;", lines: [{ text: [{ value: section.answer, style: "font-size:64px;color:#fff7e4;" }] }] }] }
            layout.slides.push({ id: slideId })
        }
    }
    if (!layout.slides.length) throw new Error("Resursen saknar text: " + resource.title)
    history({ id: "UPDATE", newData: { data: show }, oldData: { id }, location: { page: "show", id: "show" } })
    return true
}

export function importChurchPackages(files: { name?: string; content: string; extension?: string }[]) {
    let installed = 0,
        duplicates = 0,
        unsupported = 0
    const errors: string[] = []
    function installBible(bible: Bible) {
        const id = "church_bible_" + encodeURIComponent(bible.name)
        if (get(scriptures)[id]) return false
        scripturesCache.update((cache) => ({ ...cache, [id]: bible }))
        scriptures.update((entries) => ({ ...entries, [id]: { name: bible.name, id, copyright: bible.metadata?.copyright || "" } }))
        setActiveScripture(id)
        return true
    }
    try {
        for (const bible of parseUsxBibles(files)) {
            if (installBible(bible)) installed++
            else duplicates++
        }
    } catch (error) {
        errors.push(String((error as Error).message))
    }
    const containsStylePack = files.some((file) => {
        try {
            return JSON.parse(file.content)?.format === "churchshow-style-pack"
        } catch {
            return false
        }
    })
    for (const file of files) {
        try {
            const name = file.name || "Import"
            if (/(^|[\\/])(__MACOSX|\._[^\\/]*)($|[\\/])/.test(name)) continue
            if (/(?:^|\/)(README|LAS-MIG|LÄS-MIG)\.txt$/i.test(name)) continue
            if (containsStylePack && file.extension === "svg") continue
            if (["txt", "md"].includes(file.extension || "")) {
                const resource: ChurchResource = { id: name, title: name.replace(/\.(txt|md)$/i, ""), kind: "study", sections: [{ text: file.content }] }
                if (installChurchResource(resource, "text")) installed++
                else duplicates++
                continue
            }
            if (file.extension === "usx" || /(^|\/)metadata\.xml$/i.test(name)) continue
            if (file.extension !== "json") {
                unsupported++
                continue
            }
            const raw = JSON.parse(file.content)
            if (["pure-words-epub-inventory-v1", "remnant-egw-library-v1"].includes(raw?.format)) continue
            if (raw?.format === "churchshow-style-pack") {
                installed += installChurchStylePack(raw)
                continue
            }
            const bible = parseChurchBible(raw, name)
            if (bible) {
                if (installBible(bible)) installed++
                else duplicates++
                continue
            }
            const legacy = raw?.format === "local-bible-study" ? [raw] : Array.isArray(raw?.studies) ? raw.studies : null
            const packet = validateChurchPackage(legacy ? { format: "church-show-package", version: 1, id: "legacy-studies", title: name, resources: legacy.map((study: any) => ({ id: study.id || study.title, title: study.title, kind: "study", sections: study.sections?.map((section: any) => ({ text: section.text, title: section.heading, source: study.source })) })) } : raw)
            for (const resource of packet.resources) {
                if (installChurchResource(resource, packet.id)) installed++
                else duplicates++
            }
        } catch (error) {
            errors.push(String((error as Error).message))
        }
    }
    const preferred = Object.entries(get(scriptures)).find(([, entry]) => entry.name === "Svenska Reformationsbibeln 2026")
    if (preferred && installed) setActiveScripture(preferred[0])
    // Alert renders HTML; never insert imported strings without escaping.
    const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    alertMessage.set(`${installed} resurser installerade. ${duplicates} fanns redan. ${unsupported} filer stöds inte.${errors.length ? "<br>" + errors.map(escape).join("<br>") : ""}`)
    activePopup.set("alert")
}

export function installDefaultCues() {
    for (const title of ["Välkommen", "Bön", "Kollekt", "Barnens stund", "Predikan", "Avslutning"]) installChurchResource({ id: title, kind: "cue", title, sections: [{ text: title }] }, "default-cues")
}
