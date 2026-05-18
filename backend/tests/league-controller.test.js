"use strict";

const db = require("../db");
const League = require("../db/models/League");
const MLBRoster = require("../db/models/MLBRoster");
const leagueController = require("../controllers/league-controller");
const { createResponse } = require("./test-helpers");

describe("league-controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createLeague rejects missing required fields", async () => {
    const req = { body: { sport: "", name: "", draftType: "" }, userId: "user-1" };
    const res = createResponse();

    await leagueController.createLeague(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      errorMessage: "Please enter all required fields.",
    });
  });

  it("getMyLeagues returns the current user's leagues", async () => {
    vi.spyOn(db, "getLeaguesByUser").mockResolvedValue([{ _id: "league-1" }]);
    const res = createResponse();

    await leagueController.getMyLeagues({ userId: "user-1" }, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload).toEqual({
      leagues: [{ _id: "league-1" }],
    });
  });

  it("getMyLeagues returns a 500 when the db lookup fails", async () => {
    vi.spyOn(db, "getLeaguesByUser").mockRejectedValue(new Error("db down"));
    const res = createResponse();

    await leagueController.getMyLeagues({ userId: "user-1" }, res);

    expect(res.statusCode).toBe(500);
    expect(res.jsonPayload).toEqual({
      errorMessage: "Error fetching leagues.",
    });
  });

  it("createLeague creates rosters and trims the league name", async () => {
    const createdRosters = [];
    vi.spyOn(db, "createMLBRoster").mockImplementation(async (payload) => {
      createdRosters.push(payload);
      return { _id: `roster-${createdRosters.length}` };
    });
    vi.spyOn(db, "createLeague").mockImplementation(async (payload) => payload);

    const req = {
      userId: "user-1",
      body: {
        sport: "MLB",
        name: "  Weekend League  ",
        draftType: "auction",
        teamCount: 2,
        budgetCap: 260,
      },
    };
    const res = createResponse();

    await leagueController.createLeague(req, res);

    expect(createdRosters).toEqual([
      { budgetLeft: 260, name: "Team 1" },
      { budgetLeft: 260, name: "Team 2" },
    ]);
    expect(res.statusCode).toBe(201);
    expect(res.jsonPayload).toEqual({
      success: true,
      league: {
        user: "user-1",
        sport: "MLB",
        name: "Weekend League",
        draftType: "auction",
        playerLeagueType: "MLB",
        teamCount: 2,
        budgetCap: 260,
        rosterIds: ["roster-1", "roster-2"],
      },
    });
  });

  it("setMyTeam returns 404 when the league does not belong to the user", async () => {
    vi.spyOn(db, "getLeagueById").mockResolvedValue(null);

    const req = {
      params: { id: "league-1" },
      body: { myTeamId: "roster-1" },
      userId: "user-1",
    };
    const res = createResponse();

    await leagueController.setMyTeam(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.jsonPayload).toEqual({
      errorMessage: "League not found.",
    });
  });

  it("setMyTeam rejects requests without myTeamId", async () => {
    const req = { params: { id: "league-1" }, body: {}, userId: "user-1" };
    const res = createResponse();

    await leagueController.setMyTeam(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload.errorMessage).toBe("Please provide a team to designate as My Team.");
  });

  it("setMyTeam rejects rosters that are not in the league", async () => {
    vi.spyOn(db, "getLeagueById").mockResolvedValue({
      _id: "league-1",
      user: "user-1",
      rosterIds: ["roster-1", "roster-2"],
    });

    const req = {
      params: { id: "league-1" },
      body: { myTeamId: "roster-9" },
      userId: "user-1",
    };
    const res = createResponse();

    await leagueController.setMyTeam(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      errorMessage: "Selected team is not part of this league.",
    });
  });

  it("setMyTeam updates the league when the roster belongs to the league", async () => {
    vi.spyOn(db, "getLeagueById").mockResolvedValue({
      _id: "league-1",
      user: "user-1",
      rosterIds: ["roster-1", "roster-2"],
    });
    vi.spyOn(db, "updateLeagueById").mockResolvedValue({
      _id: "league-1",
      myTeam: "roster-2",
    });

    const req = {
      params: { id: "league-1" },
      body: { myTeamId: "roster-2" },
      userId: "user-1",
    };
    const res = createResponse();

    await leagueController.setMyTeam(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload).toEqual({
      success: true,
      league: {
        _id: "league-1",
        myTeam: "roster-2",
      },
    });
  });

  it("editLeague rejects invalid budget cap input", async () => {
    const req = {
      params: { id: "league-1" },
      userId: "user-1",
      body: {
        name: "Updated League",
        budgetCap: 0,
      },
    };
    const res = createResponse();

    await leagueController.editLeague(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      errorMessage: "Please provide a valid league name and budget cap.",
    });
  });

  it("editLeague rejects invalid teamsToAdd and teamRenames payloads", async () => {
    const negativeRes = createResponse();
    await leagueController.editLeague(
      {
        params: { id: "league-1" },
        userId: "user-1",
        body: { name: "League", budgetCap: 260, teamsToAdd: -1 },
      },
      negativeRes
    );
    expect(negativeRes.statusCode).toBe(400);
    expect(negativeRes.jsonPayload.errorMessage).toContain("non-negative integer");

    const teamRenamesRes = createResponse();
    await leagueController.editLeague(
      {
        params: { id: "league-1" },
        userId: "user-1",
        body: { name: "League", budgetCap: 260, teamRenames: [] },
      },
      teamRenamesRes
    );
    expect(teamRenamesRes.statusCode).toBe(400);
    expect(teamRenamesRes.jsonPayload.errorMessage).toContain("teamRenames must be an object");
  });

  it("editLeague rejects unknown teams in delete and rename payloads", async () => {
    vi.spyOn(League, "findById").mockResolvedValue({
      _id: "league-1",
      user: "user-1",
      rosterIds: ["roster-1"],
    });

    const deleteRes = createResponse();
    await leagueController.editLeague(
      {
        params: { id: "league-1" },
        userId: "user-1",
        body: { name: "League", budgetCap: 260, teamsToDelete: ["roster-9"] },
      },
      deleteRes
    );
    expect(deleteRes.statusCode).toBe(400);

    const renameRes = createResponse();
    await leagueController.editLeague(
      {
        params: { id: "league-1" },
        userId: "user-1",
        body: { name: "League", budgetCap: 260, teamRenames: { "roster-9": "X" } },
      },
      renameRes
    );
    expect(renameRes.statusCode).toBe(400);
  });

  it("editLeague rejects renaming and deleting the same team", async () => {
    vi.spyOn(League, "findById").mockResolvedValue({
      _id: "league-1",
      user: "user-1",
      rosterIds: ["roster-1", "roster-2"],
    });

    const req = {
      params: { id: "league-1" },
      userId: "user-1",
      body: {
        name: "Updated League",
        budgetCap: 260,
        teamsToDelete: ["roster-1"],
        teamRenames: { "roster-1": "Renamed Team" },
      },
    };
    const res = createResponse();

    await leagueController.editLeague(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      errorMessage: "Cannot rename and delete the same team.",
    });
  });

  it("editLeague rejects blank rename values", async () => {
    vi.spyOn(League, "findById").mockResolvedValue({
      _id: "league-1",
      user: "user-1",
      rosterIds: ["roster-1"],
    });

    const res = createResponse();
    await leagueController.editLeague(
      {
        params: { id: "league-1" },
        userId: "user-1",
        body: { name: "League", budgetCap: 260, teamRenames: { "roster-1": "   " } },
      },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      errorMessage: "Team names cannot be empty.",
    });
  });

  it("editLeague updates league metadata and roster names on success", async () => {
    const save = vi.fn().mockResolvedValue();
    const league = {
      _id: "league-1",
      user: "user-1",
      rosterIds: ["roster-1", "roster-2"],
      myTeam: "roster-1",
      save,
    };
    vi.spyOn(League, "findById").mockResolvedValue(league);
    vi.spyOn(MLBRoster, "find").mockReturnValue({
      select: vi.fn().mockResolvedValue([
        { name: "Team 1" },
        { name: "Team 2" },
      ]),
    });
    vi.spyOn(MLBRoster, "create").mockResolvedValue({ _id: "roster-3", name: "Team 3" });
    vi.spyOn(MLBRoster, "updateOne").mockResolvedValue({});
    vi.spyOn(MLBRoster, "updateMany").mockResolvedValue({});
    vi.spyOn(db, "getLeaguesByUser").mockResolvedValue([
      { _id: "league-1", name: "Updated League", budgetCap: 300, teamCount: 3 },
    ]);

    const req = {
      params: { id: "league-1" },
      userId: "user-1",
      body: {
        name: " Updated League ",
        budgetCap: 300,
        teamsToAdd: 1,
        teamRenames: { "roster-1": "Renamed Team" },
      },
    };
    const res = createResponse();

    await leagueController.editLeague(req, res);

    expect(res.statusCode).toBe(200);
    expect(league.rosterIds).toEqual(["roster-1", "roster-2", "roster-3"]);
    expect(save).toHaveBeenCalled();
    expect(res.jsonPayload).toEqual({
      success: true,
      league: { _id: "league-1", name: "Updated League", budgetCap: 300, teamCount: 3 },
    });
  });
});
