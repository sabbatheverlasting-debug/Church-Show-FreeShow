import { getAccess } from "../utils/profile"
import { get } from "svelte/store"
import { splitChurchText } from "../../types/ChurchPackage"
import { history } from "../components/helpers/history"
import { loadShows } from "../components/helpers/setShow"
import { activeProject, activeShow, showsCache } from "../stores"
import { convertText } from "./txt"

export async function dropChurchText(text: string, area: string, index?: number) {
    const access = getAccess("shows")
    if (["read", "none"].includes(access.global)) return
    const data = convertText({ name: text.trim().slice(0, 70), text: splitChurchText(text).join("\n\n"), noFormatting: true, returnData: true })
    if (!data?.show) return
    if (area === "project") {
        const project = get(activeProject)
        if (!project) return
        history({ id: "UPDATE", newData: { data: data.show, remember: { project, index } }, oldData: { id: data.id }, location: { page: "show", id: "show" } })
        return
    }
    const current = get(activeShow)
    if (!current) return
    await loadShows([current.id])
    const original = get(showsCache)[current.id]
    if (!original || original.locked || ["read", "none"].includes(access[original.category || ""])) return
    const show = JSON.parse(JSON.stringify(original))
    const layoutId = show.settings.activeLayout
    const layout = show.layouts[layoutId]
    if (!layout) return
    Object.assign(show.slides, data.show.slides)
    layout.slides.splice(index ?? layout.slides.length, 0, ...data.show.layouts[data.show.settings.activeLayout].slides)
    history({ id: "UPDATE", newData: { data: show }, oldData: { id: current.id }, location: { page: "show", id: "show" } })
}
