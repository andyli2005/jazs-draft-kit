export const SLOT_DEFS = [
  { key: "catcher1", label: "C1" },
  { key: "catcher2", label: "C2" },
  { key: "firstBase", label: "1B" },
  { key: "secondBase", label: "2B" },
  { key: "thirdBase", label: "3B" },
  { key: "shortStop", label: "SS" },
  { key: "inField", label: "IF" },
  { key: "middleInField", label: "MIF" },
  { key: "utility", label: "UTIL" },
  { key: "outfielder1", label: "OF1" },
  { key: "outfielder2", label: "OF2" },
  { key: "outfielder3", label: "OF3" },
  { key: "outfielder4", label: "OF4" },
  { key: "outfielder5", label: "OF5" },
  { key: "pitcher1", label: "P1" },
  { key: "pitcher2", label: "P2" },
  { key: "pitcher3", label: "P3" },
  { key: "pitcher4", label: "P4" },
  { key: "pitcher5", label: "P5" },
  { key: "pitcher6", label: "P6" },
  { key: "pitcher7", label: "P7" },
  { key: "pitcher8", label: "P8" },
  { key: "pitcher9", label: "P9" },
];

export const POS_TO_SLOT_KEYS = {
  C: ["catcher1", "catcher2", "utility"],
  "1B": ["firstBase", "inField", "utility"],
  "2B": ["secondBase", "middleInField", "inField", "utility"],
  "3B": ["thirdBase", "inField", "utility"],
  SS: ["shortStop", "middleInField", "inField", "utility"],
  OF: ["outfielder1", "outfielder2", "outfielder3", "outfielder4", "outfielder5", "utility"],
  U: ["utility"],
  DH: ["utility"],
  P: ["pitcher1", "pitcher2", "pitcher3", "pitcher4", "pitcher5", "pitcher6", "pitcher7", "pitcher8", "pitcher9"],
};

/**
 * Inverse of POS_TO_SLOT_KEYS.
 * Maps a roster slot key to the position tokens that make a player eligible for it.
 * Used by the Pre-draft search modal to filter players by the clicked slot.
 */
export const SLOT_KEY_TO_POS_TOKENS = Object.entries(POS_TO_SLOT_KEYS).reduce(
  (acc, [posToken, slotKeys]) => {
    slotKeys.forEach((slotKey) => {
      if (!acc[slotKey]) acc[slotKey] = [];
      acc[slotKey].push(posToken);
    });
    return acc;
  },
  {}
);

/**
 * Returns a Set of position tokens that are eligible to fill the given slot key.
 * e.g. getEligiblePosTokensForSlot("catcher1") => Set { "C" }
 *      getEligiblePosTokensForSlot("utility")   => Set { "C","1B","2B","3B","SS","OF","U","DH" }
 */
export function getEligiblePosTokensForSlot(slotKey) {
  return new Set(SLOT_KEY_TO_POS_TOKENS[slotKey] || []);
}

export function parseEligiblePositions(raw) {
  return String(raw || "")
    .split(",")
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);
}

export function getEligibleSlotKeySet(positionTokens) {
  const eligibleKeys = new Set();
  positionTokens.forEach((token) => {
    const mapped = POS_TO_SLOT_KEYS[token];
    if (mapped) {
      mapped.forEach((key) => eligibleKeys.add(key));
    }
  });
  return eligibleKeys;
}
