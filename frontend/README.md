# Draft Kit Frontend

This frontend is a React + Vite single-page application for running a fantasy baseball draft workflow. Users can register and log in, create leagues, select an active league, browse player data, compare rosters across teams, review league transactions, and save personal notes on players during the draft.

The UI is organized around a selected league. Once a league is chosen on the dashboard, the app unlocks league-specific pages such as player search, rosters, transactions, and team summaries. The frontend stores the selected league in local storage so it can survive navigation and refreshes, while authentication is maintained with an HTTP-only cookie issued by the backend.

## Main Features

- Authentication flows for registration, login, logout, profile update, and account deletion
- Dashboard for viewing leagues and creating a new draft league
- League selection that drives all league-specific pages
- Player search with sorting, filtering, and valuation data from the backend
- Player details panel with editable personal notes saved per league
- League-wide roster overview and transaction history

## Tech Stack

- React 19
- React Router 7
- Vite 7
- Standard `fetch` requests with `credentials: "include"` for cookie-based auth

## Local Development

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

By default, the frontend expects the backend API at `http://localhost:4000`. To override that, define:

```bash
VITE_API_BASE_URL=http://localhost:4000
```

## Build

```bash
npm run build
```

This produces a production bundle in `frontend/dist`.
