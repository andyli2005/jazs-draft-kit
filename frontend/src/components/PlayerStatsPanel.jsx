const BATTING_STATS = [
  { label: "At Bats", key: "atBats" },
  { label: "Batting Avg", key: "battingAverage" },
  { label: "Hits", key: "hits" },
  { label: "Home Runs", key: "homeRuns" },
  { label: "Runs", key: "runs" },
  { label: "RBI", key: "runsBattedIn" },
  { label: "Stolen Bases", key: "stolenBases" },
  { label: "OBP", key: "onBasePercentage" },
  { label: "SLG", key: "sluggingPercentage" },
  { label: "Base on Balls", key: "baseOnBalls" },
  { label: "Strikeouts", key: "strikeOuts" },
  { label: "Doubles", key: "doubles" },
  { label: "Triples", key: "triples" },
  { label: "Singles", key: "singles" },
  { label: "Caught Stealing", key: "caughtStealing" },
];

function PlayerStatsPanel({ player, fantasyPoints, cost, onClose }) {
  return (
    <aside className="player-stats-panel">
      <div className="player-stats-top">
        <p className="eyebrow">Player Stats</p>
        <button
          className="player-stats-close"
          type="button"
          onClick={onClose}
          aria-label="Close panel"
        >
          &times;
        </button>
      </div>

      <div className="player-stats-photo-wrap">
        {player.pictureURL ? (
          <img
            src={player.pictureURL}
            alt={player.name}
            className="player-stats-photo"
          />
        ) : (
          <div className="player-stats-photo-placeholder">No Photo</div>
        )}
      </div>

      <h2 className="player-stats-name">{player.name || "Unknown Player"}</h2>

      <div className="player-stats-meta">
        {player.positions && (
          <span className="player-stats-badge">{player.positions}</span>
        )}
        {player.team && (
          <span className="player-stats-badge">{player.team}</span>
        )}
        {player.status && (
          <span className="player-stats-badge badge-outline">{player.status}</span>
        )}
      </div>

      <div className="player-stats-kpi-row">
        <div className="player-stats-kpi">
          <span className="player-stats-kpi-label">Fantasy Pts</span>
          <span className="player-stats-kpi-value">
            {fantasyPoints}
          </span>
        </div>
        <div className="player-stats-kpi">
          <span className="player-stats-kpi-label">Est. Cost</span>
          <span className="player-stats-kpi-value">${cost}</span>
        </div>
      </div>

      <div className="player-stats-section">
        <div className="player-stats-section-head">
          <h3>Personal Notes</h3>
          <button className="btn btn-secondary player-stats-edit-btn" type="button">
            Edit
          </button>
        </div>
        <ul className="player-stats-list">
          <li className="muted">No notes yet. Click Edit to add notes.</li>
        </ul>
      </div>

      <div className="player-stats-section">
        <h3>Depth Chart Status</h3>
        <ul className="player-stats-list">
          <li className="muted">Depth chart data not available.</li>
        </ul>
      </div>

      <div className="player-stats-section">
        <h3>Batting Stats</h3>
        <div className="player-stats-table-wrap">
          <table className="player-stats-table">
            <thead>
              <tr>
                <th>Stat</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {BATTING_STATS.map((stat) => (
                <tr key={stat.key}>
                  <td>{stat.label}</td>
                  <td>{player[stat.key] != null ? player[stat.key] : "---"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </aside>
  );
}

export default PlayerStatsPanel;
