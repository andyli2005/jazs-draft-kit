import { NavLink } from "react-router-dom";
import { useLeague } from "../leagues";

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/all-teams", label: "All Teams", requiresLeague: true },
  { to: "/my-team", label: "My Team", requiresLeague: true },
  { to: "/player-search", label: "Player Search", requiresLeague: true },
  { to: "/rosters", label: "Rosters", requiresLeague: true },
  { to: "/transactions", label: "Transactions", requiresLeague: true },
  { to: "/api-dashboard", label: "API Dashboard" },
  { to: "/settings", label: "Settings" },
];

function Sidebar() {
  const { hasSelectedLeague } = useLeague();

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

      {!hasSelectedLeague ? (
        <p className="sidebar-hint">Select a league on the dashboard to unlock league pages.</p>
      ) : null}
    </aside>
  );
}

export default Sidebar;
