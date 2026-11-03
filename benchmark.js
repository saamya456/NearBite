require("dotenv").config();
const mongoose = require("mongoose");

const center = [77.6046, 12.9279];
const radiusMeters = 3000;
const EARTH_RADIUS = 6378100;
const RUNS = 50;

async function time(fn) {
  const t = [];
  for (let i = 0; i < RUNS; i++) {
    const s = process.hrtime.bigint();
    await fn();
    t.push(Number(process.hrtime.bigint() - s) / 1e6);
  }
  return (t.reduce((a, b) => a + b, 0) / t.length).toFixed(2);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.db.collection("places");

  const filter = {
    location: {
      $geoWithin: { $centerSphere: [center, radiusMeters / EARTH_RADIUS] },
    },
    category: "cafe",
    rating: { $gte: 4 },
  };
  const run = () => col.find(filter).limit(20).toArray();

  // 1. Without geo index
  await col.dropIndex("location_2dsphere").catch(() => {});
  const noIdx = await time(run);
  const planA = await col.find(filter).explain("executionStats");

  // 2. With 2dsphere index
  await col.createIndex({ location: "2dsphere" });
  const geoIdx = await time(run);
  const planB = await col.find(filter).explain("executionStats");

  // 3. With compound index (geo + category + rating)
  await col.dropIndex("location_2dsphere");
  await col.createIndex({ category: 1, rating: 1, location: "2dsphere" });
  const compound = await time(run);
  const planC = await col.find(filter).explain("executionStats");

  const s = (p) => p.executionStats;
  console.table([
    {
      setup: "No index",
      avgMs: noIdx,
      docsExamined: s(planA).totalDocsExamined,
      stage: planA.queryPlanner.winningPlan.stage,
    },
    {
      setup: "2dsphere",
      avgMs: geoIdx,
      docsExamined: s(planB).totalDocsExamined,
      keysExamined: s(planB).totalKeysExamined,
    },
    {
      setup: "Compound",
      avgMs: compound,
      docsExamined: s(planC).totalDocsExamined,
      keysExamined: s(planC).totalKeysExamined,
    },
  ]);

  // restore the index the app needs
  await col.dropIndexes();
  await col.createIndex({ location: "2dsphere" });
  await mongoose.disconnect();
})();
