const Player = require("../db/models/Player");
const liveUpdateHub = require("../services/live-update-hub");

const EMPTY_DEPTH_CHART = Object.freeze({
  position: "",
  rank: null,
  role: "",
  section: "",
});

function normalizeTextField(value) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim();
}

function normalizeInjuryStatusField(value) {
  const text = normalizeTextField(value);
  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower === "active" || lower === "inactive") return "";
  return text;
}

function normalizeNumberField(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function firstProvidedText(...entries) {
  for (const [source, key] of entries) {
    if (hasOwn(source, key)) {
      return normalizeTextField(source[key]);
    }
  }
  return "";
}

function normalizeUpdateType(value) {
  const normalized = normalizeTextField(value).toLowerCase();
  if (normalized === "depth_chart" || normalized === "depthchart") return "depthChart";
  if (normalized === "news") return normalized;
  if (normalized === "injury" || normalized === "injury_status" || normalized === "injurystatus") return "injury";
  return "";
}

function normalizeDepthChart(value) {
  if (!value || typeof value !== "object") return { ...EMPTY_DEPTH_CHART };
  return {
    position: normalizeTextField(value.position),
    rank: normalizeNumberField(value.rank),
    role: normalizeTextField(value.role),
    section: normalizeTextField(value.section),
  };
}

function isAuthorizedWebhook(req) {
  const expectedSecret = process.env.LIVE_UPDATE_WEBHOOK_SECRET;
  if (!expectedSecret) return true;
  return req.header("x-live-update-secret") === expectedSecret;
}

function buildDefaultMessage(type, playerName) {
  if (type === "depthChart") return `${playerName} has a depth chart update.`;
  if (type === "injury") return `${playerName} has an injury status update.`;
  return `${playerName} has a news update.`;
}

function normalizePlayerLiveUpdate(payload) {
  const player = payload?.player || {};
  const updates = payload?.updates && typeof payload.updates === "object" ? payload.updates : {};
  const type = normalizeUpdateType(payload?.type || payload?.updateType);
  const APIplayerId = normalizeTextField(player.APIplayerId || player.playerId || payload?.APIplayerId);
  const rawPlayerName = normalizeTextField(player.name || payload?.playerName);
  const playerName = rawPlayerName || APIplayerId || "Player";

  if (!type) {
    const error = new Error("Live updates require type: depthChart or news.");
    error.status = 400;
    throw error;
  }
  if (!APIplayerId && !rawPlayerName) {
    const error = new Error("Live updates require player.APIplayerId or player.name.");
    error.status = 400;
    throw error;
  }

  const normalizedPlayer = {
    APIplayerId,
    upstreamId: normalizeTextField(player.upstreamId),
    name: playerName,
    team: normalizeTextField(player.team),
    positions: normalizeTextField(player.positions),
    status: firstProvidedText([updates, "status"], [player, "status"]),
    injuryStatus: normalizeInjuryStatusField(firstProvidedText(
      [updates, "injuryStatus"],
      [updates, "injury"],
      [player, "injuryStatus"],
      [player, "injury"],
      [player, "status"]
    )),
    latestNews: normalizeTextField(updates.latestNews || updates.news || player.latestNews || player.news),
    depthChart: normalizeDepthChart(updates.depthChart || player.depthChart),
    pictureURL: normalizeTextField(player.pictureURL),
  };

  if (type === "injury") {
    const hasExplicitInjuryStatus = hasOwn(updates, "injuryStatus") || hasOwn(updates, "injury");
    if (!hasExplicitInjuryStatus) {
      normalizedPlayer.injuryStatus = normalizedPlayer.injuryStatus || normalizeTextField(payload?.message);
    }
    normalizedPlayer.status = normalizedPlayer.injuryStatus ? "Inactive" : normalizedPlayer.status || "Inactive";
  }
  if (type === "news") {
    normalizedPlayer.latestNews = normalizedPlayer.latestNews || normalizeTextField(payload?.message);
  }
  const message =
    normalizeTextField(payload?.message) ||
    (type === "news" ? normalizedPlayer.latestNews : "") ||
    buildDefaultMessage(type, playerName);

  return {
    type,
    source: normalizeTextField(payload?.source) || "api-licensing",
    isTest: Boolean(payload?.isTest),
    occurredAt: normalizeTextField(payload?.occurredAt) || new Date().toISOString(),
    title: normalizeTextField(payload?.title) || buildDefaultMessage(type, playerName),
    message,
    player: normalizedPlayer,
  };
}

function buildPlayerDocUpdateFields(notice) {
  const player = notice.player || {};
  const fields = {};

  ["name", "status", "positions", "team", "pictureURL"].forEach((field) => {
    if (player[field]) fields[field] = player[field];
  });

  if (notice.type === "depthChart") {
    fields.depthChart = normalizeDepthChart(player.depthChart);
  }

  if (notice.type === "injury") {
    fields.injuryStatus = normalizeInjuryStatusField(player.injuryStatus || player.status);
    fields.status = player.status || (fields.injuryStatus ? "Inactive" : "Active");
  }

  if (notice.type === "news") {
    const latestNews = player.latestNews || notice.message || "";
    if (latestNews) fields.latestNews = latestNews;
  }

  return fields;
}

async function applyLiveUpdateToPlayerDocs(notice) {
  const APIplayerId = notice?.player?.APIplayerId;
  if (!APIplayerId) {
    return { matchedCount: 0, modifiedCount: 0 };
  }

  const fields = buildPlayerDocUpdateFields(notice);
  if (Object.keys(fields).length === 0) {
    return { matchedCount: 0, modifiedCount: 0 };
  }

  return Player.updateMany(
    { APIplayerId, isCustom: false },
    { $set: fields }
  );
}

async function receivePlayerLiveUpdate(req, res) {
  try {
    if (!isAuthorizedWebhook(req)) {
      return res.status(401).json({ success: false, errorMessage: "Unauthorized live update webhook." });
    }

    const notice = normalizePlayerLiveUpdate(req.body || {});
    const updateResult = await applyLiveUpdateToPlayerDocs(notice);
    const storedNotice = liveUpdateHub.addNotice({
      ...notice,
      affectedPlayerDocs: updateResult.modifiedCount || 0,
    });

    return res.status(202).json({
      success: true,
      notice: storedNotice,
      matchedPlayerDocs: updateResult.matchedCount || 0,
      affectedPlayerDocs: updateResult.modifiedCount || 0,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({
      success: false,
      errorMessage: err.message || "Unable to receive live update.",
    });
  }
}

function listNotices(req, res) {
  return res.status(200).json({
    success: true,
    notices: liveUpdateHub.getRecentNotices(),
  });
}

function streamNotices(req, res) {
  return liveUpdateHub.streamNotices(req, res);
}

module.exports = {
  receivePlayerLiveUpdate,
  listNotices,
  streamNotices,
  __testables: {
    applyLiveUpdateToPlayerDocs,
    buildPlayerDocUpdateFields,
    isAuthorizedWebhook,
    normalizeDepthChart,
    normalizePlayerLiveUpdate,
    normalizeUpdateType,
  },
};
