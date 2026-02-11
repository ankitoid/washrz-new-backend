import express from "express";
import "dotenv/config";
import "./database.js";
import authRoutes from "./routes/authRoutes.js";
import riderRoutes from "./routes/riderRoutes.js";
import plantRoutes from "./routes/plantRoutes.js";
import customerAppRoutes from "./routes/customerAppRoutes.js"
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
import fcmService from "./services/fcmService.js";
import debugRoutes from "./routes/debugRoutes.js";

const app = express();
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
    ],
    methods: "GET, POST, PUT, DELETE, PATCH",
    credentials: true, // Allow credentials (cookies) to be sent with the request
  })
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
      "*"
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

const addAppToRequest = (app) => {
  return (req, res, next) => {
    req.app = app; // Add the app  to the request
    next();
  };
};

const addSocketToRequest = (io) => {
  return (req, res, next) => {
    req.socket = io; // Add the socket object to the request
    next();
  };
};

// NOTE: Body parser should be registered early so routes can use req.body
app.use(express.json({ limit: "100mb" }));

// Attach io to requests early if any route/middleware needs req.socket
app.use(addSocketToRequest(io));

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

app.use(express.json({ limit: '100mb' }));
app.use(addSocketToRequest(io));
app.post("/send", (req, res) => {
  const message = req.body.message;
  // console.log("testing", req.body.message);

  io.emit("pushNotification", {
    message,
  });
  res.status(200).send({
    message: "Sent Successfully",
  });

  io.on("connection", (socket) => {
    // console.log("Connected");
    socket.on("disconnect", () => {
      // console.log("Client disconnected");
    });
  });
});

// In-memory fast-access store for active riders
const activeRiderLocations = new Map();
io.sockets.activeRiderLocations = activeRiderLocations;
const adminRooms = new Set();

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
        lastUpdate: new Date()
      });
    }
  });

  // Admin joins dashboard
  socket.on("joinAdmin", () => {
    socket.join("admin-dashboard");
    adminRooms.add(socket.id);
    console.log(`Admin joined: ${socket.id}`);

    const allRiders = Array.from(activeRiderLocations.entries()).map(([id, data]) => ({
      riderId: id,
      ...data,
    }));
    socket.emit("allActiveRiders", allRiders);
  });

  socket.on("riderLocationUpdate", async (data) => {
    const { riderId, location, speed, bearing, batteryLevel } = data;
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
          }
        },
        { upsert: true, new: true }
      );

      console.log(`📍 Updated rider ${riderId}, location = ${locationData.lat}, ${locationData.lng}`);
    } catch (error) {
      console.error("Error saving rider location:", error);
    }

    // Broadcast to admin dashboard sockets
    io.to("admin-dashboard").emit("riderLocationUpdate", {
      riderId,
      ...locationData,
      name: user?.name || "Unknown Rider",
      phone: user?.phone || "N/A",
    });
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
              coordinates: [0, 0]
            },
            speed: lastLocation?.speed || 0,
            bearing: lastLocation?.bearing || 0,
            batteryLevel: lastLocation?.batteryLevel || 100,
            status: status,
            lastUpdate: new Date(),
          }
        },
        { upsert: true, new: true }
      );

      console.log(`📝 Updated rider ${riderId} status to ${status} in MongoDB`);
    } catch (error) {
      console.error("❌ Error updating rider status in MongoDB:", error);
    }
    io.to("admin-dashboard").emit("riderStatusUpdate", {
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
      const latestLocation = await RiderLocation.findOne({ riderId }).sort({ lastUpdate: -1 }).limit(1);
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

  socket.on("disconnect", () => {
    // console.log("Client disconnected:", socket.id);
  });
});

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
                coordinates: [0, 0]
              },
              status: "idle",
              lastUpdate: now,
            }
          },
          { upsert: true }
        );
        console.log(`🟡 Rider ${riderId} marked as IDLE (no updates for 5 min)`);
      } catch (error) {
        console.error("Error updating idle status in DB:", error);
      }

      io.to("admin-dashboard").emit("riderStatusUpdate", {
        riderId,
        status: "idle",
        lastUpdate: now,
      });
    }
  }
}, 60 * 1000);

app.post("/api/v1/test-fcm", async (req, res) => {
  try {
    const { riderId, title = "Test Notification", body = "This is a test notification" } = req.body;

    if (!riderId) {
      return res.status(400).json({ error: "riderId is required" });
    }

    const result = await fcmService.sendToRider(
      riderId,
      { title, body },
      { type: "test", timestamp: new Date().toISOString() }
    );

    res.json({
      message: "FCM test sent",
      result
    });
  } catch (error) {
    console.error("Test FCM error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Test FCM connection
app.get("/api/v1/fcm-status", async (req, res) => {
  try {
    const status = await fcmService.testConnection();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/v1/fcm-status", async (req, res) => {
  try {
    const status = await fcmService.testConnection();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test send notification
app.post("/api/v1/test-fcm", async (req, res) => {
  try {
    const { riderId, title = "Test Notification", body = "This is a test notification" } = req.body;

    if (!riderId) {
      return res.status(400).json({
        error: "riderId is required",
        hint: "Get rider ID from /api/v1/debug/riders-with-tokens"
      });
    }

    // Validate riderId format
    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({
        error: "Invalid riderId format. Must be a valid MongoDB ObjectId"
      });
    }

    const result = await fcmService.sendToRider(
      riderId,
      { title, body },
      {
        type: "test",
        timestamp: new Date().toISOString(),
        test: "true"
      }
    );

    res.json({
      message: "FCM test completed",
      riderId,
      result
    });
  } catch (error) {
    console.error("Test FCM error:", error);
    res.status(500).json({ error: error.message });
  }
});



app.use("/api/v1/debug", debugRoutes);
app.use("/api/v1/rider/push-tokens", pushTokenRoutes);
app.use("/api/v1/trips", tripRoutes);
app.use("/api/v1", customerRoutes);
app.use("/api/app",customerAppRoutes)
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/rider", riderRoutes);
app.use("/api/v1/location", riderLocationRoutes);
app.use("/api/v1/plant", plantRoutes);
app.use("/api/v1", revenueRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/qr', qrRoutes);
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
