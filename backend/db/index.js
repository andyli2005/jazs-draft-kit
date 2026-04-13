const mongoose = require("mongoose");
const User = require("./models/User");
const Transaction = require("./models/Transaction");
const League = require("./models/League");
const MLBRoster = require("./models/MLBRoster");
const Player = require("./models/Player");

class Database {
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
  async createUser(userData)                  { const newUser = new User(userData); return newUser.save(); }
  async updateUserById(id, fieldsToUpdate)    { return User.findByIdAndUpdate(id, { $set: fieldsToUpdate }, { new: true }); }
  async deleteUserById(id)                    { return User.findByIdAndDelete(id); }

  async createTransaction(transactionData)    { const newTransction = new Transaction(transactionData); return newTransction.save(); }
  async getTransactions(leagueId)             { return Transaction.find({ leagueId }).sort({ createdAt: -1 }).limit(50); }

  async createLeague(leagueData)              { const newLeague = new League(leagueData); return newLeague.save(); }
  async getLeaguesByUser(userId) {
    return League.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate({
        path: "rosterIds",
        populate: [
          { path: "catcher1", select: "name positions team pictureURL" },
          { path: "catcher2", select: "name positions team pictureURL" },
          { path: "firstBase", select: "name positions team pictureURL" },
          { path: "secondBase", select: "name positions team pictureURL" },
          { path: "thirdBase", select: "name positions team pictureURL" },
          { path: "inField", select: "name positions team pictureURL" },
          { path: "shortStop", select: "name positions team pictureURL" },
          { path: "utility", select: "name positions team pictureURL" },
          { path: "middleInField", select: "name positions team pictureURL" },
          { path: "pitcher1", select: "name positions team pictureURL" },
          { path: "pitcher2", select: "name positions team pictureURL" },
          { path: "pitcher3", select: "name positions team pictureURL" },
          { path: "pitcher4", select: "name positions team pictureURL" },
          { path: "pitcher5", select: "name positions team pictureURL" },
          { path: "pitcher6", select: "name positions team pictureURL" },
          { path: "pitcher7", select: "name positions team pictureURL" },
          { path: "pitcher8", select: "name positions team pictureURL" },
          { path: "pitcher9", select: "name positions team pictureURL" },
          { path: "outfielder1", select: "name positions team pictureURL" },
          { path: "outfielder2", select: "name positions team pictureURL" },
          { path: "outfielder3", select: "name positions team pictureURL" },
          { path: "outfielder4", select: "name positions team pictureURL" },
          { path: "outfielder5", select: "name positions team pictureURL" },
        ],
      });
  }
  async getLeagueById(id)                     { return League.findById(id); }
  async deleteLeagueById(id)                  { return League.findByIdAndDelete(id); }

  async createMLBRoster(rosterData)           { const newRoster = new MLBRoster(rosterData); return newRoster.save(); }
  async getMLBRosterById(id)                  { return MLBRoster.findById(id); }

  async getPlayerDoc(APIplayerId, leagueId)   { return Player.findOne({ APIplayerId, leagueId }); }
  async upsertPlayerDoc(APIplayerId, leagueId, fields) {
    return Player.findOneAndUpdate(
      { APIplayerId, leagueId },
      { $set: { APIplayerId, leagueId, ...fields } },
      { upsert: true, new: true, runValidators: true }
    );
  }
}

module.exports = new Database();
