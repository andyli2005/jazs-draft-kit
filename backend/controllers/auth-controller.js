const auth = require("../auth");
const bcrypt = require("bcryptjs");
const db = require("../db");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "none", // backend and frontend are on different domains, so we need to set SameSite to "none" and secure to true
  };
}

const getLoggedIn = async (req, res) => {
  try {
    const userId = auth.verifyUser(req);
    if (!userId) {
      return res.status(200).json({
        loggedIn: false,
        user: null,
        errorMessage: "No user logged in",
      });
    }

    const loggedInUser = await db.getUserById(userId);
    if (!loggedInUser) {
      return res.status(200).json({
        loggedIn: false,
        user: null,
        errorMessage: "No user logged in",
      });
    }

    return res.status(200).json({
      loggedIn: true,
      user: {
        id: loggedInUser._id,
        userName: loggedInUser.userName,
        email: loggedInUser.email,
      },
    });
  } catch (err) {
    return res.status(400).json({
      loggedIn: false,
      user: null,
      errorMessage: "No user logged in",
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ errorMessage: "Please enter all required fields." });
    }

    const normalizedEmail = normalizeEmail(email);
    const existingUser = await db.getUserByEmail(normalizedEmail);
    if (!existingUser) {
      return res.status(401).json({
        errorMessage: "Wrong email or password provided.",
      });
    }

    const passwordCorrect = await bcrypt.compare(password, existingUser.passwordHash);
    if (!passwordCorrect) {
      return res.status(401).json({
        errorMessage: "Wrong email or password provided.",
      });
    }

    const token = auth.signToken(existingUser._id);
    res.cookie("token", token, getCookieOptions());
    return res.status(200).json({
      success: true,
      user: {
        id: existingUser._id,
        userName: existingUser.userName,
        email: existingUser.email,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send();
  }
};

const logoutUser = async (req, res) => {
  const options = getCookieOptions();
  res.clearCookie("token", {
    httpOnly: true,
    secure: options.secure,
    sameSite: options.sameSite,
  });
  return res.status(200).json({
    success: true,
    message: "Logged out",
  });
};

const registerUser = async (req, res) => {
  try {
    const { userName, email, password, passwordVerify } = req.body;

    if (!userName || !email || !password || !passwordVerify) {
      return res
        .status(400)
        .json({ errorMessage: "Please enter all required fields." });
    }

    if (password.length < 8) {
      return res.status(400).json({
        errorMessage: "Please enter a password of at least 8 characters.",
      });
    }

    if (password !== passwordVerify) {
      return res.status(400).json({
        errorMessage: "Please enter the same password twice.",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const existingUser = await db.getUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        errorMessage: "An account with this email address already exists.",
      });
    }

    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const passwordHash = await bcrypt.hash(password, salt);

    const savedUser = await db.createUser({
      userName: userName.trim(),
      email: normalizedEmail,
      passwordHash,
    });

    const token = auth.signToken(savedUser._id);

    res.cookie("token", token, getCookieOptions());
    return res.status(200).json({
      success: true,
      user: {
        id: savedUser._id,
        userName: savedUser.userName,
        email: savedUser.email,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send();
  }
};

const updateUser = async (req, res) => {
  try {
    const userId = auth.verifyUser(req);
    if (!userId) {
      return res.status(401).json({ errorMessage: "UNAUTHORIZED" });
    }

    const { userName, password, passwordVerify } = req.body;
    if (!userName) {
      return res
        .status(400)
        .json({ errorMessage: "Please enter all required fields." });
    }

    const updates = {
      userName: userName.trim(),
    };

    if (password || passwordVerify) {
      if (!password || !passwordVerify) {
        return res
          .status(400)
          .json({ errorMessage: "Please enter all required fields." });
      }

      if (password.length < 8) {
        return res.status(400).json({
          errorMessage: "Please enter a password of at least 8 characters.",
        });
      }

      if (password !== passwordVerify) {
        return res.status(400).json({
          errorMessage: "Please enter the same password twice.",
        });
      }

      const saltRounds = 10;
      const salt = await bcrypt.genSalt(saltRounds);
      const passwordHash = await bcrypt.hash(password, salt);
      updates.passwordHash = passwordHash;
    }

    const updatedUser = await db.updateUserById(userId, updates);
    if (!updatedUser) {
      return res.status(404).json({ errorMessage: "User not found." });
    }

    const token = auth.signToken(userId);
    res.cookie("token", token, getCookieOptions());
    return res.status(200).json({
      success: true,
      user: {
        id: updatedUser._id,
        userName: updatedUser.userName,
        email: updatedUser.email,
      },
    });
  } catch (err) {
    console.error("Error in updateUser:", err);
    return res.status(500).send();
  }
};

module.exports = {
  getLoggedIn,
  registerUser,
  loginUser,
  logoutUser,
  updateUser,
};
