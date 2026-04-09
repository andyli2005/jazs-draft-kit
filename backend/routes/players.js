const express = require("express");
const router = express.Router();
const PlayersController = require("../controllers/players-controller");
const auth = require("../auth");

router.get("/totalFantasyPoints", auth.verify, PlayersController.getTotalFantasyPoints);
router.get("/:APIplayerId/doc", auth.verify, PlayersController.getPlayerDoc);
router.put("/:APIplayerId/doc", auth.verify, PlayersController.upsertPlayerDoc);
router.get("/", auth.verify, PlayersController.getPlayers);

module.exports = router;
