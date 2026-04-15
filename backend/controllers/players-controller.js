const db = require("../db");
const { computeTotalMoneyRemaining, computeRosterSpotsRemaining, computeMoneyAboveMinimum } = require("../services/league-valuation");

const DEFAULT_API_ENDPOINT = "http://localhost:4001";
const ROSTER_SLOT_KEYS = [
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

function getApiBase() {
  const raw = process.env.API_ENDPOINT || DEFAULT_API_ENDPOINT;
  return raw.replace(/\/+$/, "");
}

function extractPlayers(payload) {
  const source = Array.isArray(payload) ? payload : payload?.items || payload?.players || [];
  if (!Array.isArray(source)) {
    console.warn("Unexpected players payload format:", payload);
    return [];
  }

  return source.map((player) => ({
    APIplayerId: player._id,
    name: player.name,
    status: player.status,
    pictureURL: player.pictureURL,
    positions: player.positions,
    team: player.team,
    cost: player.cost,
    currentStats: player.currentStats || {},
    projectedStats: player.projectedStats || {},
    threeYearAverageStats: player.threeYearAverageStats || {},
    ...player.currentStats,
  }));
}

function buildUpstreamUrl(query, path="/api/players") {
  const searchParams = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, String(item)));
      return;
    }
    if (value != null && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  const base = `${getApiBase()}${path}`;
  return queryString ? `${base}?${queryString}` : base;
}

const getPlayers = async (req, res) => {
  if (!process.env.API_TOKEN) {
    return res.status(500).json({
      errorMessage: "Server configuration is missing API_TOKEN.",
    });
  }

  const { leagueId } = req.query;
  if (!leagueId) {
    return res.status(400).json({ errorMessage: "leagueId query parameter is required." });
  }
  let leagueState = null;

  const league = await db.getLeagueById(leagueId);
  if (!league) {
    return res.status(404).json({ errorMessage: "League not found. " });
  }
  const rosters = await Promise.all((league.rosterIds || []).map((id) => db.getMLBRosterById(id)));

  const totalMoneyRemaining = computeTotalMoneyRemaining(rosters);
  const spotsRemaining = rosters.reduce(
    (sum, roster) => sum + computeRosterSpotsRemaining(roster),
    0
  );
  const moneyAboveMinimum = computeMoneyAboveMinimum(totalMoneyRemaining, spotsRemaining);
  leagueState = { totalMoneyRemaining, spotsRemaining, moneyAboveMinimum };

  // Cost is NOT part of API Licensing database, so if user wants to sort by cost,
  // temporarily change rankBy to a valid data column
  const upstreamQuery = { ...req.query };
  if (upstreamQuery.rankBy === "cost") upstreamQuery.rankBy = "fantasyPoints";
    
  // Similarly, leagueId is not necessary for the query
  delete upstreamQuery.leagueId;

  upstreamQuery.moneyAboveMinimum = moneyAboveMinimum;

  const url = buildUpstreamUrl(upstreamQuery, "/api/players/evaluations");

  try {
    const response = await fetch(url, { headers: { "x-api-token": process.env.API_TOKEN } });

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      return res.status(response.status).json({
        errorMessage: data.errorMessage || data.message || data.error || "Failed to fetch players.",
      });
    }

    let players = extractPlayers(data);

    // The query from original request should contain the true rankBy, 
    // since it is overridden in the upstreamQuery previously
    if (req.query.rankBy === "cost") {
      const dir = String(req.query.order || "desc").toLowerCase() === "asc" ? 1 : -1;
      players = [...players].sort((a, b) => ((a.cost || 0) - (b.cost || 0)) * dir);
    }

    return res.status(200).json({
      success: true,
      players,
      leagueState,
    });
  } catch (err) {
    return res.status(502).json({
      errorMessage: `Unable to reach players service at ${url}.`,
    });
  }
}

