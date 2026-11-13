import { describe, expect, it } from "vitest"
import { detachPreviousBackgroundFolders, visibleBackgroundFolders, resetDefaultBackground } from "./churchFolders"
describe("detached background folders", () => {
    it("retains paths and metadata while removing folders from the active library", () => {
        const saved = { pictures: { name: "Bilder", path: "/Users/test/Pictures", mediaType: "background" as const } }
        const migrated = detachPreviousBackgroundFolders(saved)
        expect(migrated.pictures.path).toBe(saved.pictures.path)
        expect(migrated.pictures.mediaType).toBe("background")
        expect(visibleBackgroundFolders(migrated)).toEqual({})
        expect(saved.pictures).not.toHaveProperty("churchDetached")
        migrated.pictures.churchDetached = false
        expect(visibleBackgroundFolders(migrated).pictures.path).toBe(saved.pictures.path)
    })
})

it("resets a default background once while retaining custom templates", () => {
    const values = { default: { settings: { backgroundPath: "/old.jpg" } }, custom: { settings: { backgroundPath: "/keep.jpg" } } }
    const result = resetDefaultBackground(values, true)
    expect(result.default.settings.backgroundPath).toBeUndefined()
    expect(result.custom).toEqual(values.custom)
    expect(values.default.settings.backgroundPath).toBe("/old.jpg")
    result.default.settings.backgroundPath = "/chosen-later.jpg"
    expect(resetDefaultBackground(result, true).default.settings.backgroundPath).toBe("/chosen-later.jpg")
})
