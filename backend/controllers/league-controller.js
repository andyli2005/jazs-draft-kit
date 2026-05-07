const db = require("../db");
const League = require("../db/models/League");
const MLBRoster = require("../db/models/MLBRoster");
const Player = require("../db/models/Player");

const DEFAULT_TEAM_PREFIX = "Team";

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

const editLeague = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      budgetCap,
      teamRenames = {},
      teamsToDelete = [],
      teamsToAdd = 0,
    } = req.body || {};

    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedBudgetCap = Number(budgetCap);
    const normalizedTeamsToAdd = Number(teamsToAdd);
    const normalizedTeamsToDelete = Array.isArray(teamsToDelete) ? teamsToDelete : [];
    const renameEntries = Object.entries(teamRenames || {});

    if (!normalizedName || !Number.isFinite(normalizedBudgetCap) || normalizedBudgetCap < 1) {
      return res.status(400).json({
        errorMessage: "Please provide a valid league name and budget cap.",
      });
    }

    if (!Number.isInteger(normalizedTeamsToAdd) || normalizedTeamsToAdd < 0) {
      return res.status(400).json({
        errorMessage: "teamsToAdd must be a non-negative integer.",
      });
    }

    if (!Array.isArray(normalizedTeamsToDelete)) {
      return res.status(400).json({
        errorMessage: "teamsToDelete must be an array.",
      });
    }

    if (typeof teamRenames !== "object" || teamRenames == null || Array.isArray(teamRenames)) {
      return res.status(400).json({
        errorMessage: "teamRenames must be an object.",
      });
    }

    const league = await League.findById(id);
    if (!league || String(league.user) !== String(req.userId)) {
      return res.status(404).json({
        errorMessage: "League not found.",
      });
    }

    const rosterIdsInLeague = new Set((league.rosterIds || []).map((rosterId) => String(rosterId)));
    const deleteSet = new Set(normalizedTeamsToDelete.map((rosterId) => String(rosterId)));

    for (const rosterId of deleteSet) {
      if (!rosterIdsInLeague.has(rosterId)) {
        return res.status(400).json({
          errorMessage: "A team selected for deletion is not part of this league.",
        });
      }
    }

    for (const [rosterId, nextNameRaw] of renameEntries) {
      if (!rosterIdsInLeague.has(String(rosterId))) {
        return res.status(400).json({
          errorMessage: "A team selected for rename is not part of this league.",
        });
      }
      if (deleteSet.has(String(rosterId))) {
        return res.status(400).json({
          errorMessage: "Cannot rename and delete the same team.",
        });
      }

      const nextName = typeof nextNameRaw === "string" ? nextNameRaw.trim() : "";
      if (!nextName) {
        return res.status(400).json({
          errorMessage: "Team names cannot be empty.",
        });
      }
    }

    if (deleteSet.size > 0) {
      // Turn set to array since $in operations require array 
      const deleteArray = Array.from(deleteSet);

      // Before deletion of a roster, retrieve the necessary information to create 
      // drop transactions for each player, using select and lean for optimized reads
      const [rostersToDelete, playersToDrop] = await Promise.all([
        MLBRoster.find({ _id: { $in: deleteArray } }).select("name budgetLeft").lean(),
        Player.find({
          leagueId: league._id,
          ownerId: { $in: deleteArray },
        })
          .select("name price ownerId")
          .lean(),
      ]);

      const rosterIdsToRoster = new Map(
        rostersToDelete.map((roster) => [String(roster._id), roster])
      );

      const rosterIdToPlayers = new Map();
      playersToDrop.forEach((player) => {
        const owner = String(player.ownerId || "");
        if (!owner) return;
        const currPlayers = rosterIdToPlayers.get(owner) || [];
        currPlayers.push(player);
        rosterIdToPlayers.set(owner, currPlayers);
      });

      // Idea: Collect all the data/bodies for every drop transaction then delete later 
      // 1) Go through all the rosterIds that are mapped to at least one player to delete
      // 2) For each id, collect name and budgetLeft of that roster 
      // 3) For each id, collect all the players sorted by name 
      // 4) For each player collected, create the transaction data 
      const dropTransactionsBody = [];
      const rosterIdsToForDropTransactions = Array.from(rosterIdToPlayers.keys()).sort();
      for (const rosterId of rosterIdsToForDropTransactions) {
        const roster = rosterIdsToRoster.get(rosterId);
        const teamName = typeof roster?.name === "string" ? roster.name : "Unknown Team";
        let runningBudgetLeft = Number(roster?.budgetLeft ?? 0);

        const players = rosterIdToPlayers.get(rosterId) || [];
        const sortedPlayers = players
          .slice()
          .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));

        for (const player of sortedPlayers) {
          const refundAmount = Number(player?.price) || 0;
          runningBudgetLeft += refundAmount;
          dropTransactionsBody.push({
            teamOwner: teamName,
            player: player?.name || "Unknown Player",
            actionType: "Dropped",
            draftCost: refundAmount,
            budgetLeft: runningBudgetLeft,
            leagueId: league._id,
            rosterId: roster?._id || null,
          });
        }
      }

      await Player.updateMany(
        {
          leagueId: league._id,
          ownerId: { $in: deleteArray },
        },
        {
          $set: { ownerId: null, bidStartedById: null, price: 0, contractStatus: null },
        }
      );

      await Player.updateMany(
        {
          leagueId: league._id,
          bidStartedById: { $in: deleteArray },
        },
        {
          $set: { bidStartedById: null },
        }
      );

      for (const body of dropTransactionsBody) {
        await db.createTransaction(body);
      }

      const filteredRosterIds = (league.rosterIds || []).filter(
        (rosterId) => !deleteSet.has(String(rosterId))
      );
      league.rosterIds = filteredRosterIds;

      if (league.myTeam && deleteSet.has(String(league.myTeam))) {
        league.myTeam = null;
      }

      await MLBRoster.deleteMany({ _id: { $in: deleteArray } });
    }

    if (normalizedTeamsToAdd > 0) {
      const existingRosters = await MLBRoster.find({ _id: { $in: league.rosterIds } }).select("name");
      const existingNames = new Set(
        existingRosters.map((roster) => (typeof roster.name === "string" ? roster.name.trim() : ""))
      );
      const createdRosters = [];

      let counter = 1;
      while (createdRosters.length < normalizedTeamsToAdd) {
        const nextName = `${DEFAULT_TEAM_PREFIX} ${counter}`;
        if (!existingNames.has(nextName)) {
          const roster = await MLBRoster.create({
            budgetLeft: normalizedBudgetCap,
            name: nextName,
          });
          createdRosters.push(roster);
          existingNames.add(nextName);
        }
        counter += 1;
      }

      league.rosterIds = [...(league.rosterIds || []), ...createdRosters.map((roster) => roster._id)];
    }

    if (renameEntries.length > 0) {
      const renameOps = renameEntries.map(([rosterId, nextNameRaw]) =>
        MLBRoster.updateOne(
          { _id: rosterId },
          { $set: { name: String(nextNameRaw).trim() } }
        )
      );
      await Promise.all(renameOps);
    }

    league.name = normalizedName;
    league.budgetCap = normalizedBudgetCap;
    league.teamCount = Array.isArray(league.rosterIds) ? league.rosterIds.length : 0;
    await league.save();

    const updatedLeague = await db.getLeaguesByUser(req.userId).then((leagues) =>
      leagues.find((userLeague) => String(userLeague._id) === String(league._id))
    );

    return res.status(200).json({
      success: true,
      league: updatedLeague || league,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      errorMessage: "Error editing league.",
    });
  }
};

module.exports = {
  createLeague,
  getMyLeagues,
  setMyTeam,
  editLeague,
};
