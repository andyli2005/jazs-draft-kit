const mongoose = require("mongoose");
const User = require("./models/User");
const Transaction = require("./models/Transaction");
const League = require("./models/League");
const MLBRoster = require("./models/MLBRoster");
const Player = require("./models/Player");

class Database {
  constructor() {
    this.rosterPlayerSelect =
      "name status injuryStatus positions team pictureURL price age contractStatus latestNews depthChart height weight APIplayerId currentStats projectedStats threeYearAverageStats isCustom";
    this.leaguePopulate = {
      path: "rosterIds",
      populate: [
        { path: "catcher1", select: this.rosterPlayerSelect },
        { path: "catcher2", select: this.rosterPlayerSelect },
        { path: "firstBase", select: this.rosterPlayerSelect },
        { path: "secondBase", select: this.rosterPlayerSelect },
        { path: "thirdBase", select: this.rosterPlayerSelect },
        { path: "inField", select: this.rosterPlayerSelect },
        { path: "shortStop", select: this.rosterPlayerSelect },
        { path: "utility", select: this.rosterPlayerSelect },
        { path: "middleInField", select: this.rosterPlayerSelect },
        { path: "pitcher1", select: this.rosterPlayerSelect },
        { path: "pitcher2", select: this.rosterPlayerSelect },
        { path: "pitcher3", select: this.rosterPlayerSelect },
        { path: "pitcher4", select: this.rosterPlayerSelect },
        { path: "pitcher5", select: this.rosterPlayerSelect },
        { path: "pitcher6", select: this.rosterPlayerSelect },
        { path: "pitcher7", select: this.rosterPlayerSelect },
        { path: "pitcher8", select: this.rosterPlayerSelect },
        { path: "pitcher9", select: this.rosterPlayerSelect },
        { path: "outfielder1", select: this.rosterPlayerSelect },
        { path: "outfielder2", select: this.rosterPlayerSelect },
        { path: "outfielder3", select: this.rosterPlayerSelect },
        { path: "outfielder4", select: this.rosterPlayerSelect },
        { path: "outfielder5", select: this.rosterPlayerSelect },
      ],
    };
  }

  async connect() {
    const uri = process.env.MONGO_URL;
    if (!uri) throw new Error("MONGO_URL not set");
    await mongoose.connect(uri);
    console.log("MongoDB connected");
  }

  async disconnect() {
    await mongoose.connection.close();
  }

