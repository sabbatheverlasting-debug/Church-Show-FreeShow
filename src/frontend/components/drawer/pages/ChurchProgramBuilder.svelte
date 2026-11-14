<script lang="ts">
    import { uid } from "uid"
    import { buildChurchProgram, type ProgramDraft, type ProgramRow } from "../../../../types/ChurchProgramBuilder"
    import { activePage, activeProject, projectView, shows, special } from "../../../stores"
    import { history } from "../../helpers/history"
    let draft: ProgramDraft = $special.churchProgramDraft || { title: "", rows: [] }
    let message = ""
    let created = false
    $: special.update((value) => ({ ...value, churchProgramDraft: draft }))
    $: available = Object.entries($shows)
        .map(([id, show]) => ({ id, ...show }))
        .sort((a, b) => a.name.localeCompare(b.name, "sv"))
    $: preview = draft.rows.map((row) => ({ title: row.title || $shows[row.resourceId]?.name || "Välj innehåll", person: row.person }))
    function add(kind: ProgramRow["kind"]) {
        draft = { ...draft, rows: [...draft.rows, { id: uid(), kind, resourceId: "", title: "", person: "", notes: "" }] }
        created = false
    }
    function move(index: number, offset: number) {
        const rows = [...draft.rows]
        ;[rows[index], rows[index + offset]] = [rows[index + offset], rows[index]]
        draft = { ...draft, rows }
        created = false
    }
    function remove(id: string) {
        draft = { ...draft, rows: draft.rows.filter((row) => row.id !== id) }
        created = false
    }
    function create() {
        try {
            const project = buildChurchProgram(draft, $shows)
            const id = uid()
            history({ id: "UPDATE", newData: { data: project }, oldData: { id }, location: { page: "show", id: "project" } })
            activeProject.set(id)
            activePage.set("show")
            projectView.set(false)
            message = `Project ”${project.name}” har skapats med ${draft.rows.length} programpunkter.`
            created = true
        } catch (error) {
            message = (error as Error).message
        }
    }
</script>

<div class="builder">
    <h2>Programbyggare</h2>
    <p>Välj sånger och färdiga studier från biblioteket och ange vem som gör vad. Programmet skapas som ett nytt project med hållpunkter i din ordning. Sångernas ljudkopplingar följer med.</p>
    <label>Programmets rubrik <input bind:value={draft.title} on:input={() => (created = false)} placeholder="Till exempel Sabbatsgudstjänst – Hopp" /></label>
    <div class="actions"><button on:click={() => add("song")}>+ Sång</button><button on:click={() => add("study")}>+ Studium / bildspel</button><button on:click={() => add("cue")}>+ Hållpunkt</button></div>
    {#each draft.rows as row, index (row.id)}
        <fieldset on:input={() => (created = false)} on:change={() => (created = false)}>
            <legend>{index + 1}. {row.kind === "song" ? "Sång" : row.kind === "study" ? "Studium / bildspel" : "Hållpunkt"}</legend>
            {#if row.kind !== "cue"}
                <label
                    >Innehåll från biblioteket <select bind:value={row.resourceId}
                        ><option value="">Välj innehåll…</option>{#each available.filter((show) => (row.kind === "song" ? !["church_books", "church_questions", "church_cues", "church_studies"].includes(show.category || "") : !["church_books", "church_cues"].includes(show.category || ""))) as show}<option value={show.id}>{show.name}</option>{/each}</select
                    ></label
                >
            {/if}
            <label>Rubrik för punkten <input bind:value={row.title} placeholder={row.kind === "cue" ? "Till exempel Välkommen eller Bön" : "Använd innehållets titel"} /></label>
            <label>Ansvarig / medverkande <input bind:value={row.person} placeholder="Namn" /></label>
            <label>Anteckningar för ledaren <textarea bind:value={row.notes} rows="2"></textarea></label>
            <div class="actions"><button disabled={index === 0} on:click={() => move(index, -1)} aria-label="Flytta punkten upp">↑ Upp</button><button disabled={index === draft.rows.length - 1} on:click={() => move(index, 1)} aria-label="Flytta punkten ned">↓ Ned</button><button on:click={() => remove(row.id)}>Ta bort punkt</button></div>
        </fieldset>
    {/each}
    {#if preview.length}<h3>Programordning</h3>
        <ol>
            {#each preview as row}<li>{row.title}{row.person ? " · " + row.person : ""}</li>{/each}
        </ol>{/if}
    <p>Hållpunkter och ansvariga är ledarinformation. De läggs inte på projektorn som egna textbilder. Utkastet sparas när du byter flik.</p>
    <button class="create" disabled={created || !draft.rows.length || !draft.title.trim()} on:click={create}>{created ? "Project skapat" : "Skapa project från programmet"}</button>
    {#if message}<p role="status">{message}</p>{/if}
</div>

<style>
    .builder {
        padding: 20px;
        max-width: 1000px;
    }
    label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin: 10px 0;
    }
    input,
    select,
    textarea {
        padding: 9px;
        color: var(--text);
        background: var(--primary);
        border: 1px solid var(--primary-lighter);
        border-radius: 5px;
    }
    fieldset {
        border: 1px solid var(--primary-lighter);
        padding: 12px;
        margin: 16px 0;
        border-radius: 8px;
    }
    .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 12px 0;
    }
    button {
        padding: 8px 14px;
        border: 1px solid var(--primary-lighter);
        border-radius: 5px;
    }
    .create {
        border-color: #d6ba79;
    }
    p,
    li {
        line-height: 1.6;
    }
</style>
