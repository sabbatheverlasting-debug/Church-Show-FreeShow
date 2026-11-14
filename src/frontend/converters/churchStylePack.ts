import { get } from "svelte/store"
import { validateChurchStylePack } from "../../types/ChurchStylePack"
import { history } from "../components/helpers/history"
import { mediaFolders, templates, themes, theme } from "../stores"
import { updateThemeValues } from "../utils/updateSettings"

export function installChurchStylePack(raw: any): number {
    const pack = validateChurchStylePack(raw)
    const currentTheme = get(theme)
    let count = 0
    for (const item of pack.themes) {
        const id = `church_${pack.id}_${item.id}`
        if (get(themes)[id]) continue
        const c = item.colors
        history({
            id: "UPDATE",
            newData: { data: { name: item.name, font: { family: "", size: "1em" }, colors: { primary: c.surface, "primary-lighter": c.border, "primary-darker": c.card, "primary-darkest": c.card, text: c.ink, textInvert: c.card, "secondary-text": c.card, secondary: c.accent, "secondary-opacity": c.accent + "80", hover: item.mode === "dark" ? "#ffffff0d" : "#0000000d", focus: item.mode === "dark" ? "#ffffff19" : "#00000019" } } },
            oldData: { id },
            location: { page: "settings", id: "settings_theme" }
        })
        count++
    }
    if (pack.themes.length) { theme.set(currentTheme); updateThemeValues(get(themes)[currentTheme]) }
    for (const bg of pack.backgrounds) {
        const id = `church_${pack.id}_${bg.id}`
        if (get(templates)[id]) continue
        const backgroundPath = raw.installedBackgrounds?.[bg.id]
        if (typeof backgroundPath !== "string") throw new Error("Bakgrunden måste installeras genom Gemensam import.")
        history({
            id: "UPDATE",
            newData: { data: { name: "Sång · " + bg.name, color: bg.accent, category: "song", settings: { resolution: { width: 1920, height: 1080 }, backgroundColor: bg.bottom, backgroundPath }, items: [{ style: "left:180px;top:160px;width:1560px;height:720px;font-family:Arial;text-align:center;", align: "center", textFit: "shrinkToFit", lines: [{ align: "center", text: [{ value: "Sångtext", style: `font-size:68px;color:${bg.text};font-weight:500;` }] }] }] } },
            oldData: { id },
            location: { page: "drawer", id: "template" }
        })
        count++
    }
    if (pack.backgrounds.length && typeof raw.installedFolder === "string") {
        mediaFolders.update((folders) => ({ ...folders, ["church_" + pack.id]: { name: pack.name, path: raw.installedFolder, mediaType: "background", churchDetached: false } }))
    }
    return count
}
