const db = require("../db");
const mongoose = require("mongoose");
const League = require("../db/models/League");
const MLBRoster = require("../db/models/MLBRoster");
const Player = require("../db/models/Player");
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
const STAT_KEYS = [
  "atBats",
  "runs",
  "hits",
  "singles",
  "doubles",
  "triples",
  "homeRuns",
  "runsBattedIn",
  "baseOnBalls",
  "strikeOuts",
  "stolenBases",
  "caughtStealing",
  "battingAverage",
  "onBasePercentage",
  "sluggingPercentage",
  "fantasyPoints",
];

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isTransactionUnsupportedError(error) {
  const message = String(error?.message || "");
  return message.includes("Transaction numbers are only allowed on a replica set member or mongos");
}

function normalizeStatBlock(block) {
  return STAT_KEYS.reduce((acc, key) => {
    const raw = block?.[key];
    const value = Number(raw);
    acc[key] = Number.isFinite(value) ? value : 0;
    return acc;
  }, {});
}

function normalizeApiPlayer(rawPlayer) {
  if (!rawPlayer) return null;
  return {
    APIplayerId: rawPlayer._id || rawPlayer.APIplayerId,
    name: rawPlayer.name || "",
    status: rawPlayer.status || "",
    notes: rawPlayer.note || rawPlayer.notes || rawPlayer.status || "",
    positions: rawPlayer.positions || "",
    team: rawPlayer.team || "",
    pictureURL: rawPlayer.pictureURL || "",
    // Single-player licensed payload does not include recommended cost.
    price: 0,
    currentStats: normalizeStatBlock(rawPlayer.currentStats),
    projectedStats: normalizeStatBlock(rawPlayer.projectedStats),
    threeYearAverageStats: normalizeStatBlock(rawPlayer.threeYearAverageStats),
  };
}

function hasTruthyOverride(value) {
  return value === true || value === "true";
}

function mapPlayerToDocFields(licensedPlayer, existingDoc) {
  return {
    name: licensedPlayer.name,
    status: licensedPlayer.status,
    notes: licensedPlayer.notes || licensedPlayer.status || "",
    positions: licensedPlayer.positions,
    team: licensedPlayer.team,
    pictureURL: licensedPlayer.pictureURL || "",
    // Preserve local draft/dropped state; this should not be overwritten by recommended API cost.
    price: existingDoc?.price ?? 0,
    personalNotes: existingDoc?.personalNotes || "",
    currentStats: licensedPlayer.currentStats,
    projectedStats: licensedPlayer.projectedStats,
    threeYearAverageStats: licensedPlayer.threeYearAverageStats,
  };
}

async function fetchUpstreamJson(url) {
  const response = await fetch(url, { headers: { "x-api-token": process.env.API_TOKEN } });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  return { response, data };
}

async function fetchLicensedPlayerById(APIplayerId) {
  if (!process.env.API_TOKEN) {
    throw createHttpError(500, "Server configuration is missing API_TOKEN.");
  }

  const url = `${getApiBase()}/api/players/${APIplayerId}`;
  const { response, data } = await fetchUpstreamJson(url);
  if (response.status === 404) {
    return fetchLicensedPlayerFromEvaluations(APIplayerId);
  }
  if (!response.ok) {
    throw createHttpError(response.status, data?.errorMessage || data?.message || "Failed to fetch player.");
  }
  const item = data?.item;
  const normalized = normalizeApiPlayer(item);
  if (!normalized || String(normalized.APIplayerId) !== String(APIplayerId)) {
    throw createHttpError(502, "Licensed API returned an invalid player payload.");
  }
  return normalized;
}

