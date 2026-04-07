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
      if (!this.isAvailable()) {
        return {
          success: false,
          error: "Firebase Admin not initialized or messaging not available",
        };
      }

      const app = this.admin.app();
      return {
        success: true,
        message: "Customer FCM service is connected",
        appName: app.name,
        hasMessaging: !!this.admin.messaging,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendToCustomer(customerId, notification, data = {}) {
    try {
      if (!customerId) {
        return { success: false, error: "Customer ID is required" };
      }

      if (!this.isAvailable()) {
        return { success: false, error: "FCM service not available" };
      }

      const tokensDocs = await CustomerPushToken.find({
        customerId: String(customerId),
        isActive: true,
      }).lean();

      const tokens = tokensDocs.map((d) => d.token).filter(Boolean);

      if (tokens.length === 0) {
        return {
          success: false,
          message: "No active tokens found for this customer",
          tokensCount: 0,
        };
      }

      const results = [];
      const failedTokens = [];

      for (const token of tokens) {
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

          const response = await this.admin.messaging().send(message);
          results.push({
            token: token.substring(0, 20) + "...",
            success: true,
            messageId: response,
          });
        } catch (error) {
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
            failedTokens.push(token);
          }
        }
      }

      if (failedTokens.length > 0) {
        await CustomerPushToken.updateMany(
          { token: { $in: failedTokens } },
          {
            $set: {
              isActive: false,
              lastSeenAt: new Date(),
              deactivationReason: "FCM failure",
            },
          }
        );
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      return {
        success: successCount > 0,
        successCount,
        failureCount,
        totalTokens: tokens.length,
        results,
        failedTokens: failedTokens.length,
      };
    } catch (error) {
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