/** Native stores use display names as filenames; imported titles must stay in their data folder. */
export function churchContentName(value: string): string {
    return (
        value
            .replace(/[/\\\x00-\x1f?%*:|"<>]/g, "")
            .trim()
            .slice(0, 180) || "Namnlöst innehåll"
    )
}
