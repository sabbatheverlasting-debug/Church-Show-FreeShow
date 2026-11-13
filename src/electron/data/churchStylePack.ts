import fs from "fs"
import path from "path"
import { churchBackgroundSvg, validateChurchStylePack } from "../../types/ChurchStylePack"
import { getDataFolderPath } from "../utils/files"

export function prepareChurchStyleFile(file: { content: Buffer | string | object; name?: string; extension?: string }) {
    if (file.extension !== "json" || typeof file.content !== "string") return file
    let raw: any
    try {
        raw = JSON.parse(file.content)
    } catch {
        return file
    }
    if (raw?.format !== "churchshow-style-pack") return file
    const pack = validateChurchStylePack(raw)
    const folder = path.join(getDataFolderPath("imports", "Church Show backgrounds"), pack.id)
    fs.mkdirSync(folder, { recursive: true })
    const installedBackgrounds: Record<string, string> = {}
    for (const background of pack.backgrounds) {
        const destination = path.join(folder, background.id + ".svg")
        fs.writeFileSync(destination, churchBackgroundSvg(background), "utf8")
        installedBackgrounds[background.id] = destination
    }
    return { ...file, content: JSON.stringify({ ...pack, installedFolder: folder, installedBackgrounds }) }
}