const getTotalFantasyPoints = async (req, res) => {
  if (!process.env.API_TOKEN) {
    return res.status(500).json({
      errorMessage: "Server configuration is missing API_TOKEN.",
    });
  }

  const url = `${getApiBase()}/api/players/totalFantasyPoints`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-token": process.env.API_TOKEN,
      },
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      return res.status(response.status).json({
        errorMessage: data.errorMessage || data.message || "Failed to fetch players.",
      });
    }

    return res.status(200).json({
      success: true,
      totalPoints: data.totalPoints,
    });
  } catch (err) {
    return res.status(502).json({
      errorMessage: `Unable to reach players service at ${url}.`,
    });
  }
}

const getPlayerDoc = async (req, res) => {
  try {
    const { APIplayerId } = req.params;
    const { leagueId } = req.query;

    if (!leagueId) {
      return res.status(400).json({ errorMessage: "leagueId query parameter is required." });
    }

    const playerDoc = await db.getPlayerDoc(APIplayerId, leagueId);
    return res.status(200).json({ playerDoc });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ errorMessage: "Error fetching player document." });
  }
};

const upsertPlayerDoc = async (req, res) => {
  try {
    const { APIplayerId } = req.params;
    const {
      leagueId, personalNotes, name, status, notes,
      positions, team, pictureURL, price,
      currentStats, projectedStats, threeYearAverageStats,
    } = req.body;

    if (!leagueId) {
      return res.status(400).json({ errorMessage: "leagueId is required." });
    }

    const fields = {
      name,
      status,
      notes: notes || status || "",
      positions,
      team,
      pictureURL: pictureURL || "",
      price: price ?? 0,
      personalNotes: personalNotes || "",
      currentStats,
      projectedStats,
      threeYearAverageStats,
    };

    const prevDoc = await db.getPlayerDoc(APIplayerId, leagueId);
    const prevNotes = prevDoc?.personalNotes ?? "";
    const hasChangedNotes = prevNotes !== fields.personalNotes;

    const playerDoc = await db.upsertPlayerDoc(APIplayerId, leagueId, fields);

    if (hasChangedNotes) {
      const user = await db.getUserById(req.userId);
      const data = {
        teamOwner: user.userName,
        player: playerDoc.name,
        actionType: "UpdatedNotes",
        leagueId,
      };
      await db.createTransaction(data);
    }
    
    return res.status(200).json({ playerDoc });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ errorMessage: "Error saving player document." });
  }
};

const draftPlayer = async (req, res) => {
  try {
    const { APIplayerId } = req.params;
    const {
      leagueId,
      bidStartedById,
      draftedToRosterId,
      slotKey,
      draftCost,
      inactiveOverrideAccepted,
    } = req.body || {};

    if (!leagueId || !bidStartedById || !draftedToRosterId || !slotKey || draftCost == null) {
      return res.status(400).json({
        errorMessage: "leagueId, bidStartedById, draftedToRosterId, slotKey, and draftCost are required.",
      });
    }

    if (!ROSTER_SLOT_KEYS.includes(slotKey)) {
      return res.status(400).json({ errorMessage: "Invalid roster slot selected." });
    }

    if (!Number.isFinite(Number(draftCost))) {
      return res.status(400).json({ errorMessage: "draftCost must be a valid number." });
    }

    const normalizedDraftCost = Number(draftCost);
    if (normalizedDraftCost < 0) {
      return res.status(400).json({ errorMessage: "draftCost must be zero or greater." });
    }

    const league = await db.getLeagueById(leagueId);
    if (!league) {
      return res.status(404).json({ errorMessage: "League not found." });
    }

    if (String(league.user) !== String(req.userId)) {
      return res.status(403).json({ errorMessage: "You do not have access to this league." });
    }

    const rosterIdsInLeague = new Set((league.rosterIds || []).map((id) => String(id)));
    if (!rosterIdsInLeague.has(String(bidStartedById)) || !rosterIdsInLeague.has(String(draftedToRosterId))) {
      return res.status(400).json({ errorMessage: "Selected roster does not belong to this league." });
    }

    const draftedToRoster = await db.getMLBRosterById(draftedToRosterId);
    if (!draftedToRoster) {
      return res.status(404).json({ errorMessage: "Draft destination roster not found." });
    }

    if (draftedToRoster[slotKey]) {
      return res.status(409).json({ errorMessage: "Selected slot is already occupied." });
    }

    const openSlotsRemaining = ROSTER_SLOT_KEYS.reduce(
      (count, key) => count + (draftedToRoster[key] ? 0 : 1),
      0
    );
    const maxSpendable = draftedToRoster.budgetLeft - (openSlotsRemaining - 1);
    if (normalizedDraftCost > maxSpendable) {
      return res.status(400).json({
        errorMessage: "Draft cost exceeds legal budget based on remaining slots.",
      });
    }

    const playerDoc = await db.getPlayerDoc(APIplayerId, leagueId);
    if (!playerDoc) {
      return res.status(404).json({
        errorMessage: "Player document does not exist yet for this league.",
      });
    }

    const normalizedStatus = String(playerDoc.status || "").trim().toLowerCase();
    const isActive = normalizedStatus === "active";
    if (!isActive && !inactiveOverrideAccepted) {
      return res.status(400).json({
        errorMessage: "Player is not currently active. Confirm inactive override to continue.",
      });
    }

    if (playerDoc.ownerId && String(playerDoc.ownerId) !== String(draftedToRosterId)) {
      return res.status(409).json({ errorMessage: "Player is already drafted in this league." });
    }

    if (playerDoc.ownerId && String(playerDoc.ownerId) === String(draftedToRosterId)) {
      return res.status(409).json({ errorMessage: "Player is already drafted to the selected roster." });
    }

    draftedToRoster[slotKey] = playerDoc._id;
    draftedToRoster.budgetLeft = draftedToRoster.budgetLeft - normalizedDraftCost;

    playerDoc.bidStartedById = bidStartedById;
    playerDoc.ownerId = draftedToRosterId;
    playerDoc.price = normalizedDraftCost;

    await draftedToRoster.save();
    await playerDoc.save();

    return res.status(200).json({ playerDoc, roster: draftedToRoster });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ errorMessage: "Error drafting player." });
  }
};

