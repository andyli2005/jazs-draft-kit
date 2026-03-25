const express = require("express");
const router = express.Router();
const PlayersController = require("../controllers/players-controller");
const auth = require("../auth");

router.get("/totalFantasyPoints", auth.verify, PlayersController.getTotalFantasyPoints)
router.get("/", auth.verify, PlayersController.getPlayers);

module.exports = router;
