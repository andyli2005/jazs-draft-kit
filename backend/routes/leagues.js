const express = require("express");
const router = express.Router();
const LeagueController = require("../controllers/league-controller");
const auth = require("../auth");

router.get("/", auth.verify, LeagueController.getMyLeagues);
router.post("/", auth.verify, LeagueController.createLeague);

module.exports = router;
