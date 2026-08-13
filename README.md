# JAZS Fantasy Baseball Draft Kit

A fantasy baseball draft management app for creating leagues, preparing rosters, running salary-cap drafts, tracking transactions, and viewing player information from the API-Licensing player service.

JAZS was developed by a four-person team as a semester project for Stony Brook University's CSE 416 course. This repository is a public copy of the original team repository and preserves its complete contributor history.

The companion player-data and valuation service is available in the [JAZS Player API repository](https://github.com/andyli2005/jazs-player-api).

## My Contributions

My work focused on integrating player valuations into the draft application, implementing transaction history, and developing taxi-squad drafting workflows. This included:

- Passing league state, remaining budgets, position filters, and prior draft results to the valuation service to produce draft-aware player prices.
- Adding league-specific transaction storage and views for draft, drop, move, taxi, minor-league, note, and position-change activity.
- Building taxi-squad drafting across the backend and frontend with league ownership checks, positional eligibility, roster-capacity validation, and custom-player support.

## Project Structure

This repository is split into two main components:

- **`/frontend`**: React + Vite single-page application. It uses React Context for authentication, selected league state, and live-update state.
  - See [Frontend Architecture](./frontend/README.md) for local state and routing details.
- **`/backend`**: Express API backed by MongoDB. It handles account authentication, league state, roster mutations, transaction history, and proxy calls to the API-Licensing player service.
  - See [Backend Architecture](./backend/README.md) for database schemas and controller details.

## Tech Stack

**Front end**: React 19, React Router 7, Vite 7, Context API  
**Back end**: Node.js, Express, MongoDB, Mongoose, JWT, HTTP-only cookies

## Implemented Draft Kit Features

### Accounts

- **Account creation and login**: Users can register, log in, log out, and keep an authenticated session through an HTTP-only JWT cookie.
- **Password reset/retrieval mechanism**: Users register with a security question and answer, then use the forgot-password flow to retrieve the security question and reset the password.
- **Account settings**: Authenticated users can update profile information and password, or delete their account.

### Draft And League Management

- **Multiple drafts/leagues per account**: Users can create and access multiple drafts from the dashboard.
- **Draft selection**: Users can select an active draft/league and move between Draft Kit pages for that selected league.
- **Create a new draft from an existing draft**: The Pre-draft page can import roster and transaction data from another league owned by the user.
- **Player pool setup**: New drafts can be configured as All MLB, AL-only, or NL-only.
- **Custom number of fantasy teams**: League creation supports a configurable team count.
- **Custom fantasy team names**: League editing supports renaming teams, adding teams, and deleting teams.
- **Budget cap management**: League creation and editing support a configurable salary-cap budget.

### Pre-Draft Rosters

- **Pre-draft roster entry**: Users can fill roster slots before the draft using player search.
- **Contract and dollar values**: Drafting and pre-draft entry require contract status and draft cost where applicable.
- **Import previous league data**: Users can populate a new league using another league's roster slots, budgets, transactions, and selected "My Team" mapping.

### Player Search And Drafting

- **Filtering by position**: Player Search supports filtering the eligible player list by position.
- **Filtering/searching by name**: Player Search and draft entry flows support name search.
- **Sorting by dollar value**: Player Search can sort by estimated cost.
- **Sorting by stats**: Player Search can sort by stat/ranking fields returned by the API-Licensing player evaluations endpoint.
- **Draft transaction tracking**: Draft, drop, move, taxi, minor-league, notes, and position changes are recorded as transactions.
- **Ordered draft history**: The Transactions page displays league transactions in reverse chronological order with team, player, action, timestamp, and message details.

### Roster Editing

- **Move player to a new position within a team**: Player details include a change-position control for moving drafted players into open roster slots.
- **Position eligibility support**: The move-position UI defaults to slots that match the player's eligible positions. It also includes an explicit override option for manual correction.
- **Move players between teams**: Player details include a change-team flow that drops and re-drafts a player to another roster while preserving the stored draft price and requiring a contract status.
- **Drop players**: Drafted players can be dropped, which clears roster ownership and refunds budget.

### Minor League Rosters

- **Minor league roster entry**: Users can create custom players as Major League or Minor League players and add minor players to minor league rosters.
- **Minor league draft page**: The Minor League Draft page searches the minor player pool, assigns players to team minor rosters, and shows current minor rosters.
- **Minor players are blocked from the major draft**: Backend draft endpoints reject players marked `isMajor: false` for major league roster slots.
- **Minor league players can be moved between teams**: The Minor League Draft page supports moving a minor roster player from one team's minor league roster to another.

### Custom Players

- **Create custom players**: Users can add league-local custom players that are not present in the licensed player database.
- **Choose major/minor status for custom players**: Custom player creation supports Major League or Minor League player level.
- **Draft, drop, edit, and delete custom players**: Custom players participate in normal roster workflows, with custom-player-specific endpoints.
- **Edit custom player stats and metadata**: Custom player details support editing stats, notes, positions, team, status, picture URL, and contract data.

### Player Details

- **Stats and estimated value**: Player detail panels show fantasy points, current stats, projected stats, and estimated cost.
- **Age, injury status, and news**: Player detail panels show age, player status, injury status, and latest news when available.
- **Depth chart information**: Player detail panels show depth chart position, rank, role, and section.
- **Transactions and contract status**: Drafted player details show contract status and link into roster/transaction workflows.
- **Player notes**: Users can enter and edit notes before or during the draft.

### Team Views

- **My Team view**: Users can mark one roster as their team and view that roster separately.
- **All Teams view**: Users can compare fantasy teams in a tabular/card layout with budget left, money spent, estimated value, and fill count.
- **Roster pages**: Users can open other league rosters from the sidebar.
- **Taxi and minor roster visibility**: All Teams displays taxi squad and minor league roster sections when teams have those players.

### MLB Depth Charts

- **Depth chart page**: Player Search includes a depth-chart view grouped by MLB team and position.
- **Depth chart data in player details**: Player detail panels show depth chart fields for individual players.

### Live Updates And Notifications

- **Live update webhook**: Draft Kit exposes an endpoint for notification-worthy player updates from the API-Licensing side.
- **Pushed state updates**: Live updates can update local player documents for depth chart, injury, and news changes.
- **Notification system**: The frontend opens an SSE connection, displays popup notifications, tracks unread notices, and dispatches page-level update events.
- **Manual/test update support**: The webhook accepts test-style update payloads when authorized by configuration.

### Taxi Draft

- **Taxi draft page**: Users can search for taxi-eligible players and add players to taxi rosters.
- **Taxi roster capacity**: Taxi rosters are limited to 9 players.
- **Taxi draft unlock rule**: The Taxi Draft page unlocks after all main roster slots are filled, unless the test taxi environment flag is enabled.
- **Players entered are removed from the eligible list**: Taxi-drafted players are marked locally and filtered from the taxi-eligible list after entry.
- **Taxi roster visibility**: Taxi players are attached to league roster data and shown in All Teams.

## Local Setup

Run the backend and frontend in separate terminals.

### Prerequisites

- Node.js
- MongoDB connection string
- Running API-Licensing service and API token for player data

### 1. Start The Backend

```bash
cd backend
npm install
npm run dev
```

The backend defaults to `http://localhost:4000`.

### 2. Start The Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend defaults to the Vite development URL shown in the terminal.

## Environment Configuration

### Backend Environment Variables (`backend/.env`)

- `PORT`: Express port, defaults to `4000`
- `FRONTEND_ORIGIN`: allowed frontend origin for CORS
- `MONGO_URL`: MongoDB connection string
- `JWT_SECRET`: secret used to sign auth tokens
- `JWT_EXPIRES_IN`: optional JWT lifetime, defaults to `1d`
- `API_ENDPOINT`: API-Licensing base URL, defaults to `http://localhost:4001`
- `API_TOKEN`: API-Licensing token used for player data requests
- `LIVE_UPDATE_WEBHOOK_SECRET`: optional secret required by the live-update webhook

### Frontend Environment Variables (`frontend/.env`)

```bash
VITE_API_BASE_URL=http://localhost:4000
VITE_TEST_TAXI=false
```

## Backend API Summary

All paths are relative to the Draft Kit backend base URL.

### Auth

- `POST /api/auth/register` - create an account with username, email, password, password confirmation, security question, and security answer.
- `POST /api/auth/login` - authenticate credentials and issue the auth cookie.
- `POST /api/auth/logout` - clear the auth cookie.
- `GET /api/auth/loggedIn` - check current auth state.
- `GET /api/auth/security-question` - retrieve the security question for password reset.
- `POST /api/auth/reset-password` - reset password after answering the security question.
- `PUT /api/auth/user` - update profile fields or password.
- `DELETE /api/auth/user` - delete the current account and owned league data.

### Leagues

- `GET /api/leagues` - list leagues owned by the authenticated user.
- `POST /api/leagues` - create a league and seed default rosters.
- `PATCH /api/leagues/:id` - update league name, budget, team names, team additions, and team deletions.
- `PATCH /api/leagues/:id/my-team` - set the user's team for a league.
- `POST /api/leagues/:id/import-from/:sourceId` - import roster and transaction data from another owned league.

### Players

- `GET /api/players` - fetch evaluated players for a league, with sort and filter query parameters.
- `GET /api/players/depth-charts` - fetch MLB depth chart data from API-Licensing.
- `GET /api/players/totalFantasyPoints` - fetch total fantasy points summary from API-Licensing.
- `GET /api/players/custom` - list custom players for a league.
- `POST /api/players/custom` - create a custom player.
- `PATCH /api/players/custom/:playerId` - update a custom player.
- `DELETE /api/players/custom/:playerId` - delete a custom player.
- `POST /api/players/custom/:playerId/draft` - draft a custom player.
- `POST /api/players/custom/:playerId/drop` - drop a custom player.
- `POST /api/players/custom/:playerId/move` - move a custom player to a different slot.
- `GET /api/players/:APIplayerId/doc` - fetch local player metadata and notes.
- `PUT /api/players/:APIplayerId/doc` - upsert player notes or local player metadata.
- `POST /api/players/:APIplayerId/draft` - draft a licensed player.
- `POST /api/players/:APIplayerId/drop` - drop a licensed player.
- `POST /api/players/:APIplayerId/move` - move a licensed player to a different slot.
- `POST /api/players/:APIplayerId/taxi` - add a player to a taxi roster.
- `POST /api/players/:APIplayerId/minor-league` - add a minor league player to a minor league roster.
- `POST /api/players/:APIplayerId/minor-league/move` - move a minor league player between minor league rosters.

### Transactions

- `GET /api/transactions` - list transactions for a league.
- `POST /api/transactions` - create a transaction entry.

### Live Updates

- `POST /api/live-updates/player` - receive a player depth chart, injury, or news update.
- `GET /api/live-updates/notices` - list recent live update notices.
- `GET /api/live-updates/events` - stream live update notices over SSE.

## Quality Assurance And Build Commands

### Backend Tests

```bash
cd backend
npm test
```

### Frontend Build

```bash
cd frontend
npm run build
```

This produces a production bundle in `frontend/dist`.
