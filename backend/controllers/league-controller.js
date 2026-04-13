const db = require("../db");

const createLeague = async (req, res) => {
  try {
    const { sport, name, draftType, teamCount, budgetCap } = req.body;

    if (!sport || !name || !draftType || teamCount == null || budgetCap == null) {
      return res
        .status(400)
        .json({ errorMessage: "Please enter all required fields." });
    }

    const rosterPromises = Array.from({ length: teamCount }, (_, i) =>
      db.createMLBRoster({
        budgetLeft: budgetCap,
        name: `Team ${i + 1}`,
      })
    );
    const rosters = await Promise.all(rosterPromises);
    const rosterIds = rosters.map((r) => r._id);

    const league = await db.createLeague({
      user: req.userId,
      sport,
      name: name.trim(),
      draftType,
      teamCount,
      budgetCap,
      rosterIds,
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

const setMyTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { myTeamId } = req.body;

    if (!myTeamId) {
      return res.status(400).json({
        errorMessage: "Please provide a team to designate as My Team.",
      });
    }

    const league = await db.getLeagueById(id);
    if (!league || String(league.user) !== String(req.userId)) {
      return res.status(404).json({
        errorMessage: "League not found.",
      });
    }

    const isLeagueRoster = Array.isArray(league.rosterIds)
      ? league.rosterIds.some((rosterId) => String(rosterId) === String(myTeamId))
      : false;

    if (!isLeagueRoster) {
      return res.status(400).json({
        errorMessage: "Selected team is not part of this league.",
      });
    }

    const updatedLeague = await db.updateLeagueById(id, { myTeam: myTeamId });

    return res.status(200).json({
      success: true,
      league: updatedLeague,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      errorMessage: "Error setting My Team.",
    });
  }
};

module.exports = {
  createLeague,
  getMyLeagues,
  setMyTeam,
};
