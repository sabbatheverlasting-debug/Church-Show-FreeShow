import type { Categories } from "../../types/Tabs"

// Migration only detaches folder references. It never deletes or moves files.
export function detachPreviousBackgroundFolders(folders: Categories): Categories {
    return Object.fromEntries(Object.entries(folders).map(([id, folder]) => [id, { ...folder, churchDetached: !!folder.path }]))
}
export function visibleBackgroundFolders(folders: Categories): Categories {
    return Object.fromEntries(Object.entries(folders).filter(([, folder]) => !folder.churchDetached))
}

// Reset only the default preset. User templates, slides and files are untouched.
export function resetDefaultBackground<T extends Record<string, any>>(entries: T, template = false): T {
    const entry = entries.default
    if (!entry || entry.churchBackgroundResetV1) return entries
    const copy = JSON.parse(JSON.stringify(entry))
    if (template) {
        copy.settings = { ...copy.settings, backgroundColor: "#182D3C" }
        delete copy.settings.backgroundPath
    } else {
        delete copy.backgroundImage
        copy.background = "#182D3C"
    }
    copy.churchBackgroundResetV1 = true
    return { ...entries, default: copy }
}
