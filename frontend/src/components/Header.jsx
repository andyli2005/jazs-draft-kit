import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/index.jsx";

function Header() {
  const navigate = useNavigate();
  const { user, logoutUser } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const avatarInitial = (user?.userName || user?.email || "?").trim().charAt(0).toUpperCase();
  const hasProfilePicture = Boolean(user?.profilePicture);

  useEffect(() => {
    function handleDocumentClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleDocumentClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [isMenuOpen]);

  function handleOpenEditProfile() {
    setIsMenuOpen(false);
    navigate("/settings");
  }

  async function handleLogout() {
    setIsMenuOpen(false);
    await logoutUser();
  }

  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Draft Kit</p>
        <h2 className="app-title">Dashboard</h2>
      </div>
      <div className="header-right" ref={menuRef}>
        <button
          className="header-avatar-trigger"
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-label="Open account menu"
          aria-expanded={isMenuOpen}
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

        {isMenuOpen ? (
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
    </header>
  );
}

export default Header;
