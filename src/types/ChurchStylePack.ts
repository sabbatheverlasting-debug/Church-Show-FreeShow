export interface ChurchStylePack {
    format: "churchshow-style-pack"
    version: 1
    id: string
    name: string
    themes: { id: string; name: string; mode: "light" | "dark"; colors: { surface: string; card: string; border: string; ink: string; subtle: string; accent: string } }[]
    backgrounds: { id: string; name: string; top: string; bottom: string; glow: string; text: string; accent: string }[]
}
const hex = /^#[0-9a-f]{6}$/i
const validId = /^[a-z0-9][a-z0-9-]{0,79}$/
export function validateChurchStylePack(value: unknown): ChurchStylePack {
    const pack = value as ChurchStylePack
    if (!pack || pack.format !== "churchshow-style-pack" || pack.version !== 1 || typeof pack.id !== "string" || !validId.test(pack.id) || typeof pack.name !== "string" || !pack.name.trim() || !Array.isArray(pack.themes) || !Array.isArray(pack.backgrounds) || pack.themes.length > 30 || pack.backgrounds.length > 30) throw new Error("Ogiltigt bakgrunds- och temapaket.")
    for (const list of [pack.themes, pack.backgrounds]) {
        const ids = new Set<string>()
        for (const item of list) {
            if (!item || typeof item.id !== "string" || !validId.test(item.id) || ids.has(item.id) || typeof item.name !== "string" || !item.name.trim()) throw new Error("Ogiltigt eller dubbelt namn/ID i temapaketet.")
            ids.add(item.id)
        }
    }
    for (const theme of pack.themes) {
        if (!["light", "dark"].includes(theme.mode) || !theme.colors || (["surface", "card", "border", "ink", "subtle", "accent"] as const).some((key) => !hex.test(theme.colors[key] || ""))) throw new Error("Temats färger är ogiltiga.")
    }
    for (const bg of pack.backgrounds) {
        if ([bg.top, bg.bottom, bg.glow, bg.text, bg.accent].some((color) => !hex.test(color))) throw new Error("Bakgrundens färger är ogiltiga.")
    }
    return pack
}

// Plain SVG gradients: portable, resolution-independent, no scripts or external assets.
export function churchBackgroundSvg(bg: ChurchStylePack["backgrounds"][number]): string {
    if ([bg.top, bg.bottom, bg.glow].some((color) => !hex.test(color))) throw new Error("Ogiltiga färger")
    return `<svg xmlns="http://www.w3.org/2000/svg" width="3840" height="2160" viewBox="0 0 3840 2160"><defs><linearGradient id="base" x2="0" y2="1"><stop stop-color="${bg.top}"/><stop offset="1" stop-color="${bg.bottom}"/></linearGradient><radialGradient id="light" cx="0.83" cy="0.08" r="0.9"><stop stop-color="${bg.glow}" stop-opacity="0.2"/><stop offset="1" stop-color="${bg.glow}" stop-opacity="0"/></radialGradient></defs><path fill="url(#base)" d="M0 0H3840V2160H0z"/><path fill="url(#light)" d="M0 0H3840V2160H0z"/><path d="M0 1940 Q1000 1790 1930 2010 T3840 1940" fill="none" stroke="${bg.glow}" stroke-opacity="0.08" stroke-width="2"/></svg>`
}
