// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Wish from "./models/models_Wish.js";
import Feedback from "./models/models_feedback.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// === CORS ===
const allowedOrigins = [
  process.env.CLIENT_URL || "https://birthday-wisher-frontend-jylu.vercel.app",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Handle preflight requests for POST/PUT
app.options("*", cors({ origin: allowedOrigins, credentials: true }));

app.use(express.json());

// === Ensure uploads folder exists ===
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use("/uploads", express.static(uploadsDir));

// === Multer storage ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});
const upload = multer({ storage });

// === MongoDB connection ===
const PORT = process.env.PORT || 5000;

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}
connectDB();

// === API Routes ===
app.get("/api", (req, res) => res.send("🎉 Backend running"));

// Create a new wish
app.post(
  "/api/wish",
  upload.fields([
    { name: "images", maxCount: 3 },
    { name: "video", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { name, message, sender } = req.body;
      if (!name || !message || !sender)
        return res.status(400).json({ error: "name, message & sender are required" });

      const images = (req.files["images"] || []).map(
        (f) => `${req.protocol}://${req.get("host")}/uploads/${f.filename}`
      );

      const video =
        req.files["video"]?.[0]
          ? `${req.protocol}://${req.get("host")}/uploads/${req.files["video"][0].filename}`
          : null;

      const newWish = await Wish.create({ name, message, sender, images, video });

      const baseFrontend = process.env.CLIENT_URL || "http://localhost:5173";
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

// Fetch single wish
app.get("/api/wish/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid wish ID" });

    const wish = await Wish.findById(id);
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

// Fetch all wishes
app.get("/api/wishes", async (req, res) => {
  try {
    const list = await Wish.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Serve video by wish ID
app.get("/video/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid wish ID" });

    const wish = await Wish.findById(id);
    if (!wish?.video) return res.status(404).json({ error: "Video not found" });

    const filename = path.basename(wish.video);
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing" });

    res.set("Content-Type", "video/mp4");
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Save feedback
app.post("/api/feedback", async (req, res) => {
  try {
    const { feedback } = req.body;
    if (!feedback?.trim()) return res.status(400).json({ error: "Feedback cannot be empty" });

    const newFeedback = await Feedback.create({ feedback });
    console.log("✅ Saved feedback:", newFeedback);

    res.json({ message: "Thank you for your feedback!", feedback: newFeedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save feedback" });
  }
});

// === Serve frontend build ===
const frontendDir = path.join(__dirname, "frontend", "dist");
if (fs.existsSync(frontendDir)) app.use(express.static(frontendDir));

// SPA fallback for React Router
app.get("*", (req, res) => {
  const indexPath = path.join(frontendDir, "index.html");
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).send("Frontend not built yet. Run 'npm run build' in frontend.");
});
