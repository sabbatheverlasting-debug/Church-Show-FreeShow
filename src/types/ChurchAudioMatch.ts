export function songMatchKey(name: string): string {
    return name.replace(/\.(mp3|m4a|wav|ogg|flac|aac|aiff|aif)$/i, "").replace(/^\s*\d+\s*[-._ ]*\s*/, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9åäö]+/g, " ").trim()
}
export function uniqueAudioMatches(songs: { id: string; name: string; paired?: boolean }[], audio: { path: string; name: string }[]) {
    const songsByKey = new Map<string, typeof songs>(), audioByKey = new Map<string, typeof audio>()
    for (const song of songs) { const key = songMatchKey(song.name); if (key) songsByKey.set(key, [...(songsByKey.get(key) || []), song]) }
    for (const file of audio) { const key = songMatchKey(file.name); if (key && !(audioByKey.get(key) || []).some((item) => item.path === file.path)) audioByKey.set(key, [...(audioByKey.get(key) || []), file]) }
    const matches: { id: string; path: string }[] = [], ambiguous: string[] = []
    for (const [key, group] of songsByKey) {
        const files = audioByKey.get(key)
        if (!files?.length || group.every((song) => song.paired)) continue
        if (group.length !== 1 || files.length !== 1) { ambiguous.push(group[0].name); continue }
        matches.push({ id: group[0].id, path: files[0].path })
    }
    return { matches, ambiguous }
}