async function fetchLicensedPlayerFromEvaluations(APIplayerId) {
  const evaluationsUrl = buildUpstreamUrl(
    { moneyAboveMinimum: 0 },
    "/api/players/evaluations"
  );
  const { response, data } = await fetchUpstreamJson(evaluationsUrl);
  if (!response.ok) {
    throw createHttpError(
      response.status,
      data?.errorMessage || data?.message || "Failed to fetch evaluations for player fallback."
    );
  }

  const players = extractPlayers(data);
  const matched = players.find(
    (player) => String(player.APIplayerId) === String(APIplayerId)
  );
  if (!matched) {
    throw createHttpError(404, data?.error || "Player not found.");
  }

  return normalizeApiPlayer({
    _id: matched.APIplayerId,
    name: matched.name,
    status: matched.status,
    note: matched.notes || matched.status || "",
    pictureURL: matched.pictureURL,
    positions: matched.positions,
    team: matched.team,
    currentStats: matched.currentStats,
    projectedStats: matched.projectedStats,
    threeYearAverageStats: matched.threeYearAverageStats,
  });
}

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
  const draftedPlayers = await db.getDraftedPlayers(leagueId);
  const draftHistory = draftedPlayers.map((player) => ({
    playerId: String(player.APIplayerId),
    draftCost: Number(player.price),
  }));

  try {
    const response = await fetch(url, { 
      method: 'POST',
      headers: { 
        "Content-Type": "application/json",
        "x-api-token": process.env.API_TOKEN 
      },
      body: JSON.stringify({ 
        draftHistory,
        leagueState: {
          spotsRemaining,
        }
      }),
    });

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

    const apiPlayerIds = players
      .map((player) => player.APIplayerId)
      .filter((id) => id != null && id !== "");

    let localPlayerMap = new Map();
    if (apiPlayerIds.length > 0) {
      const localPlayerDocs = await Player.find(
        { leagueId, APIplayerId: { $in: apiPlayerIds } },
        "APIplayerId ownerId bidStartedById price"
      ).lean();
      localPlayerMap = new Map(
        localPlayerDocs.map((doc) => [String(doc.APIplayerId), doc])
      );
    }

    players = players.map((player) => {
      const localDoc = localPlayerMap.get(String(player.APIplayerId));
      const isDrafted = Boolean(localDoc?.ownerId);
      return {
        ...player,
        isDrafted,
        draftOwnerId: localDoc?.ownerId ? String(localDoc.ownerId) : null,
        bidStartedById: localDoc?.bidStartedById ? String(localDoc.bidStartedById) : null,
        leaguePrice: localDoc?.price ?? null,
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

    const league = await League.findById(leagueId).select("user").lean();
    if (!league) {
      return res.status(404).json({ errorMessage: "League not found." });
    }

    if (String(league.user) !== String(req.userId)) {
      return res.status(403).json({ errorMessage: "You do not have access to this league." });
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

    const league = await League.findById(leagueId).select("user").lean();
    if (!league) {
      return res.status(404).json({ errorMessage: "League not found." });
    }

    if (String(league.user) !== String(req.userId)) {
      return res.status(403).json({ errorMessage: "You do not have access to this league." });
    }

    const prevDoc = await db.getPlayerDoc(APIplayerId, leagueId);

    const fields = {
      name,
      status,
      notes: notes || status || "",
      positions,
      team,
      pictureURL: pictureURL || "",
      // Preserve existing draft cost unless explicitly provided.
      price: price ?? prevDoc?.price ?? 0,
      personalNotes: personalNotes || "",
      currentStats,
      projectedStats,
      threeYearAverageStats,
    };

    const prevNotes = prevDoc?.personalNotes ?? "";
    const hasChangedNotes = prevNotes !== fields.personalNotes;

    const playerDoc = await db.upsertPlayerDoc(APIplayerId, leagueId, fields);

    if (hasChangedNotes) {
      const user = await db.getUserById(req.userId);
      const data = {
        teamOwner: user?.userName || "N/A",
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
  let session = null;
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

    const licensedPlayer = await fetchLicensedPlayerById(APIplayerId);
    const normalizedStatus = String(licensedPlayer.status || "").trim().toLowerCase();
    const isActive = normalizedStatus === "active";
    if (!isActive && !hasTruthyOverride(inactiveOverrideAccepted)) {
      return res.status(400).json({
        errorMessage: "Player is not currently active. Confirm inactive override to continue.",
      });
    }

    let updatedPlayerDoc = null;
    let updatedRoster = null;

    const applyDraftMutation = async (activeSession = null) => {
      const queryOptions = activeSession ? { session: activeSession } : {};
      const leagueQuery = League.findById(leagueId);
      if (activeSession) leagueQuery.session(activeSession);
      const league = await leagueQuery;
      if (!league) {
        throw createHttpError(404, "League not found.");
      }

      if (String(league.user) !== String(req.userId)) {
        throw createHttpError(403, "You do not have access to this league.");
      }

      const rosterIdsInLeague = new Set((league.rosterIds || []).map((id) => String(id)));
      if (!rosterIdsInLeague.has(String(bidStartedById)) || !rosterIdsInLeague.has(String(draftedToRosterId))) {
        throw createHttpError(400, "Selected roster does not belong to this league.");
      }

      const rosterQuery = MLBRoster.findById(draftedToRosterId);
      if (activeSession) rosterQuery.session(activeSession);
      const draftedToRoster = await rosterQuery;
      if (!draftedToRoster) {
        throw createHttpError(404, "Draft destination roster not found.");
      }

      if (draftedToRoster[slotKey]) {
        throw createHttpError(409, "Selected slot is already occupied.");
      }

      const openSlotsRemaining = ROSTER_SLOT_KEYS.reduce(
        (count, key) => count + (draftedToRoster[key] ? 0 : 1),
        0
      );
      const maxSpendable = draftedToRoster.budgetLeft - (openSlotsRemaining - 1);
      if (normalizedDraftCost > maxSpendable) {
        throw createHttpError(400, "Draft cost exceeds legal budget based on remaining slots.");
      }

      const existingDocQuery = Player.findOne({ APIplayerId, leagueId });
      if (activeSession) existingDocQuery.session(activeSession);
      const existingDoc = await existingDocQuery;
      if (existingDoc?.ownerId) {
        if (String(existingDoc.ownerId) === String(draftedToRosterId)) {
          throw createHttpError(409, "Player is already drafted to the selected roster.");
        }
        throw createHttpError(409, "Player is already drafted in this league.");
      }

      const docFields = mapPlayerToDocFields(licensedPlayer, existingDoc);
      const playerDoc = await Player.findOneAndUpdate(
        { APIplayerId, leagueId },
        { $set: { APIplayerId, leagueId, ...docFields } },
        { upsert: true, new: true, runValidators: true, ...queryOptions }
      );

      const claimResult = await Player.updateOne(
        { _id: playerDoc._id, $or: [{ ownerId: null }, { ownerId: { $exists: false } }] },
        { $set: { ownerId: draftedToRosterId, bidStartedById, price: normalizedDraftCost } },
        queryOptions
      );
      if (claimResult.modifiedCount !== 1) {
        throw createHttpError(409, "Player was drafted by another request.");
      }

      const minReserve = openSlotsRemaining - 1;
      const rosterUpdate = await MLBRoster.updateOne(
        {
          _id: draftedToRosterId,
          [slotKey]: null,
          budgetLeft: { $gte: normalizedDraftCost + minReserve },
        },
        { $set: { [slotKey]: playerDoc._id }, $inc: { budgetLeft: -normalizedDraftCost } },
        queryOptions
      );
      if (rosterUpdate.modifiedCount !== 1) {
        throw createHttpError(409, "Roster changed before draft could be applied.");
      }

      const updatedPlayerQuery = Player.findById(playerDoc._id);
      if (activeSession) updatedPlayerQuery.session(activeSession);
      updatedPlayerDoc = await updatedPlayerQuery;

      const updatedRosterQuery = MLBRoster.findById(draftedToRosterId);
      if (activeSession) updatedRosterQuery.session(activeSession);
      updatedRoster = await updatedRosterQuery;

      const data = {
        teamOwner: updatedRoster?.name || "Unknown Team",
        player: updatedPlayerDoc?.name || "Unknown Player",
        actionType: "Drafted",
        draftCost: normalizedDraftCost,
        budgetLeft: Number(updatedRoster?.budgetLeft ?? 0),
        leagueId,
        rosterId: draftedToRosterId,
      };
      await db.createTransaction(data, queryOptions);
    };

    session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await applyDraftMutation(session);
      });
    } catch (error) {
      if (!isTransactionUnsupportedError(error)) {
        throw error;
      }
      await applyDraftMutation(null);
    }

    return res.status(200).json({ playerDoc: updatedPlayerDoc, roster: updatedRoster });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ errorMessage: err.message || "Error drafting player." });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

const dropPlayer = async (req, res) => {
  let session = null;
  try {
    const { APIplayerId } = req.params;
    const { leagueId, rosterId } = req.body || {};

    if (!leagueId || !rosterId) {
      return res.status(400).json({ errorMessage: "leagueId and rosterId are required." });
    }

    let updatedPlayerDoc = null;
    let updatedRoster = null;

    const applyDropMutation = async (activeSession = null) => {
      const queryOptions = activeSession ? { session: activeSession } : {};
      const leagueQuery = League.findById(leagueId);
      if (activeSession) leagueQuery.session(activeSession);
      const league = await leagueQuery;
      if (!league) {
        throw createHttpError(404, "League not found.");
      }

      if (String(league.user) !== String(req.userId)) {
        throw createHttpError(403, "You do not have access to this league.");
      }

      const rosterIdsInLeague = new Set((league.rosterIds || []).map((id) => String(id)));
      if (!rosterIdsInLeague.has(String(rosterId))) {
        throw createHttpError(400, "Selected roster does not belong to this league.");
      }

      const rosterQuery = MLBRoster.findById(rosterId);
      if (activeSession) rosterQuery.session(activeSession);
      const roster = await rosterQuery;
      if (!roster) {
        throw createHttpError(404, "Roster not found.");
      }

      const playerDocQuery = Player.findOne({ APIplayerId, leagueId });
      if (activeSession) playerDocQuery.session(activeSession);
      const playerDoc = await playerDocQuery;
      if (!playerDoc) {
        throw createHttpError(404, "Player document not found for this league.");
      }

      if (!playerDoc.ownerId || String(playerDoc.ownerId) !== String(rosterId)) {
        throw createHttpError(400, "Player is not owned by the selected roster.");
      }

      const slotKey = ROSTER_SLOT_KEYS.find((key) => String(roster[key] || "") === String(playerDoc._id));
      if (!slotKey) {
        throw createHttpError(409, "Roster/player assignment is inconsistent.");
      }

      const refundAmount = Number(playerDoc.price) || 0;
      const rosterUpdate = await MLBRoster.updateOne(
        { _id: rosterId, [slotKey]: playerDoc._id },
        { $set: { [slotKey]: null }, $inc: { budgetLeft: refundAmount } },
        queryOptions
      );
      if (rosterUpdate.modifiedCount !== 1) {
        throw createHttpError(409, "Roster changed before drop could be applied.");
      }

      const playerUpdate = await Player.updateOne(
        { _id: playerDoc._id, ownerId: rosterId },
        { $set: { ownerId: null, bidStartedById: null, price: 0 } },
        queryOptions
      );
      if (playerUpdate.modifiedCount !== 1) {
        throw createHttpError(409, "Player ownership changed before drop could be applied.");
      }

      const updatedPlayerQuery = Player.findById(playerDoc._id);
      if (activeSession) updatedPlayerQuery.session(activeSession);
      updatedPlayerDoc = await updatedPlayerQuery;

      const updatedRosterQuery = MLBRoster.findById(rosterId);
      if (activeSession) updatedRosterQuery.session(activeSession);
      updatedRoster = await updatedRosterQuery;

      const data = {
        teamOwner: updatedRoster?.name || "Unknown Team",
        player: updatedPlayerDoc?.name || "Unknown Player",
        actionType: "Dropped",
        draftCost: refundAmount,
        budgetLeft: Number(updatedRoster?.budgetLeft ?? 0),
        leagueId,
        rosterId,
      };
      await db.createTransaction(data, queryOptions);
    };

    session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await applyDropMutation(session);
      });
    } catch (error) {
      if (!isTransactionUnsupportedError(error)) {
        throw error;
      }
      await applyDropMutation(null);
    }

    return res.status(200).json({ playerDoc: updatedPlayerDoc, roster: updatedRoster });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ errorMessage: err.message || "Error dropping player." });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

module.exports = {
  getPlayers,
  getTotalFantasyPoints,
  getPlayerDoc,
  upsertPlayerDoc,
  draftPlayer,
  dropPlayer,
  __testables: {
    createHttpError,
    isTransactionUnsupportedError,
    normalizeStatBlock,
    normalizeApiPlayer,
    hasTruthyOverride,
    mapPlayerToDocFields,
    fetchUpstreamJson,
    fetchLicensedPlayerById,
    fetchLicensedPlayerFromEvaluations,
    getApiBase,
    extractPlayers,
    buildUpstreamUrl,
    ROSTER_SLOT_KEYS,
    STAT_KEYS,
  },
};
