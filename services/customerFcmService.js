import customerApp from "../config/Customer-firebaseAdmin.js";
import CustomerPushToken from "../models/customerPushTokenModel.js";

class CustomerFCMService {
  constructor() {
    this.admin = customerApp;
  }

  isAvailable() {
    try {
      return this.admin && this.admin.messaging;
    } catch {
      return false;
    }
  }

  async testConnection() {
    try {
      console.log("========== CUSTOMER FCM TEST ==========");
      console.log("Admin Exists:", !!this.admin);
      console.log("Messaging Exists:", !!this.admin?.messaging);

      if (!this.isAvailable()) {
        console.error("Firebase unavailable");
        return {
          success: false,
          error: "Firebase Admin not initialized or messaging not available",
        };
      }

      const app = this.admin.app();

      console.log("App Name:", app.name);
      console.log("Project ID:", app.options.projectId);
      console.log("Client Email:", app.options.credential?.clientEmail);

      return {
        success: true,
        message: "Customer FCM service is connected",
        appName: app.name,
        hasMessaging: !!this.admin.messaging,
      };
    } catch (error) {
      console.error(error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendToCustomer(customerId, notification, data = {}) {
    console.log("\n================ CUSTOMER FCM =================");
    console.log("Customer ID:", customerId);
    console.log("Notification:", notification);
    console.log("Data:", data);

    try {
      if (!customerId) {
        console.error("❌ Customer ID missing");
        return {
          success: false,
          error: "Customer ID is required",
        };
      }

      console.log("Checking Firebase availability...");

      if (!this.isAvailable()) {
        console.error("❌ Firebase Admin is not available");
        return {
          success: false,
          error: "FCM service not available",
        };
      }

      console.log("✅ Firebase Admin available");

      console.log("Fetching customer tokens...");

      const tokensDocs = await CustomerPushToken.find({
        customerId: String(customerId),
        isActive: true,
      }).lean();

      console.log("Mongo Result:", tokensDocs);

      const tokens = tokensDocs.map((d) => d.token).filter(Boolean);

      console.log("Active Tokens:", tokens.length);

      if (!tokens.length) {
        console.warn("⚠️ No active tokens found");
        return {
          success: false,
          message: "No active tokens found for this customer",
        };
      }

      const results = [];
      const failedTokens = [];

      for (const token of tokens) {
        console.log("----------------------------------------");
        console.log("Sending notification to token:");
        console.log(token.substring(0, 20) + "...");

        try {
          const message = {
            token,
            notification: {
              title: notification.title || "Notification",
              body: notification.body || "",
            },
            data: Object.fromEntries(
              Object.entries({
                ...data,
                timestamp: new Date().toISOString(),
              }).map(([k, v]) => [k, String(v)])
            ),
            android: {
              priority: "high",
            },
            apns: {
              payload: {
                aps: {
                  badge: 1,
                  sound: "default",
                },
              },
            },
          };

          console.log("Message Payload:", {
            token: token.substring(0, 20) + "...",
            notification: message.notification,
            data: message.data,
          });

          const response = await this.admin.messaging().send(message);

          console.log("✅ Sent Successfully");
          console.log("Message ID:", response);

          results.push({
            token: token.substring(0, 20) + "...",
            success: true,
            messageId: response,
          });
        } catch (error) {
          console.error("❌ Send Failed");
          console.error("Code:", error.code);
          console.error("Message:", error.message);
          console.error("Stack:", error.stack);

          results.push({
            token: token.substring(0, 20) + "...",
            success: false,
            error: error.message,
          });

          if (
            error.code === "messaging/registration-token-not-registered" ||
            error.code === "messaging/invalid-registration-token" ||
            error.message.includes("not registered") ||
            error.message.includes("invalid")
          ) {
            console.warn("Marking token inactive");
            failedTokens.push(token);
          }
        }
      }

      if (failedTokens.length) {
        console.log("Updating invalid tokens:", failedTokens.length);

        await CustomerPushToken.updateMany(
          {
            token: { $in: failedTokens },
          },
          {
            $set: {
              isActive: false,
              lastSeenAt: new Date(),
              deactivationReason: "FCM failure",
            },
          }
        );

        console.log("Invalid tokens updated");
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      console.log("================ SUMMARY ================");
      console.log("Success:", successCount);
      console.log("Failure:", failureCount);
      console.log("Failed Tokens:", failedTokens.length);
      console.log("=========================================");

      return {
        success: successCount > 0,
        successCount,
        failureCount,
        totalTokens: tokens.length,
        results,
        failedTokens: failedTokens.length,
      };
    } catch (error) {
      console.error("🔥 FATAL ERROR");
      console.error(error);
      console.error(error.stack);

      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  async sendToMultipleCustomers(customerIds, notification, data = {}) {
    const results = [];
    for (const customerId of customerIds) {
      const result = await this.sendToCustomer(customerId, notification, data);
      results.push({ customerId, ...result });
    }
    return results;
  }
}

export default new CustomerFCMService();