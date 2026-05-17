export const LIVE_UPDATE_STORAGE_KEY = "draft-kit:live-update-history";
export const MAX_HISTORY_NOTICES = 50;
export const MAX_VISIBLE_NOTICES = 4;

export function formatNoticeTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function getNoticeTitle(notice) {
  const playerName = notice?.player?.name || notice?.player?.APIplayerId || "Player";
  if (notice?.type === "depthChart") return `${playerName}: Depth Chart`;
  if (notice?.type === "injury") return `${playerName}: Injury Status`;
  if (notice?.type === "news") return `${playerName}: News`;
  return notice?.title || "Player Update";
}

export function readStoredHistory() {
  try {
    const raw = window.sessionStorage.getItem(LIVE_UPDATE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY_NOTICES) : [];
  } catch {
    return [];
  }
}

export function writeStoredHistory(notices) {
  try {
    window.sessionStorage.setItem(
      LIVE_UPDATE_STORAGE_KEY,
      JSON.stringify(notices.slice(0, MAX_HISTORY_NOTICES))
    );
  } catch {
    // Ignore storage failures.
  }
}

export function clearStoredHistory() {
  try {
    window.sessionStorage.removeItem(LIVE_UPDATE_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
