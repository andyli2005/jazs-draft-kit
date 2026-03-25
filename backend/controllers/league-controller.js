const db = require("../db");

const createLeague = async (req, res) => {
  try {
    const { sport, name, draftType, teamCount, budgetCap } = req.body;

    if (!sport || !name || !draftType || teamCount == null || budgetCap == null) {
      return res
        .status(400)
        .json({ errorMessage: "Please enter all required fields." });
    }

    const league = await db.createLeague({
      user: req.userId,
      sport,
      name: name.trim(),
      draftType,
      teamCount,
      budgetCap,
      rosterIds: [],
    });

    return res.status(201).json({
      success: true,
      league,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send();
  }
};

const getMyLeagues = async (req, res) => {
  try {
    const leagues = await db.getLeaguesByUser(req.userId);

    return res.status(200).json({
      leagues,
    });
  } catch (err) {
    return res.status(500).json({
      errorMessage: "Error fetching leagues.",
    });
  }
};

module.exports = {
  createLeague,
  getMyLeagues,
};
