const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;

const userSchema = new mongoose.Schema(
  {
    userName:       { type: String, required: true, trim: true, },
    email:          { type: String, required: true, unique: true, lowercase: true, trim: true, },
    passwordHash:   { type: String, required: true, },
    profilePicture:      { type: String, default: "", },
    securityQuestion:    { type: String, default: "" },
    securityAnswerHash:  { type: String, default: "" },
    leagues:             { type: [{ type: ObjectId, ref: "League" }], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
