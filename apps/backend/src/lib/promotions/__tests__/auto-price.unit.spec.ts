import { autoPrice, AutoPromo, matches, PromoProduct } from "../auto-price"

const p = (x: Partial<PromoProduct> = {}): PromoProduct => ({ id: "prod_1", collection_id: "col_yeezy", type_id: null, tag_ids: [], category_ids: [], discountable: true, ...x })
const promo = (x: Partial<AutoPromo>): AutoPromo => ({ id: "promo", label: "11.11", type: "percentage", value: 25, rules: [], ...x })

// Как настроено 11.11: −25% на MISBHV и YEEZY, −20% на CK и TH, −15% на остальные; предзаказ — без скидки
const PRE = "tag_preorder"
const p25 = promo({ id: "25", value: 25, rules: [{ attribute: "items.product.collection_id", operator: "in", values: ["col_misbhv", "col_yeezy"] }, { attribute: "items.product.tags.id", operator: "ne", values: [PRE] }] })
const p20 = promo({ id: "20", value: 20, rules: [{ attribute: "items.product.collection_id", operator: "in", values: ["col_ck", "col_th"] }, { attribute: "items.product.tags.id", operator: "ne", values: [PRE] }] })
const p15 = promo({ id: "15", value: 15, rules: [{ attribute: "items.product.collection_id", operator: "ne", values: ["col_misbhv", "col_yeezy", "col_ck", "col_th"] }, { attribute: "items.product.tags.id", operator: "ne", values: [PRE] }] })
const all = [p25, p20, p15]

describe("цена по автоматическим акциям", () => {
  it("скидка по бренду", () => {
    expect(autoPrice(9990, p(), all)).toEqual({ price: 7493, label: "11.11", pct: 25 })
    expect(autoPrice(10000, p({ collection_id: "col_ck" }), all)).toMatchObject({ price: 8000, pct: 20 })
    expect(autoPrice(10000, p({ collection_id: "col_cp" }), all)).toMatchObject({ price: 8500, pct: 15 })
    expect(autoPrice(10000, p({ collection_id: null }), all)).toMatchObject({ price: 8500 })
  })
  it("предзаказ и «Без скидок вообще» — без акции", () => {
    expect(autoPrice(10000, p({ tag_ids: [PRE] }), all)).toBeNull()
    expect(autoPrice(10000, p({ discountable: false }), all)).toBeNull()
  })
  it("фиксированная скидка и неизвестное условие", () => {
    expect(autoPrice(10000, p(), [promo({ type: "fixed", value: 1000 })])).toMatchObject({ price: 9000, pct: 10 })
    expect(matches(p(), promo({ rules: [{ attribute: "items.unknown", operator: "in", values: ["x"] }] }))).toBe(false)
  })
  it("несколько подходящих — самая выгодная", () => {
    expect(autoPrice(10000, p(), [promo({ value: 10 }), promo({ value: 30, label: "Чёрная пятница" })])).toMatchObject({ price: 7000, label: "Чёрная пятница" })
  })
})
