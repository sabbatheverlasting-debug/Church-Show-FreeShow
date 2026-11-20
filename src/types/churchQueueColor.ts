export const cueCardColor = "#29374b"

/** Section headings and program content have separate roles in the running order. */
export function churchQueueColor(category: string, title: string, type: string, paired = false): string {
    const label = category + " " + title
    if (type === "section" || /church_cues|hållpunkt/i.test(category) || /^(barnens stund|children's time|hållpunkt)(?:$|\s*[·:–-])/i.test(title.trim())) return cueCardColor
    if (/missionsberättelse|mission(?:s|ary)?[ _-]*stor(?:y|ies)/i.test(label)) return "#f6dda8"
    if (/barn(?:ens)?[ _-]*(?:bibel)?[ _-]*studi|barnlektion|(?:children(?:'s)?|kids)[ _-]*(?:bible[ _-]*)?(?:study|lesson)/i.test(label)) return "#f5d6df"
    if (/predik|sermon/i.test(label)) return "#ded6f2"
    if (/sång|song|hymn|\bsion/i.test(label) || paired || type === "audio") return "#c8e7dc"
    if (/studie|studium|study|studies/i.test(label)) return "#cce5f4"
    return ""
}
