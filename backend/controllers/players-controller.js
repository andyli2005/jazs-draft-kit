const db = require("../db");
const mongoose = require("mongoose");
const League = require("../db/models/League");
const MLBRoster = require("../db/models/MLBRoster");
const Player = require("../db/models/Player");
const { computeTotalMoneyRemaining, computeRosterSpotsRemaining, computeMoneyAboveMinimum, computeRemainingSlotsPerPosition } = require("../services/league-valuation");

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
const EMPTY_DEPTH_CHART = Object.freeze({
  position: "",
  rank: null,
  role: "",
  section: "",
});

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

function normalizeNumberField(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeTextField(value) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function normalizeDepthChart(value) {
  if (!value || typeof value !== "object") {
    return { ...EMPTY_DEPTH_CHART };
  }

  return {
    position: normalizeTextField(value.position),
    rank: normalizeNumberField(value.rank),
    role: normalizeTextField(value.role),
    section: normalizeTextField(value.section),
  };
}

function normalizeApiPlayer(rawPlayer) {
  if (!rawPlayer) return null;
  const depthChart = normalizeDepthChart(rawPlayer.depthChart);
  return {
    APIplayerId: rawPlayer.playerId || rawPlayer.APIplayerId || rawPlayer._id,
    name: rawPlayer.name || "",
    status: rawPlayer.status || "",
    notes: rawPlayer.note || rawPlayer.notes || rawPlayer.status || "",
    positions: rawPlayer.positions || "",
    team: rawPlayer.team || "",
    pictureURL: rawPlayer.pictureURL || "",
    age: normalizeNumberField(rawPlayer.age),
    contractStatus: normalizeTextField(rawPlayer.contractStatus),
    latestNews: normalizeTextField(rawPlayer.latestNews || rawPlayer.news),
    depthChart,
    height: normalizeNumberField(rawPlayer.height),
    weight: normalizeNumberField(rawPlayer.weight),
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

function buildEmptyStatBlock() {
  return STAT_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
}

async function getAuthorizedLeague(leagueId, userId, activeSession = null) {
  const leagueQuery = League.findById(leagueId);
  if (activeSession) {
    leagueQuery.session(activeSession);
  }

  const league = await leagueQuery;
  if (!league) {
    throw createHttpError(404, "League not found.");
  }

  if (String(league.user) !== String(userId)) {
    throw createHttpError(403, "You do not have access to this league.");
  }

  return league;
}

function buildLicensedPlayerIdentifierQuery(playerIdentifier, leagueId) {
  const identifier = String(playerIdentifier || "").trim();
  const orClauses = [{ APIplayerId: identifier }];
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    orClauses.push({ _id: identifier });
  }
  return {
    leagueId,
    isCustom: false,
    $or: orClauses,
  };
}

function mapPlayerToDocFields(licensedPlayer, existingDoc) {
  return {
    name: licensedPlayer.name,
    status: licensedPlayer.status,
    notes: licensedPlayer.notes || licensedPlayer.status || "",
    positions: licensedPlayer.positions,
    team: licensedPlayer.team,
    pictureURL: licensedPlayer.pictureURL || "",
    age: licensedPlayer.age ?? null,
    contractStatus: licensedPlayer.contractStatus || "",
    latestNews: licensedPlayer.latestNews || "",
    depthChart: normalizeDepthChart(licensedPlayer.depthChart),
    height: licensedPlayer.height ?? null,
    weight: licensedPlayer.weight ?? null,
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

  const url = `${getApiBase()}/api/players/${encodeURIComponent(APIplayerId)}`;
  const { response, data } = await fetchUpstreamJson(url);
  if (!response.ok) {
    const detailError = createHttpError(
      response.status,
      data?.errorMessage || data?.message || "Failed to fetch player."
    );
    try {
      return await fetchLicensedPlayerFromEvaluations(APIplayerId);
    } catch {
      throw detailError;
    }
  }
  const item = data?.item || data?.player || data?.playerDoc || data;
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
    playerId: matched.APIplayerId,
    name: matched.name,
    status: matched.status,
    note: matched.notes || matched.status || "",
    pictureURL: matched.pictureURL,
    positions: matched.positions,
    team: matched.team,
    age: matched.age,
    contractStatus: matched.contractStatus,
    latestNews: matched.latestNews,
    depthChart: matched.depthChart,
    height: matched.height,
    weight: matched.weight,
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
    APIplayerId: player.playerId || player.APIplayerId || player._id,
    name: player.name,
    status: player.status,
    notes: player.note || player.notes || player.status || "",
    pictureURL: player.pictureURL,
    positions: player.positions,
    team: player.team,
    cost: player.cost,
    age: normalizeNumberField(player.age),
    contractStatus: normalizeTextField(player.contractStatus),
    latestNews: normalizeTextField(player.latestNews || player.news),
    depthChart: normalizeDepthChart(player.depthChart),
    height: normalizeNumberField(player.height),
    weight: normalizeNumberField(player.weight),
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

const getCustomPlayers = async (req, res) => {
  try {
    const { leagueId } = req.query;
    if (!leagueId) {
      return res.status(400).json({ errorMessage: "leagueId query parameter is required." });
    }

    await getAuthorizedLeague(leagueId, req.userId);
    const players = await Player.find({ leagueId, isCustom: true }).sort({ name: 1, createdAt: -1 });
    return res.status(200).json({ success: true, players });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ errorMessage: err.message || "Error fetching custom players." });
  }
};

const createCustomPlayer = async (req, res) => {
  try {
    const {
      leagueId,
      name,
      status,
      notes,
      positions,
      team,
      pictureURL,
      personalNotes,
    } = req.body || {};

    if (!leagueId) {
      return res.status(400).json({ errorMessage: "leagueId is required." });
    }
    if (!name || !status || !positions || !team) {
      return res.status(400).json({
        errorMessage: "name, status, positions, and team are required to create a custom player.",
      });
    }

    await getAuthorizedLeague(leagueId, req.userId);

    const emptyStats = buildEmptyStatBlock();
    const playerDoc = await Player.create({
      leagueId,
      isCustom: true,
      APIplayerId: null,
      name: String(name).trim(),
      status: String(status).trim(),
      notes: (notes || status || "").trim(),
      positions: String(positions).trim(),
      team: String(team).trim(),
      pictureURL: pictureURL || "",
      personalNotes: personalNotes || "",
      price: 0,
      currentStats: emptyStats,
      projectedStats: emptyStats,
      threeYearAverageStats: emptyStats,
      ownerId: null,
      bidStartedById: null,
    });

    return res.status(201).json({ playerDoc });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ errorMessage: err.message || "Error creating custom player." });
  }
};

