import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { useEffect, useState } from "react";
import { useLeague } from "../leagues";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function renderValue(value) {
  if (value == null || value === "") return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isDateLike(value) {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}

function renderMessage(transaction) {
  switch(transaction.actionType) {
    case "UpdatedNotes":
      return `You updated ${transaction.player}'s player notes.`;
    case "UpdatedPosition": 
      return `You updated ${transaction.player}'s position.`;
    case "Drafted":
      return `${transaction.teamOwner} ${transaction.actionType.toLowerCase()} ${transaction.player} for $${transaction.draftCost}. ($${transaction.budgetLeft} left)`;
    case "Dropped":
      return `${transaction.teamOwner} ${transaction.actionType.toLowerCase()} ${transaction.player} for $${transaction.draftCost}. ($${transaction.budgetLeft} left)`;
  }
  return "Error";
}

function renderCellValue(key, value, transaction) {
  if (key === "teamOwner" && transaction.actionType === "UpdatedNotes") return "N/A";
  if (key === "message") return renderMessage(transaction);
  // Safety string check with .startsWith method
  if (key === "actionType") {
    const actionType = typeof value === "string" ? value : "";
    if (actionType.startsWith("Updated")) return "Updated";
  }
  if ((key === "createdAt" || key === "updatedAt") && isDateLike(value)) {
    return new Date(value).toLocaleString();
  }
  return renderValue(value);
}

const TABLE_COLUMNS = [
  { label: "Timestamp", key: "createdAt" },
  { label: "Team", key: "teamOwner" },
  { label: "Player", key: "player" },
  { label: "Action", key: "actionType" },
  { label: "Messages", key: "message" }
];

function TransactionsPage() {
  const { selectedLeagueId } = useLeague();
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadTransactions() {
      setErrorMessage("");

      if (!selectedLeagueId) {
        setIsLoading(false);
        setErrorMessage("Select a league first.");
        return;
      }

      try {
        const params = new URLSearchParams();
        params.set("leagueId", selectedLeagueId);
        const response = await fetch(`${API_BASE}/api/transactions?${params.toString()}`, {
          method: "GET",
          credentials: "include",
        });

        let data = {};
        try {
          data = await response.json();
        } catch {
          data = {};
        }

        if (!response.ok) {
          throw new Error(data.errorMessage || "Failed to load transactions.");
        }

        if (!isMounted) return;
        setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
      } catch (err) {
        if (!isMounted) return;
        setErrorMessage(err.message || "Unable to load transactions.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    setIsLoading(true);
    loadTransactions();

    return () => {
      isMounted = false;
    };
  }, [selectedLeagueId]);

  const hasTransactions = transactions.length > 0;

  return (
    <main className="app-shell page-private">
      <Header />
      <div className="app-body">
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">Transactions</p>
          <h1>Recent Moves</h1>
          <p className="muted">Review trades, claims, and drops to stay updated.</p>

          {isLoading ? <p className="muted">Loading transactions...</p> : null}
          {!isLoading && errorMessage ? <p className="error">{errorMessage}</p> : null}
          {!isLoading && !errorMessage && !hasTransactions ? (
            <p className="muted">No transactions found.</p>
          ) : null}

          {!isLoading && !errorMessage && hasTransactions ? (
            <div className="transactions-table-wrap">
              <div className="transactions-table-inner">
                <table className="transactions-table">
                  <thead>
                    <tr>
                      {TABLE_COLUMNS.map((column) => (
                        <th key={column.key} scope="col">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction, index) => {
                      const rowKey = transaction._id || `${transaction.teamOwner || "transaction"}-${index}`;
                      return (
                        <tr key={rowKey}>
                          {TABLE_COLUMNS.map((column) => (
                            <td key={`${rowKey}-${column.key}`}>
                              {renderCellValue(column.key, transaction[column.key], transaction)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

        </section>
      </div>
    </main>
  );
}

export default TransactionsPage;
