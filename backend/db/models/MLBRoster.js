const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;

const mlbRosterSchema = new mongoose.Schema(
  {
    budgetLeft:     { type: Number, required: true },
    name:           { type: String, required: true, trim: true },
    catcher1:       { type: ObjectId, ref: "Player", default: null },
    catcher2:       { type: ObjectId, ref: "Player", default: null },
    firstBase:      { type: ObjectId, ref: "Player", default: null },
    secondBase:     { type: ObjectId, ref: "Player", default: null },
    thirdBase:      { type: ObjectId, ref: "Player", default: null },
    inField:        { type: ObjectId, ref: "Player", default: null },
    shortStop:      { type: ObjectId, ref: "Player", default: null },
    utility:        { type: ObjectId, ref: "Player", default: null },
    middleInField:  { type: ObjectId, ref: "Player", default: null },
    pitcher1:       { type: ObjectId, ref: "Player", default: null },
    pitcher2:       { type: ObjectId, ref: "Player", default: null },
    pitcher3:       { type: ObjectId, ref: "Player", default: null },
    pitcher4:       { type: ObjectId, ref: "Player", default: null },
    pitcher5:       { type: ObjectId, ref: "Player", default: null },
    pitcher6:       { type: ObjectId, ref: "Player", default: null },
    pitcher7:       { type: ObjectId, ref: "Player", default: null },
    pitcher8:       { type: ObjectId, ref: "Player", default: null },
    pitcher9:       { type: ObjectId, ref: "Player", default: null },
    outfielder1:    { type: ObjectId, ref: "Player", default: null },
    outfielder2:    { type: ObjectId, ref: "Player", default: null },
    outfielder3:    { type: ObjectId, ref: "Player", default: null },
    outfielder4:    { type: ObjectId, ref: "Player", default: null },
    outfielder5:    { type: ObjectId, ref: "Player", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MLBRoster", mlbRosterSchema);
