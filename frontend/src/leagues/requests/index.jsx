const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

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

export function dropPlayer(APIplayerId, payload) {
  return request(`/api/players/${APIplayerId}/drop`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPlayerDoc(APIplayerId, leagueId) {
  const params = new URLSearchParams({ leagueId: String(leagueId) });
  return request(`/api/players/${APIplayerId}/doc?${params.toString()}`, {
    method: "GET",
  });
}

export function updatePlayerDoc(APIplayerId, payload) {
  return request(`/api/players/${APIplayerId}/doc`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function draftPlayer(APIplayerId, payload) {
  return request(`/api/players/${APIplayerId}/draft`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getTransactions(leagueId) {
  const params = new URLSearchParams({ leagueId: String(leagueId) });
  return request(`/api/transactions?${params.toString()}`, { method: "GET" });
}
