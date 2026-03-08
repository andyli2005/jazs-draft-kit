import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/index.jsx";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

function SettingsPage() {
  const navigate = useNavigate();
  const { user, updateCurrentUser, deleteCurrentUser } = useAuth();
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVerify, setPasswordVerify] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setUserName(user?.userName || "");
  }, [user?.userName]);

  async function handleUpdate(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setUpdating(true);

    try {
      const payload = { userName };
      if (password || passwordVerify) {
        payload.password = password;
        payload.passwordVerify = passwordVerify;
      }

      await updateCurrentUser(payload);
      setPassword("");
      setPasswordVerify("");
      setSuccess("Account updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete your account permanently?")) {
      return;
    }

    setError("");
    setSuccess("");
    setDeleting(true);

    try {
      await deleteCurrentUser();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <main className="app-shell page-private">
      <Header />
      <div className="app-body">
        <Sidebar />
        <section className="app-content card settings-card">
          <p className="eyebrow">Settings</p>
          <h1>Account Settings</h1>
          <p className="muted">Update your username/password or delete your account.</p>

          <form onSubmit={handleUpdate} className="form settings-form">
            <label>
              Username
              <input value={userName} onChange={(event) => setUserName(event.target.value)} required />
            </label>
            <label>
              New Password (optional)
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Leave blank to keep current password"
              />
            </label>
            <label>
              Confirm New Password
              <input
                type="password"
                value={passwordVerify}
                onChange={(event) => setPasswordVerify(event.target.value)}
                placeholder="Only needed when changing password"
              />
            </label>

            {error ? <p className="error">{error}</p> : null}
            {success ? <p className="success">{success}</p> : null}

            <button type="submit" className="btn btn-primary" disabled={updating || deleting}>
              {updating ? "Updating account..." : "Update Account"}
            </button>
          </form>

          <div className="danger-zone">
            <h2>Delete Account</h2>
            <p className="muted">This action is permanent and cannot be undone.</p>
            <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting || updating}>
              {deleting ? "Deleting account..." : "Delete Account"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default SettingsPage;
