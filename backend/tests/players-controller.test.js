"use strict";

const mongoose = require("mongoose");
const db = require("../db");
const League = require("../db/models/League");
const MLBRoster = require("../db/models/MLBRoster");
const Player = require("../db/models/Player");
const playersController = require("../controllers/players-controller");
const { createResponse } = require("./test-helpers");

const {
  buildUpstreamUrl,
  createHttpError,
  extractPlayers,
  fetchLicensedPlayerById,
  fetchLicensedPlayerFromEvaluations,
  getApiBase,
  hasTruthyOverride,
  isTransactionUnsupportedError,
  mapPlayerToDocFields,
  normalizeApiPlayer,
  normalizeStatBlock,
} = playersController.__testables;

const LEAGUE_ID = "507f1f77bcf86cd799439011";
const ROSTER_ID = "507f191e810c19729de860ea";
const OTHER_ROSTER_ID = "507f191e810c19729de860eb";
const API_PLAYER_ID = "507f191e810c19729de860aa";
const API_PLAYER_ID_TWO = "507f191e810c19729de860ab";
const PLAYER_DOC_ID = "507f191e810c19729de860ac";
const USER_ID = "507f191e810c19729de860ad";

function createSession() {
  return {
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  };
}

function createQuery(result) {
  return {
    session() {
      return this;
    },
    lean() {
      return Promise.resolve(result);
    },
    select() {
      return Promise.resolve(result);
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
}

function createSelectLeanQuery(result) {
  return {
    select() {
      return this;
    },
    lean() {
      return Promise.resolve(result);
    },
  };
}

describe("players-controller helpers", () => {
  const originalFetch = global.fetch;
  const originalApiToken = process.env.API_TOKEN;
  const originalApiEndpoint = process.env.API_ENDPOINT;

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
    process.env.API_TOKEN = originalApiToken;
    process.env.API_ENDPOINT = originalApiEndpoint;
  });

  it("normalizeStatBlock converts invalid stat values to zero", () => {
    expect(normalizeStatBlock({ runs: "7", hits: "bad" }).runs).toBe(7);
    expect(normalizeStatBlock({ runs: "7", hits: "bad" }).hits).toBe(0);
    expect(normalizeStatBlock({}).fantasyPoints).toBe(0);
  });

  it("normalizeApiPlayer maps licensed API payloads", () => {
    const normalized = normalizeApiPlayer({
      _id: "mongo-id",
      playerId: "api-1",
      name: "Player One",
      status: "DTD",
      injuryStatus: "Day-to-day",
      note: "day-to-day",
      positions: "1B",
      team: "NYM",
      age: 28,
      depthChart: { position: "1B", rank: 2, role: "Reserve", section: "Infield" },
      height: 74,
      weight: 224,
      currentStats: { runs: "3" },
    });

    expect(normalized).toMatchObject({
      APIplayerId: "api-1",
      name: "Player One",
      status: "Inactive",
      injuryStatus: "Day-to-day",
      notes: "day-to-day",
      positions: "1B",
      team: "NYM",
      age: 28,
      depthChart: { position: "1B", rank: 2, role: "Reserve", section: "Infield" },
      height: 74,
      weight: 224,
      price: 0,
    });
    expect(normalized.currentStats.runs).toBe(3);
    expect(normalizeApiPlayer(null)).toBeNull();
  });

  it("buildUpstreamUrl appends arrays and removes trailing slashes from the base url", () => {
    process.env.API_ENDPOINT = "http://example.test///";

    const url = buildUpstreamUrl({ leagueId: "ignored", foo: ["a", "b"], bar: 7 }, "/api/x");

    expect(url).toBe("http://example.test/api/x?leagueId=ignored&foo=a&foo=b&bar=7");
    expect(getApiBase()).toBe("http://example.test");
  });

  it("extractPlayers supports both array and nested payload shapes", () => {
    const payload = {
      items: [
        {
          _id: "mongo-id-1",
          playerId: "api-1",
          name: "Player One",
          status: "Active",
          pictureURL: "img",
          positions: "SP",
          team: "SEA",
          cost: 12,
          age: 29,
          depthChart: { position: "SP", rank: 3, role: "Starter", section: "Pitchers" },
          height: 76,
          weight: 230,
          currentStats: { runs: 1 },
        },
      ],
    };

    expect(extractPlayers(payload)).toEqual([
      expect.objectContaining({
        APIplayerId: "api-1",
        team: "SEA",
        cost: 12,
        age: 29,
        depthChart: { position: "SP", rank: 3, role: "Starter", section: "Pitchers" },
        height: 76,
        weight: 230,
        runs: 1,
      }),
    ]);
  });

  it("mapPlayerToDocFields preserves local draft state from an existing document", () => {
    const fields = mapPlayerToDocFields(
      {
        name: "Player One",
        status: "Active",
        injuryStatus: "Healthy",
        notes: "Healthy",
        positions: "SP",
        team: "SEA",
        pictureURL: "img",
        age: 31,
        depthChart: { position: "SP", rank: 1, role: "Ace", section: "Pitchers" },
        height: 77,
        weight: 225,
        currentStats: { runs: 1 },
        projectedStats: { runs: 2 },
        threeYearAverageStats: { runs: 3 },
      },
      {
        price: 44,
        personalNotes: "stash",
      }
    );

    expect(fields.price).toBe(44);
    expect(fields.personalNotes).toBe("stash");
    expect(fields.notes).toBe("Healthy");
    expect(fields.injuryStatus).toBe("Healthy");
    expect(fields.depthChart.role).toBe("Ace");
    expect(fields.depthChart.section).toBe("Pitchers");
    expect(fields.height).toBe(77);
    expect(fields.weight).toBe(225);
  });

  it("hasTruthyOverride only accepts boolean true or the string true", () => {
    expect(hasTruthyOverride(true)).toBe(true);
    expect(hasTruthyOverride("true")).toBe(true);
    expect(hasTruthyOverride("TRUE")).toBe(false);
    expect(hasTruthyOverride(1)).toBe(false);
  });

  it("createHttpError and transaction error detection preserve status information", () => {
    const error = createHttpError(409, "bad state");

    expect(error.status).toBe(409);
    expect(error.message).toBe("bad state");
    expect(
      isTransactionUnsupportedError(
        new Error("Transaction numbers are only allowed on a replica set member or mongos")
      )
    ).toBe(true);
    expect(isTransactionUnsupportedError(new Error("other failure"))).toBe(false);
  });

  it("fetchLicensedPlayerById falls back to evaluations when detail lookup fails", async () => {
    process.env.API_TOKEN = "token";
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        status: 500,
        ok: false,
        json: async () => ({ errorMessage: "Failed to fetch player." }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              _id: "api-7",
              name: "Fallback Player",
              status: "Active",
              positions: "OF",
              team: "ATL",
              depthChart: { position: "OF", rank: 1, role: "Starter", section: "Outfield" },
              height: 75,
              weight: 210,
              currentStats: {},
              projectedStats: {},
              threeYearAverageStats: {},
            },
          ],
        }),
      });

    const player = await fetchLicensedPlayerById("api-7");

    expect(player.APIplayerId).toBe("api-7");
    expect(player.name).toBe("Fallback Player");
    expect(player.height).toBe(75);
    expect(player.weight).toBe(210);
  });

  it("fetchLicensedPlayerById accepts player response shape and preserves depth chart", async () => {
    process.env.API_TOKEN = "token";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        player: {
          _id: "mongo-id",
          playerId: "api-10",
          name: "Depth Player",
          status: "Active",
          note: "Healthy",
          injuryStatus: "Healthy",
          pictureURL: "img",
          positions: "2B",
          team: "SEA",
          depthChart: {
            position: "2B",
            rank: 1,
            role: "Starter",
            section: "Infield",
          },
          height: 72,
          weight: 205,
          currentStats: {},
          projectedStats: {},
          threeYearAverageStats: {},
        },
      }),
    });

    const player = await fetchLicensedPlayerById("api-10");

    expect(player.APIplayerId).toBe("api-10");
    expect(player.depthChart).toEqual({
      position: "2B",
      rank: 1,
      role: "Starter",
      section: "Infield",
    });
    expect(player.height).toBe(72);
    expect(player.weight).toBe(205);
  });

  it("fetchLicensedPlayerFromEvaluations throws when the player is absent", async () => {
    process.env.API_TOKEN = "token";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });

    await expect(fetchLicensedPlayerFromEvaluations("missing")).rejects.toMatchObject({
      status: 404,
      message: "Player not found.",
    });
  });

  it("fetchLicensedPlayerById throws for invalid upstream payloads", async () => {
    process.env.API_TOKEN = "token";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ item: { _id: "different-id" } }),
    });

    await expect(fetchLicensedPlayerById("api-9")).rejects.toMatchObject({
      status: 502,
      message: "Licensed API returned an invalid player payload.",
    });
  });
});

