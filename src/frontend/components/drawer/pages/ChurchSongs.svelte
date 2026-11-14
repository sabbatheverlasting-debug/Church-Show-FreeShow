<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { uniqueAudioMatches } from "../../../../types/ChurchAudioMatch"
    import { requestMain } from "../../../IPC/main"
    import { audioFolders, categories, selected, shows } from "../../../stores"
    import { droppedAudio, pairChurchAudio } from "../../../converters/churchAudio"
    import { encodeFilePath } from "../../helpers/media"
    import SelectElem from "../../system/SelectElem.svelte"
    import ShowButton from "../../inputs/ShowButton.svelte"
    import ChurchAudioTools from "../audio/ChurchAudioTools.svelte"
    import ChurchProgramBuilder from "./ChurchProgramBuilder.svelte"
    export let searchValue = ""
    let files: { name: string; path: string; isFolder?: boolean }[] = []
    let message = "",
        showAll = false,
        planning = true
    $: library = Object.entries($shows)
        .filter(([, show]) => !["church_books", "church_questions", "church_cues", "church_studies"].includes(show.category || ""))
        .map(([id, show]) => ({ ...show, id }))
    $: songs = library.filter((show) => (showAll || show.quickAccess?.churchAudio || /song|sång|hymn|sion/i.test(show.category + " " + ($categories[show.category || ""]?.name || ""))) && show.name.toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))
    $: ambiguous = uniqueAudioMatches(
        library.map((show) => ({ id: show.id, name: show.name, paired: !!show.quickAccess?.churchAudio })),
        files
    ).ambiguous
    async function refresh() {
        try {
            const paths = Object.values($audioFolders)
                .map((folder) => folder.path)
                .filter((path): path is string => !!path)
            if (!paths.length) {
                message = "Lägg till dina ljudmappar under Audio för automatisk koppling. Du kan även dra en ljudfil direkt till sången."
                return
            }
            const data = await requestMain(Main.READ_FOLDER, { path: paths, depth: 0 }, undefined, 120000)
            files = Object.values(data || {}).filter((file) => !file.isFolder && /\.(mp3|m4a|wav|ogg|flac|aac|aiff|aif)$/i.test(file.name))
            message = `${files.length} ljudfiler inlästa från ljudbiblioteket.`
        } catch {
            message = "Ljudbiblioteket kunde inte läsas. Försök uppdatera igen."
        }
    }
    onMount(refresh)
    function drag(event: DragEvent, id: string) {
        selected.set({ id: "show_drawer", data: [{ id }] })
        event.dataTransfer?.setData("application/x-church-song", id)
        event.dataTransfer?.setData("text/plain", $shows[id]?.name || "")
    }
    async function dropAudio(event: DragEvent, id: string) {
        const path = droppedAudio(event)
        if (!path) return
        event.preventDefault()
        event.stopPropagation()
        await pairChurchAudio(id, path)
        message = "Ljudkopplingen har behandlats. Låsta och skrivskyddade sånger ändras inte."
    }
</script>

<div class="songs">
    <div class="tools"><label><input type="checkbox" bind:checked={planning} /> Visa planeringen bredvid sångerna</label><label><input type="checkbox" bind:checked={showAll} /> Visa även övriga bildspel</label><button on:click={refresh}>Läs om ljudbiblioteket</button></div>
    <p>Dra sången upp till ditt vanliga show-program eller till planeringen bredvid. Ljudkopplingen följer med. Dra en ljudfil till sången för att koppla eller byta ljud.</p>
    <ChurchAudioTools {files} />
    {#if message}<p role="status">{message}</p>{/if}
    <div class="columns" class:planning>
        <div class="library">
            {#each songs as song (song.id)}
                <div class="song" on:dragstart={(event) => drag(event, song.id)} on:dragover|preventDefault on:drop={(event) => dropAudio(event, song.id)}>
                    <SelectElem id="show_drawer" data={{ id: song.id }} shiftRange={songs} draggable><ShowButton id={song.id} show={song} /></SelectElem>
                    {#if song.quickAccess?.churchAudio}
                        <p class="paired">↔ Kopplad: {song.quickAccess.churchAudio.name}</p>
                        <audio controls preload="none" src={encodeFilePath(song.quickAccess.churchAudio.path)}></audio>
                    {:else}<p>{ambiguous.includes(song.name) ? "Flera möjliga träffar – välj ljud manuellt" : "Saknar kopplat ljud"}</p>{/if}
                </div>
            {/each}
            {#if !songs.length}<p>Inga sånger matchar. Välj ”Visa även övriga bildspel” om sångerna ännu inte ligger i en sångkategori.</p>{/if}
        </div>
        {#if planning}<div class="plan"><ChurchProgramBuilder /></div>{/if}
    </div>
</div>

<style>
    .songs {
        padding: 12px;
    }
    .tools {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        align-items: center;
    }
    .columns {
        display: grid;
        gap: 16px;
    }
    .columns.planning {
        grid-template-columns: minmax(220px, 1fr) minmax(300px, 1.3fr);
    }
    .library,
    .plan {
        min-width: 0;
    }
    .song {
        padding: 8px;
        margin: 8px 0;
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
    }
    .song p {
        font-size: 13px;
        overflow-wrap: anywhere;
    }
    .paired {
        color: var(--secondary);
    }
    audio {
        width: 100%;
        height: 32px;
    }
    @media (max-width: 700px) {
        .columns.planning {
            grid-template-columns: 1fr;
        }
    }
</style>
