import { get } from "svelte/store"
import { activeDrawerTab, activePage, drawer } from "../stores"
export function openChurchPlanning() {
    activePage.set("planning")
    if (get(activeDrawerTab) === "program_builder") activeDrawerTab.set("songs")
    drawer.update((value) => ({ ...value, height: Math.min(Math.max(value.height, 180), Math.max(180, window.innerHeight * 0.34)), autoclosed: false }))
}
