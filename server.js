require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
app.use(express.static("public"));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model("User", userSchema);

const signToken = (user) =>
  jwt.sign({ id: user._id, name: user.name }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Login required" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Register
app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 8)
      return res.status(400).json({
        error: "name, email and a password of 8+ characters are required",
      });
    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
    });
    res.status(201).json({
      token: signToken(user),
      user: { id: user._id, name: user.name },
    });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: "Email already registered" });
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase() });
    if (!user || !(await bcrypt.compare(password || "", user.passwordHash)))
      return res.status(401).json({ error: "Invalid email or password" });
    res.json({
      token: signToken(user),
      user: { id: user._id, name: user.name },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const placeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: String,
  dishes: [String], // e.g. ["filter coffee", "masala dosa"]
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  location: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
});
placeSchema.index({ location: "2dsphere" });
placeSchema.index(
  { name: "text", dishes: "text" },
  { weights: { name: 5, dishes: 2 }, name: "place_text" },
);

const reviewSchema = new mongoose.Schema({
  placeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Place",
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName: String,
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: String,
  createdAt: { type: Date, default: Date.now },
});
reviewSchema.index({ placeId: 1, userId: 1 }, { unique: true }); // one review per user per place
const Review = mongoose.model("Review", reviewSchema);

// Recalculate and store avg rating + count on the place
async function updatePlaceRating(placeId) {
  const [stats] = await Review.aggregate([
    { $match: { placeId: new mongoose.Types.ObjectId(placeId) } },
    {
      $group: { _id: "$placeId", avg: { $avg: "$rating" }, count: { $sum: 1 } },
    },
  ]);
  await Place.findByIdAndUpdate(placeId, {
    rating: stats ? Math.round(stats.avg * 10) / 10 : 0,
    reviewCount: stats ? stats.count : 0,
  });
}

const Place = mongoose.model("Place", placeSchema);

app.get("/", (req, res) => {
  res.json({ message: "Welcome to NearBite API!" });
});

// Add a place
app.post("/places", async (req, res) => {
  const { name, category, dishes, rating, lng, lat } = req.body;
  const place = await Place.create({
    name,
    category,
    dishes,
    rating,
    location: { type: "Point", coordinates: [lng, lat] },
  });
  res.status(201).json(place);
});

// Nearby search: /places/nearby?lng=77.59&lat=12.97&radius=2000&category=cafe&minRating=4
// /places/nearby?lng=77.60&lat=12.92&radius=3000&category=cafe&minRating=4&sort=rating&page=2&limit=10
app.get("/places/nearby", async (req, res) => {
  try {
    const {
      lng,
      lat,
      radius = 2000,
      category,
      minRating = 0,
      sort = "distance",
    } = req.query;
    const x = Number(lng),
      y = Number(lat);
    if (!Number.isFinite(x) || !Number.isFinite(y))
      return res
        .status(400)
        .json({ error: "lng and lat are required numbers" });

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

    const query = { rating: { $gte: Number(minRating) } };
    if (category) query.category = category;

    const sorts = {
      rating: { rating: -1, distanceMeters: 1, _id: 1 },
      reviews: { reviewCount: -1, distanceMeters: 1, _id: 1 },
    };

    const pipeline = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: [x, y] },
          distanceField: "distanceMeters",
          maxDistance: Number(radius),
          query,
          spherical: true,
        },
      },
    ];
    if (sorts[sort]) pipeline.push({ $sort: sorts[sort] }); // default: already sorted by distance

    pipeline.push({
      $facet: {
        results: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        total: [{ $count: "count" }],
      },
    });

    const [out] = await Place.aggregate(pipeline);
    const total = out.total[0]?.count || 0;
    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      results: out.results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a review
app.post("/places/:id/reviews", auth, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: "Invalid place id" });
    const place = await Place.findById(req.params.id);
    if (!place) return res.status(404).json({ error: "Place not found" });

    const review = await Review.create({
      placeId: place._id,
      userId: req.user.id,
      userName: req.user.name,
      rating,
      comment,
    });
    await updatePlaceRating(place._id);
    res.status(201).json(review);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: "You already reviewed this place" });
    res.status(500).json({ error: err.message });
  }
});

// List reviews (newest first)
app.get("/places/:id/reviews", async (req, res) => {
  try {
    const reviews = await Review.find({ placeId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /places/search?q=dosa&lng=77.60&lat=12.92&radius=3000

app.get("/places/search", async (req, res) => {
  try {
    const { q, lng, lat, radius = "3000" } = req.query;

    if (typeof q !== "string" || !q.trim()) {
      return res.status(400).json({ error: "q is required" });
    }

    const filter = { $text: { $search: q.trim() } };

    // Optional area limit: validate coordinates when supplied
    if (lng !== undefined || lat !== undefined) {
      const x = Number(lng);
      const y = Number(lat);
      const r = Number(radius);

      if (
        lng === undefined ||
        lat === undefined ||
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < -180 ||
        x > 180 ||
        y < -90 ||
        y > 90 ||
        !Number.isFinite(r) ||
        r <= 0 ||
        r > 20000
      ) {
        return res.status(400).json({
          error: "Provide valid lng, lat, and radius (max 20000m)",
        });
      }

      filter.location = {
        $geoWithin: {
          $centerSphere: [[x, y], r / 6378100],
        },
      };
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      50,
    );

    const [results, total] = await Promise.all([
      Place.find(filter, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" }, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Place.countDocuments(filter),
    ]);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() =>
    app.listen(3000, () => console.log("Running on http://localhost:3000")),
  )
  .catch((err) => {
    console.error("DB connection failed:", err.message);
    process.exit(1);
  });
