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
      console.log("[CustomerFCM] sendToCustomer started", {
        customerId: customerId ? String(customerId) : null,
        title: notification?.title || "Notification",
        dataKeys: Object.keys(data || {}),
      });

      if (!customerId) {
        console.warn("[CustomerFCM] Missing customerId");
        return { success: false, error: "Customer ID is required" };
      }
 
      if (!this.isAvailable()) {
        console.error("[CustomerFCM] Firebase messaging is not available");
        return { success: false, error: "FCM service not available" };
      }
 
      const tokensDocs = await CustomerPushToken.find({
        customerId: String(customerId),
        isActive: true,
      }).lean();
 
      const tokens = tokensDocs.map((d) => d.token).filter(Boolean);

      console.log("[CustomerFCM] Active tokens loaded", {
        customerId: String(customerId),
        totalDocs: tokensDocs.length,
        usableTokens: tokens.length,
        platforms: tokensDocs.reduce((acc, tokenDoc) => {
          const platform = tokenDoc.platform || "unknown";
          acc[platform] = (acc[platform] || 0) + 1;
          return acc;
        }, {}),
      });
 
      if (tokens.length === 0) {
        console.warn("[CustomerFCM] No active tokens found", {
          customerId: String(customerId),
        });
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
          const tokenPreview = token.substring(0, 20) + "...";
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

          console.log("[CustomerFCM] Sending message", {
            customerId: String(customerId),
            token: tokenPreview,
            notificationTitle: message.notification.title,
            dataKeys: Object.keys(message.data || {}),
            hasApnsPayload: !!message.apns?.payload,
          });
 
          const response = await this.admin.messaging().send(message);
          console.log("[CustomerFCM] Send success", {
            customerId: String(customerId),
            token: tokenPreview,
            messageId: response,
          });

          results.push({
            token: tokenPreview,
            success: true,
            messageId: response,
          });
        } catch (error) {
          const tokenPreview = token.substring(0, 20) + "...";
          console.error("[CustomerFCM] Send failed", {
            customerId: String(customerId),
            token: tokenPreview,
            code: error.code,
            message: error.message,
          });

          results.push({
            token: tokenPreview,
            success: false,
            error: error.message,
            code: error.code,
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
        console.warn("[CustomerFCM] Marking failed tokens inactive", {
          customerId: String(customerId),
          failedTokens: failedTokens.length,
        });

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

      console.log("[CustomerFCM] sendToCustomer completed", {
        customerId: String(customerId),
        success: successCount > 0,
        successCount,
        failureCount,
        totalTokens: tokens.length,
        failedTokens: failedTokens.length,
      });
 
      return {
        success: successCount > 0,
        successCount,
        failureCount,
        totalTokens: tokens.length,
        results,
        failedTokens: failedTokens.length,
      };
    } catch (error) {
      console.error("[CustomerFCM] sendToCustomer crashed", {
        customerId: customerId ? String(customerId) : null,
        code: error.code,
        message: error.message,
        stack: error.stack,
      });

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