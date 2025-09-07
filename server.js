// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Wish from "./models_wish.js";
import Feedback from "./models_feedback.js";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors()); // for demo, allow all. Later restrict with FRONTEND_URL.
app.use(express.json());

// Serve uploads folder publicly
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// === Connect to MongoDB Atlas ===
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Error:", err);
    process.exit(1);
  }
}
connectDB();

// === Multer storage (for images + video) ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

/**
 * Create a new wish
 */
app.post(
  "/api/wish",
  upload.fields([
    { name: "images", maxCount: 3 },
    { name: "video", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { name, message, sender } = req.body;
      if (!name || !message || !sender) {
        return res
          .status(400)
          .json({ error: "name, message & sender are required" });
      }

      const images = (req.files["images"] || []).map(
        (f) => `${req.protocol}://${req.get("host")}/uploads/${f.filename}`
      );

      const video =
        req.files["video"] && req.files["video"][0]
          ? `${req.protocol}://${req.get("host")}/uploads/${req.files["video"][0].filename}`
          : null;

      const newWish = await Wish.create({
        name,
        message,
        sender,
        images,
        video,
      });

      const baseFrontend = process.env.BASE_URL || "http://localhost:5173";
      const link = `${baseFrontend}/wish/${newWish._id}`;

      res.json({
        link,
        id: newWish._id,
        name: newWish.name,
        message: newWish.message,
        sender: newWish.sender,
        images: newWish.images,
        video: newWish.video,
        createdAt: newWish.createdAt,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * Fetch a single wish
 */
app.get("/api/wish/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let wish;

    if (mongoose.Types.ObjectId.isValid(id)) {
      wish = await Wish.findById(id);
    } else {
      wish = await Wish.findOne({ _id: id });
    }

    if (!wish) return res.status(404).json({ error: "Wish not found" });

    res.json({
      id: wish._id,
      name: wish.name,
      message: wish.message,
      sender: wish.sender,
      images: wish.images,
      video: wish.video,
      createdAt: wish.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Fetch all wishes
 */
app.get("/api/wishes", async (req, res) => {
  try {
    const list = await Wish.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Serve video by wish ID
 */
app.get("/video/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let wish;

    if (mongoose.Types.ObjectId.isValid(id)) {
      wish = await Wish.findById(id);
    } else {
      wish = await Wish.findOne({ _id: id });
    }

    if (!wish || !wish.video) {
      return res.status(404).json({ error: "Video not found" });
    }

    const filename = path.basename(wish.video);
    const filePath = path.join(__dirname, "uploads", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File missing" });
    }

    res.set("Content-Type", "video/mp4");
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Save feedback to MongoDB Atlas
 */
app.post("/api/feedback", async (req, res) => {
  try {
    const { feedback } = req.body;

    if (!feedback || feedback.trim() === "") {
      return res.status(400).json({ error: "Feedback cannot be empty" });
    }

    const newFeedback = new Feedback({ feedback });
    await newFeedback.save();

    console.log("✅ Saved feedback:", newFeedback);

    res.json({ message: "Thank you for your feedback!", feedback: newFeedback });
  } catch (err) {
    console.error("Error saving feedback:", err);
    res.status(500).json({ error: "Failed to save feedback" });
  }
});

app.get("/", (req, res) => res.send("🎉 Backend running"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