const dropPlayer = async (req, res) => {
  try {
    const { APIplayerId } = req.params;
    const { leagueId, rosterId } = req.body || {};

    if (!leagueId || !rosterId) {
      return res.status(400).json({ errorMessage: "leagueId and rosterId are required." });
    }

    const league = await db.getLeagueById(leagueId);
    if (!league) {
      return res.status(404).json({ errorMessage: "League not found." });
    }

    if (String(league.user) !== String(req.userId)) {
      return res.status(403).json({ errorMessage: "You do not have access to this league." });
    }

    const rosterIdsInLeague = new Set((league.rosterIds || []).map((id) => String(id)));
    if (!rosterIdsInLeague.has(String(rosterId))) {
      return res.status(400).json({ errorMessage: "Selected roster does not belong to this league." });
    }

    const roster = await db.getMLBRosterById(rosterId);
    if (!roster) {
      return res.status(404).json({ errorMessage: "Roster not found." });
    }

    const playerDoc = await db.getPlayerDoc(APIplayerId, leagueId);
    if (!playerDoc) {
      return res.status(404).json({ errorMessage: "Player document not found for this league." });
    }

    if (!playerDoc.ownerId || String(playerDoc.ownerId) !== String(rosterId)) {
      return res.status(400).json({ errorMessage: "Player is not owned by the selected roster." });
    }

    const slotKey = ROSTER_SLOT_KEYS.find((key) => String(roster[key] || "") === String(playerDoc._id));
    if (!slotKey) {
      return res.status(409).json({ errorMessage: "Roster/player assignment is inconsistent." });
    }

    const refundAmount = Number(playerDoc.price) || 0;
    roster[slotKey] = null;
    roster.budgetLeft = roster.budgetLeft + refundAmount;

    playerDoc.bidStartedById = null;
    playerDoc.ownerId = null;
    // Price-reset behavior will be fully aligned with model changes in next todo.
    playerDoc.price = 0;

    await roster.save();
    await playerDoc.save();

    return res.status(200).json({ playerDoc, roster });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ errorMessage: "Error dropping player." });
  }
};

module.exports = {
  getPlayers,
  getTotalFantasyPoints,
  getPlayerDoc,
  upsertPlayerDoc,
  draftPlayer,
  dropPlayer,
};
