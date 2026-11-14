import type { Item, Show } from "./Show"

// Coordinates use the song templates' 1920 × 1080 canvas and stay fixed on every verse.
export function churchSongFooterItems(show: Pick<Show, "name" | "meta">, colors: { text: string; accent: string }): Item[] {
    const meta = show.meta || {}
    const title = [meta.number?.trim(), meta.title?.trim() || show.name?.trim()].filter(Boolean).join(" · ")
    const credits = [meta.author?.trim(), meta.composer?.trim(), meta.copyright?.trim(), meta.publisher?.trim()]
        .filter((value, index, values) => value && values.indexOf(value) === index).join(" · ")
    const box = (value: string, top: number, height: number, size: number, color: string): Item => ({
        type: "text", align: "center", textFit: "shrinkToFit",
        style: `left:140px;top:${top}px;width:1640px;height:${height}px;font-family:Arial;text-align:center;background-color:rgba(2,6,17,0.55);border-radius:8px;`,
        lines: [{ align: "center", text: [{ value, style: `font-size:${size}px;color:${color};` }] }]
    })
    return [title ? box(title, 885, 60, 34, colors.accent) : null, credits ? box(credits, 950, 65, 24, colors.text) : null].filter((item): item is Item => !!item)
}
