// config/firebaseadmin.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use global variable to track if initialized
if (!global.firebaseAdminInitialized) {
  try {
    // Try multiple possible locations for the service account key
    const possiblePaths = [
      path.join(__dirname, "..", "secret-key-firebase.json"),
      path.join(process.cwd(), "secret-key-firebase.json"),
      // path.join(__dirname, "secret-key-firebase.json")
    ];

    console.log("paths", possiblePaths)
    
    let serviceAccount = null;
    let keyPath = "";
    
    for (const possiblePath of possiblePaths) {
      try {
         console.log("possiblePath, possiblePaths", possiblePath, possiblePaths)
        console.log("fs.existsSync(possiblePath)", fs.existsSync(possiblePath))
        if (fs.existsSync(possiblePath)) {
          keyPath = possiblePath;
          console.log("keyPath", keyPath)
          serviceAccount = JSON.parse(fs.readFileSync(possiblePath, "utf8"));
          console.log("this is the read data", serviceAccount)
          console.log(`✅ Found Firebase key at: ${keyPath}`);
          break;
        }
      } catch (err) {
        console.log("errr, this is the error", err)
        continue;
      }
    }
    
    if (!serviceAccount) {
      // Try environment variable
      const envKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (envKey) {
        serviceAccount = JSON.parse(envKey);
        console.log("✅ Using Firebase key from environment variable");
      } else {
        throw new Error("Firebase service account key not found in any location");
      }
    }
    
    // Initialize Firebase
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    
    global.firebaseAdminInitialized = true;
    console.log("✅ Firebase Admin initialized successfully");
    
    // Test messaging
    try {
      const messaging = admin.messaging();
      console.log("✅ Firebase Messaging is available");
    } catch (messagingError) {
      console.error("❌ Firebase Messaging error:", messagingError);
    }
    
  } catch (err) {
    console.error("❌ Firebase Admin initialization failed:", err.message);
    // Don't crash the app, but FCM won't work
    global.firebaseAdminInitialized = false;
  }
}

export default admin;