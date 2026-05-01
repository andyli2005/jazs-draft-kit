const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;

const statBlockSchema = new mongoose.Schema(
  {
    atBats:             { type: Number, required: true },
    runs:               { type: Number, required: true },
    hits:               { type: Number, required: true },
    singles:            { type: Number, required: true },
    doubles:            { type: Number, required: true },
    triples:            { type: Number, required: true },
    homeRuns:           { type: Number, required: true },
    runsBattedIn:       { type: Number, required: true },
    baseOnBalls:        { type: Number, required: true },
    strikeOuts:         { type: Number, required: true },
    stolenBases:        { type: Number, required: true },
    caughtStealing:     { type: Number, required: true },
    battingAverage:     { type: Number, required: true },
    onBasePercentage:   { type: Number, required: true },
    sluggingPercentage: { type: Number, required: true },
    fantasyPoints:      { type: Number, required: true },
  },
  { _id: false }
);

const playerSchema = new mongoose.Schema(
  {
    name:                  { type: String, required: true, trim: true },
    status:                { type: String, required: true },
    notes:                 { type: String, required: true },
    positions:             { type: String, required: true },
    personalNotes:         { type: String, default: "" },
    pictureURL:            { type: String, default: "" },
    price:                 { type: Number, required: true },
    team:                  { type: String, required: true },
    weight:                { type: Number, default: null },
    height:                { type: Number, default: null },
    bidStartedById:        { type: ObjectId, ref: "MLBRoster", default: null },
    ownerId:               { type: ObjectId, ref: "MLBRoster", default: null },
    leagueId:              { type: ObjectId, ref: "League", required: true },
    APIplayerId:           { type: ObjectId, default: null },
    isCustom:              { type: Boolean, default: false },
    currentStats:          { type: statBlockSchema, required: true },
    projectedStats:        { type: statBlockSchema, required: true },
    threeYearAverageStats: { type: statBlockSchema, required: true },
  },
  { timestamps: true }
);

playerSchema.index(
  { APIplayerId: 1, leagueId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      APIplayerId: { $exists: true, $ne: null },
    },
  }
);

module.exports = mongoose.model("Player", playerSchema);
