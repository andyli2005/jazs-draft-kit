import { NavLink } from "react-router-dom";
import { useLeague } from "../leagues";

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/all-teams", label: "All Teams", requiresLeague: true },
  { to: "/my-team", label: "My Team", requiresLeague: true },
  { to: "/player-search", label: "Player Search", requiresLeague: true },
  { to: "/transactions", label: "Transactions", requiresLeague: true },
  { to: "/api-dashboard", label: "API Dashboard" },
  { to: "/settings", label: "Settings" },
];

function Sidebar() {
  const { hasSelectedLeague, selectedLeague } = useLeague();
  const leagueRosters = Array.isArray(selectedLeague?.rosterIds) ? selectedLeague.rosterIds : [];
  const rosterOptions = leagueRosters.filter(
    (roster) => !selectedLeague?.myTeam || String(roster._id) !== String(selectedLeague.myTeam)
  );

  return (
    <aside className="app-sidebar">
      {NAV_ITEMS.map((item) => {
        const isDisabled = item.requiresLeague && !hasSelectedLeague;

        if (isDisabled) {
          return (
            <span
              key={item.to}
              className="side-link side-link-disabled"
              aria-disabled="true"
              title="Select a league on the dashboard to unlock this page."
            >
              {item.label}
            </span>
          );
        }

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className="side-link"
          >
            {item.label}
          </NavLink>
        );
      })}

      {hasSelectedLeague ? (
        <>
          <span className="side-section-label">Rosters</span>
          {rosterOptions.length > 0 ? (
            rosterOptions.map((roster, index) => (
              <NavLink
                key={roster._id || `roster-link-${index}`}
                to={`/rosters/${roster._id}`}
                className="side-link"
              >
                {roster.name || `Team ${index + 1}`}
              </NavLink>
            ))
          ) : (
            <span className="side-link side-link-disabled" aria-disabled="true">
              No additional rosters
            </span>
          )}
        </>
      ) : (
        <span
          className="side-link side-link-disabled"
          aria-disabled="true"
          title="Select a league on the dashboard to unlock this page."
        >
          Rosters
        </span>
      )}

      {!hasSelectedLeague ? (
        <p className="sidebar-hint">Select a league on the dashboard to unlock league pages.</p>
      ) : null}
    </aside>
  );
}

export default Sidebar;
