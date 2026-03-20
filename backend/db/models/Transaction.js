const mongoose = require("mongoose");
// const ObjectId = Schema.Types.ObjectId

const transactionSchema = new mongoose.Schema(
  {
    teamOwner:  { type: String, required: true, trim: true, },
    player:     { type: String, required: true, trim: true},
    actionType: { type: String, required: true, trim: true, },
    draftCost:  { type: Number, default: 0},
    budgetLeft: { type: Number, default: 260}
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
