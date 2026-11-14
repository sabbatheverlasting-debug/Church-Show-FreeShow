<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { calendars, activeProject, projects, events } from "../../../stores"
    import { history } from "../../helpers/history"
    import { uid } from "uid"
    import { openProject } from "../../show/project"
    let calendar = "__unassigned__", includeNotes = false, status: any = {}, busy = false, message = ""
    let date = new Date().toLocaleDateString("sv-SE"), time = "10:30"
    async function update(action: "enable" | "disable" | "status") {
        busy = true
        try { status = await requestMain(Main.CHURCH_CALENDAR, { action, calendar, includeNotes, name: $calendars[calendar]?.name || "Church Show" }); message = status?.error || "" }
        catch { message = "Delningen kunde inte uppdateras." }
        busy = false
    }
    onMount(async () => { await update("status"); if (status?.enabled) { calendar = status.calendar; includeNotes = status.includeNotes } })
    async function copy(url: string) { try { await navigator.clipboard.writeText(url); message = "Länken är kopierad." } catch { message = "Markera länken och kopiera den." } }
    function plan() {
        const project = $activeProject && $projects[$activeProject]
        const from = new Date(date + "T" + time), to = new Date(from.getTime() + 60 * 60 * 1000)
        if (!project || !Number.isFinite(from.getTime())) return
        const id = uid()
        history({ id: "UPDATE", newData: { data: { [id]: { name: project.name, type: "event", from: from.toString(), to: to.toString(), time: true, repeat: false, color: "#D6BA79", churchProjectId: $activeProject, ...(calendar !== "__unassigned__" ? { origin: calendar } : {}) } }, keys: [id] }, location: { page: "drawer", id: "event" } })
        message = "Projektet är inlagt i kalendern, med en timmes längd. Ändra tiden i kalenderhändelsen vid behov."
    }
</script>
<details class="share">
    <summary>Planera och dela kalender</summary>
    <label>Kalender <select bind:value={calendar}><option value="__unassigned__">Händelser utan kalender</option>{#each Object.entries($calendars) as [id, cal]}<option value={id}>{cal.name}</option>{/each}</select></label>
    <label><input type="checkbox" bind:checked={includeNotes} /> Ta med anteckningar i delningen</label>
    <p>Prenumerationslänken uppdateras med sparade kalenderändringar. Den fungerar på ditt lokala nätverk medan Church Show är igång. Delning utanför hemmet behöver en server eller NAS med en publik adress. Ingen sådan anslutning är konfigurerad här.</p>
    <button disabled={busy} on:click={() => update("enable")}>{status?.enabled ? "Skapa ny länk (ersätter den gamla)" : "Aktivera prenumerationslänk"}</button>
    {#if status?.enabled}<button disabled={busy} on:click={() => update("disable")}>Stäng av delning</button>{/if}
    {#each status?.urls || [] as url}<div><input aria-label="Prenumerationslänk" readonly value={url} on:focus={(event) => event.currentTarget.select()} /><button on:click={() => copy(url)}>Kopiera</button></div>{/each}
    {#if $activeProject}<div><label>Datum <input type="date" bind:value={date} /></label><label>Tid <input type="time" bind:value={time} /></label><button on:click={plan}>Planera aktivt projekt</button></div>{/if}
    {#each Object.entries($events).filter(([, event]) => event.churchProjectId && $projects[event.churchProjectId]) as [, event]}<button on:click={() => openProject(event.churchProjectId || "")}>{new Date(event.from).toLocaleDateString("sv-SE")} · Öppna {event.name}</button>{/each}
    {#if message}<p role="status">{message}</p>{/if}
</details>
<style>.share { padding: 10px; background: var(--primary-darker); } .share p { max-width: 750px; font-size: 13px; } label { display: inline-block; padding: 6px; } input[readonly] { width: min(650px, 80%); } button { margin: 5px; padding: 7px; }</style>
