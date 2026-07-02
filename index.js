import express from "express";
import "dotenv/config";
import "./database.js";
import authRoutes from "./routes/authRoutes.js";
import riderRoutes from "./routes/riderRoutes.js";
import plantRoutes from "./routes/plantRoutes.js";
import customerAppRoutes from "./routes/customerAppRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import revenueRoutes from "./routes/revenueRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import qrRoutes from "./routes/qrRoutes.js";
import AppError from "./utills/appError.js";
import tripRoutes from "./routes/tripRoutes.js";
import http from "http";
import cors from "cors";
import os from "os";
import { Server } from "socket.io";
import cookies from "cookie-parser";
import { uploadFiles } from "./controller/riderController.js";
import riderLocationRoutes from "./routes/riderLocationRoutes.js";
import RiderLocation from "./models/riderLocationSchema.js";
import pushTokenRoutes from "./routes/pushTokenRoutes.js";
import User from "./models/userModel.js";
import debugRoutes from "./routes/debugRoutes.js";
import osrmRoutes from "./routes/osrmRoutes.js";
import adminCoupons from "./routes/adminCouponRoutes.js";
import customerCoupons from "./routes/customerCouponRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import catalogRoutes from "./routes/catalogRoutes.js";
import customerNotificationRoutes from "./routes/customerNotificationRoutes.js";
import customerPushTokenRoutes from "./routes/customerPushTokenRoutes.js";
import slotBookingRoutes from "./routes/slotBookingRoutes.js"
import slotRoutes from "./routes/slotsRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import socketService from "./services/socketService.js";
import { cleanupExpiredCoupons } from "./jobs/couponCleanup.js";
import { syncPlayStoreDownloads } from "./jobs/playStoreSync.js";
import { syncAppStoreDownloads } from "./jobs/appStoreSync.js";
import faqRoutes from "./routes/faqRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import ChatRoom from "./models/ChatRoom.js";
import Message from "./models/Message.js";
import riderGroupRoutes from "./routes/riderGroupRoutes.js";
import RiderGroup from "./models/RiderGroup.js";
import RiderGroupMessage from "./models/RiderGroupMessage.js";
import {
  completeTaskTrackingLeg,
  startTaskTrackingLeg,
  upsertTaskTrackingFromLocation,
} from "./services/taskTrackingService.js";
import customerFcmService from "./services/customerFcmService.js";

const app = express();

console.log("just changed");
const server = http.createServer(app);
app.use(cookies());
app.use(
  cors({
    origin: [
      "https://washrz.vercel.app",
      "http://localhost:1574",
      "http://localhost:3000",
      "https://washrzdotcom.netlify.app",
      "http://localhost:3001",
      "http://dep-washrz-dev.s3-website.ap-south-1.amazonaws.com",
      "https://www.magha1.com",
      "http://erp.drydash.in.s3-website.ap-south-1.amazonaws.com",
      "https://erp.drydash.in",
      "http://localhost:5173",
      "https://new.drydash.in",
      "http://localhost:8081",
      "https://testdrydash.netlify.app",
      "https://test-drydash.netlify.app",
      "https://new.shiptos.com",
      "https://test.shiptos.com",
    ],
    methods: "GET, POST, PUT, DELETE, PATCH",
    credentials: true, // Allow credentials (cookies) to be sent with the request
  }),
);

console.log(`The total number of CPUs is ${os.cpus().length}`);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:1574",
      "http://localhost:3000",
      "https://washrz.vercel.app",
      "http://deploy-washrz-frontend.s3-website.ap-south-1.amazonaws.com",
      "https://washrzdotcom.netlify.app",
      "http://dep-washrz-dev.s3-website.ap-south-1.amazonaws.com",
      "https://www.magha1.com",
      "http://erp.drydash.in.s3-website.ap-south-1.amazonaws.com",
      "https://erp.drydash.in",
      "http://localhost:5173",
      "https://new.drydash.in",
      "http://localhost:8081",
      "http://localhost:5174", // Your React admin dev server
      "https://admin.drydash.in", // Your admin production URL
      "https://drydash-admin.vercel.app", // If using Vercel
      // ADD FOR RIDER APP
      "exp://192.168.10.215:8081", // Expo local development
      "http://192.168.10.215:8081", // Expo web
      "*",
      "https://testdrydash.netlify.app",
      "https://test-drydash.netlify.app",

      // adding for hoistinger deployment
      "https://new.shiptos.com",

     // adding for hoistinger test deployment
      "https://test.shiptos.com",
    ],
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  allowEIO3: true,
  pingTimeout: 60000, // Increase timeout for Render.com
  pingInterval: 25000,
  transports: ["websocket", "polling"], // Enable both transports
});

