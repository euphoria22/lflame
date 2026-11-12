import { DEFAULT_LOYALTY, dropForecast, isExcludedCounterparty, loyaltyPrice, nextTier, normalizePhone, periodTotal, tierFor, validateLoyalty } from "./rules"

const day = (n: number) => new Date(Date.UTC(2026, 10, 8) + n * 86_400_000)
const now = day(0)
const e = (amount: number, creditDay: number, status = "credited") => ({ amount, status, credit_at: day(creditDay), purchased_at: day(creditDay - 7) })

describe("лояльность: правила", () => {
  it("телефон", () => {
    expect(normalizePhone("8 (913) 000-00-00")).toBe("+79130000000")
    expect(normalizePhone("9130000000")).toBe("+79130000000")
    expect(normalizePhone("+7 913 000 00 00")).toBe("+79130000000")
    expect(normalizePhone("3812 22-33-44")).toBeNull()
  })
  it("уровни по сумме", () => {
    const t = DEFAULT_LOYALTY.tiers
    expect(tierFor(0, t).code).toBe("BASE")
    expect(tierFor(49999, t).code).toBe("BASE")
    expect(tierFor(50000, t).code).toBe("MEMBER")
    expect(tierFor(250000, t).code).toBe("ICON")
    expect(tierFor(400000, t).code).toBe("PRIVATE")
    expect(nextTier(60000, t)?.code).toBe("SELECT")
    expect(nextTier(500000, t)).toBeNull()
  })
  it("сумма за скользящие 12 месяцев: pending и старое не считаются, возвраты вычитаются", () => {
    const list = [e(30000, -10), e(25000, -100), e(-5000, -5), e(40000, -400), e(70000, 3, "pending"), e(10000, -1, "cancelled")]
    expect(periodTotal(list, 365, now)).toBe(50000)
  })
  it("прогноз понижения", () => {
    // 60 000 засчитано 350 дней назад -> через 30 дней выбудет
    const list = [e(60000, -350), e(10000, -20)]
    const f = dropForecast(list, DEFAULT_LOYALTY, now)
    expect(f?.level.code).toBe("MEMBER")
    expect(f?.future.code).toBe("BASE")
    expect(f?.need).toBe(40000)
    expect(dropForecast([e(60000, -10)], DEFAULT_LOYALTY, now)).toBeNull()
  })
  it("«большая из двух»: скидка уровня и уценка не суммируются", () => {
    expect(loyaltyPrice(10000, null, 10)).toBe(9000)
    // постоянная уценка + скидка уровня суммируются: от текущей цены
    expect(loyaltyPrice(7000, 10000, 10)).toBe(6300)
    expect(loyaltyPrice(9500, 10000, 15)).toBe(8075)
    expect(loyaltyPrice(9500, 10000, 0)).toBe(9500)
  })
  it("обезличенные контрагенты", () => {
    expect(isExcludedCounterparty("Онлайн-заказ B2B Мой склад", DEFAULT_LOYALTY)).toBe(true)
    expect(isExcludedCounterparty("Алиса Опт", DEFAULT_LOYALTY)).toBe(true)
    expect(isExcludedCounterparty("Иванова Мария", DEFAULT_LOYALTY)).toBe(false)
  })
  it("проверка настроек", () => {
    expect(validateLoyalty({ tiers: [{ code: "A", name: "A", threshold: 100, discount: 5 }] }).error).toBeTruthy()
    expect(validateLoyalty({ tiers: [{ code: "base", name: "Base", threshold: 0, discount: 0 }, { code: "vip", name: "VIP", threshold: 1000, discount: 60 }] }).error).toBeTruthy()
    const ok = validateLoyalty({ excluded_brands: "Stone Island, Yeezy Gap" as unknown as string[] })
    expect(ok.value?.excluded_brands).toEqual(["Stone Island", "Yeezy Gap"])
  })
})

describe("автоматические акции и скидка Club", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { hasAutoPromo } = require("./cart") as typeof import("./cart")
  it("скидка не от промокода — автоматическая акция", () => {
    expect(hasAutoPromo({ adjustments: [{ code: "STONE-20", amount: 2000 }] }, {})).toBe(true)
    expect(hasAutoPromo({ adjustments: [{ code: "SALE10", amount: 500 }] }, { promo_code: "sale10" })).toBe(false)
    expect(hasAutoPromo({ adjustments: [] }, {})).toBe(false)
  })
})
