import fs from "fs"
import { createHash } from "crypto"
import { shell } from "electron"
const isAudio = (path: string) => /\.(mp3|m4a|wav|ogg|flac|aac|aiff|aif)$/i.test(path)
async function digest(file: string) { const hash = createHash("sha256"); for await (const chunk of fs.createReadStream(file)) hash.update(chunk); return hash.digest("hex") }
export async function churchAudioFiles(data: { paths?: string[]; remove?: string; keep?: string }) {
    if (data.remove && data.keep) {
        if (!isAudio(data.remove) || !isAudio(data.keep) || fs.realpathSync(data.remove) === fs.realpathSync(data.keep)) throw new Error("Ogiltig dubblett")
        if (await digest(data.remove) !== await digest(data.keep)) throw new Error("Filerna är inte längre identiska. Gör en ny sökning.")
        await shell.trashItem(data.remove)
        return { removed: data.remove }
    }
    const bySize = new Map<number, string[]>(), groups: string[][] = [], errors: string[] = []
    for (const file of [...new Set(data.paths || [])].slice(0, 10000)) {
        if (!isAudio(file)) continue
        try { const stat = await fs.promises.lstat(file); if (stat.isFile()) bySize.set(stat.size, [...(bySize.get(stat.size) || []), file]) } catch { errors.push(file) }
    }
    for (const files of bySize.values()) {
        if (files.length < 2) continue
        const hashes = new Map<string, string[]>()
        for (const file of files) { try { const hash = await digest(file); hashes.set(hash, [...(hashes.get(hash) || []), file]) } catch { errors.push(file) } }
        groups.push(...[...hashes.values()].filter((group) => group.length > 1))
    }
    return { groups, errors }
}