const updateCustomPlayer = async (req, res) => {
  try {
    const { playerId } = req.params;
    const { leagueId } = req.body || {};
    if (!leagueId) {
      return res.status(400).json({ errorMessage: "leagueId is required." });
    }

    await getAuthorizedLeague(leagueId, req.userId);

    const playerDoc = await Player.findOne({ _id: playerId, leagueId, isCustom: true });
    if (!playerDoc) {
      return res.status(404).json({ errorMessage: "Custom player not found in this league." });
    }

    const editableStringFields = ["name", "status", "notes", "positions", "team", "pictureURL", "personalNotes"];
    editableStringFields.forEach((field) => {
      if (req.body[field] != null) {
        playerDoc[field] = String(req.body[field]).trim();
      }
    });

    if (req.body.currentStats != null) {
      playerDoc.currentStats = normalizeStatBlock(req.body.currentStats);
    }
    if (req.body.projectedStats != null) {
      playerDoc.projectedStats = normalizeStatBlock(req.body.projectedStats);
    }
    if (req.body.threeYearAverageStats != null) {
      playerDoc.threeYearAverageStats = normalizeStatBlock(req.body.threeYearAverageStats);
    }

    if (!playerDoc.notes) {
      playerDoc.notes = playerDoc.status || "";
    }

    await playerDoc.save();
    return res.status(200).json({ playerDoc });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ errorMessage: err.message || "Error updating custom player." });
  }
};

