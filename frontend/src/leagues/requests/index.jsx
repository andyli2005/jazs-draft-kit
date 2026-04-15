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