socketService.init(io);

const addAppToRequest = (app) => {
  return (req, res, next) => {
    req.app = app; // Add the app  to the request
    next();
  };
};

const addSocketToRequest = () => {
  return (req, res, next) => {
    req.socket = socketService;
    next();
  };
};

// NOTE: Body parser should be registered early so routes can use req.body
app.use(express.json({ limit: "100mb" }));
app.use("/api/v1/catalog", catalogRoutes);

// Attach io to requests early if any route/middleware needs req.socket
app.use(addSocketToRequest());

// If uploadFiles expects req.body or req.socket, it will now have them
app.use("/api/v1/rider/uploadFiles/:id", addAppToRequest(app), uploadFiles);

app.get("/heavy", (req, res) => {
  let total = 18;
  for (let i = 0; i < 5000000000; i++) {
    total++;
  }
  res.send(`The result of the CPU intensive task is ${total}\n`);
});

app.get("/test", (req, res) => {
  res.send({
    message: "api is workng",
    code: 200,
  });
});

app.use("/api/v1/rider/uploadFiles/:id", addAppToRequest(app), uploadFiles);

app.use(express.json({ limit: "100mb" }));
app.use(addSocketToRequest(io));

// app.post("/send", (req, res) => {
//   const message = req.body.message;
//   // console.log("testing", req.body.message);

//   io.emit("pushNotification", {
//     message,
//   });
//   res.status(200).send({
//     message: "Sent Successfully",
//   });

//   io.on("connection", (socket) => {
//     // console.log("Connected");
//     socket.on("disconnect", () => {
//       // console.log("Client disconnected");
//     });
//   });
// });

app.post("/send", (req, res) => {
  const message = req.body.message;
  req.socket.emitToAll("pushNotification", { message });
  res.status(200).send({ message: "Sent Successfully" });
});

// In-memory fast-access store for active riders
const activeRiderLocations = new Map();
io.sockets.activeRiderLocations = activeRiderLocations;
const adminRooms = new Set();

// Expose to HTTP routes so they can update the same in-memory map + broadcast
app.locals.activeRiderLocations = activeRiderLocations;
app.locals.io = io;

