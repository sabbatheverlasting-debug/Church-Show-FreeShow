export function projectMonthGroups<T extends { created?: number; name?: string }>(projects: T[], locale = "sv-SE"): { key: string; label: string; projects: T[] }[] {
    const groups = new Map<string, { key: string; label: string; projects: T[] }>()
    for (const project of projects) {
        const date = new Date(project.created || NaN)
        const valid = Number.isFinite(date.getTime())
        const key = valid ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : "unknown"
        if (!groups.has(key)) groups.set(key, { key, label: valid ? date.toLocaleDateString(locale, { month: "long", year: "numeric" }) : "Utan skapandedatum", projects: [] })
        groups.get(key)!.projects.push(project)
    }
    return [...groups.values()].sort((a, b) => a.key === "unknown" ? 1 : b.key === "unknown" ? -1 : b.key.localeCompare(a.key)).map((group) => ({ ...group, projects: group.projects.sort((a, b) => (b.created || 0) - (a.created || 0) || (a.name || "").localeCompare(b.name || "")) }))
}
