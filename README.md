# JAZS Fantasy Baseball Draft Kit

A comprehensive tracker and valuation tool for fantasy baseball drafts. This application allows users to manage multiple leagues, track draft picks, and get dynamic player valuations based on market scarcity and remaining budget.

## Project Structure

This repository is split into two main components:

- **`/frontend`**: A React + Vite single-page application.
- **`/backend`**: An Express API backed by MongoDB.

## Key Features

- **Dynamic Valuations:** Real-time dollar values calculated using projected stats, 3-year averages, and positional scarcity.
- **Draft Tracking:** Log every pick with automatic budget updates and transaction history.
- **Player Search:** Filter by name or position (with multi-position support) and sort by stats or value.
- **Custom Players:** Add and draft players not found in the standard MLB database.
- **League Management:** Update budget caps, rename teams, or add/remove teams mid-draft with automatic synchronization.
- **Taxi Draft:** Manage minor league or "taxi" squads with dedicated roster rules.

## Local Setup

To run the Draft Kit locally, you will need two terminals running simultaneously:

### 1. Start the Backend
```bash
cd backend
npm install
# Ensure .env is configured with MONGO_URL, API_TOKEN, and API_ENDPOINT
npm run dev
```

### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

## Environment Configuration

The Draft Kit depends on an **Upstream Player API** for its data. Ensure your `backend/.env` has:
- `API_ENDPOINT`: The URL of your Licensing API.
- `API_TOKEN`: A valid key generated from your Licensing API account.