const deleteCustomPlayer = async (req, res) => {
  let session = null;
  try {
    const { playerId } = req.params;
    const { leagueId } = req.body || {};

    if (!leagueId) {
      return res.status(400).json({ errorMessage: "leagueId is required." });
    }

    const applyDeleteMutation = async (activeSession = null) => {
      const queryOptions = activeSession ? { session: activeSession } : {};
      await getAuthorizedLeague(leagueId, req.userId, activeSession);

      const playerDocQuery = Player.findOne({ _id: playerId, leagueId, isCustom: true });
      if (activeSession) {
        playerDocQuery.session(activeSession);
      }
      const playerDoc = await playerDocQuery;
      if (!playerDoc) {
        throw createHttpError(404, "Custom player not found in this league.");
      }

      if (playerDoc.ownerId) {
        const rosterId = String(playerDoc.ownerId);
        const rosterQuery = MLBRoster.findById(rosterId);
        if (activeSession) {
          rosterQuery.session(activeSession);
        }
        const roster = await rosterQuery;
        if (!roster) {
          throw createHttpError(409, "Drafted custom player is assigned to a missing roster.");
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
          throw createHttpError(409, "Roster changed before custom player drop could be applied.");
        }

        const data = {
          teamOwner: roster?.name || "Unknown Team",
          player: playerDoc?.name || "Unknown Player",
          actionType: "Dropped",
          draftCost: refundAmount,
          budgetLeft: Number((roster.budgetLeft || 0) + refundAmount),
          leagueId,
          rosterId,
        };
        await db.createTransaction(data, queryOptions);
      }

      const deleteResult = await Player.deleteOne({ _id: playerDoc._id, leagueId, isCustom: true }, queryOptions);
      if (deleteResult.deletedCount !== 1) {
        throw createHttpError(409, "Custom player changed before delete could be applied.");
      }
    };

    session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await applyDeleteMutation(session);
      });
    } catch (error) {
      if (!isTransactionUnsupportedError(error)) {
        throw error;
      }
      await applyDeleteMutation(null);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ errorMessage: err.message || "Error deleting custom player." });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

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
  const remainingSlotsPerPosition = computeRemainingSlotsPerPosition(rosters);
  const moneyAboveMinimum = computeMoneyAboveMinimum(totalMoneyRemaining, spotsRemaining);
  leagueState = { totalMoneyRemaining, spotsRemaining, moneyAboveMinimum, remainingSlotsPerPosition };

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
        leagueState,
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
        { leagueId, APIplayerId: { $in: apiPlayerIds }, isCustom: false },
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
    let licensedPlayer = null;
    try {
      licensedPlayer = await fetchLicensedPlayerById(APIplayerId);
    } catch (err) {
      console.warn(
        `Unable to hydrate player ${APIplayerId} from upstream:`,
        err.message || "Failed to fetch upstream player."
      );
      licensedPlayer = null;
    }

    if (!playerDoc) {
      return res.status(200).json({ playerDoc: licensedPlayer });
    }

    if (!licensedPlayer) {
      return res.status(200).json({ playerDoc });
    }

    const localPlayerDoc =
      typeof playerDoc.toObject === "function" ? playerDoc.toObject() : playerDoc;
    const mergedPlayerDoc = {
      ...localPlayerDoc,
      ...(licensedPlayer || {}),
      price: playerDoc.price,
      personalNotes: playerDoc.personalNotes,
      bidStartedById: playerDoc.bidStartedById,
      ownerId: playerDoc.ownerId,
      leagueId: playerDoc.leagueId,
      APIplayerId: playerDoc.APIplayerId,
    };

    return res.status(200).json({ playerDoc: mergedPlayerDoc });
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
      positions, team, pictureURL, price, age, contractStatus, latestNews, depthChart, height, weight,
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
      age: normalizeNumberField(age),
      contractStatus: normalizeTextField(contractStatus),
      latestNews: normalizeTextField(latestNews),
      depthChart: normalizeDepthChart(depthChart),
      height: normalizeNumberField(height),
      weight: normalizeNumberField(weight),
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

      const existingDocQuery = Player.findOne({ APIplayerId, leagueId, isCustom: false });
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
        { APIplayerId, leagueId, isCustom: false },
        { $set: { APIplayerId, leagueId, isCustom: false, ...docFields } },
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

      const playerDocQuery = Player.findOne(buildLicensedPlayerIdentifierQuery(APIplayerId, leagueId));
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

