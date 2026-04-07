import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let riderApp = null;

try {
  const possiblePaths = [
    path.join(__dirname, "..", "secret-key-firebase.json"),
    path.join(process.cwd(), "secret-key-firebase.json"),
  ];
  let serviceAccount = null;
  let keyPath = "";

  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      keyPath = possiblePath;
      serviceAccount = JSON.parse(fs.readFileSync(possiblePath, "utf8"));
      break;
    }
  }

  if (!serviceAccount) {
    const envKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_RIDER;
    if (envKey) {
      serviceAccount = JSON.parse(envKey);
      console.log("✅ Using RIDER Firebase key from environment variable");
    } else {
      throw new Error("Rider Firebase service account key not found");
    }
  }

  // Initialize with a unique name "rider"
  if (!admin.apps.some(app => app.name === "rider")) {
    riderApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    }, "rider");
    console.log("✅ RIDER Firebase Admin initialized successfully");
  } else {
    riderApp = admin.app("rider");
  }

  // Test messaging
  const messaging = admin.messaging(riderApp);
  console.log("✅ RIDER Firebase Messaging is available");

} catch (err) {
  console.error("❌ RIDER Firebase Admin initialization failed:", err.message);
}

export default riderApp; // Export the named app