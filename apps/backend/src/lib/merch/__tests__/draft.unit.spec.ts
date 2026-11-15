import { draftLayout } from "../../../admin/lib/merch/catalog"
import { checkLayout } from "../checks"

it("черновик зала проходит проверку без ошибок (пересечения, стены, вход)", () => {
  const d = draftLayout()
  expect(checkLayout(d.items, d.room).filter((x) => x.level === "error").map((x) => x.text)).toEqual([])
})
