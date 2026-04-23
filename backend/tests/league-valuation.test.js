"use strict";

const {
  computeMoneyAboveMinimum,
  computeRosterSpotsRemaining,
  computeTotalMoneyRemaining,
} = require("../services/league-valuation");

describe("league-valuation", () => {
  it("computeTotalMoneyRemaining sums only finite roster budgets", () => {
    const total = computeTotalMoneyRemaining([
      { budgetLeft: 120 },
      { budgetLeft: 45.5 },
      { budgetLeft: Number.NaN },
      { budgetLeft: "80" },
      {},
      null,
    ]);

    expect(total).toBe(165.5);
  });

  it("computeTotalMoneyRemaining returns zero for missing rosters", () => {
    expect(computeTotalMoneyRemaining()).toBe(0);
    expect(computeTotalMoneyRemaining([])).toBe(0);
  });

  it("computeRosterSpotsRemaining counts every empty slot in the roster", () => {
    const remaining = computeRosterSpotsRemaining({
      catcher1: null,
      catcher2: { id: "p1" },
      firstBase: undefined,
      secondBase: { id: "p2" },
      outfielder1: 0,
    });

    expect(remaining).toBe(20);
  });

  it("computeRosterSpotsRemaining treats a missing roster as fully empty", () => {
    expect(computeRosterSpotsRemaining()).toBe(23);
  });

  it("computeMoneyAboveMinimum never returns a negative value", () => {
    expect(computeMoneyAboveMinimum(150, 80)).toBe(70);
    expect(computeMoneyAboveMinimum(12, 24)).toBe(0);
  });
});