const movePlayer = async (req, res) => {
  let session = null;
  try {
    const { APIplayerId } = req.params;
    const { leagueId, rosterId, newSlotKey } = req.body || {};

    if (!leagueId || !rosterId || !newSlotKey) {
      return res.status(400).json({
        errorMessage: "leagueId, rosterId, and newSlotKey are required.",
      });
    }

    if (!ROSTER_SLOT_KEYS.includes(newSlotKey)) {
      return res.status(400).json({ errorMessage: "Invalid roster slot selected." });
    }

    let updatedPlayerDoc = null;
    let updatedRoster = null;

    const applyMoveMutation = async (activeSession = null) => {
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

      const playerDocQuery = Player.findOne(buildLicensedPlayerIdentifierQuery(APIplayerId, leagueId));
      if (activeSession) playerDocQuery.session(activeSession);
      const playerDoc = await playerDocQuery;
      if (!playerDoc) {
        throw createHttpError(404, "Player document not found for this league.");
      }

      if (!playerDoc.ownerId || String(playerDoc.ownerId) !== String(rosterId)) {
        throw createHttpError(400, "Player is not owned by the selected roster.");
      }

      const currentSlotKey = ROSTER_SLOT_KEYS.find(
        (key) => String(roster[key] || "") === String(playerDoc._id)
      );
      if (!currentSlotKey) {
        throw createHttpError(409, "Roster/player assignment is inconsistent.");
      }

      if (currentSlotKey === newSlotKey) {
        throw createHttpError(400, "Player is already assigned to that slot.");
      }

      if (roster[newSlotKey]) {
        throw createHttpError(409, "Selected destination slot is already occupied.");
      }

      const rosterUpdate = await MLBRoster.updateOne(
        { _id: rosterId, [currentSlotKey]: playerDoc._id, [newSlotKey]: null },
        { $set: { [currentSlotKey]: null, [newSlotKey]: playerDoc._id } },
        queryOptions
      );
      if (rosterUpdate.modifiedCount !== 1) {
        throw createHttpError(409, "Roster changed before move could be applied.");
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
        actionType: "ChangedPosition",
        draftCost: Number(updatedPlayerDoc?.price) || 0,
        budgetLeft: Number(updatedRoster?.budgetLeft ?? 0),
        leagueId,
        rosterId,
      };
      await db.createTransaction(data, queryOptions);
    };

    session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await applyMoveMutation(session);
      });
    } catch (error) {
      if (!isTransactionUnsupportedError(error)) {
        throw error;
      }
      await applyMoveMutation(null);
    }

    return res.status(200).json({ playerDoc: updatedPlayerDoc, roster: updatedRoster });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ errorMessage: err.message || "Error moving player." });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