describe("players-controller endpoints", () => {
  const originalFetch = global.fetch;
  const originalApiToken = process.env.API_TOKEN;

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
    process.env.API_TOKEN = originalApiToken;
  });

  it("getPlayers rejects requests when API_TOKEN is missing", async () => {
    delete process.env.API_TOKEN;
    const res = createResponse();

    await playersController.getPlayers({ query: {} }, res);

    expect(res.statusCode).toBe(500);
    expect(res.jsonPayload.errorMessage).toBe("Server configuration is missing API_TOKEN.");
  });

  it("getPlayers validates the league id", async () => {
    process.env.API_TOKEN = "token";
    const res = createResponse();

    await playersController.getPlayers({ query: {} }, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload.errorMessage).toBe("leagueId query parameter is required.");
  });

  it("getPlayers returns merged local state and sorts by cost when requested", async () => {
    process.env.API_TOKEN = "token";
    vi.spyOn(db, "getLeagueById").mockResolvedValue({
      _id: "league-1",
      rosterIds: ["roster-1", "roster-2"],
    });
    vi.spyOn(db, "getMLBRosterById")
      .mockResolvedValueOnce({ budgetLeft: 100, catcher1: null })
      .mockResolvedValueOnce({ budgetLeft: 90, catcher1: "x" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            _id: "api-1",
            name: "Low Cost",
            status: "Active",
            positions: "SP",
            team: "SEA",
            cost: 5,
            currentStats: {},
            projectedStats: {},
            threeYearAverageStats: {},
          },
          {
            _id: "api-2",
            name: "High Cost",
            status: "Active",
            positions: "OF",
            team: "ATL",
            cost: 15,
            currentStats: {},
            projectedStats: {},
            threeYearAverageStats: {},
          },
        ],
      }),
    });

    const req = { query: { leagueId: "league-1", rankBy: "cost", order: "asc" } };
    const res = createResponse();

    const playerFindSpy = vi.spyOn(Player, "find").mockImplementation((query) => {
      if (query.isCustom === true) {
        return { lean: vi.fn().mockResolvedValue([]) };
      }
      return createQuery([
        {
          APIplayerId: "api-2",
          ownerId: "roster-1",
          bidStartedById: "roster-1",
          price: 25,
        },
      ]);
    });

    await playersController.getPlayers(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload.success).toBe(true);
    expect(res.jsonPayload.players.map((player) => player.APIplayerId)).toEqual(["api-1", "api-2"]);
    expect(res.jsonPayload.players[1]).toMatchObject({
      isDrafted: true,
      draftOwnerId: "roster-1",
      bidStartedById: "roster-1",
      leaguePrice: 25,
    });
    expect(res.jsonPayload.leagueState.moneyAboveMinimum).toBeGreaterThanOrEqual(0);
    playerFindSpy.mockRestore();
  });

  it("getPlayers returns upstream errors", async () => {
    process.env.API_TOKEN = "token";
    vi.spyOn(db, "getLeagueById").mockResolvedValue({ _id: "league-1", rosterIds: [] });
    vi.spyOn(db, "getDraftedPlayers").mockResolvedValue([]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ errorMessage: "Bad query" }),
    });

    const res = createResponse();
    await playersController.getPlayers({ query: { leagueId: "league-1" } }, res);

    expect(res.statusCode).toBe(422);
    expect(res.jsonPayload.errorMessage).toBe("Bad query");
  });

  it("getPlayers returns 404 when the league does not exist", async () => {
    process.env.API_TOKEN = "token";
    vi.spyOn(db, "getLeagueById").mockResolvedValue(null);

    const res = createResponse();
    await playersController.getPlayers({ query: { leagueId: "league-1" } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.jsonPayload.errorMessage).toBe("League not found. ");
  });

  it("getPlayers returns a 502 when the upstream request throws", async () => {
    process.env.API_TOKEN = "token";
    vi.spyOn(db, "getLeagueById").mockResolvedValue({ _id: "league-1", rosterIds: [] });
    vi.spyOn(db, "getDraftedPlayers").mockResolvedValue([]);
    global.fetch = vi.fn().mockRejectedValue(new Error("offline"));

    const res = createResponse();
    await playersController.getPlayers({ query: { leagueId: "league-1" } }, res);

    expect(res.statusCode).toBe(502);
    expect(res.jsonPayload.errorMessage).toContain("Unable to reach players service");
  });

  it("getTotalFantasyPoints validates API configuration and upstream failures", async () => {
    delete process.env.API_TOKEN;
    const missingRes = createResponse();
    await playersController.getTotalFantasyPoints({}, missingRes);
    expect(missingRes.statusCode).toBe(500);

    process.env.API_TOKEN = "token";
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ message: "Unavailable" }),
    });
    const upstreamRes = createResponse();
    await playersController.getTotalFantasyPoints({}, upstreamRes);
    expect(upstreamRes.statusCode).toBe(503);

    global.fetch = vi.fn().mockRejectedValue(new Error("offline"));
    const networkRes = createResponse();
    await playersController.getTotalFantasyPoints({}, networkRes);
    expect(networkRes.statusCode).toBe(502);
  });

  it("getTotalFantasyPoints returns the upstream total", async () => {
    process.env.API_TOKEN = "token";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ totalPoints: 987 }),
    });
    const res = createResponse();

    await playersController.getTotalFantasyPoints({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload).toEqual({ success: true, totalPoints: 987 });
  });

  it("getPlayerDoc validates leagueId and returns the saved doc", async () => {
    const missingRes = createResponse();
    await playersController.getPlayerDoc({ params: { APIplayerId: API_PLAYER_ID }, query: {} }, missingRes);
    expect(missingRes.statusCode).toBe(400);

    vi.spyOn(League, "findById").mockReturnValue(
      createSelectLeanQuery({ user: USER_ID })
    );
    vi.spyOn(db, "getPlayerDoc").mockResolvedValue({ APIplayerId: API_PLAYER_ID, leagueId: LEAGUE_ID });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: "Not Found" }),
    });
    const res = createResponse();
    await playersController.getPlayerDoc(
      { userId: USER_ID, params: { APIplayerId: API_PLAYER_ID }, query: { leagueId: LEAGUE_ID } },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload.playerDoc).toEqual({ APIplayerId: API_PLAYER_ID, leagueId: LEAGUE_ID });
  });

  it("getPlayerDoc returns depth chart data from the upstream player API", async () => {
    process.env.API_TOKEN = "token";
    vi.spyOn(League, "findById").mockReturnValue(
      createSelectLeanQuery({ user: USER_ID })
    );
    vi.spyOn(db, "getPlayerDoc").mockResolvedValue(null);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        player: {
          _id: "mongo-id",
          playerId: API_PLAYER_ID,
          name: "Depth Player",
          status: "Active",
      note: "Healthy",
      injuryStatus: "Healthy",
      pictureURL: "img",
          positions: "2B",
          team: "SEA",
          depthChart: {
            position: "2B",
            rank: 1,
            role: "Starter",
            section: "Infield",
          },
          currentStats: {},
          projectedStats: {},
          threeYearAverageStats: {},
        },
      }),
    });

    const res = createResponse();
    await playersController.getPlayerDoc(
      { userId: USER_ID, params: { APIplayerId: API_PLAYER_ID }, query: { leagueId: LEAGUE_ID } },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload.playerDoc).toMatchObject({
      APIplayerId: API_PLAYER_ID,
      depthChart: {
        position: "2B",
        rank: 1,
        role: "Starter",
        section: "Infield",
      },
    });
  });

  it("getPlayerDoc returns 500 when the document lookup fails", async () => {
    vi.spyOn(League, "findById").mockReturnValue(
      createSelectLeanQuery({ user: USER_ID })
    );
    vi.spyOn(db, "getPlayerDoc").mockRejectedValue(new Error("db down"));
    const res = createResponse();

    await playersController.getPlayerDoc(
      { userId: USER_ID, params: { APIplayerId: API_PLAYER_ID }, query: { leagueId: LEAGUE_ID } },
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.jsonPayload.errorMessage).toBe("Error fetching player document.");
  });

  it("upsertPlayerDoc validates missing leagueId and skips transactions when notes are unchanged", async () => {
    const missingRes = createResponse();
    await playersController.upsertPlayerDoc(
      { params: { APIplayerId: API_PLAYER_ID }, body: {}, userId: USER_ID },
      missingRes
    );
    expect(missingRes.statusCode).toBe(400);

    vi.spyOn(League, "findById").mockReturnValue(
      createSelectLeanQuery({ user: USER_ID })
    );
    vi.spyOn(db, "getPlayerDoc").mockResolvedValue({ personalNotes: "same", price: 12 });
    vi.spyOn(db, "upsertPlayerDoc").mockResolvedValue({ name: "Player One" });
    const createTransactionSpy = vi.spyOn(db, "createTransaction").mockResolvedValue({});
    const res = createResponse();

    await playersController.upsertPlayerDoc(
      {
        params: { APIplayerId: API_PLAYER_ID },
        body: {
          leagueId: LEAGUE_ID,
          personalNotes: "same",
          name: "Player One",
          status: "Active",
          positions: "SP",
          team: "SEA",
          currentStats: {},
          projectedStats: {},
          threeYearAverageStats: {},
        },
        userId: USER_ID,
      },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(createTransactionSpy).not.toHaveBeenCalled();
  });

  it("upsertPlayerDoc records a transaction when personal notes change", async () => {
    vi.spyOn(League, "findById").mockReturnValue(
      createSelectLeanQuery({ user: USER_ID })
    );
    vi.spyOn(db, "getPlayerDoc").mockResolvedValue({ personalNotes: "before", price: 12 });
    vi.spyOn(db, "upsertPlayerDoc").mockResolvedValue({ name: "Player One" });
    vi.spyOn(db, "getUserById").mockResolvedValue({ userName: "Owner" });
    const createTransactionSpy = vi.spyOn(db, "createTransaction").mockResolvedValue({});

    const req = {
      userId: USER_ID,
      params: { APIplayerId: API_PLAYER_ID },
      body: {
        leagueId: LEAGUE_ID,
        personalNotes: "after",
        name: "Player One",
        status: "Active",
        positions: "SP",
        team: "SEA",
        currentStats: {},
        projectedStats: {},
        threeYearAverageStats: {},
      },
    };
    const res = createResponse();

    await playersController.upsertPlayerDoc(req, res);

    expect(res.statusCode).toBe(200);
    expect(createTransactionSpy).toHaveBeenCalledWith({
      teamOwner: "Owner",
      player: "Player One",
      actionType: "UpdatedNotes",
      leagueId: LEAGUE_ID,
    });
  });

  it("upsertPlayerDoc requires contractStatus when the player is drafted", async () => {
    vi.spyOn(League, "findById").mockReturnValue(
      createSelectLeanQuery({ user: USER_ID })
    );
    vi.spyOn(db, "getPlayerDoc").mockResolvedValue({
      personalNotes: "before",
      price: 12,
      ownerId: "roster-1",
      contractStatus: "S1",
    });
    const res = createResponse();

    await playersController.upsertPlayerDoc(
      {
        params: { APIplayerId: API_PLAYER_ID },
        body: {
          leagueId: LEAGUE_ID,
          personalNotes: "after",
          name: "Player One",
          status: "Active",
          positions: "SP",
          team: "SEA",
          currentStats: {},
          projectedStats: {},
          threeYearAverageStats: {},
        },
        userId: USER_ID,
      },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload.errorMessage).toContain("contractStatus is required");

    vi.spyOn(db, "upsertPlayerDoc").mockResolvedValue({ name: "Player One" });
    vi.spyOn(db, "getUserById").mockResolvedValue({ userName: "Owner" });
    vi.spyOn(db, "createTransaction").mockResolvedValue({});
    const resOk = createResponse();
    await playersController.upsertPlayerDoc(
      {
        params: { APIplayerId: API_PLAYER_ID },
        body: {
          leagueId: LEAGUE_ID,
          personalNotes: "after",
          name: "Player One",
          status: "Active",
          positions: "SP",
          team: "SEA",
          currentStats: {},
          projectedStats: {},
          threeYearAverageStats: {},
          contractStatus: "F2",
        },
        userId: USER_ID,
      },
      resOk
    );
    expect(resOk.statusCode).toBe(200);
  });

  it("upsertPlayerDoc returns 500 when persistence fails", async () => {
    vi.spyOn(League, "findById").mockReturnValue(
      createSelectLeanQuery({ user: USER_ID })
    );
    vi.spyOn(db, "getPlayerDoc").mockRejectedValue(new Error("db down"));
    const res = createResponse();

    await playersController.upsertPlayerDoc(
      {
        params: { APIplayerId: API_PLAYER_ID },
        body: { leagueId: LEAGUE_ID },
        userId: USER_ID,
      },
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.jsonPayload.errorMessage).toBe("Error saving player document.");
  });

  it("draftPlayer validates missing required fields before touching persistence", async () => {
    const res = createResponse();

    await playersController.draftPlayer({ params: { APIplayerId: "api-1" }, body: {} }, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload.errorMessage).toContain("leagueId, bidStartedById");
  });

  it("draftPlayer rejects invalid slot keys and draft costs", async () => {
    const invalidSlotRes = createResponse();
    await playersController.draftPlayer(
      {
        params: { APIplayerId: "api-1" },
        body: {
          leagueId: "league-1",
          bidStartedById: "roster-1",
          draftedToRosterId: "roster-1",
          slotKey: "bench",
          draftCost: 10,
          contractStatus: "S1",
        },
      },
      invalidSlotRes
    );
    expect(invalidSlotRes.statusCode).toBe(400);

    const invalidCostRes = createResponse();
    await playersController.draftPlayer(
      {
        params: { APIplayerId: "api-1" },
        body: {
          leagueId: "league-1",
          bidStartedById: "roster-1",
          draftedToRosterId: "roster-1",
          slotKey: "pitcher1",
          draftCost: "NaN",
          contractStatus: "S1",
        },
      },
      invalidCostRes
    );
    expect(invalidCostRes.statusCode).toBe(400);

    const negativeCostRes = createResponse();
    await playersController.draftPlayer(
      {
        params: { APIplayerId: "api-1" },
        body: {
          leagueId: "league-1",
          bidStartedById: "roster-1",
          draftedToRosterId: "roster-1",
          slotKey: "pitcher1",
          draftCost: -1,
          contractStatus: "S1",
        },
      },
      negativeCostRes
    );
    expect(negativeCostRes.statusCode).toBe(400);
  });

  it("draftPlayer rejects missing contractStatus", async () => {
    const missingRes = createResponse();
    await playersController.draftPlayer(
      {
        params: { APIplayerId: "api-1" },
        body: {
          leagueId: "league-1",
          bidStartedById: "roster-1",
          draftedToRosterId: "roster-1",
          slotKey: "pitcher1",
          draftCost: 1,
        },
      },
      missingRes
    );
    expect(missingRes.statusCode).toBe(400);
    expect(missingRes.jsonPayload.errorMessage).toContain("contractStatus is required");
  });

  it("draftPlayer requires explicit inactive override for inactive players", async () => {
    process.env.API_TOKEN = "token";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        item: {
          _id: "api-1",
          name: "Injured Player",
          status: "Out",
          positions: "SP",
          team: "SEA",
          currentStats: {},
          projectedStats: {},
          threeYearAverageStats: {},
        },
      }),
    });

    const req = {
      userId: "user-1",
      params: { APIplayerId: "api-1" },
      body: {
        leagueId: "league-1",
        bidStartedById: "roster-1",
        draftedToRosterId: "roster-1",
        slotKey: "pitcher1",
        draftCost: 10,
        contractStatus: "S1",
      },
    };
    const res = createResponse();

    await playersController.draftPlayer(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload.errorMessage).toContain("Player is not currently active");
  });

  it("draftPlayer applies the draft mutation and falls back when transactions are unsupported", async () => {
    process.env.API_TOKEN = "token";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        item: {
          _id: API_PLAYER_ID_TWO,
          name: "Healthy Player",
          status: "Active",
          positions: "SP",
          team: "SEA",
          currentStats: {},
          projectedStats: {},
          threeYearAverageStats: {},
        },
      }),
    });

    const session = {
      withTransaction: async () => {
        throw new Error("Transaction numbers are only allowed on a replica set member or mongos");
      },
      endSession: async () => {},
    };
    vi.spyOn(mongoose, "startSession").mockResolvedValue(session);
    vi.spyOn(League, "findById").mockResolvedValue({ _id: LEAGUE_ID, user: USER_ID, rosterIds: [ROSTER_ID] });
    vi.spyOn(MLBRoster, "findById").mockResolvedValue({ _id: ROSTER_ID, budgetLeft: 100, pitcher1: null });
    vi.spyOn(Player, "findOne").mockResolvedValue(null);
    vi.spyOn(Player, "findOneAndUpdate").mockResolvedValue({ _id: PLAYER_DOC_ID });
    vi.spyOn(Player, "updateOne")
      .mockResolvedValueOnce({ modifiedCount: 1 })
      .mockResolvedValueOnce({ modifiedCount: 1 });
    vi.spyOn(Player, "findById").mockResolvedValue({ _id: PLAYER_DOC_ID, ownerId: ROSTER_ID });
    vi.spyOn(MLBRoster, "updateOne").mockResolvedValue({ modifiedCount: 1 });
    vi.spyOn(db, "createTransaction").mockResolvedValue({});

    const req = {
      userId: USER_ID,
      params: { APIplayerId: API_PLAYER_ID_TWO },
      body: {
        leagueId: LEAGUE_ID,
        bidStartedById: ROSTER_ID,
        draftedToRosterId: ROSTER_ID,
        slotKey: "pitcher1",
        draftCost: 10,
        inactiveOverrideAccepted: true,
        contractStatus: "F1",
      },
    };
    const res = createResponse();

    await playersController.draftPlayer(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload.playerDoc._id).toBe(PLAYER_DOC_ID);
    expect(res.jsonPayload.roster._id).toBe(ROSTER_ID);
  });

  it("draftPlayer rejects access to leagues owned by another user", async () => {
    process.env.API_TOKEN = "token";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        item: {
          _id: "api-2",
          name: "Healthy Player",
          status: "Active",
          positions: "SP",
          team: "SEA",
          currentStats: {},
          projectedStats: {},
          threeYearAverageStats: {},
        },
      }),
    });

    const session = createSession();
    vi.spyOn(mongoose, "startSession").mockResolvedValue(session);
    vi.spyOn(League, "findById").mockImplementation(() =>
      createQuery({ _id: "league-1", user: "other-user", rosterIds: ["roster-1"] })
    );

    const req = {
      userId: "user-1",
      params: { APIplayerId: "api-2" },
      body: {
        leagueId: "league-1",
        bidStartedById: "roster-1",
        draftedToRosterId: "roster-1",
        slotKey: "pitcher1",
        draftCost: 10,
        inactiveOverrideAccepted: true,
        contractStatus: "X",
      },
    };
    const res = createResponse();

    await playersController.draftPlayer(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.jsonPayload.errorMessage).toBe("You do not have access to this league.");
  });

  it("dropPlayer validates required fields", async () => {
    const res = createResponse();

    await playersController.dropPlayer({ params: { APIplayerId: "api-1" }, body: {} }, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload.errorMessage).toBe("leagueId and rosterId are required.");
  });

  it("dropPlayer clears roster ownership and refunds budget", async () => {
    const session = {
      withTransaction: async () => {
        throw new Error("Transaction numbers are only allowed on a replica set member or mongos");
      },
      endSession: async () => {},
    };
    vi.spyOn(mongoose, "startSession").mockResolvedValue(session);
    vi.spyOn(League, "findById").mockResolvedValue({ _id: LEAGUE_ID, user: USER_ID, rosterIds: [ROSTER_ID] });
    vi.spyOn(MLBRoster, "findById").mockResolvedValue({ _id: ROSTER_ID, budgetLeft: 80, pitcher1: PLAYER_DOC_ID });
    vi.spyOn(Player, "findOne").mockResolvedValue({ _id: PLAYER_DOC_ID, ownerId: ROSTER_ID, price: 12 });
    vi.spyOn(MLBRoster, "updateOne").mockResolvedValue({ modifiedCount: 1 });
    vi.spyOn(Player, "updateOne").mockResolvedValue({ modifiedCount: 1 });
    vi.spyOn(Player, "findById").mockResolvedValue({ _id: PLAYER_DOC_ID, ownerId: null, price: 0 });
    vi.spyOn(db, "createTransaction").mockResolvedValue({});

    const req = {
      userId: USER_ID,
      params: { APIplayerId: API_PLAYER_ID },
      body: {
        leagueId: LEAGUE_ID,
        rosterId: ROSTER_ID,
      },
    };
    const res = createResponse();

    await playersController.dropPlayer(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload.playerDoc.ownerId).toBeNull();
    expect(res.jsonPayload.roster._id).toBe(ROSTER_ID);
  });

  it("dropPlayer rejects rosters that are not part of the league", async () => {
    const session = createSession();
    vi.spyOn(mongoose, "startSession").mockResolvedValue(session);
    vi.spyOn(League, "findById").mockImplementation(() =>
      createQuery({ _id: "league-1", user: "user-1", rosterIds: ["roster-2"] })
    );

    const req = {
      userId: "user-1",
      params: { APIplayerId: "api-1" },
      body: {
        leagueId: "league-1",
        rosterId: "roster-1",
      },
    };
    const res = createResponse();

    await playersController.dropPlayer(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload.errorMessage).toBe("Selected roster does not belong to this league.");
  });

  it("dropPlayer returns 404 when the player document does not exist", async () => {
    const session = createSession();
    vi.spyOn(mongoose, "startSession").mockResolvedValue(session);
    vi.spyOn(League, "findById").mockImplementation(() =>
      createQuery({ _id: "league-1", user: "user-1", rosterIds: ["roster-1"] })
    );
    vi.spyOn(MLBRoster, "findById").mockImplementation(() =>
      createQuery({ _id: "roster-1", budgetLeft: 80, pitcher1: null })
    );
    vi.spyOn(Player, "findOne").mockImplementation(() => createQuery(null));

    const req = {
      userId: "user-1",
      params: { APIplayerId: "api-1" },
      body: {
        leagueId: "league-1",
        rosterId: "roster-1",
      },
    };
    const res = createResponse();

    await playersController.dropPlayer(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.jsonPayload.errorMessage).toBe("Player document not found for this league.");
  });
});