io.on("connection", (socket) => {
  // console.log("hii this is the socket id--->> ", socket.id);
  socket.emit("backendMessage", { message: "a new client connected" });

  // Rider joins its room
  socket.on("joinRider", ({ riderId }) => {
    if (!riderId) return;
    socket.join(`rider:${riderId}`);
    socket.riderId = riderId;
    console.log(`Rider joined room: rider:${riderId}`);

    if (!activeRiderLocations.has(riderId)) {
      activeRiderLocations.set(riderId, {
        status: "active",
        lastUpdate: new Date(),
      });
    }
  });

  // Admin joins dashboard
  socket.on("joinAdmin", () => {
    socket.join("admin-dashboard");
    adminRooms.add(socket.id);
    console.log(`Admin joined: ${socket.id}`);

    const allRiders = Array.from(activeRiderLocations.entries()).map(
      ([id, data]) => ({
        riderId: id,
        ...data,
      }),
    );
    socket.emit("allActiveRiders", allRiders);
  });

  socket.on("joinCustomer", ({ customerId }) => {
    if (!customerId) return;
    socketService.registerUser(customerId, socket);
    socket.customerId = customerId;
  });

  socket.on("joinOrder", ({ orderId }) => {
    if (!orderId) return;
    socket.join(`order:${orderId}`);
    socket.orderId = orderId;
    console.log(`Socket joined order room: order:${orderId}`);
  });

  socket.on("disconnect", () => {
    if (socket.customerId) socketService.removeUser(socket.customerId);
  });

  socket.on("riderLocationUpdate", async (data) => {
    const { riderId, location, speed, bearing, batteryLevel, taskTracking } = data;
    if (!riderId || !location) {
      console.log("Invalid location update:", data);
      return;
    }

    const locationData = {
      location: { type: "Point", coordinates: [location.lng, location.lat] },
      lat: location.lat,
      lng: location.lng,
      speed: speed || 0,
      bearing: bearing || 0,
      batteryLevel: batteryLevel || 100,
      lastUpdate: new Date(),
      status: "active",
    };

    // Update in-memory store
    activeRiderLocations.set(riderId, locationData);

    let user = null;
    try {
      user = await User.findById(riderId).select("name phone");

      await RiderLocation.findOneAndUpdate(
        { riderId },
        {
          $set: {
            name: user?.name || "Unknown Rider",
            phone: user?.phone || "N/A",
            location: locationData.location,
            speed: locationData.speed,
            bearing: locationData.bearing,
            batteryLevel: locationData.batteryLevel,
            status: "active",
            lastUpdate: locationData.lastUpdate,
          },
        },
        { upsert: true, new: true },
      );

      await upsertTaskTrackingFromLocation({
        riderId,
        lat: location.lat,
        lng: location.lng,
        speed,
        bearing,
        batteryLevel,
        taskTracking,
      });

      console.log(
        `📍 Updated rider ${riderId}, location = ${locationData.lat}, ${locationData.lng}`,
      );
    } catch (error) {
      console.error("Error saving rider location:", error);
    }

    // Broadcast to admin dashboard sockets
    socketService.emitToAdmin("riderLocationUpdate", {
      riderId,
      ...locationData,
      name: user?.name || "Unknown Rider",
      phone: user?.phone || "N/A",
      taskTracking,
    });
  });

  socket.on("taskNavigationStarted", async (data) => {
    try {
      await startTaskTrackingLeg(data);
      socketService.emitToAdmin("taskNavigationStarted", data);
    } catch (error) {
      console.error("Error starting task tracking leg:", error);
    }
  });

  socket.on("taskNavigationEnded", async (data) => {
    try {
      const trackingLeg = await completeTaskTrackingLeg(data);
      socketService.emitToAdmin("taskNavigationEnded", {
        ...data,
        trackingLeg,
      });
    } catch (error) {
      console.error("Error ending task tracking leg:", error);
    }
  });

  // Update status (active/idle/offline/etc.)
  socket.on("riderStatusUpdate", async ({ riderId, status, lastUpdate }) => {
    if (!riderId || !status) return;
    const riderData = activeRiderLocations.get(riderId);
    if (riderData) {
      riderData.status = status;
      riderData.lastUpdate = new Date(lastUpdate || Date.now());
      activeRiderLocations.set(riderId, riderData);
    } else {
      activeRiderLocations.set(riderId, {
        status,
        lastUpdate: new Date(lastUpdate || Date.now()),
      });
    }
    try {
      const user = await User.findById(riderId).select("name phone");
      const lastLocation = await RiderLocation.findOne({ riderId })
        .sort({ lastUpdate: -1 })
        .select("location speed bearing batteryLevel")
        .lean();
      await RiderLocation.findOneAndUpdate(
        { riderId },
        {
          $set: {
            riderId,
            name: user?.name || "Unknown Rider",
            phone: user?.phone || "N/A",
            location: lastLocation?.location || {
              type: "Point",
              coordinates: [0, 0],
            },
            speed: lastLocation?.speed || 0,
            bearing: lastLocation?.bearing || 0,
            batteryLevel: lastLocation?.batteryLevel || 100,
            status: status,
            lastUpdate: new Date(),
          },
        },
        { upsert: true, new: true },
      );

      console.log(`📝 Updated rider ${riderId} status to ${status} in MongoDB`);
    } catch (error) {
      console.error("❌ Error updating rider status in MongoDB:", error);
    }
    socketService.emitToAdmin("riderStatusUpdate", {
      riderId,
      status,
      lastUpdate: new Date(),
    });
  });

  // Admin asks for specific rider location
  socket.on("getRiderLocation", async ({ riderId }) => {
    const locationData = activeRiderLocations.get(riderId);
    if (locationData) {
      socket.emit("riderLocation", { riderId, ...locationData });
      return;
    }

    try {
      const latestLocation = await RiderLocation.findOne({ riderId })
        .sort({ lastUpdate: -1 })
        .limit(1);
      if (latestLocation) {
        socket.emit("riderLocation", {
          riderId,
          lat: latestLocation.location.coordinates[1],
          lng: latestLocation.location.coordinates[0],
          lastUpdate: latestLocation.lastUpdate,
          status: "offline", // offline because not present in active map
        });
      } else {
        socket.emit("riderLocation", { riderId, message: "No location found" });
      }
    } catch (error) {
      console.error("Error fetching rider location:", error);
    }
  });

  // =============================
  // CHAT SOCKET EVENTS
  // =============================
  
  
});

