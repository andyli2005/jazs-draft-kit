const express = require("express");
const router = express.Router();
const auth = require("../auth");
const LiveUpdateController = require("../controllers/live-update-controller");

router.post("/player", LiveUpdateController.receivePlayerLiveUpdate);
router.get("/notices", auth.verify, LiveUpdateController.listNotices);
router.get("/events", auth.verify, LiveUpdateController.streamNotices);

module.exports = router;
