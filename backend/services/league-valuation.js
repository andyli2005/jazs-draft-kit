const ROSTER_KEYS = [
    "catcher1",
    "catcher2",
    "firstBase",
    "secondBase",
    "thirdBase",
    "inField",
    "shortStop",
    "utility",
    "middleInField",
    "pitcher1",
    "pitcher2",
    "pitcher3",
    "pitcher4",
    "pitcher5",
    "pitcher6",
    "pitcher7",
    "pitcher8",
    "pitcher9",
    "outfielder1",
    "outfielder2",
    "outfielder3",
    "outfielder4",
    "outfielder5",
];

// Roster keys => { abbreivated positions => weights }
const POSITION_WEIGHTS = {
  catcher1: { "C": 1 },
  catcher2: { "C": 1 },
  firstBase: { "1B": 1 },
  secondBase: { "2B": 1 },
  thirdBase: { "3B": 1 },
  inField: {
    "1B": 0.25,
    "2B": 0.25,
    "3B": 0.25,
    "SS": 0.25,
  },
  shortStop: { "SS": 1 },
  utility: {
    "C": 1 / 6,
    "1B": 1 / 6,
    "2B": 1 / 6,
    "3B": 1 / 6,
    "SS": 1 / 6,
    "OF": 1 / 6,
  },
  middleInField: {
    "2B": 0.5,
    "SS": 0.5,
  },
  outfielder1: { "OF": 1 },
  outfielder2: { "OF": 1 },
  outfielder3: { "OF": 1 },
  outfielder4: { "OF": 1 },
  outfielder5: { "OF": 1 },
  pitcher1: { "P": 1 },
  pitcher2: { "P": 1 },
  pitcher3: { "P": 1 },
  pitcher4: { "P": 1 },
  pitcher5: { "P": 1 },
  pitcher6: { "P": 1 },
  pitcher7: { "P": 1 },
  pitcher8: { "P": 1 },
  pitcher9: { "P": 1 },
};


function computeTotalMoneyRemaining(rosters) {
    return (rosters || []).reduce((sum, roster) => {
        const budgetLeft = roster?.budgetLeft;
        return sum + (Number.isFinite(budgetLeft) ? budgetLeft : 0);
    }, 0);
}

function computeRosterSpotsRemaining(roster) {
    let remaining = 0;
    for (const player of ROSTER_KEYS) {
        if (roster?.[player] == null) remaining += 1;
    }
    return remaining;
}

function computeMoneyAboveMinimum(totalMoneyRemaining, totalSpotsRemaining) {
    return Math.max(totalMoneyRemaining - totalSpotsRemaining, 0);
}

function computeRemainingSlotsPerPosition(rosters) {
  const remainingSlotsPerPosition = {};
  
  (rosters || []).forEach((roster) => {
    Object.entries(POSITION_WEIGHTS).forEach(([key, weights]) => {
      if (roster?.[key] != null) return;

      Object.entries(weights).forEach(([pos, weight]) => {
        remainingSlotsPerPosition[pos] = (remainingSlotsPerPosition[pos] || 0) + weight;
      })
    })
  })

  return remainingSlotsPerPosition;
}

module.exports = {
    computeTotalMoneyRemaining,
    computeRosterSpotsRemaining,
    computeMoneyAboveMinimum,
    computeRemainingSlotsPerPosition
}