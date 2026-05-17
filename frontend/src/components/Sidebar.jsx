import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useLeague } from "../leagues";
import { SLOT_DEFS } from "../leagues/rosterSlots";

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/pre-draft", label: "Pre-draft", requiresLeague: true },
  { to: "/all-teams", label: "All Teams", requiresLeague: true },
  { to: "/my-team", label: "My Team", requiresLeague: true },
  { to: "/player-search", label: "Player Search", requiresLeague: true },
  { to: "/custom-players", label: "Custom Players", requiresLeague: true },
  { to: "/taxi", label: "Taxi Draft", requiresLeague: true, requiresFullRosters: true },
  { to: "/transactions", label: "Transactions", requiresLeague: true },
  { to: "/api-dashboard", label: "API Dashboard" },
  { to: "/settings", label: "Settings" },
];

function Sidebar() {
  const location = useLocation();
  const { hasSelectedLeague, selectedLeague } = useLeague();
  const leagueRosters = Array.isArray(selectedLeague?.rosterIds) ? selectedLeague.rosterIds : [];
  const rosterOptions = leagueRosters.filter(
    (roster) => !selectedLeague?.myTeam || String(roster._id) !== String(selectedLeague.myTeam)
  );
  const [isRostersManuallyOpen, setIsRostersManuallyOpen] = useState(location.pathname.startsWith("/rosters/"));
  const isRostersOpen = location.pathname.startsWith("/rosters/") || isRostersManuallyOpen;

  const allRostersFull =
    hasSelectedLeague &&
    leagueRosters.length > 0 &&
    leagueRosters.every((roster) =>
      SLOT_DEFS.every(({ key }) => roster?.[key] != null)
    );
  const testTaxi = true;

  function renderRostersMenu() {
    if (hasSelectedLeague) {
      return (
        <>
          <button
            type="button"
            className="side-link side-link-toggle"
            onClick={() => setIsRostersManuallyOpen((isOpen) => !isOpen)}
            aria-expanded={isRostersOpen}
          >
            <span>Rosters</span>
            <span className="side-link-caret">{isRostersOpen ? "▾" : "▸"}</span>
          </button>
          {isRostersOpen ? (
            <div className="side-submenu">
              {rosterOptions.length > 0 ? (
                rosterOptions.map((roster, index) => (
                  <NavLink
                    key={roster._id || `roster-link-${index}`}
                    to={`/rosters/${roster._id}`}
                    className="side-link side-link-subitem"
                  >
                    {roster.name || `Team ${index + 1}`}
                  </NavLink>
                ))
              ) : (
                <span className="side-link side-link-disabled side-link-subitem" aria-disabled="true">
                  No additional rosters
                </span>
              )}
            </div>
          ) : null}
        </>
      );
    }

    return (
      <span
        className="side-link side-link-disabled"
        aria-disabled="true"
        title="Select a league on the dashboard to unlock league pages."
      >
        Rosters
      </span>
    );
  }

  return (
    <aside className="app-sidebar">
      {NAV_ITEMS.map((item) => {
        const isDisabled = 
          (item.requiresLeague && !hasSelectedLeague) ||
          (item.requiresFullRosters && !testTaxi && !allRostersFull);

        const disabledTitle = (item.requiresFullRosters && hasSelectedLeague && !testTaxi && !allRostersFull)
          ? "Finish drafting main roster to unlock this page."
          : "Select a league on the dashboard to unlock this page.";

        if (isDisabled) {
          return (
            <span
              key={item.to}
              className="side-link side-link-disabled"
              aria-disabled="true"
              title={disabledTitle}
            >
              {item.label}
            </span>
          );
        }

        return item.to === "/transactions" ? (
          <div key="rosters-and-transactions" className="side-nav-group">
            {renderRostersMenu()}
            <NavLink to={item.to} end={item.to === "/"} className="side-link">
              {item.label}
            </NavLink>
          </div>
        ) : (
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

      {!hasSelectedLeague ? (
        <p className="sidebar-hint">Select a league on the dashboard to unlock league pages.</p>
      ) : null}
    </aside>
  );
}

export default Sidebar;
