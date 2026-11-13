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
    $: reading = $showsCache[readingId]
    async function read(id: string) {
        readingId = id
        await loadShows([id])
    }
    function dragQuote(event: DragEvent) {
        const quote = window.getSelection()?.toString().trim()
        if (!quote || !reading) return
        selected.set({ id: null, data: [] })
        event.dataTransfer?.setData("text/plain", quote + "\n\n" + (reading.meta.publisher || reading.name))
    }
    export let id: string
    export let searchValue = ""
    $: category = id === "books" ? "church_books" : id === "questions" ? "church_questions" : "church_cues"
    $: resources = Object.entries($shows)
        .filter(([id, show]) => show.category === category && (show.name + " " + JSON.stringify($textCache[id] || "")).toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))
        .map(([id, show]) => ({ ...show, id }))
    function importPackage() {
        sendMain(Main.IMPORT, { channel: "church_package", format: { name: "Gemensam import · ZIP / JSON / text", extensions: ["zip", "json", "txt", "md"] } })
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
        {#each Object.values(reading.slides) as slide}<p style="white-space:pre-wrap;line-height:1.6;">{getSlideText(slide)}</p>{/each}
    </article>
{/if}

<style>
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
