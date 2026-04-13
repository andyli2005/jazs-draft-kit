const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: {"Content-Type": "application/json"},
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

export function getLoggedIn() {
  return request("/api/auth/loggedIn", { method: "GET" });
}

export function login(payload) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function register(payload) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateUser(payload) {
  return request("/api/auth/user", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteUser() {
  return request("/api/auth/user", {
    method: "DELETE",
  });
}

export function logout() {
  return request("/api/auth/logout", { method: "POST" });
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
