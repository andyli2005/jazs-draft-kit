# JAZS Fantasy Baseball Draft Kit

A comprehensive tracker and valuation tool for fantasy baseball drafts. This application allows users to manage multiple leagues, track draft picks, and get dynamic player valuations based on market scarcity and remaining budget.

## Project Structure

This repository is split into two main components:

- **`/frontend`**: A React + Vite single-page application. Uses React Context for global authentication and league states with centralized request modules.
    - See [Frontend Architecture](./frontend/README.md) for local state and routing blueprints.
- **`/backend`**: An Express API backed by MongoDB. Handles user authentication via secure HTTP-only cookies, manages application state, and proxies an upstream player licensing data service.
  - See [Backend Architecture](./backend/README.md) for database schemas and proxy models.

## Tech Stack
**Front end**: React 19, React Router 7, Vite 7, Context API
**Back end**: Node.js, Express, MongoDB (Mongoose), JWT, Cookies (HTTP-only)

## Key Features

- **Dynamic Valuations:** Real-time dollar values calculated using projected stats, 3-year averages, and positional scarcity.
- **Draft Tracking:** Log every pick with automatic budget updates and transaction history.
- **Player Search:** Filter by name or position (with multi-position support) and sort by stats or value.
- **Custom Players:** Add and draft players not found in the standard MLB database.
- **League Management:** Update budget caps, rename teams, or add/remove teams mid-draft with automatic synchronization.
- **Taxi Draft:** Manage minor league or "taxi" squads with dedicated roster rules.

## Local Setup

To run the Draft Kit locally, you will need to configure and run both environments using two terminals simultaneously:

### Prerequisites
- Node.js
- MongoDB

### 1. Start the Backend
Install dependencies and start the dev server:
```bash
cd backend
npm install
# Ensure that you have a backend/.env with the environment variable configuration below
npm run dev
```

The development server will be available locally at `http://localhost:4000`.

### 2. Start the Frontend
Install dependencies and start the dev server:
```bash
cd frontend
npm install
# Ensure that you have a frontend/.env with the environment variable configuration below
npm run dev
```

The app will be available at `http://localhost:5173`.

## Environment Configuration
### Backend Environment Variables (backend/.env)
The Draft Kit depends on an **Upstream Player API** for its data. Ensure your `backend/.env` has:
- `API_ENDPOINT`: The URL of your Licensing API, defaults to `http://localhost:4001`.
- `API_TOKEN`: A valid key generated from your Licensing API account.

In addition to the following typical variables used by the backend:
- `PORT`: Express port, defaults to `4000`
- `FRONTEND_ORIGIN`: allowed frontend origin for CORS
- `MONGO_URL`: MongoDB connection string
- `JWT_SECRET`: secret used to sign auth tokens
- `JWT_EXPIRES_IN`: optional JWT lifetime, defaults to `1d`

### Frontend Environment Variables (frontend/.env)
By default, the frontend expects the backend API at `http://localhost:4000`. To override that, define:

```bash
VITE_API_BASE_URL=http://localhost:4000
```

## Backend API Documentation
### API Endpoints

All paths below are relative to the backend base URL, for example `http://localhost:4000`, and are mounted uniformly under `/api`. Most routes require authentication via a secure `token` cookie (`httpOnly`, `secure: true`, `sameSite: "none"`).

#### Auth
- `POST /api/auth/register` - Creates a new user account, hashes password, sets session cookie. Expects JSON containing `userName`, `email`, `password`, and `passwordVerify` and returns the created user payload.
- `POST /api/auth/login` - Authenticates user credentials and issues session cookie. Expects `email` and `password` and returns the signed-in user payload.
- `POST /api/auth/logout` - Clears the active authentication session cookie.
- `GET /api/auth/loggedIn` - Checks authentication cookie validity. Returns `loggedIn: true` plus the current user when authenticated and `loggedIn: false` when no valid session exists.
- `PUT /api/auth/user` - Modifies profile properties (username, password, profilePicture). Reissues auth cookie and returns the updated user.
- `DELETE /api/auth/user` - Removes the currently logged-in user account and clears the auth cookie.

#### Leagues
- `GET /api/leagues` - Returns all leagues owned by the requesting authenticated user.
- `POST /api/leagues` - Creates a new league and auto-seeds default rosters. Expects `sport`, `name`, `draftType`, `teamCount`, and `budgetCap`.
- `PATCH /api/leagues/:id` - Updates league metadata, handles mid-draft team additions/deletions, and updates financial structures.
- `PATCH /api/leagues/:id/my-team` - Sets a team in the current league to be associated with the authenticated user.

#### Players
- `GET /api/players` - Returns player data for a specific league. Requires `leagueId` query parameter; accepts optional sorting (`rankBy`, `order`) and filtering (`name`) modifiers.
- `GET /api/players/totalFantasyPoints` - Proxies the upstream server total fantasy points summary endpoint.
- `GET /api/players/:APIplayerId/doc` - Fetches local player records, metadata, and saved personal scout notes. Requires `leagueId`.
- `PUT /api/players/:APIplayerId/doc` - Upserts local player documents and logs an `UpdatedNotes` transaction block if comments change.
- `POST /api/players/:APIplayerId/draft` - Drafts a player into a specific roster slot. 
- `POST /api/players/:APIplayerId/drop` - Drops a player from a roster, clears local ownership state, and refunds the draft price back to the team's available budget.

#### Transactions
- `GET /api/transactions` - Streams full transaction items for a league. Requires `leagueId` query parameter.
- `POST /api/transactions` - Creates a transaction entry for a league. Standardizes position shifts to `UpdatedPosition` labels.

### Endpoints Currently Used by the Frontend

These are the routes actively called by the current frontend code:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/loggedIn`
- `PUT /api/auth/user`
- `DELETE /api/auth/user`
- `GET /api/leagues`
- `POST /api/leagues`
- `PATCH /api/leagues/:id`
- `PATCH /api/leagues/:id/my-team`
- `GET /api/players`
- `GET /api/players/:APIplayerId/doc`
- `PUT /api/players/:APIplayerId/doc`
- `POST /api/players/:APIplayerId/draft`
- `POST /api/players/:APIplayerId/drop`
- `GET /api/transactions`

`POST /api/transactions` and `GET /api/players/totalFantasyPoints` are implemented by the backend but are not currently called by the checked-in frontend code.

## Quality Assurance and Build Commands
### Quality Notes for Frontend
- `npm run lint` currently passes on the checked-in frontend code
- Context modules intentionally export both providers and hooks, so they explicitly disable the Fast Refresh lint rule that expects component-only exports

### Production Bundling for Frontend
Compile the application layer into optimized code assets:
```bash
npm run build
```
This produces a production bundle in `frontend/dist`.
