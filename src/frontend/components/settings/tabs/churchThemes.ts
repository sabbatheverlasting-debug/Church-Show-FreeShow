import type { Themes } from "../../../../types/Settings"
import { defaultThemes } from "./defaultThemes"

// Built-in default is read-only in the editor; user edits are saved as copies.
// Only migrate light/dark palettes when they still match the original preset.
export function loadChurchThemes(saved: { [key: string]: Themes }): { [key: string]: Themes } {
    const themes = JSON.parse(JSON.stringify(Object.keys(saved).length ? saved : defaultThemes))
    themes.default = JSON.parse(JSON.stringify(defaultThemes.default))
    for (const id of ["light", "dark"]) {
        const original = id === "light" ? ["#dadde2", "#b0b5c0", "#e8eaed", "#eff2f6", "#333748"] : ["#242832", "#2f3542", "#191923", "#12121c", "#f0f0ff"]
        const colors = themes[id]?.colors
        const matches = colors && ["primary", "primary-lighter", "primary-darker", "primary-darkest", "text"].every((key, i) => colors[key]?.toLowerCase() === original[i])
        const originalAccent = id === "light" ? ["#f0008c", "#c6a45d"] : ["#e64934"]
        if (!themes[id]) themes[id] = JSON.parse(JSON.stringify(defaultThemes[id]))
        else if (matches && originalAccent.includes(colors.secondary?.toLowerCase() || "")) themes[id] = { ...themes[id], colors: { ...defaultThemes[id].colors } }
    }
    return themes
}