io.on("connection", (socket) => {

    console.log(
        "SOCKET CONNECTED:",
        socket.id
    );

    // =========================
    // JOIN ROOM
    // =========================

    socket.on(

        "joinChatRoom",

        (roomId) => {

            socket.join(roomId);

            console.log(
                "JOINED ROOM:",
                roomId
            );
        }
    );

    // =========================
    // SEND MESSAGE
    // =========================

// socket.on("sendChatMessage", async (data) => {
//     try {
//         console.log("MESSAGE RECEIVED:", data);

//         let unreadCount = await Message.countDocuments({
//            senderType: { $ne: "admin" }, 
//     isRead: false            
// });

//         // 1. Save the new message
//         const newMessage = await Message.create({
//             roomId: data.roomId,
//             senderType: data.senderType,
//             senderId: data.senderId,
//             message: data.message
//         });

//         // 2. Find the chat room
//         const chatRoom = await ChatRoom.findById(data.roomId);
//         if (!chatRoom) {
//             throw new Error("Chat room not found");
//         }

//         // 3. Update fields and unread counts manually
//         chatRoom.lastMessage = data.message;
//         chatRoom.lastMessageAt = new Date();
//         chatRoom.lastMessageSender = data.senderType;

//         if (data.senderType !== 'admin') {
//             // Non-admin → increment admin unread count
//             chatRoom.unreadAdminCount = (chatRoom.unreadAdminCount || 0) + 1;

//             unreadCount = unreadCount + 1
//         } else {
//             // Admin reply → increment customer unread count and reset admin count
//             chatRoom.unreadCustomerCount = (chatRoom.unreadCustomerCount || 0) + 1;
//             chatRoom.unreadAdminCount = 0;   // admin has seen the chat
//         }

//         // 4. Save the updated room
//         await chatRoom.save();

//         console.log("UPDATED ROOM:", chatRoom); // verify counts

//         console.log("MESSAGE SAVED:", newMessage._id);

//         // 5. Emit to the specific room
//         io.to(data.roomId.toString()).emit("receiveChatMessage", newMessage);
//         console.log("MESSAGE EMITTED TO ROOM:", data.roomId);

//         // 6. Notify all clients
//         io.emit("chatRoomsUpdated");
//         io.emit("sendMessageUnreadCount",{
//           unreadCount
//         })

//     } catch (error) {
//         console.log("SOCKET ERROR:", error);
//     }
// });


// adding changes for image upload in the chat 24 june 2026
socket.on("sendChatMessage", async (data) => {
    try {
        console.log("MESSAGE RECEIVED:", data);

        // Extract new fields with defaults
        const { 
            roomId, 
            senderType, 
            senderId, 
            message = '', 
            messageType = 'text', 
            fileUrl = null 
        } = data;

        // 1. Save the new message (including messageType and fileUrl)
        const newMessage = await Message.create({
            roomId,
            senderType,
            senderId,
            message,                // caption (if any)
            messageType,            // 'text' | 'image' | 'file'
            fileUrl                 // S3 URL (if any)
        });

        // 2. Find the chat room
        const chatRoom = await ChatRoom.findById(roomId);
        if (!chatRoom) {
            throw new Error("Chat room not found");
        }

        // 3. Determine lastMessage preview text
        let lastMessageText = message;
        if (messageType === 'image' && !message.trim()) {
            // If it's an image with no caption, use a placeholder
            lastMessageText = 'Image';
        } else if (messageType === 'file' && !message.trim()) {
            lastMessageText = 'File';
        }
        // If there is a caption, we keep it as is

        // 4. Update room fields
        chatRoom.lastMessage = lastMessageText;
        chatRoom.lastMessageAt = new Date();
        chatRoom.lastMessageSender = senderType;

        // 5. Update unread counts (same logic as before)
        if (senderType !== 'admin') {
          console.log("i am called in the if")
            // Non-admin (customer/bot) → increment admin unread count
      chatRoom.unreadAdminCount = (chatRoom.unreadAdminCount || 0) + 1;
        } else {
            // Admin reply → increment customer unread count and reset admin count
            chatRoom.unreadCustomerCount = (chatRoom.unreadCustomerCount || 0) + 1;
            chatRoom.unreadAdminCount = 0;  

            console.log("i am called--->>",chatRoom?.appCustomerId)
                        try {
               const fcm = await customerFcmService.sendToCustomer(
                              String(chatRoom.appCustomerId),
                              {
                                  title: "New Support Message",
                                  body: message,
                              },
                              {
                                  roomId: roomId.toString(),
                                  type: "chat",
                                  senderId: senderId ? senderId.toString() : "admin",
                              }
                          );

            console.log("i am calledddd in fcm 1===>>>",fcm)
            } catch (error) {
              console.log("this is the error by fcm==>>",error)
            }// admin has seen the chat
        }

        // 6. Save the updated room
        await chatRoom.save();

        console.log("UPDATED ROOM:", chatRoom);
        console.log("MESSAGE SAVED:", newMessage._id);

        // 7. Emit to the specific room
        io.to(roomId.toString()).emit("receiveChatMessage", newMessage);
        console.log("MESSAGE EMITTED TO ROOM:", roomId);

        // 8. Notify all clients about room list update and unread count
        io.emit("chatRoomsUpdated");

        // (Optional) You may want to compute total unread count for admin dashboard
        // Recalculate unread count across all rooms (if needed)
        const totalUnread = await Message.countDocuments({
            senderType: { $ne: "admin" },
            isRead: false
        });
        io.emit("sendMessageUnreadCount", { unreadCount: totalUnread });

    } catch (error) {
        console.log("SOCKET ERROR:", error);
    }
});


    socket.on("disconnect", () => {

        console.log(
            "SOCKET DISCONNECTED:",
            socket.id
        );
    });

    socket.on("joinGroup", (groupId) => {
        socket.join(`group_${groupId}`);
        console.log(`Socket joined group: ${groupId}`);
    });

    socket.on("sendGroupMessage", async (data) => {
        const { groupId, senderId, senderType, senderName, message } = data;
        const newMessage = await RiderGroupMessage.create({ groupId, senderId, senderType, senderName, message });
        await RiderGroup.findByIdAndUpdate(groupId, { lastMessage: message, lastMessageAt: new Date() });
        io.to(`group_${groupId}`).emit("receiveGroupMessage", newMessage);
    });

    // Typing indicator – user started typing
  socket.on("typing", (data) => {
    console.log("📝 typing event received", data);
    socket.to(data.roomId).emit("userTyping", { userId: data.userId, userName: data.userName });
  });
  socket.on("stopTyping", (roomId) => {
    console.log("🛑 stopTyping received", roomId);
    socket.to(roomId).emit("userStoppedTyping");
  });
});


