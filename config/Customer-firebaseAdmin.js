import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let customerApp = null;

try {
  const possiblePaths = [
    path.join(__dirname, "..", "customer-secret-key-firebase.json"),
    path.join(process.cwd(), "customer-secret-key-firebase.json"),
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
    const envKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_CUSTOMER;
    if (envKey) {
      serviceAccount = JSON.parse(envKey);
      console.log("✅ Using CUSTOMER Firebase key from environment variable");
    } else {
      throw new Error("Customer Firebase service account key not found");
    }
  }

  // Initialize with a unique name "customer"
  if (!admin.apps.some(app => app.name === "customer")) {
    customerApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    }, "customer");
    console.log("✅ CUSTOMER Firebase Admin initialized successfully");
  } else {
    customerApp = admin.app("customer");
  }

  // Test messaging
  const messaging = admin.messaging(customerApp);
  console.log("✅ CUSTOMER Firebase Messaging is available");

} catch (err) {
  console.error("❌ CUSTOMER Firebase Admin initialization failed:", err.message);
}

export default customerApp;