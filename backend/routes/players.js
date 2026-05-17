const express = require("express");
const router = express.Router();
const PlayersController = require("../controllers/players-controller");
const auth = require("../auth");

router.get("/totalFantasyPoints", auth.verify, PlayersController.getTotalFantasyPoints);
router.get("/depth-charts", auth.verify, PlayersController.getDepthCharts);
router.get("/custom", auth.verify, PlayersController.getCustomPlayers);
router.post("/custom", auth.verify, PlayersController.createCustomPlayer);
router.patch("/custom/:playerId", auth.verify, PlayersController.updateCustomPlayer);
router.delete("/custom/:playerId", auth.verify, PlayersController.deleteCustomPlayer);
router.post("/custom/:playerId/draft", auth.verify, PlayersController.draftCustomPlayer);
router.post("/custom/:playerId/drop", auth.verify, PlayersController.dropCustomPlayer);
router.post("/custom/:playerId/move", auth.verify, PlayersController.moveCustomPlayer);
router.get("/:APIplayerId/doc", auth.verify, PlayersController.getPlayerDoc);
router.put("/:APIplayerId/doc", auth.verify, PlayersController.upsertPlayerDoc);
router.post("/:APIplayerId/draft", auth.verify, PlayersController.draftPlayer);
router.post("/:APIplayerId/drop", auth.verify, PlayersController.dropPlayer);
router.post("/:APIplayerId/move", auth.verify, PlayersController.movePlayer);
router.post("/:APIplayerId/taxi", auth.verify, PlayersController.draftTaxiPlayer);
router.get("/", auth.verify, PlayersController.getPlayers);

module.exports = router;
