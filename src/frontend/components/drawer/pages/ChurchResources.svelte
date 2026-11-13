<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import { activePopup, shows, showsCache, selected, textCache } from "../../../stores"
    import { installDefaultCues } from "../../../converters/churchPackage"
    import SelectElem from "../../system/SelectElem.svelte"
    import ShowButton from "../../inputs/ShowButton.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { loadShows } from "../../helpers/setShow"
    import { getSlideText } from "../../edit/scripts/textStyle"
    let readingId = ""
    let chapterIndex = 0
    let bookSearch = ""
    $: chapters = reading?.churchBook?.sections || []
    $: matchingChapters = chapters.map((chapter, index) => ({ ...chapter, index })).filter((chapter) => (chapter.title + " " + chapter.text).toLocaleLowerCase().includes(bookSearch.toLocaleLowerCase()))
    $: reading = $showsCache[readingId]
    async function read(id: string) {
        readingId = id
        chapterIndex = 0
        bookSearch = ""
        await loadShows([id])
    }
    function dragQuote(event: DragEvent) {
        const quote = window.getSelection()?.toString().trim()
        if (!quote || !reading) return
        selected.set({ id: null, data: [] })
        const source = chapters[chapterIndex]?.source || reading.meta.publisher || reading.name
        event.dataTransfer?.setData("text/plain", quote + "\n\n" + source)
        event.dataTransfer?.setData("application/x-church-quote", JSON.stringify({ text: quote, source }))
    }
    export let id: string
    export let searchValue = ""
    $: category = id === "books" ? "church_books" : id === "questions" ? "church_questions" : "church_cues"
    $: resources = Object.entries($shows)
        .filter(([id, show]) => show.category === category && (show.name + " " + JSON.stringify($textCache[id] || "")).toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))
        .map(([id, show]) => ({ ...show, id }))
    function importPackage() {
        sendMain(Main.IMPORT, { channel: "church_package", format: { name: "Gemensam import · ZIP / JSON / text", extensions: ["zip", "json", "txt", "md", "epub", "usx"] } })
        activePopup.set(null)
    }
</script>

<div class="tools">
    <MaterialButton on:click={importPackage}>Gemensam import</MaterialButton>
    {#if id === "cues"}<MaterialButton on:click={installDefaultCues}>Lägg till standardhållpunkter</MaterialButton>{/if}
</div>
<p class="hint">Dra en resurs till projektet. Öppna den för att läsa, redigera eller dra enskilda bilder vidare.</p>
{#each resources as show (show.id)}
    <SelectElem id="show_drawer" data={{ id: show.id }} shiftRange={resources} draggable>
        <ShowButton id={show.id} {show} />
    </SelectElem>
    <button on:click={() => read(show.id)}>Läs och markera text</button>
{/each}
{#if !resources.length}<p class="hint">Inga resurser här ännu. Installera ett paket via Gemensam import.</p>{/if}
{#if reading}
    <article on:dragstart={dragQuote} style="padding:20px;max-width:900px;user-select:text;">
        <h2>{reading.name}</h2>
        <p>Markera ett utdrag och dra det till projektet eller bildspelet. Källan följer med.</p>
        {#if chapters.length}
            <label>Sök i boken <input type="search" bind:value={bookSearch} placeholder="Ord eller mening" /></label>
            <nav aria-label="Bokens kapitel" style="max-height:180px;overflow:auto;display:flex;flex-direction:column;">
                {#each matchingChapters as chapter}
                    <button class:chosen={chapter.index === chapterIndex} on:click={() => (chapterIndex = chapter.index)}>{chapter.index + 1}. {chapter.title}</button>
                {/each}
            </nav>
            {#if !matchingChapters.length}<p>Inga kapitel matchar sökningen.</p>{/if}
            <h3>{chapters[chapterIndex]?.title}</h3>
            <p style="white-space:pre-wrap;line-height:1.7;">{chapters[chapterIndex]?.text}</p>
            <small>{chapters[chapterIndex]?.source}</small>
        {:else}
            {#each Object.values(reading.slides) as slide}<p style="white-space:pre-wrap;line-height:1.6;">{getSlideText(slide)}</p>{/each}
        {/if}
    </article>
{/if}

<style>
    .chosen {
        border-left: 3px solid #d6ba79;
    }
    .tools {
        display: flex;
        gap: 8px;
        padding: 12px;
        flex-wrap: wrap;
    }
    .hint {
        padding: 10px 16px;
        opacity: 0.75;
    }
</style>
