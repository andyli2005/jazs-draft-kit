const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export function getLiveUpdateEventUrl() {
  return `${API_BASE}/api/live-updates/events`;
}