let isRunning = false;

setInterval(async () => {
  if (isRunning) return;

  try {
    isRunning = true;
    await cleanupExpiredCoupons();
  } catch (err) {
    console.error("Coupon cleanup error:", err);
  } finally {
    isRunning = false;
  }
}, 30000);


// Schedule Google Play Store downloads sync (Runs every 12 hours)
setInterval(async () => {
  try {
    await syncPlayStoreDownloads();
  } catch (err) {
    console.error("Google Play sync interval error:", err);
  }
}, 12 * 60 * 60 * 1000);

// Run once immediately on startup after a small delay (10 seconds to allow DB to connect)
setTimeout(async () => {
  try {
    await syncPlayStoreDownloads();
  } catch (err) {
    console.error("Google Play initial sync error:", err);
  }
}, 10000);

// ── iOS: App Store Connect downloads sync (every 12 hours) ─────────────────
setInterval(async () => {
  try {
    await syncAppStoreDownloads();
  } catch (err) {
    console.error("App Store sync interval error:", err);
  }
}, 12 * 60 * 60 * 1000);

// Run once on startup (15s delay — slightly after Android to avoid rate limits)
setTimeout(async () => {
  try {
    await syncAppStoreDownloads();
  } catch (err) {
    console.error("App Store initial sync error:", err);
  }
}, 15000);


