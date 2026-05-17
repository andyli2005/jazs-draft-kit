const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function normalizePathId(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") {
    return encodeURIComponent(String(value));
  }

  if (typeof value === "object") {
    if (typeof value.$oid === "string") {
      return encodeURIComponent(value.$oid);
    }
    if (typeof value.toString === "function") {
      return encodeURIComponent(String(value.toString()));
    }
  }

  return encodeURIComponent(String(value));
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error(`Cannot reach API at ${API_BASE}`);
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const errorMessage = data.errorMessage || data.message || "Request failed";
    throw new Error(errorMessage);
  }

  return data;
}

export function createLeague(payload) {
  return request("/api/leagues", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getLeagues() {
  return request("/api/leagues", { method: "GET" });
}

export function setMyTeam(leagueId, myTeamId) {
  return request(`/api/leagues/${leagueId}/my-team`, {
    method: "PATCH",
    body: JSON.stringify({ myTeamId }),
  });
}

export function updateLeague(leagueId, payload) {
  return request(`/api/leagues/${leagueId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function importLeagueData(targetLeagueId, sourceLeagueId) {
  return request(
    `/api/leagues/${normalizePathId(targetLeagueId)}/import-from/${normalizePathId(sourceLeagueId)}`,
    { method: "POST" }
  );
}

export function getPlayers(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value != null && value !== "") {
      params.set(key, String(value));
    }
  });

  const queryString = params.toString();
  const path = queryString ? `/api/players?${queryString}` : "/api/players";
  return request(path, { method: "GET" });
}

export function getCustomPlayers(leagueId) {
  const params = new URLSearchParams({ leagueId: String(leagueId) });
  return request(`/api/players/custom?${params.toString()}`, { method: "GET" });
}

export function createCustomPlayer(payload) {
  return request("/api/players/custom", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCustomPlayer(playerId, payload) {
  return request(`/api/players/custom/${normalizePathId(playerId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteCustomPlayer(playerId, payload) {
  return request(`/api/players/custom/${normalizePathId(playerId)}`, {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

export function dropPlayer(APIplayerId, payload) {
  return request(`/api/players/${normalizePathId(APIplayerId)}/drop`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function movePlayer(APIplayerId, payload) {
  return request(`/api/players/${normalizePathId(APIplayerId)}/move`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPlayerDoc(APIplayerId, leagueId) {
  const params = new URLSearchParams({ leagueId: String(leagueId) });
  return request(`/api/players/${normalizePathId(APIplayerId)}/doc?${params.toString()}`, {
    method: "GET",
  });
}

export function updatePlayerDoc(APIplayerId, payload) {
  return request(`/api/players/${normalizePathId(APIplayerId)}/doc`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function draftPlayer(APIplayerId, payload) {
  return request(`/api/players/${normalizePathId(APIplayerId)}/draft`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function draftTaxiPlayer(APIplayerId, payload) {
  return request(`/api/players/${normalizePathId(APIplayerId)}/taxi`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function draftCustomPlayer(playerId, payload) {
  return request(`/api/players/custom/${normalizePathId(playerId)}/draft`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function dropCustomPlayer(playerId, payload) {
  return request(`/api/players/custom/${normalizePathId(playerId)}/drop`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function moveCustomPlayer(playerId, payload) {
  return request(`/api/players/custom/${normalizePathId(playerId)}/move`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getTransactions(leagueId) {
  const params = new URLSearchParams({ leagueId: String(leagueId) });
  return request(`/api/transactions?${params.toString()}`, { method: "GET" });
}
