<script lang="ts">
    import { cueHeadingColor } from "../../../../types/churchQueueColor"
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { activePopup, shows, showsCache, selected, textCache } from "../../../stores"
    import { installChurchResource, installDefaultCues } from "../../../converters/churchPackage"
    import SelectElem from "../../system/SelectElem.svelte"
    import ShowButton from "../../inputs/ShowButton.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { loadShows } from "../../helpers/setShow"
    import { getSlideText } from "../../edit/scripts/textStyle"
    let creatingCue = false
    let cueName = ""
    onMount(() => { if (id === "cues") installDefaultCues() })
    function createCue() {
        const title = cueName.trim()
        if (!title) return
        if (!Object.values($shows).some(show => show.category === "church_cues" && show.name.toLocaleLowerCase() === title.toLocaleLowerCase()))
            installChurchResource({ id: title.toLocaleLowerCase(), kind: "cue", title, sections: [{ text: title }] }, "personal-cues")
        creatingCue = false
        cueName = ""
    }
    let quizMessage = ""
    async function quiz(action: "start" | "questions") {
        try {
            const result = await requestMain(Main.CHURCH_QUIZ, { action })
            if (result?.questions) {
                let added = 0
                result.questions.forEach((q: any[], index: number) => {
                    if (installChurchResource({ id: String(index + 1), title: q[0], kind: "question", source: q[3], sections: [{ text: q[0] + "\n\n" + q[1].map((answer: string, i: number) => String.fromCharCode(65 + i) + ". " + answer).join("\n"), answer: q[2] + ". " + q[1][String(q[2]).charCodeAt(0) - 65], source: q[3] }] }, "trivia-starter")) added++
                })
                quizMessage = `${added} frågor installerade. Dra dem till programmet; svaret visas på nästa bild.`
            } else quizMessage = "Ledarvyn är öppnad. Projektorvyn öppnas därifrån."
        } catch { quizMessage = "Frågesporten kunde inte öppnas. Kontrollera att port 5515 är ledig." }
    }
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
    {#if id === "questions"}<MaterialButton on:click={() => quiz("start")}>Starta frågesport · ledarvy</MaterialButton><MaterialButton on:click={() => quiz("questions")}>Lägg in frågebanken som bilder</MaterialButton>{/if}
    <MaterialButton on:click={importPackage}>Gemensam import</MaterialButton>
    
</div>
{#if quizMessage}<p class="hint" role="status">{quizMessage}</p>{/if}
{#if id === "cues"}<p class="hint">Dra en hållpunkt till rätt plats i planeringen.</p>{:else}<p class="hint">Dra en resurs till projektet. Öppna den för att läsa, redigera eller dra enskilda bilder vidare.</p>{/if}
{#each resources as show (show.id)}
    <SelectElem id="show_drawer" data={{ id: show.id }} shiftRange={resources} draggable>
        {#if id === "cues"}<div class="cue-heading" style:background-color={cueHeadingColor(show.name)}>◆　{show.name}</div>{:else}<ShowButton id={show.id} {show} />{/if}
    </SelectElem>
    {#if id !== "cues"}<button on:click={() => read(show.id)}>Läs och markera text</button>{/if}
{/each}
{#if id === "cues"}
    {#if creatingCue}<form on:submit|preventDefault={createCue}><input aria-label="Ny hållpunkt" placeholder="Rubrik" bind:value={cueName} /><button disabled={!cueName.trim()}>Spara</button><button type="button" on:click={() => creatingCue = false}>Avbryt</button></form>
    {:else}<button on:click={() => creatingCue = true}>＋ Skapa ny</button>{/if}
{/if}
{#if !resources.length && id !== "cues"}<p class="hint">Inga resurser här ännu. Installera ett paket via Gemensam import.</p>{/if}
{#if reading && id !== "cues"}
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
    .cue-heading { padding: 5px 10px; color: white; font-weight: 700; cursor: grab; }
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
