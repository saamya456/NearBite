require("dotenv").config();
const mongoose = require("mongoose");

const placeSchema = new mongoose.Schema({
  name: String,
  category: String,
  rating: Number,
  reviewCount: { type: Number, default: 0 },
  location: { type: { type: String, default: "Point" }, coordinates: [Number] },
});
const Place = mongoose.model("Place", placeSchema);

const categories = ["cafe", "restaurant", "bakery", "street-food", "juice-bar"];
const rand = (min, max) => Math.random() * (max - min) + min;

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Place.deleteMany({});
  await Place.collection.dropIndexes().catch(() => {}); // start with NO geo index

  const TOTAL = 100000,
    BATCH = 5000;
  for (let i = 0; i < TOTAL; i += BATCH) {
    const docs = Array.from({ length: BATCH }, (_, j) => ({
      name: `Place ${i + j}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      rating: Math.round(rand(1, 5) * 10) / 10,
      // spread around Bengaluru: lng 77.45-77.75, lat 12.85-13.10
      location: {
        type: "Point",
        coordinates: [rand(77.45, 77.75), rand(12.85, 13.1)],
      },
    }));
    await Place.insertMany(docs, { ordered: false });
    console.log(`Inserted ${i + BATCH}`);
  }
  await mongoose.disconnect();
})();
