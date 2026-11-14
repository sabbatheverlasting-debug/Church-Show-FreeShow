import { expect, it } from "vitest"
import { projectMonthGroups } from "./ChurchProjectMonths"
it("groups by creation month newest first without guessing missing dates", () => {
 const groups = projectMonthGroups([{ name:"old",created:new Date(2025,11,1).getTime() },{ name:"new",created:new Date(2026,10,14).getTime() },{ name:"unknown" }])
 expect(groups.map(g=>g.key)).toEqual(["2026-11","2025-12","unknown"])
 expect(groups[0].label).toContain("2026")
})
