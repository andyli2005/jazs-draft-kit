import { useAuth } from "../auth/index.jsx";
import AuthHeader from "../components/AuthHeader";
import AuthSidebar from "../components/AuthSidebar";

function LoggedInHomePage() {
  const { user } = useAuth();

  return (
    <main className="app-shell page-private">
      <AuthHeader />
      <div className="app-body">
        <AuthSidebar />
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
