export interface ChurchStylePack {
    format: "churchshow-style-pack"
    version: 1
    id: string
    name: string
    themes: { id: string; name: string; mode: "light" | "dark"; colors: { surface: string; card: string; border: string; ink: string; subtle: string; accent: string } }[]
    backgrounds: { id: string; name: string; top: string; bottom: string; glow: string; text: string; accent: string; design?: "aurora" | "horizon" | "rays" }[]
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
        if (bg.design && !["aurora", "horizon", "rays"].includes(bg.design)) throw new Error("Okänd bakgrundsdesign")
        if ([bg.top, bg.bottom, bg.glow, bg.text, bg.accent].some((color) => !hex.test(color))) throw new Error("Bakgrundens färger är ogiltiga.")
    }
    return pack
}

// Plain SVG gradients: portable, resolution-independent, no scripts or external assets.
export function churchBackgroundSvg(bg: ChurchStylePack["backgrounds"][number]): string {
    if ([bg.top, bg.bottom, bg.glow].some((color) => !hex.test(color))) throw new Error("Ogiltiga färger")
    if (bg.design) {
        const details = bg.design === "horizon"
            ? `<ellipse cx="3000" cy="1620" rx="650" ry="220" fill="${bg.glow}" opacity=".22" filter="url(#soft)"/><path d="M0 1730Q600 1420 1400 1760T3840 1640V2160H0Z" fill="${bg.bottom}" opacity=".65"/><path d="M0 1900Q900 1620 1800 1920T3840 1800V2160H0Z" fill="#020913" opacity=".35"/>`
            : bg.design === "rays"
              ? `<g fill="${bg.glow}" opacity=".12" filter="url(#soft)"><path d="M2500 -200L3840 300L1100 2160L1900 1800Z"/><path d="M2900 -100L3550 0L1300 2160L900 2160Z"/></g>`
              : `<g fill="none" stroke="${bg.glow}" filter="url(#soft)"><path d="M-300 1760C650 1900 1000 2400 2100 1940S3500 1250 4200 1820" stroke-width="170" opacity=".16"/><path d="M-300 100C800 350 900 -500 2200 -30S3500 450 4100 0" stroke-width="240" opacity=".25"/></g>`
        return `<svg xmlns="http://www.w3.org/2000/svg" width="3840" height="2160" viewBox="0 0 3840 2160"><defs><linearGradient id="base" x2="1" y2="1"><stop stop-color="${bg.top}"/><stop offset="1" stop-color="${bg.bottom}"/></linearGradient><radialGradient id="halo" cx=".85" cy=".18" r=".8"><stop stop-color="${bg.glow}" stop-opacity=".28"/><stop offset="1" stop-color="${bg.glow}" stop-opacity="0"/></radialGradient><radialGradient id="shade"><stop stop-color="#020611" stop-opacity=".24"/><stop offset="1" stop-color="#020611" stop-opacity=".05"/></radialGradient><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="55"/></filter></defs><path fill="url(#base)" d="M0 0H3840V2160H0Z"/><path fill="url(#halo)" d="M0 0H3840V2160H0Z"/>${details}<path fill="url(#shade)" d="M0 0H3840V2160H0Z"/></svg>`
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="3840" height="2160" viewBox="0 0 3840 2160"><defs><linearGradient id="base" x2="0" y2="1"><stop stop-color="${bg.top}"/><stop offset="1" stop-color="${bg.bottom}"/></linearGradient><radialGradient id="light" cx="0.83" cy="0.08" r="0.9"><stop stop-color="${bg.glow}" stop-opacity="0.2"/><stop offset="1" stop-color="${bg.glow}" stop-opacity="0"/></radialGradient></defs><path fill="url(#base)" d="M0 0H3840V2160H0z"/><path fill="url(#light)" d="M0 0H3840V2160H0z"/><path d="M0 1940 Q1000 1790 1930 2010 T3840 1940" fill="none" stroke="${bg.glow}" stroke-opacity="0.08" stroke-width="2"/></svg>`
}
