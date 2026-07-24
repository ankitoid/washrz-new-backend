import dotenv from "dotenv";
import mongoose from "mongoose";
import pickup from "../models/pickupSchema.js";
import { geocodeWithOla } from "../services/olaMapsService.js";

dotenv.config();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set in environment variables.");
    process.exit(1);
  }

  console.log("Connecting to Database...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Database Connected!");

  try {
    // Find pickups with missing geocode coordinates
    const pendingPickups = await pickup.find({
      $or: [
        { "pickupLocation.latitude": null },
        { "pickupLocation.longitude": null },
        { pickupLocation: { $exists: false } }
      ],
      isDeleted: false,
      Address: { $ne: null, $exists: true }
    });

    console.log(`Found ${pendingPickups.length} pickups requiring geocoding.`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pendingPickups.length; i++) {
      const p = pendingPickups[i];
      const address = p.Address?.trim();

      if (!address) {
        console.log(`[${i+1}/${pendingPickups.length}] Skipping pickup ID ${p._id}: Empty address.`);
        continue;
      }

      console.log(`[${i+1}/${pendingPickups.length}] Geocoding address for pickup ID ${p._id}: "${address}"...`);

      try {
        const coords = await geocodeWithOla(address);
        p.pickupLocation = {
          latitude: coords.lat,
          longitude: coords.lng
        };
        await p.save();
        console.log(`  Successfully updated to coordinates: ${coords.lat}, ${coords.lng}`);
        successCount++;
      } catch (err) {
        console.error(`  Failed to geocode pickup ID ${p._id}: ${err.message}`);
        failCount++;
      }

      // Small delay to respect API rate limits
      await sleep(250);
    }

    console.log(`Geocoding complete. Success: ${successCount}, Failed: ${failCount}`);
  } catch (error) {
    console.error("Error during geocoding script execution:", error);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed.");
  }
}

// run();
