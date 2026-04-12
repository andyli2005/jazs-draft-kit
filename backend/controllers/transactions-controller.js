const db = require("../db");

const getTransactions = async (req, res) => {
  try {
    const leagueId = req.query.leagueId;

    if (!leagueId) {
      return res
      .status(400)
      .json({ errorMessage: "Please provide leagueId." });
    }

    const transactions = await db.getTransactions(leagueId);

    return res.status(200).json({
        transactions
    });
  } catch (err) {
    return res.status(500).json({
      errorMessage: "Error",
    });
  }
};

const createTransaction = async (req, res) => {
  try {
    const { teamOwner, player, actionType, draftCost, budgetLeft, leagueId } = req.body;

    if (!teamOwner || !player || !actionType || !leagueId) {
      return res
        .status(400)
        .json({ errorMessage: "Please enter all required fields." });
    }

    const transaction = await db.createTransaction({
        teamOwner,
        player,
        actionType,
        draftCost,
        budgetLeft,
        leagueId
    });

    return res.status(201).json({
      success: true,
      transaction
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send();
  }
};

module.exports = {
  getTransactions,
  createTransaction,
};
