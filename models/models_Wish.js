// backend/models_wish.js
import mongoose from "mongoose";

const WishSchema = new mongoose.Schema({
  name: { type: String, required: true },
  message: { type: String, required: true },
  sender: { type: String, required: true },
  images: [String],
  video: { type: String },   // 👈 added field
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Wish", WishSchema);
