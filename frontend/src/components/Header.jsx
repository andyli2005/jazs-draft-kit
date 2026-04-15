import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/index.jsx";
import { useLeague } from "../leagues";
import EditLeagueModal from "./EditLeagueModal";

function Header() {
  const navigate = useNavigate();
  const { user, logoutUser } = useAuth();
  const { leagues, selectedLeagueId, selectLeague, isLoadingLeagues, refreshLeagues } = useLeague();
  const [openMenu, setOpenMenu] = useState(null);
  const [editingLeague, setEditingLeague] = useState(null);
  const menuRef = useRef(null);
  const avatarInitial = (user?.userName || user?.email || "?").trim().charAt(0).toUpperCase();
  const hasProfilePicture = Boolean(user?.profilePicture);
  const isLeaguesMenuOpen = openMenu === "leagues";
  const isAccountMenuOpen = openMenu === "account";

  useEffect(() => {
    function handleDocumentClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    }

    if (openMenu) {
      document.addEventListener("mousedown", handleDocumentClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [openMenu]);

  function handleOpenEditProfile() {
    setOpenMenu(null);
    navigate("/settings");
  }

  async function handleLogout() {
    setOpenMenu(null);
    await logoutUser();
  }

  function handleSelectLeague(league) {
    selectLeague(league);
    setOpenMenu(null);
    navigate("/all-teams");
  }

  function handleEditLeague(league) {
    setEditingLeague(league);
    setOpenMenu(null);
  }

  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">JAZS Draft Kit</p>
        <h2 className="app-title">Dashboard</h2>
      </div>
      <div className="header-right" ref={menuRef}>
        <button 
          className="btn btn-primary"
          type="button"
          onClick={() => setOpenMenu((menu) => (menu === "leagues" ? null : "leagues"))}
          aria-label="Open leagues menu"
          aria-expanded={isLeaguesMenuOpen}
          aria-haspopup="menu"
        >
          Leagues
        </button>

        <button
          className="header-avatar-trigger"
          type="button"
          onClick={() => setOpenMenu((menu) => (menu === "account" ? null : "account"))}
          aria-label="Open account menu"
          aria-expanded={isAccountMenuOpen}
          aria-haspopup="menu"
        >
          {hasProfilePicture ? (
            <img
              className="header-avatar"
              src={user.profilePicture}
              alt={`${user?.userName || "User"} profile`}
            />
          ) : (
            <span className="header-avatar-fallback">{avatarInitial}</span>
          )}
        </button>

        {isLeaguesMenuOpen ? (
          <div className="header-dropdown header-leagues-dropdown" role="menu" aria-label="Leagues menu">
            <div className="header-dropdown-section">
              <p className="header-dropdown-name">Your Leagues</p>
              {isLoadingLeagues ? (
                <p className="header-dropdown-email">Loading leagues...</p>
              ) : null}
              {!isLoadingLeagues && leagues.length === 0 ? (
                <p className="header-dropdown-email">No leagues yet.</p>
              ) : null}
              {!isLoadingLeagues && leagues.length > 0 ? (
                <div className="header-league-list">
                  {leagues.map((league) => (
                    <div
                      key={league._id}
                      className={`header-league-row${league._id === selectedLeagueId ? " selected" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectLeague(league)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleSelectLeague(league);
                        }
                      }}
                    >
                      <div className="header-league-option" role="menuitem">
                        <span>{league.name}</span>
                        <small>{league.sport || "League"}</small>
                      </div>
                      <button
                        className="btn btn-secondary header-league-edit-btn"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleEditLeague(league);
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {isAccountMenuOpen ? (
          <div className="header-dropdown" role="menu" aria-label="Account menu">
            <div className="header-dropdown-section">
              {hasProfilePicture ? (
                <img
                  className="header-dropdown-avatar"
                  src={user.profilePicture}
                  alt={`${user?.userName || "User"} profile`}
                />
              ) : (
                <span className="header-dropdown-avatar-fallback">{avatarInitial}</span>
              )}
              <p className="header-dropdown-name">{user?.userName || "User"}</p>
              <p className="header-dropdown-email">{user?.email || ""}</p>
            </div>
            <hr className="header-dropdown-divider" />
            <div className="header-dropdown-section">
              <button className="btn btn-secondary" type="button" onClick={handleOpenEditProfile}>
                Edit Profile
              </button>
              <button className="btn btn-danger" type="button" onClick={handleLogout}>
                Log Out
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <EditLeagueModal
        open={Boolean(editingLeague)}
        league={editingLeague}
        onClose={() => setEditingLeague(null)}
        onSaved={refreshLeagues}
      />
    </header>
  );
}

export default Header;
