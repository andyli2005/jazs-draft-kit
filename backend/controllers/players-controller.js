const db = require("../db");
const { computeTotalPoints } = require("../services/player-valuation");
const { computeTotalMoneyRemaining, computeRosterSpotsRemaining, computeMoneyAboveMinimum } = require("../services/league-valuation");

const DEFAULT_API_ENDPOINT = "http://localhost:4001";

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
    currentStats: player.currentStats || {},
    projectedStats: player.projectedStats || {},
    threeYearAverageStats: player.threeYearAverageStats || {},
    ...player.currentStats,
  }));
}

function buildUpstreamUrl(query) {
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
  const base = `${getApiBase()}/api/players`;
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

  // Build separate query for cost so that searching/filtering players
  // does not affect cost 
  const upstreamQueryForCost = { ...req.query };

  // Have cost of players be based on the top 200 players in DB based on FP
  upstreamQueryForCost.top = "200";
  upstreamQueryForCost.rankBy = "fantasyPoints";
  upstreamQueryForCost.order = "desc";
  delete upstreamQueryForCost.leagueId;
  delete upstreamQueryForCost.team;
  delete upstreamQueryForCost.name;
  delete upstreamQueryForCost.position;
  delete upstreamQueryForCost.page;
  delete upstreamQueryForCost.limit;

  const url = buildUpstreamUrl(upstreamQuery);
  const costUrl = buildUpstreamUrl(upstreamQueryForCost);

  try {
    const [response, costResponse] = await Promise.all([
      fetch(url, { headers: { "x-api-token": process.env.API_TOKEN } }),
      fetch(costUrl, { headers: { "x-api-token": process.env.API_TOKEN } }),
    ]);

    let data = {};
    let costData = {};
    try {
      [data, costData] = await Promise.all([response.json(), costResponse.json()]);
    } catch {
      data = {};
      costData = {};
    }

    if (!response.ok) {
      return res.status(response.status).json({
        errorMessage: data.errorMessage || data.message || "Failed to fetch players.",
      });
    }

    if (!costResponse.ok) {
      return res.status(costResponse.status).json({
        errorMessage: costData.errorMessage || costData.message || "Failed to fetch top players.",
      });
    }

    let players = extractPlayers(data).map((player) => ({
      ...player,
      points: computeTotalPoints(player),
    }));

    // extract the top 200 players in order to evaluate costs
    let topPlayers = extractPlayers(costData).map((player) => ({
      ...player,
      points: computeTotalPoints(player),
    }));    

    const totalPoints = topPlayers.reduce(
      (sum, player) => sum + player.points,
      0
    );

    players = players.map((player) => {
      const cost = totalPoints > 0
        ? (player.points / totalPoints) * moneyAboveMinimum + 1
        : 1;

      return {
        ...player,
        cost: Math.max(Math.round(cost), 1),
      };
    });

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

module.exports = {
  getPlayers,
  getTotalFantasyPoints,
  getPlayerDoc,
  upsertPlayerDoc,
};
