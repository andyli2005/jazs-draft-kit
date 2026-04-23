"use strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const bcrypt = require("bcryptjs");
const auth = require("../auth");
const db = require("../db");
const authController = require("../controllers/auth-controller");
const { createResponse } = require("./test-helpers");

describe("auth-controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getLoggedIn returns logged out when no verified user exists", async () => {
    vi.spyOn(auth, "verifyUser").mockReturnValue(null);
    const res = createResponse();

    await authController.getLoggedIn({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload).toEqual({
      loggedIn: false,
      user: null,
      errorMessage: "No user logged in",
    });
  });

  it("getLoggedIn returns the current user when the session is valid", async () => {
    vi.spyOn(auth, "verifyUser").mockReturnValue("user-1");
    vi.spyOn(db, "getUserById").mockResolvedValue({
      _id: "user-1",
      userName: "Alice",
      email: "alice@example.com",
      profilePicture: "",
    });
    const res = createResponse();

    await authController.getLoggedIn({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload).toEqual({
      loggedIn: true,
      user: {
        id: "user-1",
        userName: "Alice",
        email: "alice@example.com",
        profilePicture: "",
      },
    });
  });

  it("registerUser rejects missing required fields", async () => {
    const req = { body: { userName: "", email: "", password: "", passwordVerify: "" } };
    const res = createResponse();

    await authController.registerUser(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      errorMessage: "Please enter all required fields.",
    });
  });

  it("registerUser rejects short passwords", async () => {
    const req = {
      body: {
        userName: "Alice",
        email: "alice@example.com",
        password: "short",
        passwordVerify: "short",
      },
    };
    const res = createResponse();

    await authController.registerUser(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload.errorMessage).toContain("at least 8 characters");
  });

  it("registerUser rejects mismatched passwords", async () => {
    const req = {
      body: {
        userName: "Alice",
        email: "alice@example.com",
        password: "password123",
        passwordVerify: "password124",
      },
    };
    const res = createResponse();

    await authController.registerUser(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload.errorMessage).toContain("same password twice");
  });

  it("registerUser rejects duplicate emails", async () => {
    vi.spyOn(db, "getUserByEmail").mockResolvedValue({ _id: "existing-user" });
    const req = {
      body: {
        userName: "Alice",
        email: "alice@example.com",
        password: "password123",
        passwordVerify: "password123",
      },
    };
    const res = createResponse();

    await authController.registerUser(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      success: false,
      errorMessage: "An account with this email address already exists.",
    });
  });

  it("registerUser normalizes email and sets an auth cookie on success", async () => {
    vi.spyOn(db, "getUserByEmail").mockResolvedValue(null);
    vi.spyOn(db, "createUser").mockImplementation(async (payload) => ({
      _id: "user-1",
      userName: payload.userName,
      email: payload.email,
      profilePicture: payload.profilePicture,
    }));
    vi.spyOn(bcrypt, "genSalt").mockResolvedValue("salt");
    vi.spyOn(bcrypt, "hash").mockImplementation(async (password, salt) => `${password}:${salt}`);
    vi.spyOn(auth, "signToken").mockReturnValue("signed-token");

    const req = {
      body: {
        userName: "  Alice  ",
        email: "  Alice@Example.COM ",
        password: "password123",
        passwordVerify: "password123",
      },
    };
    const res = createResponse();

    await authController.registerUser(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.cookies).toHaveLength(1);
    expect(res.cookies[0].name).toBe("token");
    expect(res.cookies[0].value).toBe("signed-token");
    expect(res.jsonPayload).toEqual({
      success: true,
      user: {
        id: "user-1",
        userName: "Alice",
        email: "alice@example.com",
        profilePicture: "",
      },
    });
  });

  it("loginUser rejects invalid credentials", async () => {
    vi.spyOn(db, "getUserByEmail").mockResolvedValue({
      _id: "user-2",
      userName: "Bob",
      email: "bob@example.com",
      passwordHash: "stored-hash",
    });
    vi.spyOn(bcrypt, "compare").mockResolvedValue(false);

    const req = {
      body: {
        email: "bob@example.com",
        password: "wrong-password",
      },
    };
    const res = createResponse();

    await authController.loginUser(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.jsonPayload).toEqual({
      errorMessage: "Wrong email or password provided.",
    });
  });

  it("loginUser rejects requests with missing required fields", async () => {
    const res = createResponse();

    await authController.loginUser({ body: { email: "", password: "" } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload.errorMessage).toBe("Please enter all required fields.");
  });

  it("loginUser sets the token cookie on success", async () => {
    vi.spyOn(db, "getUserByEmail").mockResolvedValue({
      _id: "user-3",
      userName: "Carol",
      email: "carol@example.com",
      profilePicture: "",
      passwordHash: "stored-hash",
    });
    vi.spyOn(bcrypt, "compare").mockResolvedValue(true);
    vi.spyOn(auth, "signToken").mockReturnValue("login-token");

    const req = {
      body: {
        email: "carol@example.com",
        password: "password123",
      },
    };
    const res = createResponse();

    await authController.loginUser(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.cookies[0].value).toBe("login-token");
    expect(res.jsonPayload).toEqual({
      success: true,
      user: {
        id: "user-3",
        userName: "Carol",
        email: "carol@example.com",
        profilePicture: "",
      },
    });
  });

  it("updateUser rejects unauthorized requests", async () => {
    vi.spyOn(auth, "verifyUser").mockReturnValue(null);
    const res = createResponse();

    await authController.updateUser({ body: { userName: "Alice" } }, res);

    expect(res.statusCode).toBe(401);
    expect(res.jsonPayload).toEqual({ errorMessage: "UNAUTHORIZED" });
  });

  it("updateUser validates missing userName and password fields", async () => {
    vi.spyOn(auth, "verifyUser").mockReturnValue("user-1");

    const missingNameRes = createResponse();
    await authController.updateUser({ body: {}, cookies: {} }, missingNameRes);
    expect(missingNameRes.statusCode).toBe(400);

    const missingVerifyRes = createResponse();
    await authController.updateUser(
      { body: { userName: "Alice", password: "password123" }, cookies: {} },
      missingVerifyRes
    );
    expect(missingVerifyRes.statusCode).toBe(400);
  });

  it("updateUser validates password length and confirmation", async () => {
    vi.spyOn(auth, "verifyUser").mockReturnValue("user-1");

    const shortRes = createResponse();
    await authController.updateUser(
      { body: { userName: "Alice", password: "short", passwordVerify: "short" }, cookies: {} },
      shortRes
    );
    expect(shortRes.statusCode).toBe(400);

    const mismatchRes = createResponse();
    await authController.updateUser(
      {
        body: { userName: "Alice", password: "password123", passwordVerify: "password124" },
        cookies: {},
      },
      mismatchRes
    );
    expect(mismatchRes.statusCode).toBe(400);
  });

  it("updateUser returns 404 when the user no longer exists", async () => {
    vi.spyOn(auth, "verifyUser").mockReturnValue("user-1");
    vi.spyOn(db, "updateUserById").mockResolvedValue(null);
    const res = createResponse();

    await authController.updateUser({ body: { userName: "Alice" }, cookies: {} }, res);

    expect(res.statusCode).toBe(404);
    expect(res.jsonPayload).toEqual({ errorMessage: "User not found." });
  });

  it("updateUser updates profile data and refreshes the auth cookie", async () => {
    vi.spyOn(auth, "verifyUser").mockReturnValue("user-1");
    vi.spyOn(bcrypt, "genSalt").mockResolvedValue("salt");
    vi.spyOn(bcrypt, "hash").mockResolvedValue("hashed");
    vi.spyOn(db, "updateUserById").mockResolvedValue({
      _id: "user-1",
      userName: "Alice",
      email: "alice@example.com",
      profilePicture: "avatar.png",
    });
    vi.spyOn(auth, "signToken").mockReturnValue("refresh-token");
    const res = createResponse();

    await authController.updateUser(
      {
        body: {
          userName: "  Alice  ",
          password: "password123",
          passwordVerify: "password123",
          profilePicture: "avatar.png",
        },
        cookies: {},
      },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.cookies[0].value).toBe("refresh-token");
    expect(res.jsonPayload.user.profilePicture).toBe("avatar.png");
  });

  it("deleteUser rejects unauthorized requests", async () => {
    vi.spyOn(auth, "verifyUser").mockReturnValue(null);
    const res = createResponse();

    await authController.deleteUser({}, res);

    expect(res.statusCode).toBe(401);
    expect(res.jsonPayload).toEqual({ errorMessage: "UNAUTHORIZED" });
  });

  it("deleteUser returns 404 when the user cannot be deleted", async () => {
    vi.spyOn(auth, "verifyUser").mockReturnValue("user-1");
    vi.spyOn(db, "deleteUserById").mockResolvedValue(null);
    const res = createResponse();

    await authController.deleteUser({}, res);

    expect(res.statusCode).toBe(404);
    expect(res.jsonPayload).toEqual({ errorMessage: "User not found." });
  });

  it("deleteUser clears the cookie after a successful delete", async () => {
    vi.spyOn(auth, "verifyUser").mockReturnValue("user-1");
    vi.spyOn(db, "deleteUserById").mockResolvedValue({ _id: "user-1" });
    const res = createResponse();

    await authController.deleteUser({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.clearedCookies[0].name).toBe("token");
    expect(res.jsonPayload).toEqual({
      success: true,
      message: "Account deleted",
    });
  });

  it("logoutUser clears the token cookie with cross-site safe options", async () => {
    const res = createResponse();

    await authController.logoutUser({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.clearedCookies).toEqual([
      {
        name: "token",
        options: {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        },
      },
    ]);
  });
});
