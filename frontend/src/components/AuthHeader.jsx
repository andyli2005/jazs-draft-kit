import { useAuth } from "../auth/index.jsx";

function AuthHeader() {
  const { user, logoutUser } = useAuth();

  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Draft Kit</p>
        <h2 className="app-title">Dashboard</h2>
      </div>
      <div className="header-right">
        <span className="header-user">{user?.userName || user?.email}</span>
        <button className="btn btn-secondary" type="button" onClick={logoutUser}>
          Log Out
        </button>
      </div>
    </header>
  );
}

export default AuthHeader;
