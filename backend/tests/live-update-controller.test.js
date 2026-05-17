"use strict";

const Player = require("../db/models/Player");
const LiveUpdateController = require("../controllers/live-update-controller");
const liveUpdateHub = require("../services/live-update-hub");
const { createResponse } = require("./test-helpers");

const {
  buildPlayerDocUpdateFields,
  normalizePlayerLiveUpdate,
} = LiveUpdateController.__testables;

function createRequest(body, headerValue = "") {
  return {
    body,
    header: vi.fn(() => headerValue),
  };
}

describe("live-update-controller", () => {
  const originalSecret = process.env.LIVE_UPDATE_WEBHOOK_SECRET;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalSecret == null) {
      delete process.env.LIVE_UPDATE_WEBHOOK_SECRET;
    } else {
      process.env.LIVE_UPDATE_WEBHOOK_SECRET = originalSecret;
    }
  });

  it("normalizes depth chart player updates", () => {
    const notice = normalizePlayerLiveUpdate({
      type: "depthChart",
      message: "Player One moved up the chart.",
      player: {
        APIplayerId: "api-player-1",
        name: "Player One",
      },
      updates: {
        depthChart: {
          position: "OF",
          rank: "1",
          role: "Starter",
          section: "Starting Lineup",
        },
      },
    });

    expect(notice).toMatchObject({
      type: "depthChart",
      message: "Player One moved up the chart.",
      player: {
        APIplayerId: "api-player-1",
        depthChart: {
          position: "OF",
          rank: 1,
          role: "Starter",
          section: "Starting Lineup",
        },
      },
    });
  });

  it("uses latest news as the notification message when message is absent", () => {
    const notice = normalizePlayerLiveUpdate({
      type: "news",
      player: {
        APIplayerId: "api-player-1",
        name: "Player One",
      },
      updates: {
        latestNews: "Player One will bat leadoff tonight.",
      },
    });

    expect(notice).toMatchObject({
      type: "news",
      message: "Player One will bat leadoff tonight.",
      player: {
        latestNews: "Player One will bat leadoff tonight.",
      },
    });
  });

  it("builds local update fields for depth chart and news", () => {
    expect(
      buildPlayerDocUpdateFields({
        type: "depthChart",
        player: {
          depthChart: { rank: 2, role: "Reserve" },
        },
      })
    ).toMatchObject({
      depthChart: {
        rank: 2,
        role: "Reserve",
      },
    });

    expect(
      buildPlayerDocUpdateFields({
        type: "news",
        message: "Moved to leadoff.",
        player: { latestNews: "Moved to leadoff." },
      })
    ).toMatchObject({ latestNews: "Moved to leadoff." });
  });

  it("rejects webhook requests with the wrong shared secret", async () => {
    process.env.LIVE_UPDATE_WEBHOOK_SECRET = "expected";
    const req = createRequest({ type: "news", player: { APIplayerId: "api-player-1" } }, "wrong");
    const res = createResponse();

    await LiveUpdateController.receivePlayerLiveUpdate(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.jsonPayload.errorMessage).toBe("Unauthorized live update webhook.");
  });

  it("updates player docs and broadcasts the notice", async () => {
    vi.spyOn(Player, "updateMany").mockResolvedValue({ matchedCount: 2, modifiedCount: 2 });
    vi.spyOn(liveUpdateHub, "addNotice").mockImplementation((notice) => ({
      id: "notice-1",
      receivedAt: "2026-05-08T12:00:00.000Z",
      ...notice,
    }));

    const req = createRequest({
      type: "news",
      message: "Player One will bat leadoff tonight.",
      player: {
        APIplayerId: "api-player-1",
        name: "Player One",
      },
      updates: {
        latestNews: "Player One will bat leadoff tonight.",
      },
    });
    const res = createResponse();

    await LiveUpdateController.receivePlayerLiveUpdate(req, res);

    expect(Player.updateMany).toHaveBeenCalledWith(
      { APIplayerId: "api-player-1", isCustom: false },
      {
        $set: {
          name: "Player One",
          latestNews: "Player One will bat leadoff tonight.",
        },
      }
    );
    expect(liveUpdateHub.addNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "news",
        affectedPlayerDocs: 2,
      })
    );
    expect(res.statusCode).toBe(202);
    expect(res.jsonPayload).toMatchObject({
      success: true,
      matchedPlayerDocs: 2,
      affectedPlayerDocs: 2,
      notice: {
        id: "notice-1",
        player: {
          APIplayerId: "api-player-1",
          latestNews: "Player One will bat leadoff tonight.",
        },
      },
    });
  });

});
