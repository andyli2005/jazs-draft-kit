const express = require("express");
const router = express.Router();
const TransactionsController = require("../controllers/transactions-controller");
const auth = require("../auth");

router.get("/", auth.verify, TransactionsController.getTransactions);
router.post("/", auth.verify, TransactionsController.createTransaction);

module.exports = router;
