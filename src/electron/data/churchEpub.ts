import fs from "fs/promises"
import os from "os"
import path from "path"
import { decompressZipStream } from "./zip"
import { parseChurchEpub } from "../../types/ChurchEpub"

export async function prepareChurchEpub(content: Buffer, name: string) {
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), "church-epub-"))
    try {
        const file = path.join(folder, "book.epub")
        await fs.writeFile(file, content)
        const entries = await decompressZipStream(file, false, { maxEntries: 10000, maxUncompressedBytes: 128 * 1024 * 1024 })
        const resource = parseChurchEpub(
            entries.map((entry) => ({ name: entry.name, content: String(entry.content) })),
            name
        )
        return { name: name + ".json", extension: "json", content: JSON.stringify({ format: "church-show-package", version: 1, id: "epub", title: resource.title, resources: [resource] }) }
    } finally {
        await fs.rm(folder, { recursive: true, force: true })
    }
}
