import { get } from "svelte/store"
import { uid } from "uid"
import { selected, showsCache } from "../stores"
import { history } from "../components/helpers/history"
import { loadShows } from "../components/helpers/setShow"
import { getAccess } from "../utils/profile"

export function droppedAudio(event: DragEvent): string | null {
    const file = event.dataTransfer?.files?.[0] as (File & { path?: string }) | undefined
    const selection = get(selected)
    let filePath = file?.path || ""
    if (file && !filePath) {
        try {
            filePath = window.api.showFilePath(file)
        } catch {
            return null
        }
    }
    const candidate = filePath || (selection.id === "audio" ? selection.data?.[0]?.path || selection.data?.[0]?.id : "")
    return typeof candidate === "string" && /\.(m4a|mp3|wav|ogg|flac|aac|aiff|aif)$/i.test(candidate) ? candidate : null
}

export async function pairChurchAudio(showId: string, path: string | null) {
    await loadShows([showId])
    const original = get(showsCache)[showId]
    const access = getAccess("shows")
    if (!original || original.locked || ["read", "none"].includes(access.global) || ["read", "none"].includes(access[original.category || ""])) return
    const show = JSON.parse(JSON.stringify(original))
    const previousId = show.quickAccess?.churchAudio?.id
    for (const layout of Object.values(show.layouts) as any[]) {
        for (const slide of layout.slides) {
            if (previousId) slide.audio = slide.audio?.filter((id: string) => id !== previousId)
        }
    }
    if (previousId) delete show.media[previousId]
    show.quickAccess ||= {}
    delete show.quickAccess.churchAudio
    if (path) {
        const id = uid()
        const name = path.split(/[\\/]/).pop() || "Ljud"
        show.media[id] = { name, path, type: "audio" }
        show.quickAccess.churchAudio = { id, name, path }
        for (const layout of Object.values(show.layouts) as any[]) {
            const first = layout.slides[0]
            if (first) first.audio = [...(first.audio || []), id]
        }
    }
    history({ id: "UPDATE", newData: { data: show }, oldData: { id: showId }, location: { page: "show", id: "show" } })
}
