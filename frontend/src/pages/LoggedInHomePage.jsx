import { useState } from "react";
import { useAuth } from "../auth/index.jsx";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import CreateLeagueModal from "../components/CreateLeagueModal";

function LoggedInHomePage() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

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
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setShowModal(true)}
            >
              Start New Draft
            </button>
          </div>
        </section>
      </div>
      <CreateLeagueModal open={showModal} onClose={() => setShowModal(false)} />
    </main>
  );
}

export default LoggedInHomePage;
