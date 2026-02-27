const jwt = require("jsonwebtoken");

function getCookieToken(req) {
  return req.cookies ? req.cookies.token : null;
}

const auth = {
  verify(req, res, next) {
    try {
      const token = getCookieToken(req);
      if (!token) {
        return res.status(401).json({
          loggedIn: false,
          user: null,
          errorMessage: "Unauthorized",
        });
      }

      const verified = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = verified.userId;
      next();
    } catch (err) {
      return res.status(401).json({
        loggedIn: false,
        user: null,
        errorMessage: "Unauthorized",
      });
    }
  },

  verifyUser(req) {
    try {
      const token = getCookieToken(req);
      if (!token) return null;

      const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      return decodedToken.userId;
    } catch (err) {
      return null;
    }
  },

  signToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET);
  },
};

module.exports = auth;
