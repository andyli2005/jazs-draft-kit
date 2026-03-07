import { NavLink } from "react-router-dom";

function Sidebar() {
  return (
    <aside className="app-sidebar">
      <NavLink to="/" end className="side-link">Home</NavLink>
      <NavLink to="/all-teams" className="side-link">All Teams</NavLink>
      <NavLink to="/my-team" className="side-link">My Team</NavLink>
      <NavLink to="/player-search" className="side-link">Player Search</NavLink>
      <NavLink to="/rosters" className="side-link">Rosters</NavLink>
      <NavLink to="/transactions" className="side-link">Transactions</NavLink>
      <NavLink to="/api-dashboard" className="side-link">API Dashboard</NavLink>
      <NavLink to="/settings" className="side-link">Settings</NavLink>
    </aside>
  );
}

export default Sidebar;
