import { Link } from "react-router-dom";

function PublicHomePage() {
  return (
    <main className="page page-public">
      <section className="card hero">
        <p className="eyebrow">Draft Kit</p>
        <h1>Build teams faster with cleaner draft workflows.</h1>
        <p className="muted">
          Track players, compare rosters, and organize picks in one place.
        </p>
        <div className="actions">
          <Link to="/register" className="btn btn-primary">Create Account</Link>
          <Link to="/login" className="btn btn-secondary">Log In</Link>
        </div>
      </section>
    </main>
  );
}

export default PublicHomePage;
