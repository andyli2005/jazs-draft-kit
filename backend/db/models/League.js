const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;

const leagueSchema = new mongoose.Schema(
  {
    user:       { type: ObjectId, ref: "User", required: true },
    sport:      { type: String, required: true },
    name:       { type: String, required: true, trim: true },
    draftType:  { type: String, required: true, enum: ["Salary Cap", "Snake", "Linear"] },
    teamCount:  { type: Number, required: true },
    budgetCap:  { type: Number, required: true },
    rosterIds:  [{ type: ObjectId, ref: "MLBRoster" }],
    myTeam:     { type: ObjectId, ref: "MLBRoster", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("League", leagueSchema);
