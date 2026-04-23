# Backend Test Coverage Guide

This folder contains the Vitest suite for the backend application.

## Test Files

### `auth.test.js`
Tests functions from `backend/auth/index.js`.

- `signToken(userId)`
  - Creates a JWT that can be decoded back into the same user id.
- `verifyUser(req)`
  - Returns the authenticated user id when a valid token cookie exists.
  - Returns `null` when the cookie is missing.
- `verify(req, res, next)`
  - Calls `next()` and attaches `req.userId` for valid tokens.
  - Returns `401` for missing tokens.
  - Returns `401` for invalid tokens.

### `auth-controller.test.js`
Tests functions from `backend/controllers/auth-controller.js`.

- `getLoggedIn(req, res)`
  - Returns logged-out state when there is no verified user.
  - Returns logged-in user payload for a valid session.
- `registerUser(req, res)`
  - Rejects missing required fields.
  - Rejects short passwords.
  - Rejects mismatched passwords.
  - Rejects duplicate emails.
  - Normalizes email casing/spacing and sets the auth cookie on success.
- `loginUser(req, res)`
  - Rejects missing fields.
  - Rejects invalid credentials.
  - Sets the auth cookie on success.
- `updateUser(req, res)`
  - Rejects unauthorized requests.
  - Rejects missing `userName`.
  - Rejects incomplete password updates.
  - Rejects short passwords.
  - Rejects mismatched passwords.
  - Returns `404` when the user no longer exists.
  - Updates profile data and refreshes the auth cookie on success.
- `deleteUser(req, res)`
  - Rejects unauthorized requests.
  - Returns `404` when the user cannot be deleted.
  - Clears the auth cookie on success.
- `logoutUser(req, res)`
  - Clears the auth cookie with the expected cross-site options.

### `db.test.js`
Tests functions from `backend/db/index.js`.

- `connect()`
  - Uses `MONGO_URL` to connect.
  - Throws when `MONGO_URL` is missing.
- `disconnect()`
  - Closes the active mongoose connection.
- `deleteDatabase()`
  - Drops every collection in the connected database.
- `deleteUserById(id)`
  - Returns `null` when the user does not exist.
  - Cascades cleanup for leagues, rosters, transactions, and players.
- `createLeague(leagueData)`
  - Rolls back the saved league when the owning user update fails.
- `getLeaguesByUser(userId)`
  - Returns populated leagues directly when present on the user.
  - Falls back to `League.find(...)` when user league references are empty.
  - Repairs the user’s `leagues` list after fallback lookup.
  - Returns an empty array for missing users.
- `deleteLeagueById(id)`
  - Returns `null` for unknown leagues.
  - Removes known league ids from the user document.
- `createUser(userData)`
  - Saves a new user document.
- `createTransaction(transactionData)`
  - Saves a new transaction document.
- `createMLBRoster(rosterData)`
  - Saves a new roster document.
- Wrapper methods verified for direct model delegation:
  - `getUserById(id)`
  - `getUsersByUserName(userName)`
  - `getUserByEmail(email)`
  - `updateUserById(id, fieldsToUpdate)`
  - `getLeagueById(id)`
  - `updateLeagueById(id, fieldsToUpdate)`
  - `getTransactions(leagueId)`
  - `getMLBRosterById(id)`
  - `getPlayerDoc(APIplayerId, leagueId)`
  - `upsertPlayerDoc(APIplayerId, leagueId, fields)`

### `league-controller.test.js`
Tests functions from `backend/controllers/league-controller.js`.

- `createLeague(req, res)`
  - Rejects missing required fields.
  - Creates the requested number of rosters.
  - Trims the league name before persistence.
- `getMyLeagues(req, res)`
  - Returns the current user’s leagues.
  - Returns `500` when the DB lookup fails.
- `setMyTeam(req, res)`
  - Returns `404` when the league is not found or does not belong to the user.
  - Rejects requests without `myTeamId`.
  - Rejects rosters that are not part of the league.
  - Updates `myTeam` when the roster belongs to the league.
- `editLeague(req, res)`
  - Rejects invalid league name or budget cap input.
  - Rejects invalid `teamsToAdd`.
  - Rejects invalid `teamRenames` payloads.
  - Rejects deletes for teams not in the league.
  - Rejects renames for teams not in the league.
  - Rejects renaming and deleting the same team.
  - Rejects blank team names.
  - Updates league metadata and roster names on success.

