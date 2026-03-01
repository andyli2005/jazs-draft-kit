import { useAuth } from "../auth/index.jsx";

function LoggedInHomePage() {
  const { user, logoutUser } = useAuth();

  return (
    <main className="page page-private">
      <section className="card hero">
        <p className="eyebrow">Welcome back</p>
        <h1>{user?.userName ? `${user.userName}` : "Draft Kit User"}</h1>
        <p className="muted">You are signed in as {user?.email}.</p>
        <div className="actions">
          <button className="btn btn-primary" type="button">Start New Draft</button>
          <button className="btn btn-secondary" type="button" onClick={logoutUser}>Log Out</button>
        </div>
      </section>
    </main>
  );
}

export default LoggedInHomePage;
