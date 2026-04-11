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


module.exports = {
    computeTotalMoneyRemaining,
    computeRosterSpotsRemaining,
    computeMoneyAboveMinimum
}