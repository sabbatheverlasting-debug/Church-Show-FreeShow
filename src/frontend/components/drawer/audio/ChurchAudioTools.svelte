<script lang="ts">
    import { onDestroy } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { uniqueAudioMatches } from "../../../../types/ChurchAudioMatch"
    import { pairChurchAudio } from "../../../converters/churchAudio"
    import { shows, special } from "../../../stores"
    import { requestMain } from "../../../IPC/main"
    export let files: { path: string; name: string; isFolder?: boolean }[] = []
    let message = "", busy = false, groups: string[][] = [], timeout: ReturnType<typeof setTimeout>
    $: audio = files.filter((file) => !file.isFolder)
    $: candidates = uniqueAudioMatches(Object.entries($shows).filter(([, show]) => !["church_books", "church_cues", "church_questions", "church_studies"].includes(show.category || "")).map(([id, show]) => ({ id, name: show.name, paired: !!show.quickAccess?.churchAudio })), audio)
    $: if (candidates && $special.churchAutoPair !== false) schedule()
    function schedule() { clearTimeout(timeout); timeout = setTimeout(() => pair(), 700) }
    onDestroy(() => clearTimeout(timeout))
    async function pair() {
        if (busy || !candidates.matches.length) return
        busy = true
        const matches = [...candidates.matches]
        for (const match of matches) await pairChurchAudio(match.id, match.path)
        message = `${matches.length} entydiga träffar behandlade. Låsta eller skrivskyddade sånger ändras inte.`
        busy = false
    }
    const used = (path: string) => Object.values($shows).some((show) => show.quickAccess?.churchAudio?.path === path)
    async function duplicates() {
        busy = true
        try { const result = await requestMain(Main.CHURCH_AUDIO_FILES, { paths: audio.map((file) => file.path) }, undefined, 120000); groups = result?.groups || []; message = `${groups.length} grupper med byte-identiska ljudfiler hittades i den här vyn. ${result?.errors?.length || 0} filer kunde inte läsas.` }
        catch { message = "Dubblettsökningen misslyckades." }
        busy = false
    }
    async function remove(file: string, keep: string) {
        busy = true
        try { await requestMain(Main.CHURCH_AUDIO_FILES, { remove: file, keep }, undefined, 120000); groups = groups.map((group) => group.filter((path) => path !== file)).filter((group) => group.length > 1); message = "Kopian flyttades till papperskorgen. Uppdatera ljudvyn för att läsa om filerna." }
        catch { message = "Filen kunde inte flyttas. Den kan ha ändrats sedan sökningen." }
        busy = false
    }
</script>
<details style="padding:8px;background:var(--primary-darker);">
    <summary>Sångkopplingar och dubletter</summary>
    <label><input type="checkbox" checked={$special.churchAutoPair !== false} on:change={(event) => special.update((value) => ({ ...value, churchAutoPair: event.currentTarget.checked }))} /> Para ljud och sång automatiskt vid entydigt namn</label>
    <p>Gäller ljudfilerna i den öppna ljudvyn. Befintliga kopplingar behålls. Olika versioner eller flera träffar kopplas inte automatiskt.</p>
    <button disabled={busy} on:click={duplicates}>Hitta identiska ljudfiler</button>
    {#if candidates.ambiguous.length}<p>Behöver väljas manuellt: {candidates.ambiguous.join(", ")}</p>{/if}
    {#each groups as group}
        {@const sorted = [...group].sort((a, b) => Number(used(b)) - Number(used(a)))}
        <div style="padding:8px;border-top:1px solid var(--primary-lighter);"><p>Behåll: {sorted[0]}</p>{#each sorted.slice(1) as file}<p>{file} <button disabled={busy || used(file)} on:click={() => remove(file, sorted[0])}>{used(file) ? "Kopplad till sång – behålls" : "Flytta kopian till papperskorgen"}</button></p>{/each}</div>
    {/each}
    {#if message}<p role="status">{message}</p>{/if}
</details>
