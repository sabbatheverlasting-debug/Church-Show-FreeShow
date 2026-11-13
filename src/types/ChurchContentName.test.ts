import { expect, it } from "vitest"
import { churchContentName } from "./ChurchContentName"
it("keeps imported titles inside native data folders", () => {
    expect(churchContentName("../../outside\\name\0")).toBe("....outsidename")
    expect(churchContentName(" / ")).toBe("Namnlöst innehåll")
    expect(churchContentName("å".repeat(400))).toHaveLength(180)
})