  async deleteDatabase() {
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const collection of collections) {
      await mongoose.connection.db.dropCollection(collection.name);
    }
    console.log("MongoDB cleared");
  }

  async getUserById(id)                       { return User.findById(id); }
  async getUsersByUserName(userName)          { return User.find({ userName }); }
  async getUserByEmail(email)                 { return User.findOne({ email }); }
  async createUser(userData)                  { const newUser = new User({ leagues: [], ...userData }); return newUser.save(); }
  async updateUserById(id, fieldsToUpdate)    { return User.findByIdAndUpdate(id, { $set: fieldsToUpdate }, { returnDocument: 'after' }); }
  async deleteUserById(id) {
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return null;
    }

    const leagues = await League.find({ user: id }).select("_id rosterIds");
    const leagueIds = leagues.map((league) => league._id);
    const rosterIds = leagues.flatMap((league) => league.rosterIds || []);

    await Promise.all([
      leagueIds.length > 0 ? League.deleteMany({ _id: { $in: leagueIds } }) : Promise.resolve(),
      rosterIds.length > 0 ? MLBRoster.deleteMany({ _id: { $in: rosterIds } }) : Promise.resolve(),
      leagueIds.length > 0 ? Transaction.deleteMany({ leagueId: { $in: leagueIds } }) : Promise.resolve(),
      leagueIds.length > 0 ? Player.deleteMany({ leagueId: { $in: leagueIds } }) : Promise.resolve(),
    ]);

    return deletedUser;
  }

  async createTransaction(transactionData, options={})    { const newTransction = new Transaction(transactionData); return newTransction.save(options); }
  async getTransactions(leagueId)             { return Transaction.find({ leagueId }).sort({ createdAt: -1 }).limit(50); }

  async createLeague(leagueData) {
    const newLeague = new League(leagueData);
    const savedLeague = await newLeague.save();
    const updatedUser = await User.findByIdAndUpdate(
      leagueData.user,
      { $addToSet: { leagues: savedLeague._id } },
      { returnDocument: 'after' }
    );

    if (!updatedUser) {
      await League.findByIdAndDelete(savedLeague._id);
      throw new Error("User not found for league creation.");
    }

    return savedLeague;
  }
  async getLeaguesByUser(userId) {
    const user = await User.findById(userId).populate({
      path: "leagues",
      options: { sort: { createdAt: -1 } },
      populate: this.leaguePopulate,
    });

    if (!user) {
      return [];
    }

    if (user.leagues.length > 0) {
      return this.attachTaxiPlayersToLeagues(user.leagues);
    }

    const leagues = await League.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate(this.leaguePopulate);

    if (leagues.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $set: { leagues: leagues.map((league) => league._id) },
      });
    }

    return this.attachTaxiPlayersToLeagues(leagues);
  }

  // Make one query to retrieve all taxi players for every league, instead of constantly querying DB for individual players
  async attachTaxiPlayersToLeagues(leagues) {
    const leagueList = Array.isArray(leagues) ? leagues : [];
    const leagueIds = leagueList.map((league) => league?._id).filter(Boolean);

    // Each League => [Roster 1, Roster 2, etc.], flatMap => [Roster 1, Roster 2, Roster 3, etc]
    const rosterIds = leagueList.flatMap((league) =>
      (league?.rosterIds || []).map((roster) => roster?._id || roster).filter(Boolean)
    );

    if (leagueIds.length === 0 || rosterIds.length === 0) {
      return leagues;
    }

    const taxiPlayers = await Player.find({
      leagueId: { $in: leagueIds },
      taxiRosterId: { $in: rosterIds },
    })
      .select(`${this.rosterPlayerSelect} taxiRosterId taxiDraftedAt isCustom`)
      .lean();

    const taxiPlayersByRosterId = new Map();
    taxiPlayers.forEach((player) => {
      const rosterId = String(player.taxiRosterId || "");
      if (!rosterId) return;

      const rosterPlayers = taxiPlayersByRosterId.get(rosterId) || [];
      rosterPlayers.push(player);

      taxiPlayersByRosterId.set(rosterId, rosterPlayers);
    });

    // Add the taxi players as new field for league object so frontend has access
    return leagueList.map((league) => {
      const leagueObject = typeof league.toObject === "function" ? league.toObject() : { ...league };
      leagueObject.rosterIds = (leagueObject.rosterIds || []).map((roster) => {
        if (!roster || typeof roster !== "object") {
          return roster;
        }
        return {
          ...roster,
          taxiPlayers: taxiPlayersByRosterId.get(String(roster._id)) || [],
        };
      });
      return leagueObject;
    });
  }
  async getLeagueById(id)                     { return League.findById(id); }
  async updateLeagueById(id, fieldsToUpdate)  { return League.findByIdAndUpdate(id, { $set: fieldsToUpdate }, { returnDocument: 'after' }); }
  async deleteLeagueById(id) {
    const deletedLeague = await League.findByIdAndDelete(id);
    if (!deletedLeague) {
      return null;
    }

    await User.findByIdAndUpdate(deletedLeague.user, {
      $pull: { leagues: deletedLeague._id },
    });

    return deletedLeague;
  }

  async createMLBRoster(rosterData)           { const newRoster = new MLBRoster(rosterData); return newRoster.save(); }
  async getMLBRosterById(id)                  { return MLBRoster.findById(id); }

  async getPlayerDoc(APIplayerId, leagueId)   { return Player.findOne({ APIplayerId, leagueId, isCustom: false }); }
  async upsertPlayerDoc(APIplayerId, leagueId, fields) {
    return Player.findOneAndUpdate(
      { APIplayerId, leagueId, isCustom: false },
      { $set: { APIplayerId, leagueId, isCustom: false, ...fields } },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
  }

  async getDraftedPlayers(leagueId) { return Player.find({ leagueId, ownerId: { $ne: null } }).lean(); }
  async countDraftedTaxiPlayers(leagueId, rosterId, options={}) { 
    const count = Player.countDocuments({ 
      leagueId, 
      taxiRosterId: rosterId,
    }); 

    if(options.session){
      count.session(options.session);
    }
    return count;
  }
} 

module.exports = new Database();