### `league-valuation.test.js`
Tests functions from `backend/services/league-valuation.js`.

- `computeTotalMoneyRemaining(rosters)`
  - Sums finite `budgetLeft` values only.
  - Returns `0` for missing or empty input.
- `computeRosterSpotsRemaining(roster)`
  - Counts empty roster slots correctly.
  - Treats a missing roster as fully empty.
- `computeMoneyAboveMinimum(totalMoneyRemaining, totalSpotsRemaining)`
  - Never returns a negative number.

### `players-controller.test.js`
Tests functions from `backend/controllers/players-controller.js`.

Helper functions covered through `__testables`:

- `normalizeStatBlock(block)`
  - Coerces valid numeric values and defaults invalid values to `0`.
- `normalizeApiPlayer(rawPlayer)`
  - Maps licensed API player payloads into local player shape.
  - Returns `null` for missing input.
- `buildUpstreamUrl(query, path)`
  - Builds query strings correctly.
  - Supports array query params.
  - Removes trailing slashes from API base URLs.
- `getApiBase()`
  - Returns normalized API base URL.
- `extractPlayers(payload)`
  - Supports both array payloads and nested `items` payloads.
- `mapPlayerToDocFields(licensedPlayer, existingDoc)`
  - Preserves local draft price and personal notes from existing docs.
- `hasTruthyOverride(value)`
  - Accepts only `true` and `"true"`.
- `createHttpError(status, message)`
  - Preserves status and message for controller error handling.
- `isTransactionUnsupportedError(error)`
  - Detects the Mongo transaction limitation message.
- `fetchLicensedPlayerById(APIplayerId)`
  - Falls back to evaluations when detail lookup returns `404`.
  - Rejects invalid upstream payloads.
- `fetchLicensedPlayerFromEvaluations(APIplayerId)`
  - Throws `404` when the player is missing from evaluation results.

Endpoint functions covered:

- `getPlayers(req, res)`
  - Rejects missing `API_TOKEN`.
  - Rejects missing `leagueId`.
  - Returns `404` for missing leagues.
  - Merges upstream players with local drafted/bid state.
  - Sorts by cost when requested.
  - Returns upstream API errors directly.
  - Returns `502` when the upstream request fails.
- `getTotalFantasyPoints(req, res)`
  - Rejects missing `API_TOKEN`.
  - Returns upstream API errors directly.
  - Returns `502` when the upstream request fails.
  - Returns total points on success.
- `getPlayerDoc(req, res)`
  - Rejects missing `leagueId`.
  - Returns the saved player document.
  - Returns `500` on DB lookup failure.
- `upsertPlayerDoc(req, res)`
  - Rejects missing `leagueId`.
  - Skips transaction creation when notes do not change.
  - Creates an `UpdatedNotes` transaction when notes change.
  - Returns `500` when persistence fails.
- `draftPlayer(req, res)`
  - Rejects missing required fields.
  - Rejects invalid slot keys.
  - Rejects invalid draft cost values.
  - Rejects negative draft costs.
  - Requires explicit inactive override for inactive players.
  - Applies draft mutations successfully.
  - Falls back when Mongo transactions are unsupported.
  - Rejects access to leagues owned by another user.
- `dropPlayer(req, res)`
  - Rejects missing required fields.
  - Clears roster ownership and refunds budget on success.
  - Rejects rosters that are not part of the league.
  - Returns `404` when the player document does not exist.

### `transactions-controller.test.js`
Tests functions from `backend/controllers/transactions-controller.js`.

- `getTransactions(req, res)`
  - Rejects missing `leagueId`.
  - Returns transaction history on success.
  - Returns `500` when the DB lookup fails.
- `createTransaction(req, res)`
  - Rejects missing required fields.
  - Persists and returns the created transaction.
  - Returns `500` when persistence fails.

## Support Files

### `setup.js`
Test-only Vitest setup.

- Silences `console.log` and `console.error` during test runs so failure-path tests do not clutter output.

### `test-helpers.js`
Reusable test utilities.

- `createResponse()`
  - Creates an Express-like mock response object with support for:
  - `status(...)`
  - `json(...)`
  - `send(...)`
  - `cookie(...)`
  - `clearCookie(...)`
