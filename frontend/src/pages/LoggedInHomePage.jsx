import { useAuth } from "../auth/index.jsx";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

function LoggedInHomePage() {
  const { user } = useAuth();

  return (
    <main className="app-shell page-private">
      <Header />
      <div className="app-body">
        <Sidebar />
        <section className="app-content card hero">
          <p className="eyebrow">Welcome back</p>
          <h1>{user?.userName ? user.userName : "Draft Kit User"}</h1>
          <p className="muted">You are signed in as {user?.email}.</p>
          <div className="actions">
            <button className="btn btn-primary" type="button">Start New Draft</button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default LoggedInHomePage;
