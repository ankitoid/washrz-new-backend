// scripts/backfillZoneArea.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Zone from '../models/Zone.js';
import { computePolygonArea } from '../utills/geometry.js';

dotenv.config();

async function backfill() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const zones = await Zone.find({});
    console.log(`Found ${zones.length} zones to update`);

    let updated = 0;
    for (const zone of zones) {
      // Extract the outer ring of the polygon
      const coords = zone.geometry?.coordinates?.[0];
      if (!coords || coords.length < 3) {
        console.warn(`Zone ${zone.zoneId} has invalid geometry, skipping`);
        continue;
      }
      const area = computePolygonArea(coords);
      zone.area = area;
      await zone.save();
      updated++;
      console.log(`Updated ${zone.zoneId} area = ${area.toFixed(4)} km²`);
    }

    console.log(`Backfill complete. Updated ${updated} zones.`);
    process.exit(0);
  } catch (err) {
    console.error('Backfill failed:', err);
    process.exit(1);
  }
}

backfill();