const draftCustomPlayer = async (req, res) => {
  let session = null;
  try {
    const { playerId } = req.params;
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

    let updatedPlayerDoc = null;
    let updatedRoster = null;

    const applyDraftMutation = async (activeSession = null) => {
      const queryOptions = activeSession ? { session: activeSession } : {};
      const league = await getAuthorizedLeague(leagueId, req.userId, activeSession);
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

      const playerDocQuery = Player.findOne({ _id: playerId, leagueId, isCustom: true });
      if (activeSession) playerDocQuery.session(activeSession);
      const playerDoc = await playerDocQuery;
      if (!playerDoc) {
        throw createHttpError(404, "Custom player not found for this league.");
      }

      const normalizedStatus = String(playerDoc.status || "").trim().toLowerCase();
      const isActive = normalizedStatus === "active";
      if (!isActive && !hasTruthyOverride(inactiveOverrideAccepted)) {
        throw createHttpError(400, "Player is not currently active. Confirm inactive override to continue.");
      }

      if (playerDoc.ownerId) {
        if (String(playerDoc.ownerId) === String(draftedToRosterId)) {
          throw createHttpError(409, "Player is already drafted to the selected roster.");
        }
        throw createHttpError(409, "Player is already drafted in this league.");
      }

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
    return res.status(err.status || 500).json({ errorMessage: err.message || "Error drafting custom player." });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

const dropCustomPlayer = async (req, res) => {
  let session = null;
  try {
    const { playerId } = req.params;
    const { leagueId, rosterId } = req.body || {};

    if (!leagueId || !rosterId) {
      return res.status(400).json({ errorMessage: "leagueId and rosterId are required." });
    }

    let updatedPlayerDoc = null;
    let updatedRoster = null;

    const applyDropMutation = async (activeSession = null) => {
      const queryOptions = activeSession ? { session: activeSession } : {};
      const league = await getAuthorizedLeague(leagueId, req.userId, activeSession);
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

      const playerDocQuery = Player.findOne({ _id: playerId, leagueId, isCustom: true });
      if (activeSession) playerDocQuery.session(activeSession);
      const playerDoc = await playerDocQuery;
      if (!playerDoc) {
        throw createHttpError(404, "Custom player document not found for this league.");
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
    return res.status(err.status || 500).json({ errorMessage: err.message || "Error dropping custom player." });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

const moveCustomPlayer = async (req, res) => {
  let session = null;
  try {
    const { playerId } = req.params;
    const { leagueId, rosterId, newSlotKey } = req.body || {};

    if (!leagueId || !rosterId || !newSlotKey) {
      return res.status(400).json({
        errorMessage: "leagueId, rosterId, and newSlotKey are required.",
      });
    }

    if (!ROSTER_SLOT_KEYS.includes(newSlotKey)) {
      return res.status(400).json({ errorMessage: "Invalid roster slot selected." });
    }

    let updatedPlayerDoc = null;
    let updatedRoster = null;

    const applyMoveMutation = async (activeSession = null) => {
      const queryOptions = activeSession ? { session: activeSession } : {};
      const league = await getAuthorizedLeague(leagueId, req.userId, activeSession);
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

      const playerDocQuery = Player.findOne({ _id: playerId, leagueId, isCustom: true });
      if (activeSession) playerDocQuery.session(activeSession);
      const playerDoc = await playerDocQuery;
      if (!playerDoc) {
        throw createHttpError(404, "Custom player document not found for this league.");
      }

      if (!playerDoc.ownerId || String(playerDoc.ownerId) !== String(rosterId)) {
        throw createHttpError(400, "Player is not owned by the selected roster.");
      }

      const currentSlotKey = ROSTER_SLOT_KEYS.find(
        (key) => String(roster[key] || "") === String(playerDoc._id)
      );
      if (!currentSlotKey) {
        throw createHttpError(409, "Roster/player assignment is inconsistent.");
      }

      if (currentSlotKey === newSlotKey) {
        throw createHttpError(400, "Player is already assigned to that slot.");
      }

      if (roster[newSlotKey]) {
        throw createHttpError(409, "Selected destination slot is already occupied.");
      }

      const rosterUpdate = await MLBRoster.updateOne(
        { _id: rosterId, [currentSlotKey]: playerDoc._id, [newSlotKey]: null },
        { $set: { [currentSlotKey]: null, [newSlotKey]: playerDoc._id } },
        queryOptions
      );
      if (rosterUpdate.modifiedCount !== 1) {
        throw createHttpError(409, "Roster changed before move could be applied.");
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
        actionType: "ChangedPosition",
        draftCost: Number(updatedPlayerDoc?.price) || 0,
        budgetLeft: Number(updatedRoster?.budgetLeft ?? 0),
        leagueId,
        rosterId,
      };
      await db.createTransaction(data, queryOptions);
    };

    session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await applyMoveMutation(session);
      });
    } catch (error) {
      if (!isTransactionUnsupportedError(error)) {
        throw error;
      }
      await applyMoveMutation(null);
    }

    return res.status(200).json({ playerDoc: updatedPlayerDoc, roster: updatedRoster });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ errorMessage: err.message || "Error moving custom player." });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

module.exports = {
  getPlayers,
  getCustomPlayers,
  createCustomPlayer,
  updateCustomPlayer,
  deleteCustomPlayer,
  getTotalFantasyPoints,
  getPlayerDoc,
  upsertPlayerDoc,
  draftPlayer,
  draftCustomPlayer,
  dropPlayer,
  dropCustomPlayer,
  movePlayer,
  moveCustomPlayer,
  __testables: {
    createHttpError,
    isTransactionUnsupportedError,
    normalizeStatBlock,
    normalizeApiPlayer,
    hasTruthyOverride,
    buildEmptyStatBlock,
    getAuthorizedLeague,
    buildLicensedPlayerIdentifierQuery,
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
