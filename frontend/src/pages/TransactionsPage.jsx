import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

const TABLE_COLUMNS = [
  { label: "Name", key: "name" },
  { label: "Player", key: "player" },
  { label: "Action", key: "action" },
  { label: "Budget", key: "budget" },
];

function TransactionsPage() {
  return (
    <main className="app-shell page-private">
      <Header />
      <div className="app-body">
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">Transactions</p>
          <h1>Recent Moves</h1>
          <p className="muted">Review trades, claims, and drops to stay updated.</p>
        </section>
      </div>
    </main>
  );
}

export default TransactionsPage;
