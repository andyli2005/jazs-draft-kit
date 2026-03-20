const db = require("../db");

const getTransactions = async (req, res) => {
  try {
    const transactions = await db.getTransactions();

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
    const { teamOwner, player, actionType, draftCost, budgetLeft } = req.body;

    if (!teamOwner || !player || !actionType) {
      return res
        .status(400)
        .json({ errorMessage: "Please enter all required fields." });
    }

    const transaction = await db.createTransaction({
        teamOwner,
        player,
        actionType,
        draftCost,
        budgetLeft
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
