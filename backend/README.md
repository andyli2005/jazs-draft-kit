# Draft Kit Backend

This backend is an Express API backed by MongoDB. It handles user authentication, league creation, player note persistence, transaction history, and league-aware player valuation requests. It also proxies player data from an upstream players service so the frontend only needs to talk to one backend.

## Responsibilities

- Issue and validate login sessions with a signed cookie
- Persist users, leagues, rosters, transactions, and saved player documents in MongoDB
- Create league records and default rosters when a new draft league is created
- Fetch and reshape player data from the upstream players API
- Store personal notes for a player within a specific league
- Expose transaction history for a league

## Runtime Notes

- Server entry point: `backend/server.js`
- Default port: `4000`
- All API routes are mounted under `/api`
- Most routes require authentication via the `token` cookie
- Cookies are configured as `httpOnly`, `secure: true`, and `sameSite: "none"`

## Environment Variables

Typical variables used by the backend:

- `PORT`: Express port, defaults to `4000`
- `FRONTEND_ORIGIN`: allowed frontend origin for CORS
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: secret used to sign auth tokens
- `API_ENDPOINT`: base URL for the upstream players service, defaults to `http://localhost:4001`
- `API_TOKEN`: token forwarded to the upstream players service

## Local Development

Install dependencies and start the server:

```bash
npm install
npm run dev
```

## API Endpoints

All paths below are relative to the backend base URL, for example `http://localhost:4000`.

### Auth

`POST /api/auth/register`

- Creates a new user account
- Validates `userName`, `email`, `password`, and `passwordVerify`
- Hashes the password, saves the user, and sets the login cookie
- Returns the created user payload

Request body:

```json
{
  "userName": "demo",
  "email": "demo@example.com",
  "password": "password123",
  "passwordVerify": "password123"
}
```

`POST /api/auth/login`

- Logs in an existing user
- Requires `email` and `password`
- Verifies credentials and sets the login cookie
- Returns the signed-in user payload

`POST /api/auth/logout`

- Clears the auth cookie
- Ends the current session

`GET /api/auth/loggedIn`

- Checks whether the request has a valid login cookie
- Returns `loggedIn: true` plus the current user when authenticated
- Returns `loggedIn: false` when no valid session exists

`PUT /api/auth/user`

- Requires authentication
- Updates the current user profile
- Requires `userName`
- Optionally updates `password`, `passwordVerify`, and `profilePicture`
- Reissues the auth cookie and returns the updated user

`DELETE /api/auth/user`

- Requires authentication
- Deletes the currently logged-in user account
- Clears the auth cookie

### Leagues

`GET /api/leagues`

- Requires authentication
- Returns all leagues owned by the current user
- Used by the dashboard and league selection flow

`POST /api/leagues`

- Requires authentication
- Creates a new league owned by the current user
- Requires `sport`, `name`, `draftType`, `teamCount`, and `budgetCap`
- Automatically creates default roster records for each team slot

Request body:

```json
{
  "sport": "MLB",
  "name": "Home League",
  "draftType": "Auction",
  "teamCount": 12,
  "budgetCap": 260
}
```

### Players

`GET /api/players`

- Requires authentication
- Returns player data for a specific league
- Requires query parameter `leagueId`
- Accepts upstream query params such as `rankBy`, `order`, and `name`
- Computes league context such as remaining budget and roster spots, then forwards that information to the upstream players service
- Used by the player search page

Common query parameters:

- `leagueId`: required local league id
- `rankBy`: sort field such as `fantasyPoints` or `cost`
- `order`: `asc` or `desc`
- `name`: optional player name filter

Example:

```text
GET /api/players?leagueId=<leagueId>&rankBy=fantasyPoints&order=desc&name=judge
```

`GET /api/players/totalFantasyPoints`

- Requires authentication
- Proxies the upstream total fantasy points summary endpoint
- Returns `totalPoints`

`GET /api/players/:APIplayerId/doc`

- Requires authentication
- Returns the saved Draft Kit player document for one player in one league
- Requires query parameter `leagueId`
- Used by the player side panel to load saved personal notes

Example:

```text
GET /api/players/12345/doc?leagueId=<leagueId>
```

`PUT /api/players/:APIplayerId/doc`

- Requires authentication
- Creates or updates the saved Draft Kit player document for one player in one league
- Requires `leagueId` in the JSON body
- Stores metadata such as `name`, `status`, `positions`, `team`, stats, and `personalNotes`
- If `personalNotes` changed, also writes a league transaction with action type `UpdatedNotes`

Request body shape used by the frontend:

```json
{
  "leagueId": "<leagueId>",
  "personalNotes": "Target in middle rounds",
  "name": "Player Name",
  "status": "Active",
  "notes": "",
  "positions": "OF",
  "team": "NYY",
  "pictureURL": "https://...",
  "price": 0,
  "currentStats": {},
  "projectedStats": {},
  "threeYearAverageStats": {}
}
```

### Transactions

`GET /api/transactions`

- Requires authentication
- Returns transactions for a league
- Requires query parameter `leagueId`
- Used by the transactions page, which polls this endpoint

Example:

```text
GET /api/transactions?leagueId=<leagueId>
```

`POST /api/transactions`

- Requires authentication
- Creates a transaction entry for a league
- Requires `teamOwner`, `player`, `actionType`, and `leagueId`
- Optional fields include `draftCost` and `budgetLeft`

Request body:

```json
{
  "teamOwner": "Team 1",
  "player": "Player Name",
  "actionType": "Drafted",
  "draftCost": 24,
  "budgetLeft": 236,
  "leagueId": "<leagueId>"
}
```

## Endpoints Currently Used by the Frontend

These are the routes actively called by the current frontend code:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/loggedIn`
- `PUT /api/auth/user`
- `DELETE /api/auth/user`
- `GET /api/leagues`
- `POST /api/leagues`
- `GET /api/players`
- `GET /api/players/:APIplayerId/doc`
- `PUT /api/players/:APIplayerId/doc`
- `GET /api/transactions`

`POST /api/transactions` and `GET /api/players/totalFantasyPoints` are implemented by the backend but are not currently called by the checked-in frontend code.
