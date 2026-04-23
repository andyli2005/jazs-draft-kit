"use strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const auth = require("../auth");
const { createResponse } = require("./test-helpers");

describe("auth", () => {
  it("signToken and verifyUser round-trip the user id from cookies", () => {
    const token = auth.signToken("user-123");
    const req = { cookies: { token } };

    expect(auth.verifyUser(req)).toBe("user-123");
  });

  it("verifyUser returns null when no token cookie is present", () => {
    expect(auth.verifyUser({ cookies: {} })).toBeNull();
    expect(auth.verifyUser({})).toBeNull();
  });

  it("verify middleware attaches userId and calls next for a valid token", () => {
    const token = auth.signToken("league-owner");
    const req = { cookies: { token } };
    const res = createResponse();
    let nextCalled = false;

    auth.verify(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(req.userId).toBe("league-owner");
  });

  it("verify middleware rejects missing tokens with 401", () => {
    const req = { cookies: {} };
    const res = createResponse();
    let nextCalled = false;

    auth.verify(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.jsonPayload).toEqual({
      loggedIn: false,
      user: null,
      errorMessage: "Unauthorized",
    });
  });

  it("verify middleware rejects invalid tokens with 401", () => {
    const req = { cookies: { token: "bad-token" } };
    const res = createResponse();
    let nextCalled = false;

    auth.verify(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.jsonPayload.errorMessage).toBe("Unauthorized");
  });
});
