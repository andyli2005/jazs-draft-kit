"use strict";

const mongoose = require("mongoose");
const db = require("../db");
const User = require("../db/models/User");
const League = require("../db/models/League");
const MLBRoster = require("../db/models/MLBRoster");
const Transaction = require("../db/models/Transaction");
const Player = require("../db/models/Player");

function createPopulateChain(result) {
  return {
    select() {
      return this;
    },
    populate() {
      return Promise.resolve(result);
    },
    sort() {
      return this;
    },
    limit() {
      return Promise.resolve(result);
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
}

describe("db", () => {
  const originalMongoUrl = process.env.MONGO_URL;

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.MONGO_URL = originalMongoUrl;
  });

  it("connect uses MONGO_URL and disconnect closes the mongoose connection", async () => {
    process.env.MONGO_URL = "mongodb://example.test/db";
    const connectSpy = vi.spyOn(mongoose, "connect").mockResolvedValue();
    const closeSpy = vi.spyOn(mongoose.connection, "close").mockResolvedValue();

    await db.connect();
    await db.disconnect();

    expect(connectSpy).toHaveBeenCalledWith("mongodb://example.test/db");
    expect(closeSpy).toHaveBeenCalled();
  });

  it("connect throws when MONGO_URL is missing", async () => {
    delete process.env.MONGO_URL;

    await expect(db.connect()).rejects.toThrow("MONGO_URL not set");
  });

  it("deleteDatabase drops every collection in the current database", async () => {
    const dropCollection = vi.fn().mockResolvedValue();
    const originalDb = mongoose.connection.db;
    Object.defineProperty(mongoose.connection, "db", {
      configurable: true,
      value: {
        listCollections: () => ({
          toArray: async () => [{ name: "users" }, { name: "leagues" }],
        }),
        dropCollection,
      },
    });

    await db.deleteDatabase();

    Object.defineProperty(mongoose.connection, "db", {
      configurable: true,
      value: originalDb,
    });

    expect(dropCollection).toHaveBeenCalledWith("users");
    expect(dropCollection).toHaveBeenCalledWith("leagues");
  });

  it("deleteUserById returns null when the user does not exist", async () => {
    vi.spyOn(User, "findByIdAndDelete").mockResolvedValue(null);

    await expect(db.deleteUserById("user-1")).resolves.toBeNull();
  });

  it("deleteUserById cascades league, roster, transaction, and player cleanup", async () => {
    vi.spyOn(User, "findByIdAndDelete").mockResolvedValue({ _id: "user-1" });
    vi.spyOn(League, "find").mockReturnValue(createPopulateChain([
      { _id: "league-1", rosterIds: ["roster-1", "roster-2"] },
    ]));
    const deleteManyLeague = vi.spyOn(League, "deleteMany").mockResolvedValue({});
    const deleteManyRoster = vi.spyOn(MLBRoster, "deleteMany").mockResolvedValue({});
    const deleteManyTransaction = vi.spyOn(Transaction, "deleteMany").mockResolvedValue({});
    const deleteManyPlayer = vi.spyOn(Player, "deleteMany").mockResolvedValue({});

    const result = await db.deleteUserById("user-1");

    expect(result).toEqual({ _id: "user-1" });
    expect(deleteManyLeague).toHaveBeenCalled();
    expect(deleteManyRoster).toHaveBeenCalled();
    expect(deleteManyTransaction).toHaveBeenCalled();
    expect(deleteManyPlayer).toHaveBeenCalled();
  });

  it("createLeague rolls back the new league when the owning user cannot be updated", async () => {
    const save = vi.fn().mockResolvedValue({ _id: "league-1" });
    vi.spyOn(League.prototype, "save").mockImplementation(save);
    vi.spyOn(User, "findByIdAndUpdate").mockResolvedValue(null);
    const rollbackSpy = vi.spyOn(League, "findByIdAndDelete").mockResolvedValue({});

    await expect(
      db.createLeague({ user: "user-1", sport: "MLB", name: "League", draftType: "Snake" })
    ).rejects.toThrow("User not found for league creation.");

    expect(rollbackSpy).toHaveBeenCalledWith("league-1");
  });

  it("getLeaguesByUser falls back to League.find and repairs the user document", async () => {
    vi.spyOn(User, "findById").mockReturnValue(createPopulateChain({ leagues: [] }));
    vi.spyOn(League, "find").mockReturnValue(createPopulateChain([{ _id: "league-1" }]));
    const repairSpy = vi.spyOn(User, "findByIdAndUpdate").mockResolvedValue({});

    const leagues = await db.getLeaguesByUser("user-1");

    expect(leagues).toEqual([{ _id: "league-1" }]);
    expect(repairSpy).toHaveBeenCalled();
  });

  it("getLeaguesByUser returns populated leagues directly and handles missing users", async () => {
    vi.spyOn(User, "findById")
      .mockReturnValueOnce(createPopulateChain({ leagues: [{ _id: "league-1" }] }))
      .mockReturnValueOnce(createPopulateChain(null));

    await expect(db.getLeaguesByUser("user-1")).resolves.toEqual([{ _id: "league-1" }]);
    await expect(db.getLeaguesByUser("missing-user")).resolves.toEqual([]);
  });

  it("deleteLeagueById returns null for unknown leagues and removes known leagues from the user", async () => {
    vi.spyOn(League, "findByIdAndDelete")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: "league-1", user: "user-1" });
    const updateSpy = vi.spyOn(User, "findByIdAndUpdate").mockResolvedValue({});

    await expect(db.deleteLeagueById("missing")).resolves.toBeNull();
    await expect(db.deleteLeagueById("league-1")).resolves.toEqual({ _id: "league-1", user: "user-1" });
    expect(updateSpy).toHaveBeenCalledWith("user-1", {
      $pull: { leagues: "league-1" },
    });
  });

  it("constructor-backed save helpers create user, transaction, and roster documents", async () => {
    vi.spyOn(User.prototype, "save").mockResolvedValue({ _id: "user-1" });
    vi.spyOn(Transaction.prototype, "save").mockResolvedValue({ _id: "tx-1" });
    vi.spyOn(MLBRoster.prototype, "save").mockResolvedValue({ _id: "roster-1" });

    await expect(db.createUser({ userName: "Alice" })).resolves.toEqual({ _id: "user-1" });
    await expect(db.createTransaction({ player: "P" })).resolves.toEqual({ _id: "tx-1" });
    await expect(db.createMLBRoster({ name: "Team 1", budgetLeft: 260 })).resolves.toEqual({ _id: "roster-1" });
  });

  it("simple wrapper methods delegate to the underlying models", async () => {
    vi.spyOn(User, "findById").mockResolvedValue({ _id: "user-1" });
    vi.spyOn(User, "find").mockResolvedValue([{ _id: "user-1" }]);
    vi.spyOn(User, "findOne").mockResolvedValue({ _id: "user-1" });
    vi.spyOn(User, "findByIdAndUpdate").mockResolvedValue({ _id: "user-1", userName: "A" });
    vi.spyOn(League, "findById").mockResolvedValue({ _id: "league-1" });
    vi.spyOn(League, "findByIdAndUpdate").mockResolvedValue({ _id: "league-1" });
    vi.spyOn(League, "findByIdAndDelete").mockResolvedValue({ _id: "league-1", user: "user-1" });
    vi.spyOn(Transaction, "find").mockReturnValue(createPopulateChain([{ _id: "tx-1" }]));
    vi.spyOn(MLBRoster, "findById").mockResolvedValue({ _id: "roster-1" });
    vi.spyOn(Player, "findOne").mockResolvedValue({ _id: "player-1" });
    vi.spyOn(Player, "findOneAndUpdate").mockResolvedValue({ _id: "player-1" });

    await expect(db.getUserById("user-1")).resolves.toEqual({ _id: "user-1" });
    await expect(db.getUsersByUserName("A")).resolves.toEqual([{ _id: "user-1" }]);
    await expect(db.getUserByEmail("a@example.com")).resolves.toEqual({ _id: "user-1" });
    await expect(db.updateUserById("user-1", { userName: "A" })).resolves.toEqual({ _id: "user-1", userName: "A" });
    await expect(db.getLeagueById("league-1")).resolves.toEqual({ _id: "league-1" });
    await expect(db.updateLeagueById("league-1", { name: "L" })).resolves.toEqual({ _id: "league-1" });
    await expect(db.getTransactions("league-1")).resolves.toEqual([{ _id: "tx-1" }]);
    await expect(db.getMLBRosterById("roster-1")).resolves.toEqual({ _id: "roster-1" });
    await expect(db.getPlayerDoc("api-1", "league-1")).resolves.toEqual({ _id: "player-1" });
    await expect(db.upsertPlayerDoc("api-1", "league-1", { name: "P" })).resolves.toEqual({ _id: "player-1" });
  });
});
