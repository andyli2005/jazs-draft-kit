export const POSITION_OPTIONS = ["C", "1B", "2B", "3B", "SS", "OF", "U", "DH", "P"];

export function parsePositionsString(raw) {
  return String(raw || "")
    .split(",")
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean)
    .filter((token, index, arr) => arr.indexOf(token) === index)
    .filter((token) => POSITION_OPTIONS.includes(token));
}

export function formatPositionsString(positionTokens) {
  const safeTokens = Array.isArray(positionTokens) ? positionTokens : [];
  return safeTokens
    .filter((token) => POSITION_OPTIONS.includes(token))
    .join(", ");
}
