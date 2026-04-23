"use strict";

const db = require("../db");
const transactionsController = require("../controllers/transactions-controller");
const { createResponse } = require("./test-helpers");

describe("transactions-controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getTransactions rejects requests without leagueId", async () => {
    const req = { query: {} };
    const res = createResponse();

    await transactionsController.getTransactions(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      errorMessage: "Please provide leagueId.",
    });
  });

  it("getTransactions returns transaction history for the league", async () => {
    vi.spyOn(db, "getTransactions").mockResolvedValue([{ _id: "tx-1" }, { _id: "tx-2" }]);

    const req = { query: { leagueId: "league-1" } };
    const res = createResponse();

    await transactionsController.getTransactions(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload).toEqual({
      transactions: [{ _id: "tx-1" }, { _id: "tx-2" }],
    });
  });

  it("getTransactions returns 500 when the db lookup throws", async () => {
    vi.spyOn(db, "getTransactions").mockRejectedValue(new Error("db down"));

    const req = { query: { leagueId: "league-1" } };
    const res = createResponse();

    await transactionsController.getTransactions(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.jsonPayload).toEqual({
      errorMessage: "Error",
    });
  });

  it("createTransaction rejects missing required fields", async () => {
    const req = {
      body: {
        teamOwner: "",
        player: "Player A",
        actionType: "",
        leagueId: "",
      },
    };
    const res = createResponse();

    await transactionsController.createTransaction(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      errorMessage: "Please enter all required fields.",
    });
  });

  it("createTransaction persists and returns the new transaction", async () => {
    vi.spyOn(db, "createTransaction").mockImplementation(async (payload) => ({
      _id: "tx-1",
      ...payload,
    }));

    const req = {
      body: {
        teamOwner: "Team 1",
        player: "Player A",
        actionType: "draft",
        draftCost: 22,
        budgetLeft: 238,
        leagueId: "league-1",
      },
    };
    const res = createResponse();

    await transactionsController.createTransaction(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.jsonPayload).toEqual({
      success: true,
      transaction: {
        _id: "tx-1",
        teamOwner: "Team 1",
        player: "Player A",
        actionType: "draft",
        draftCost: 22,
        budgetLeft: 238,
        leagueId: "league-1",
      },
    });
  });

  it("createTransaction returns 500 when persistence fails", async () => {
    vi.spyOn(db, "createTransaction").mockRejectedValue(new Error("write failed"));

    const req = {
      body: {
        teamOwner: "Team 1",
        player: "Player A",
        actionType: "draft",
        leagueId: "league-1",
      },
    };
    const res = createResponse();

    await transactionsController.createTransaction(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.sent).toBe(true);
  });
});
