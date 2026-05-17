const express = require("express");
const router = express.Router();
const LeagueController = require("../controllers/league-controller");
const auth = require("../auth");

router.get("/", auth.verify, LeagueController.getMyLeagues);
router.post("/", auth.verify, LeagueController.createLeague);
router.post("/:id/import-from/:sourceId", auth.verify, LeagueController.importFromLeague);
router.patch("/:id", auth.verify, LeagueController.editLeague);
router.patch("/:id/my-team", auth.verify, LeagueController.setMyTeam);

module.exports = router;
