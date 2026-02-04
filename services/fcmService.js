// services/fcmService.js
import admin from "../config/firebaseAdmin.js";
import RiderPushToken from "../models/riderPushTokenModel.js";
import mongoose from "mongoose";

class FCMService {
  constructor() {
    this.admin = admin;
  }

  // Check if FCM is available
  isAvailable() {
    try {
      return this.admin && this.admin.messaging;
    } catch (error) {
      return false;
    }
  }

  // Test connection
  async testConnection() {
    try {
      if (!this.isAvailable()) {
        return { success: false, error: "Firebase Admin not initialized or messaging not available" };
      }
      
      const app = this.admin.app();
      return { 
        success: true, 
        message: "FCM service is connected",
        appName: app.name,
        hasMessaging: !!this.admin.messaging
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Send notification to a specific rider
  async sendToRider(riderId, notification, data = {}) {
    try {
      // Validate riderId
      if (!riderId || !mongoose.Types.ObjectId.isValid(riderId)) {
        console.error(`Invalid riderId: ${riderId}`);
        return { success: false, error: "Invalid rider ID" };
      }

      // Check if FCM is available
      if (!this.isAvailable()) {
        console.error("FCM not available - Firebase Admin not initialized");
        return { success: false, error: "FCM service not available" };
      }

      // Fetch active tokens for this rider
      const tokensDocs = await RiderPushToken.find({ 
        riderId: new mongoose.Types.ObjectId(riderId), 
        isActive: true 
      }).lean();
      
      const tokens = tokensDocs.map((d) => d.token).filter(Boolean);
      
      if (tokens.length === 0) {
        console.log(`No active FCM tokens found for rider: ${riderId}`);
        return { 
          success: false, 
          message: "No tokens found for this rider",
          tokensCount: 0 
        };
      }

      console.log(`Sending FCM to ${tokens.length} device(s) for rider ${riderId}`);

      // For each token, send individually (more reliable than multicast)
      const results = [];
      const failedTokens = [];
      
      for (const token of tokens) {
        try {
          const message = {
            token: token,
            notification: {
              title: notification.title || "Notification",
              body: notification.body || "",
            },
            data: {
              ...data,
              timestamp: new Date().toISOString(),
            },
            android: {
              priority: "high",
            },
            apns: {
              payload: {
                aps: {
                  badge: 1,
                  sound: 'default'
                }
              }
            }
          };

          const response = await this.admin.messaging().send(message);
          results.push({ token: token.substring(0, 20) + '...', success: true, messageId: response });
        } catch (error) {
          console.error(`Failed to send to token ${token.substring(0, 20)}...:`, error.message);
          results.push({ token: token.substring(0, 20) + '...', success: false, error: error.message });
          
          // Check if token is invalid
          if (error.code === 'messaging/registration-token-not-registered' ||
              error.code === 'messaging/invalid-registration-token' ||
              error.message.includes('not registered') ||
              error.message.includes('invalid')) {
            failedTokens.push(token);
          }
        }
      }

      // Mark failed tokens as inactive
      if (failedTokens.length > 0) {
        await RiderPushToken.updateMany(
          { token: { $in: failedTokens } },
          { 
            $set: { 
              isActive: false, 
              lastSeenAt: new Date(),
              deactivationReason: 'FCM failure' 
            } 
          }
        );
        console.log(`Marked ${failedTokens.length} tokens as inactive`);
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      return {
        success: successCount > 0,
        successCount,
        failureCount,
        totalTokens: tokens.length,
        results: results,
        failedTokens: failedTokens.length
      };

    } catch (error) {
      console.error("FCM send error:", error.message);
      console.error("Error stack:", error.stack);
      return { 
        success: false, 
        error: error.message,
        code: error.code 
      };
    }
  }

  // Send to multiple riders
  // async sendToMultipleRiders(riderIds, notification, data = {}) {
  //   const results = [];
  //   for (const riderId of riderIds) {
  //     const result = await this.sendToRider(riderId, notification, data);
  //     results.push({ riderId, ...result });
  //   }
  //   return results;
  // }
}

// Export singleton instance
export default new FCMService();