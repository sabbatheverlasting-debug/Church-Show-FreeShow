/** Shared palette for the program list, including older projects without category metadata. */
export function churchQueueColor(category: string, title: string, type: string, paired = false): string {
    function byLabel(label: string) {
        if (/barn|children|kids/i.test(label)) return "#f6dda8"
        if (/predik|sermon/i.test(label)) return "#ded6f2"
        if (/sång|song|hymn|sion/i.test(label)) return "#c8e7dc"
        if (/hållpunkt|church_cues|cue/i.test(label)) return "#d5dfec"
        if (/studie|studium|study|studies/i.test(label)) return "#cce5f4"
        return ""
    }

    return byLabel(category) || byLabel(title) || (paired || type === "audio" ? "#c8e7dc" : type === "section" ? "#d5dfec" : "")
}
