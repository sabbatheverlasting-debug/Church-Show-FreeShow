import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
const h = vi.hoisted(() => ({ displays: [] as any[], outputs: {} as Record<string, any>, constraints: vi.fn() }))
vi.mock("electron", () => ({ screen: { getAllDisplays: () => h.displays, getDisplayMatching: () => ({ scaleFactor: 2 }), getDisplayNearestPoint: () => h.displays[0] } }))
vi.mock("../..", () => ({ isMac: true, mainWindow: { getBounds: () => ({ x: 0, y: 0, width: 1440, height: 900 }) }, toApp: vi.fn() }))
vi.mock("../OutputHelper", () => ({ OutputHelper: { getOutput: (id: string) => h.outputs[id], getKeys: () => Object.keys(h.outputs), Lifecycle: { updateWindowConstraints: h.constraints } } }))
vi.mock("./OutputAlwaysOnTop", () => ({ setOutputAlwaysOnTop: vi.fn() }))
import { OutputVisibility } from "./OutputVisibility"
import { OutputBounds } from "./OutputBounds"
const internal = { id: 1, bounds: { x: 0, y: 0, width: 1440, height: 900 } }
const external = { id: 2, bounds: { x: 1440, y: 0, width: 1920, height: 1080 } }
beforeEach(() => { vi.useFakeTimers(); h.displays = [internal, external]; h.outputs = {}; h.constraints.mockClear() })
afterEach(() => { vi.runAllTimers(); vi.useRealTimers() })
describe("selected output display", () => {
    it("fills the chosen screen instead of preserving a small window on the control screen", () => {
        expect(OutputVisibility.resolveOutputBounds({ screen: "2", bounds: { x: 0, y: 0, width: 960, height: 540 } })).toEqual(external.bounds)
    })
    it("uses new display bounds after a resolution or arrangement change", () => {
        h.displays = [internal, { id: 2, bounds: { x: -2560, y: 0, width: 2560, height: 1440 } }]
        expect(OutputVisibility.resolveOutputBounds({ screen: "2", bounds: external.bounds })).toEqual(h.displays[1].bounds)
    })
    it("preserves intentional custom locked bounds", () => {
        expect(OutputVisibility.resolveOutputBounds({ screen: "2", bounds: internal.bounds, boundsLocked: true })).toEqual(internal.bounds)
    })
    it("keeps a disconnected target and restores it after reconnecting", () => {
        h.displays = [internal]
        const output = { screen: "2", bounds: external.bounds }
        expect(OutputVisibility.resolveOutputBounds(output)).toEqual(external.bounds)
        h.displays.push(external)
        expect(OutputVisibility.resolveOutputBounds(output)).toEqual(external.bounds)
    })
    it("releases a stale size lock, tracks the selected screen and discards old delayed moves", () => {
        const calls: string[] = []
        const window = { isDestroyed: () => false, isVisible: () => true, setMinimumSize: vi.fn(() => calls.push("min")), setMaximumSize: vi.fn(() => calls.push("max")), setBounds: vi.fn(() => calls.push("bounds")) }
        h.outputs.a = { window, boundsLocked: true }
        OutputBounds.updateBounds({ id: "a", bounds: internal.bounds, screen: "1" })
        OutputBounds.updateBounds({ id: "a", bounds: external.bounds, screen: "2" })
        vi.runAllTimers()
        expect(calls.slice(0, 3)).toEqual(["min", "max", "bounds"])
        expect(window.setBounds.mock.calls.slice(1).every(([bounds]) => bounds === external.bounds)).toBe(true)
        expect(h.outputs.a.screen).toBe("2")
        expect(h.constraints).toHaveBeenCalledTimes(1)
    })
})
