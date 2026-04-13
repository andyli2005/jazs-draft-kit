const ROSTER_SLOTS = [
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

function RosterPageContent({ roster, budgetCap }) {
  if (!roster) {
    return null;
  }

  return (
    <>
      <h2>{roster.name || "Team"}</h2>
      <p className="muted">Budget Left: ${roster.budgetLeft ?? budgetCap ?? 0}</p>

      <div className="roster-slot-list">
        {ROSTER_SLOTS.map((slot) => {
          const player = roster[slot.key];
          return (
            <div className="roster-slot-card" key={slot.key}>
              <span className="roster-slot-label">{slot.label}</span>
              <div className="roster-slot-content">
                {player ? (
                  <>
                    <strong>{player.name || "Rostered Player"}</strong>
                    <span className="muted">
                      {[player.team, player.price != null ? `$${player.price}` : null]
                        .filter(Boolean)
                        .join(" • ") || "Rostered Player"}
                    </span>
                  </>
                ) : (
                  <>
                    <strong>Open Slot</strong>
                    <span className="muted">open slot waiting for draft pick</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default RosterPageContent;
