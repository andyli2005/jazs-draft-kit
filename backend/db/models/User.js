const mongoose = require("mongoose");
// const ObjectId = Schema.Types.ObjectId

const userSchema = new mongoose.Schema(
  {
    userName:       { type: String, required: true, trim: true, },
    email:          { type: String, required: true, unique: true, lowercase: true, trim: true, },
    passwordHash:   { type: String, required: true, },
    profilePicture: { type: String, default: "", },
    // leagues:        [{ type: ObjectId, ref: "League" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
