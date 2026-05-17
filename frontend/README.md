# Draft Kit Frontend

This frontend is a React + Vite single-page application for running a fantasy baseball draft workflow. Users can register and log in, create leagues, select an active league, browse player data, compare rosters across teams, review league transactions, and save personal notes on players during the draft.

The UI is organized around a selected league. Once a league is chosen on the dashboard, the app unlocks league-specific pages such as player search, rosters, transactions, and team summaries. The frontend stores the selected league in local storage so it can survive navigation and refreshes, while authentication is maintained with an HTTP-only cookie issued by the backend.

## Main Features

- Authentication flows for registration, login, logout, profile update, and account deletion
- Dashboard for viewing leagues and creating a new draft league
- League selection that drives all league-specific pages
- Player search with sorting, filtering, and valuation data from the backend
- Draft and drop actions for roster management
- Player details panel with editable personal notes saved per league
- League-wide roster overview and transaction history

## Recent Updates

- **Position Filtering:** The Player Search page now includes a dedicated dropdown to filter by position (C, 1B, 2B, etc.). This supports players with multiple positions (e.g., a "C" filter will correctly find "C, 1B" players).
- **Custom Player Management:** A new `/custom-players` route allows users to create league-local players with manual stats.
- **Dynamic Comparison:** The "All Teams" page now reflects live budget changes made in the settings panel.

## Tech Stack

- React 19
- React Router 7
- Vite 7
- Context providers for auth and league state
- Centralized request helpers for auth and league/player API calls
- Standard `fetch` requests with `credentials: "include"` under those request modules

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

## Application Structure

- `src/main.jsx`: wraps the app in `BrowserRouter`, `AuthProvider`, and `LeagueProvider`
- `src/App.jsx`: route table plus auth and selected-league guards
- `src/auth/`: auth context and auth request helpers
- `src/leagues/`: league context and the shared non-auth request layer
- `src/pages/`: route-level screens
- `src/components/`: reusable UI and interactive draft widgets

## State Management

This app uses React context plus page-local state. There is no Redux, Zustand, or React Query layer.

### Auth State

`src/auth/index.jsx` owns:

- `isLoading`
- `isLoggedIn`
- `user`

It exposes:

- `bootstrapAuth`
- `loginUser`
- `registerUser`
- `updateCurrentUser`
- `deleteCurrentUser`
- `logoutUser`

Behavior:

- On mount, `bootstrapAuth()` calls `GET /api/auth/loggedIn`
- Login and registration update auth state immediately from the response payload
- Logout and account deletion clear auth state locally after the request resolves
- Context actions are wrapped in `useCallback`, and the provider value is memoized

### League State

`src/leagues/index.jsx` owns:

- `leagues`
- `selectedLeagueId`
- `isLoadingLeagues`
- `hasLoadedLeagues`
- derived `selectedLeague`
- derived `hasSelectedLeague`

It exposes:

- `createLeague`
- `setMyTeam`
- `editLeague`
- `refreshLeagues`
- `selectLeague`
- `clearSelectedLeague`

Behavior:

- League loading waits for auth bootstrap to finish
- Logged-in users fetch leagues from `GET /api/leagues`
- Logged-out users clear league state and local storage
- `selectedLeagueId` is persisted in local storage under `draft-kit:selected-league-id`
- If the selected league disappears after a refresh, the selection is cleared automatically
- Context actions are wrapped in `useCallback`, and the provider value is memoized

### Local Page and Component State

Shared cross-app state is limited to auth and league selection. Everything else stays local:

- `PlayerSearchPage` owns player-table state, sorting, search, selected row, and draft modal visibility
- `TransactionsPage` owns transaction polling state
- `PlayerStatsPanel` owns the loaded player document and in-panel notes editing state
- `DraftPlayerModal`, `CreateLeagueModal`, `EditLeagueModal`, `LoginPage`, `RegisterPage`, and `SettingsPage` own form state locally

The current strategy is:

- context for identity and selected-league state
- local `useState`/`useEffect` for page-specific server data and forms
- explicit refetches after mutations instead of a client-side normalized cache

## Request Layer

Network calls are intentionally centralized in two modules:

- `src/auth/requests/index.jsx`
- `src/leagues/requests/index.jsx`

`src/leagues/requests/index.jsx` currently wraps:

- `createLeague`
- `getLeagues`
- `setMyTeam`
- `updateLeague`
- `getPlayers`
- `dropPlayer`
- `getPlayerDoc`
- `updatePlayerDoc`
- `draftPlayer`
- `getTransactions`

This means route pages and draft-related components do not call `fetch` directly for non-auth work anymore.

## Routing

Key routes in `src/App.jsx`:

- `/`: public landing page or logged-in dashboard
- `/all-teams`
- `/my-team`
- `/player-search`
- `/rosters/:rosterId`
- `/transactions`
- `/api-dashboard`
- `/settings`
- `/login`
- `/register`

Protected routing behavior:

- `ProtectedRoute` requires `isLoggedIn`
- `LeagueProtectedRoute` requires `isLoggedIn` and `hasSelectedLeague`

## Data Flow Notes

- Draft and drop actions mutate backend state, then the UI calls `refreshLeagues()` so roster views stay synchronized
- `PlayerStatsPanel` loads and saves league-scoped player notes through the shared request layer
- `TransactionsPage` polls `GET /api/transactions` every 3 seconds
- `Sidebar` and league-protected pages derive their available navigation from the selected league context

## Quality Notes

- `npm run lint` currently passes on the checked-in frontend code
- Context modules intentionally export both providers and hooks, so they explicitly disable the Fast Refresh lint rule that expects component-only exports

## Build

```bash
npm run build
```

This produces a production bundle in `frontend/dist`.
