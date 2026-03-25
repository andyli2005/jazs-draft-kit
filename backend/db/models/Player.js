const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;

const playerSchema = new mongoose.Schema(
  {
    name:           { type: String, required: true, trim: true },
    status:         { type: String, required: true },
    notes:          { type: String, required: true },
    positions:      { type: String, required: true },
    personalNotes:  { type: String, default: "" },
    pictureURL:     { type: String, default: "" },
    price:          { type: Number, required: true },
    team:           { type: String, required: true },
    weight:         { type: Number, default: null },
    height:         { type: Number, default: null },
    bidStartedById: { type: ObjectId, ref: "MLBRoster", default: null },
    ownerId:        { type: ObjectId, ref: "MLBRoster", default: null },
    leagueId:       { type: ObjectId, ref: "League", required: true },
    APIplayerId:    { type: ObjectId, required: true },
  },
  { timestamps: true }
);

playerSchema.index({ APIplayerId: 1, leagueId: 1 }, { unique: true });

module.exports = mongoose.model("Player", playerSchema);
