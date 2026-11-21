import type { ChurchResource } from "../../types/ChurchPackage"

// Template contents are inert. Rebuild the reading view from text and semantic
// elements, so imported documents cannot introduce active content or styles.
export function readChurchHtml(name: string, content: string) {
    const template = document.createElement("template")
    template.innerHTML = content
    const root = template.content
    const title = root.querySelector("title")?.textContent?.trim() || root.querySelector("h1")?.textContent?.trim() || name.replace(/\.x?html?$/i, "")
    root.querySelectorAll("title,script,style,link,meta,base,iframe,object,embed,svg,form,nav,template,[hidden]").forEach(node => node.remove())
    const allowed = new Set("h1 h2 h3 h4 h5 h6 p div section article blockquote strong em b i ul ol li br hr table thead tbody tr th td figure figcaption pre code sup sub".split(" "))
    function copy(node: Node, parent: Node) {
        if (node.nodeType === Node.TEXT_NODE) {
            parent.appendChild(document.createTextNode(node.textContent || ""))
            return
        }
        if (!(node instanceof Element)) return
        const tag = node.localName
        const target = allowed.has(tag) ? parent.appendChild(document.createElement(tag)) : parent
        if (tag === "img" && node.getAttribute("alt")) target.appendChild(document.createTextNode(node.getAttribute("alt")!))
        for (const child of Array.from(node.childNodes)) copy(child, target)
    }
    const page = document.createElement("article")
    for (const child of Array.from(root.childNodes)) copy(child, page)
    const sections: ChurchResource["sections"] = []
    let heading = title
    let buffer = ""
    function flush() {
        const text = buffer.trim()
        if (text) sections.push({ title: heading, text })
        buffer = ""
    }
    function collect(node: Node) {
        if (node.nodeType === Node.TEXT_NODE) { buffer += node.textContent?.replace(/\s+/g, " ") || ""; return }
        if (!(node instanceof Element)) return
        if (/^h[1-6]$/.test(node.localName)) { flush(); heading = node.textContent?.trim() || title; return }
        if (node.localName === "li") buffer += "• "
        for (const child of Array.from(node.childNodes)) collect(child)
        if (/^(p|li|div|section|blockquote|br|tr)$/.test(node.localName)) buffer += "\n\n"
        if (/^(th|td)$/.test(node.localName)) buffer += " "
    }
    collect(page)
    flush()
    if (!sections.length && page.textContent?.trim()) sections.push({ title, text: page.textContent.trim() })
    if (!sections.length) throw new Error("HTML-filen saknar läsbar text: " + name)
    return { resource: { id: name, kind: "book" as const, title, sections }, html: page.innerHTML }
}
