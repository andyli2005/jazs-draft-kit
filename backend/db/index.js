const mongoose = require("mongoose");
const User = require("./models/User");

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
}

module.exports = new Database();