// Periodic cleanup: mark riders offline if no update for 2 minutes
setInterval(async () => {
  const now = new Date();
  const FIVE_MINUTES = 5 * 60 * 1000;

  for (const [riderId, data] of activeRiderLocations.entries()) {
    if (now - data.lastUpdate > FIVE_MINUTES && data.status === "active") {
      data.status = "idle";
      data.lastUpdate = now;
      activeRiderLocations.set(riderId, data);
      try {
        const user = await User.findById(riderId).select("name phone");
        const lastLocation = await RiderLocation.findOne({ riderId })
          .sort({ lastUpdate: -1 })
          .lean();

        await RiderLocation.findOneAndUpdate(
          { riderId },
          {
            $set: {
              riderId,
              name: user?.name || "Unknown Rider",
              phone: user?.phone || "N/A",
              location: lastLocation?.location || {
                type: "Point",
                coordinates: [0, 0],
              },
              status: "idle",
              lastUpdate: now,
            },
          },
          { upsert: true },
        );
        console.log(
          `🟡 Rider ${riderId} marked as IDLE (no updates for 5 min)`,
        );
      } catch (error) {
        console.error("Error updating idle status in DB:", error);
      }

      socketService.emitToAdmin("riderStatusUpdate", {
        riderId,
        status: "idle",
        lastUpdate: now,
      });
    }
  }
}, 60 * 1000);

app.use("/api/v1/debug", debugRoutes);
app.use("/api/v1/rider/push-tokens", pushTokenRoutes);
app.use("/api/v1/trips", tripRoutes);
app.use("/api/v1", customerRoutes);
app.use("/api/app", customerAppRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/rider", riderRoutes);
app.use("/api/v1/location", riderLocationRoutes);
app.use("/api/v1/plant", plantRoutes);
app.use("/api/v1", revenueRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/qr", qrRoutes);
app.use("/api/v1/osrm", osrmRoutes);
app.use("/api/v1/admincoupons", adminCoupons);
app.use("/api/v1/customercoupons", customerCoupons);
app.use("/api/v1/slots", slotRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/customer/notifications", customerNotificationRoutes);
app.use("/api/v1/customer/push-tokens", customerPushTokenRoutes);
app.use('/api/v1/bookings',slotBookingRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/faq", faqRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/rider-group", riderGroupRoutes);


// Add this test route
app.get('/test-fcm-ios', async (req, res) => {
  try {
    const iosToken = req.query.token; // Pass iOS token as query param
    if (!iosToken) {
      return res.status(400).json({ error: 'Provide iOS token: ?token=YOUR_IOS_TOKEN' });
    }
    
    const result = await customerFcmService.sendToCustomer(
      'test-customer-id',
      { title: 'Test', body: 'iOS test notification' },
      { test: 'true' }
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    message: err.message ?? "Internal Server error",
  });
});

server.listen(process.env.PORT || 5002, () => {
  console.log(`Server is running on port: ${process.env.PORT}`);
});
