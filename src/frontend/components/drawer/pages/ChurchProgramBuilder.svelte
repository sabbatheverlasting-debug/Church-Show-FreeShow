<script lang="ts">
    import { churchContentName } from "../../../../types/ChurchContentName"
    import { uid } from "uid"
    import { buildChurchProgram, programFileType, type ProgramDraft, type ProgramRow } from "../../../../types/ChurchProgramBuilder"
    import { splitChurchText } from "../../../../types/ChurchPackage"
    import { activePage, activeProject, projectView, selected, shows, special } from "../../../stores"
    import { ShowObj } from "../../../classes/Show"
    import { history } from "../../helpers/history"
    let draft: ProgramDraft = $special.churchProgramDraft || { title: "", rows: [] }
    let message = "",
        created = false,
        busy = false
    const accept = ".txt,.md,.pdf,.jpg,.jpeg,.png,.webp,.gif,.svg,.mp4,.mov,.webm,.m4v,.mp3,.m4a,.wav,.ogg,.flac,.aac,.aiff,.aif"
    $: special.update((value) => ({ ...value, churchProgramDraft: draft }))
    $: available = Object.entries($shows)
        .filter(([, show]) => show.category !== "church_books")
        .map(([id, show]) => ({ id, ...show }))
        .sort((a, b) => a.name.localeCompare(b.name, "sv"))
    function blank(kind: ProgramRow["kind"]): ProgramRow {
        return { id: uid(), kind, resourceId: "", title: "", person: "", notes: "" }
    }
    function add(kind: ProgramRow["kind"]) {
        draft = { ...draft, rows: [...draft.rows, blank(kind)] }
        created = false
    }
    function put(content: Partial<ProgramRow>, target?: string) {
        if (target) draft = { ...draft, rows: draft.rows.map((row) => (row.id === target ? { ...row, resourceId: "", file: undefined, text: undefined, ...content } : row)) }
        else draft = { ...draft, rows: [...draft.rows, { ...blank(content.kind || "study"), ...content }] }
        created = false
    }
    function choose(row: ProgramRow) {
        row.file = undefined
        row.text = undefined
        draft = { ...draft }
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
    async function attach(files: File[], target?: string) {
        busy = true
        const errors: string[] = []
        for (const [index, file] of files.entries()) {
            try {
                const destination = index === 0 ? target : undefined
                if (/\.(txt|md)$/i.test(file.name)) {
                    if (file.size > 500000) throw new Error("Textfilen är för stor (högst 500 kB).")
                    const text = (await file.text()).trim()
                    if (!text) throw new Error("Textfilen är tom.")
                    put({ kind: "study", title: file.name.replace(/\.(txt|md)$/i, ""), text }, destination)
                } else {
                    const type = programFileType(file.name)
                    if (!type) throw new Error("Filtypen stöds inte här. Importera PowerPoint via programmets import först.")
                    const path = window.api.showFilePath(file)
                    if (!path) throw new Error("Kunde inte hitta filens plats.")
                    put({ kind: "study", file: { path, name: file.name, type } }, destination)
                }
            } catch (error) {
                errors.push(`${file.name}: ${(error as Error).message}`)
            }
        }
        message = errors.length ? errors.join("\n") : "Filen har lagts in i planeringen."
        busy = false
    }
    async function fileInput(event: Event, target?: string) {
        const input = event.currentTarget as HTMLInputElement
        await attach(Array.from(input.files || []), target)
        input.value = ""
    }
    async function drop(event: DragEvent, target?: string) {
        event.preventDefault()
        event.stopPropagation()
        if (busy) return
        if (event.dataTransfer?.files.length) {
            await attach(Array.from(event.dataTransfer.files), target)
            return
        }
        const songId = event.dataTransfer?.getData("application/x-church-song")
        const ids = songId ? [songId] : ["show_drawer", "show"].includes($selected.id || "") ? $selected.data.map((item) => item.id) : []
        if (ids.length) {
            let added = 0
            for (const id of ids) {
                const show = $shows[id]
                if (!show) continue
                if (show.category === "church_books") {
                    message = "Öppna boken, markera ett utdrag och dra texten hit."
                    continue
                }
                const kind = show.category === "church_cues" ? "cue" : songId || /song|sång|hymn/i.test(show.category || "") || show.quickAccess?.churchAudio ? "song" : "study"
                put({ kind, resourceId: kind === "cue" ? "" : id, title: kind === "cue" ? show.name : "" }, added === 0 ? target : undefined)
                added++
            }
            selected.set({ id: null, data: [] })
            if (added) message = `${added} programpunkter inlagda.`
            return
        }
        if (["media", "audio"].includes($selected.id || "")) {
            let added = 0
            for (const item of $selected.data) {
                const path = item.path || item.id
                if (typeof path !== "string") continue
                const name = item.name || path.split(/[\\/]/).pop() || path
                const type = programFileType(name)
                if (!type) continue
                put({ kind: "study", file: { path, name, type } }, added === 0 ? target : undefined)
                added++
            }
            selected.set({ id: null, data: [] })
            message = added ? `${added} filer inlagda i planeringen.` : "Dra en ljud-, video-, bild- eller PDF-fil."
            return
        }
        const quote = event.dataTransfer?.getData("application/x-church-quote")
        let text = event.dataTransfer?.getData("text/plain")?.trim() || ""
        if (quote) {
            try {
                const data = JSON.parse(quote)
                text = [data.text, data.source].filter(Boolean).join("\n\n")
            } catch {
                /* use plain text */
            }
        }
        if (text) {
            put({ kind: "study", text: text.slice(0, 500000), title: "Textutdrag" }, target)
            message = "Texten har lagts till. Skriv en rubrik för punkten."
        }
    }
    function create() {
        try {
            const pending: { id: string; show: ShowObj }[] = []
            const resources = { ...$shows }
            const names = new Set(Object.values(resources).map((show) => show.name.toLocaleLowerCase()))
            const rows = draft.rows.map((row) => {
                if (!row.text?.trim() || row.kind === "cue") return row
                if (!row.title.trim()) throw new Error("Skriv en rubrik för varje punkt med egen text.")
                const id = uid(),
                    show = new ShowObj(false, null, uid(), Date.now(), false)
                const name = churchContentName(row.title.trim())
                show.name = name
                for (let n = 2; names.has(show.name.toLocaleLowerCase()); n++) show.name = `${name} (${n})`
                names.add(show.name.toLocaleLowerCase())
                for (const text of splitChurchText(row.text)) {
                    const slideId = uid()
                    show.slides[slideId] = { group: row.title, color: null, notes: "", items: [{ style: "left:100px;top:110px;width:1720px;height:780px;", lines: [{ text: [{ value: text, style: "font-size:64px;color:#fff7e4;" }] }] }], settings: { color: "#122c38" } }
                    show.layouts[show.settings.activeLayout].slides.push({ id: slideId })
                }
                pending.push({ id, show })
                resources[id] = show
                return { ...row, resourceId: id, file: undefined }
            })
            const project = buildChurchProgram({ ...draft, rows }, resources)
            if (pending.length) history({ id: "SHOWS", newData: { data: pending, projectImport: true } })
            const id = uid()
            history({ id: "UPDATE", newData: { data: project }, oldData: { id }, location: { page: "show", id: "project" } })
            activeProject.set(id)
            projectView.set(false)
            activePage.set("show")
            created = true
        } catch (error) {
            message = (error as Error).message
        }
    }
</script>

<div class="builder" on:dragover|preventDefault on:drop={(event) => drop(event)}>
    <header>
        <div>
            <h2>Planering</h2>
            <p>Skriv, dra från biblioteket nedanför eller lägg in en fil från datorn.</p>
        </div>
        <button class="create" disabled={busy || created || !draft.rows.length || !draft.title.trim()} on:click={create}>Skapa project och öppna Show</button>
    </header>
    <label class="title">Programmets rubrik<input bind:value={draft.title} on:input={() => (created = false)} placeholder="Till exempel Sabbatsgudstjänst – Hopp" /></label>
    <div class="actions"><button on:click={() => add("song")}>+ Sång</button><button on:click={() => add("study")}>+ Studium / text / fil</button><button on:click={() => add("cue")}>+ Hållpunkt</button><label class="upload">Lägg in filer<input type="file" {accept} multiple disabled={busy} on:change={(event) => fileInput(event)} /></label></div>
    {#if message}<p role="status" class="message">{message}</p>{/if}
    <div class="points">
        {#each draft.rows as row, index (row.id)}
            <fieldset on:dragover|preventDefault on:drop={(event) => drop(event, row.id)} on:input={() => (created = false)} on:change={() => (created = false)}>
                <legend>{index + 1}. {row.kind === "song" ? "Sång" : row.kind === "cue" ? "Hållpunkt" : "Studium / text / fil"}</legend>
                <div class="fields"><label>Rubrik<input bind:value={row.title} placeholder={$shows[row.resourceId]?.name || row.file?.name || "Punktens rubrik"} /></label><label>Ansvarig / medverkande<input bind:value={row.person} placeholder="Vem gör detta?" /></label></div>
                {#if row.kind !== "cue"}
                    <div class="drop-field">
                        Släpp innehåll här för den här punkten
                        {#if row.file}<p>Fil: {row.file.name}</p>{:else if row.resourceId}<p>
                                Bibliotek: {$shows[row.resourceId]?.name || "Resursen saknas"}{#if $shows[row.resourceId]?.quickAccess?.churchAudio}
                                    · ljud kopplat{/if}
                            </p>{/if}
                        <label
                            >Välj från biblioteket<select bind:value={row.resourceId} on:change={() => choose(row)}
                                ><option value="">Välj innehåll…</option>{#each available as show}<option value={show.id}>{show.name}</option>{/each}</select
                            ></label
                        >
                        <label class="upload">Välj fil<input type="file" {accept} disabled={busy} on:change={(event) => fileInput(event, row.id)} /></label>
                    </div>
                    <label
                        >Egen text till bilderna<textarea
                            value={row.text || ""}
                            on:input={(event) => {
                                row.text = event.currentTarget.value
                                row.resourceId = ""
                                row.file = undefined
                                draft = { ...draft }
                            }}
                            rows="3"
                            placeholder="Skriv eller klistra in sångtext, bibeltext, frågor eller studium…"
                        ></textarea></label
                    >
                {/if}
                <label>Anteckningar för ledaren<textarea bind:value={row.notes} rows="2" placeholder="Visas inte som egen text på projektorn"></textarea></label>
                <div class="actions"><button disabled={index === 0} on:click={() => move(index, -1)}>↑ Upp</button><button disabled={index === draft.rows.length - 1} on:click={() => move(index, 1)}>↓ Ned</button><button on:click={() => remove(row.id)}>Ta bort punkt</button></div>
            </fieldset>
        {/each}
    </div>
    <div class="drop-hint">Släpp här för att lägga till en ny programpunkt</div>
    <p class="hint">Utkastet sparas när du byter vy. Filer länkas från sin plats på datorn. PDF, bilder, video, ljud och textfiler stöds här.</p>
</div>

<style>
    .builder {
        padding: 20px 28px;
        min-height: 100%;
        box-sizing: border-box;
    }
    header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
    }
    h2 {
        margin: 0;
    }
    header p,
    .hint {
        opacity: 0.75;
        font-size: 13px;
    }
    .title {
        max-width: 900px;
    }
    .points {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
        gap: 16px;
    }
    label {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin: 8px 0;
        min-width: 0;
    }
    input,
    select,
    textarea {
        box-sizing: border-box;
        width: 100%;
        padding: 9px;
        color: var(--text);
        background: var(--primary);
        border: 1px solid var(--primary-lighter);
        border-radius: 5px;
    }
    fieldset {
        min-width: 0;
        border: 1px solid var(--primary-lighter);
        padding: 12px;
        border-radius: 8px;
    }
    legend {
        padding: 0 6px;
        font-weight: bold;
    }
    .fields {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 12px;
    }
    .drop-field,
    .drop-hint {
        padding: 12px;
        border: 1px dashed #d6ba79;
        border-radius: 6px;
    }
    .drop-hint {
        margin-top: 16px;
        text-align: center;
        padding: 20px;
    }
    .drop-field p {
        color: var(--secondary);
        overflow-wrap: anywhere;
    }
    .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin: 12px 0;
    }
    button,
    .upload {
        padding: 8px 12px;
        border: 1px solid var(--primary-lighter);
        border-radius: 5px;
        cursor: pointer;
    }
    .upload {
        display: inline-flex;
        margin: 0;
    }
    .upload input {
        width: 210px;
        font-size: 12px;
        padding: 3px;
    }
    .create {
        border-color: #d6ba79;
        white-space: nowrap;
    }
    .message {
        white-space: pre-wrap;
    }
    p {
        line-height: 1.5;
    }
    @media (max-width: 700px) {
        header {
            flex-wrap: wrap;
        }
        .fields {
            grid-template-columns: 1fr;
        }
    }
</style>
