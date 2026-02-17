// scripts/test-fcm.js
import mongoose from "mongoose";
import fcmService from "../services/fcmService.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function testFCM() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to database");
    
    // Test 1: Check FCM connection
    console.log("Testing FCM connection...");
    const connectionTest = await fcmService.testConnection();
    console.log("Connection test:", connectionTest);
    
    // Test 2: Send test notification to a specific rider
    // Replace with actual rider ID from your database
    const testRiderId = "your_test_rider_id_here";
    
    if (testRiderId && testRiderId !== "your_test_rider_id_here") {
      console.log(`\nSending test notification to rider: ${testRiderId}`);
      const result = await fcmService.sendToRider(
        testRiderId,
        {
          title: "🔔 Test Notification",
          body: "This is a test notification from backend"
        },
        {
          type: "test",
          timestamp: new Date().toISOString(),
          test: "true"
        }
      );
      
      console.log("Send result:", JSON.stringify(result, null, 2));
    } else {
      console.log("\n⚠️  Please set a valid testRiderId in the script");
    }
    
    // List all registered tokens
    const mongoose = (await import("mongoose")).default;
    const RiderPushToken = (await import("../models/riderPushTokenModel.js")).default;
    
    const tokens = await RiderPushToken.find({ isActive: true })
      .populate('riderId', 'name phone')
      .lean();
    
    console.log(`\n📱 Found ${tokens.length} active tokens:`);
    tokens.forEach((t, i) => {
      console.log(`${i+1}. ${t.riderId?.name || 'Unknown'} (${t.riderId?._id})`);
      console.log(`   Token: ${t.token.substring(0, 40)}...`);
      console.log(`   Platform: ${t.platform}, Device: ${t.deviceId || 'N/A'}`);
      console.log(`   Last seen: ${t.lastSeenAt}`);
      console.log('');
    });
    
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from database");
    process.exit(0);
  }
}

testFCM();