const WEIGHT_PROJECTED = 0.6;
const WEIGHT_CURR = 0.25;
const WEIGHT_3YEAR = 0.15;

function toNumber(val) {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
}

function computeBasePoints(player) {
    const projected = toNumber(player.projectedStats?.fantasyPoints);
    const curr = toNumber(player.currentStats?.fantasyPoints ?? player.fantasyPoints);
    const threeYearAvg = toNumber(player.threeYearAverageStats?.fantasyPoints);

    const base =
        projected * WEIGHT_PROJECTED +
        curr * WEIGHT_CURR +
        threeYearAvg * WEIGHT_3YEAR;

    return Math.max(0, base);
}

function computeAgeMultiplier(player) {
    const age = player.age;
    if (age == null) return 0;

    if (age <= 20) {
        return 0;
    } else if (age <= 25) {
        return 0.1 + (25 - age) / 50;
    } else if (age <= 29) {
        return (29 - age) / 40;
    } else if (age === 30) {
        return 0
    } else if (age <= 35) {
        return -(35 - age) / 50
    } else {
        return -0.2;
    }
}

function computeRankMultiplier(player) {
    const rank = player.rank;
    if (rank == null) return 0;

    if (rank >= 1 && rank <= 3) {
        return 0.1;
    } else if (rank <= 6) {
        return 0;
    } else {
        return -0.1;
    }
}

function factorInjury(player, points) {
    const isInjured = player.injury;
    if (isInjured == null || !isInjured) return points;
    const days = 20;

    return points * (90 - days) / 90;
}

function computeTotalPoints(player) {
    const base = computeBasePoints(player);
    const age_multiplier = computeAgeMultiplier(player);
    const rank_multiplier = computeRankMultiplier(player);

    const points = base * (1 + age_multiplier) * (1 + rank_multiplier);
    const withInjury = factorInjury(player, points);
    return Math.max(0, withInjury);
}

module.exports = {
    computeBasePoints,
    computeAgeMultiplier,
    computeRankMultiplier,
    factorInjury,
    computeTotalPoints
}