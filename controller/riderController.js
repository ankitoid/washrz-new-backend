import express from "express";
import AWS from "aws-sdk";
import multer from "multer";
import cron from "node-cron";
import Pickup from "../models/pickupSchema.js";
import Order from "../models/orderSchema.js";
import catchAsync from "../utills/catchAsync.js";
import User from "../models/userModel.js";
import pickup from "../models/pickupSchema.js";
import APIFeatures from "../utills/apiFeatures.js";
import customerFcmService from "../services/customerFcmService.js";
import { createCustomerNotification } from "./customerNotificationController.js";
import CatalogItem from "../models/catalogItemSchema.js";
import slotBookingSchema from "../models/slotBookingSchema.js";
import { assignPickupToRider } from "../services/pickupAssignmentService.js";

// upload audio and voice
// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  region: process.env.AWS_S3_REGION,
});

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fieldSize: 100 * 1024 * 1024 },
}).any();

// Function to upload files to S3
const uploadToS3 = (file, bucketName, folder = "intransiteOrderImage") => {
  const params = {
    Bucket: bucketName,
    Key: `${folder}/${Date.now()}_${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  };
  return s3.upload(params).promise();
};

const ADDRESS_KEYS = ["addressLine1", "landmark", "city", "state", "pincode"];

const buildFullAddress = (address = {}) =>
  ADDRESS_KEYS.filter((key) => address?.[key])
    .map((key) => address[key])
    .join(" ");

const fetchCustomerAddresses = async (appCustomerId) => {
  const addrRes = await fetch(
    `https://customer.shiptos.com/v1/addresses?customerid=${appCustomerId}`,
  );

  if (!addrRes.ok) {
    throw new Error("Failed to fetch customer addresses");
  }

  const addrData = await addrRes.json();
  return Array.isArray(addrData?.results) ? addrData.results : [];
};

const buildLocation = (address, fallback) => {
  if (address?.latitude != null && address?.longitude != null) {
    return {
      latitude: address.latitude,
      longitude: address.longitude,
    };
  }

  if (fallback?.latitude != null && fallback?.longitude != null) {
    return {
      latitude: fallback.latitude,
      longitude: fallback.longitude,
    };
  }

  return undefined;
};

const createItemStatusHistory = (status) => ({
  intransit: status === "intransit" ? new Date() : null,
  processing: status === "processing" ? new Date() : null,
  reprocessing: status === "reprocessing" ? new Date() : null,
  readyForDelivery: status === "ready for delivery" ? new Date() : null,
  deliveryriderassigned:
    status === "delivery rider assigned" ? new Date() : null,
  delivered: status === "delivered" ? new Date() : null,
  cancelled: status === "cancelled" ? new Date() : null,
});

const groupFilesByFieldname = (files = []) =>
  files.reduce((acc, file) => {
    if (!acc[file.fieldname]) {
      acc[file.fieldname] = [];
    }
    acc[file.fieldname].push(file);
    return acc;
  }, {});

const extractScopedFiles = (groupedFiles, prefix) => {
  const scopedFiles = new Map();

  Object.entries(groupedFiles).forEach(([fieldname, files]) => {
    if (fieldname === prefix) {
      scopedFiles.set("default", files);
      return;
    }

    const bracketPrefix = `${prefix}[`;
    const dotPrefix = `${prefix}.`;
    const colonPrefix = `${prefix}:`;

    let scopeKey = null;

    if (fieldname.startsWith(bracketPrefix) && fieldname.endsWith("]")) {
      scopeKey = fieldname.slice(bracketPrefix.length, -1);
    } else if (fieldname.startsWith(dotPrefix)) {
      scopeKey = fieldname.slice(dotPrefix.length);
    } else if (fieldname.startsWith(colonPrefix)) {
      scopeKey = fieldname.slice(colonPrefix.length);
    }

    if (scopeKey) {
      scopedFiles.set(scopeKey, files);
    }
  });

  return scopedFiles;
};

const getItemScopeKey = (item, index) =>
  String(item.clientKey || item.scopeKey || item.tempId || item.itemKey || index);

const buildOrderLineItems = ({
  orderId,
  pickupItems,
  catalogItems,
  itemImageUrlsByScopeKey,
  splitByQuantity = false,
}) => {
  const skuCounters = new Map();

  return pickupItems.flatMap((reqItem, reqIndex) => {
    const catalogItem = catalogItems.find(
      (ci) => ci._id.toString() === String(reqItem.itemId),
    );

    if (!catalogItem) return [];

    const quantity = Math.max(1, Number(reqItem.quantity || 1));
    const entryCount = splitByQuantity ? quantity : 1;
    const skuBase = String(catalogItem.sku || catalogItem.sacid || catalogItem._id)
      .trim()
      .replace(/\s+/g, "-")
      .toUpperCase();
    const scopeKey = getItemScopeKey(reqItem, reqIndex);
    const itemImageUrls = itemImageUrlsByScopeKey.get(scopeKey) || [];

    return Array.from({ length: entryCount }, () => {
      const nextSkuCount = (skuCounters.get(skuBase) || 0) + 1;
      skuCounters.set(skuBase, nextSkuCount);

      return {
        lineId: `${skuBase}-${nextSkuCount}`,
        itemId: catalogItem._id,
        label: catalogItem.label,
        price: catalogItem.price,
        unit: catalogItem.unit,
        intransitImages: [...itemImageUrls],
        readyForDeliveryImages: [],
        status: "intransit",
        statusHistory: createItemStatusHistory("intransit"),
      };
    });
  });
};

export const uploadFiles = (req, res, next) => {
  upload(req, res, async (err) => {
    console.log("this is the err:: ", err);
    if (err) {
      return res.status(400).json({ message: "Error uploading files.", err });
    }

    console.log("req.files?", req.files);
    const groupedFiles = groupFilesByFieldname(req.files || []);
    const sharedImages = groupedFiles.image || [];
    const voice = groupedFiles.voice || [];
    const itemImageFilesByScopeKey = extractScopedFiles(groupedFiles, "itemImages");
    const { id } = req.params; // ✅ this is pickupId
    const location = req.body?.location || null;
    const items = req.body.items;
//  Format:
//  [
//    { "itemId": "catalogItemId", "quantity": 2 },
//    { "itemId": "catalogItemId2", "quantity": 1 }
//  ]

//  NOTE:
//  * - :id in URL = pickupId
//  * - All customer + address data comes from Pickup DB
//  * - Items are validated against Catalog
//  * - Total price is auto-calculated

//two type data send karana padega

// formadata
// and body { "itemId": "catalogItemId", "quantity": 2 }, jaise app me bhej rhe ho


  console.log("Received items data:", items);
    console.log("Received itemImages data:", [...itemImageFilesByScopeKey.keys()]);
    console.log("Received id data:", id);
    



    if (!id || !items) {
      return res.status(400).json({
        message: "pickupId (in params) and items are required.",
      });
    }

    try {
      const parsedItems =
        typeof items === "string" ? JSON.parse(items) : items;

      // -------------------------
      // Fetch pickup using id
      // -------------------------
      const pickup_details = await Pickup.findById(id);

      console.log("Fetched pickup details:", pickup_details);

      if (!pickup_details) {
        return res.status(404).json({ message: "Pickup not found" });
      }

      // -------------------------
      // Use data from pickup
      // -------------------------
      const contactNo = pickup_details.Contact;
      const customerName = pickup_details.Name;
      const plantName = pickup_details.plantName;
      const morning_delivery = pickup_details.morning_delivery || false;
      const cust_notes = pickup_details.note || "";

      let address = pickup_details.Address;

      if (
        pickup_details?.appCustomerId ||
        pickup_details?.platform_type === "app"
      ) {
        address = pickup_details.deliveryAddress;
      }

      let parsedLocation = {
        latitude: pickup_details?.deliveryLocation?.latitude,
        longitude: pickup_details?.deliveryLocation?.longitude,
      };

      if (location) {
        parsedLocation =
          typeof location === "string" ? JSON.parse(location) : location;
      }

      // -------------------------
      // Validate + map items
      // -------------------------
      if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
        return res.status(400).json({ message: "Items are required" });
      }

      const hasExplicitScopeKeys = parsedItems.some(
        (item) =>
          item?.clientKey ||
          item?.scopeKey ||
          item?.tempId ||
          item?.itemKey,
      );

      const normalizedItems = parsedItems.map((item, index) => ({
        ...item,
        quantity: hasExplicitScopeKeys
          ? 1
          : Math.max(1, Number(item.quantity || 1)),
        scopeKey: getItemScopeKey(item, index),
      }));

      const canUseDefaultItemImages = normalizedItems.length === 1;
      const canUseSharedLegacyImages = sharedImages.length > 0;

      const missingImagesForItems = normalizedItems.filter((item) => {
        const scopedFiles =
          itemImageFilesByScopeKey.get(item.scopeKey) ||
          (canUseDefaultItemImages
            ? itemImageFilesByScopeKey.get("default") || []
            : []);
        const fallbackFiles = scopedFiles.length
          ? scopedFiles
          : canUseSharedLegacyImages
            ? sharedImages
            : [];
        return fallbackFiles.length === 0;
      });

      if (missingImagesForItems.length > 0) {
        return res.status(400).json({
          message: "Each item must include at least one image.",
          missingItemScopes: missingImagesForItems.map((item) => item.scopeKey),
        });
      }

      const itemIds = normalizedItems.map((i) => i.itemId);

      const catalogItems = await CatalogItem.find({
        _id: { $in: itemIds },
        isActive: true,
      });

      const finalPickupItems = normalizedItems.map((reqItem) => {
        const catalogItem = catalogItems.find(
          (ci) => ci._id.toString() === reqItem.itemId,
        );

        if (!catalogItem) {
          throw new Error(`Catalog item not found for itemId ${reqItem.itemId}`);
        }

        return {
          itemId: catalogItem._id,
          label: catalogItem.label,
          price: catalogItem.price,
          unit: catalogItem.unit,
          quantity: reqItem.quantity,
        };
      });

      // -------------------------
      // Calculate price
      // -------------------------
      const totalPrice = finalPickupItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      // -------------------------
      // Update Pickup (items + total)
      // -------------------------
      await Pickup.findByIdAndUpdate(id, {
        items: finalPickupItems,
        totalAmount: totalPrice,
      });

      // -------------------------
      // Upload item images and optional voice
      // -------------------------
      const itemImageUrlsByScopeKey = new Map();

      for (const reqItem of normalizedItems) {
        const scopedItemFiles =
          itemImageFilesByScopeKey.get(reqItem.scopeKey) ||
          (canUseDefaultItemImages
            ? itemImageFilesByScopeKey.get("default") || []
            : []) ||
          [];
        const itemFiles =
          scopedItemFiles.length > 0 ? scopedItemFiles : sharedImages;

        const uploads = await Promise.all(
          itemFiles.map((img) =>
            uploadToS3(img, process.env.AWS_S3_BUCKET_NAME),
          ),
        );

        itemImageUrlsByScopeKey.set(
          reqItem.scopeKey,
          uploads.map((uploadData) => uploadData.Location),
        );
      }

      let voiceUpload = null;
      if (voice.length > 0) {
        voiceUpload = await uploadToS3(
          voice[0],
          process.env.AWS_S3_BUCKET_NAME,
          "intransiteOrderVoice"
        );
      }

      const latestOrder = await Order.find().sort({ _id: -1 }).limit(1);
      let order_id = "WZ1001";
      if (latestOrder.length > 0) {
        order_id = `WZ${Number(latestOrder[0].order_id.split("WZ")[1]) + 1}`;
      }

      const orderLineItems = buildOrderLineItems({
        orderId: order_id,
        pickupItems: normalizedItems,
        catalogItems,
        itemImageUrlsByScopeKey,
        splitByQuantity: !hasExplicitScopeKeys,
      });
      
      const statusHistory = {
        intransit: new Date(),
        processing: null,
        reprocessing: null,
        readyForDelivery: null,
        deliveryriderassigned: null,
        delivered: null,
        cancelled: null,
      };

      // -------------------------
      // Create Order
      // -------------------------
      const order_details = await Order.create({
        contactNo,
        customerName,
        address,
        appCustomerId: pickup_details?.appCustomerId || null,
        tempPickupAdresssId: pickup_details?.tempPickupAdresssId || null,
        tempDeliveryAddressId: pickup_details?.tempDeliveryAddressId || null,
        platform_type: pickup_details?.platform_type || "wati",
        items: orderLineItems,
        price: totalPrice,
        order_id,
        status: "intransit",
        intransitVoice: voiceUpload?.Location || null,
        plantName,
        orderLocation: parsedLocation,
        statusHistory,
        assignedRider: {
          pickup: pickup_details?.assignedRider?.pickup
            ? {
                riderId: pickup_details.assignedRider.pickup.riderId,
                riderName: pickup_details.assignedRider.pickup.riderName,
                assignedAt: pickup_details.assignedRider.pickup.assignedAt,
              }
            : null,
          delivery: null,
        },
        morningDelivery: morning_delivery,
        notes : cust_notes,
      });

      // -------------------------
      // Mark pickup complete
      // -------------------------
      await Pickup.findByIdAndUpdate(id, { PickupStatus: "complete", orderId: order_details._id });

      const customerId = pickup_details?.appCustomerId
        ? String(pickup_details.appCustomerId)
        : null;

      if (customerId) {
        await createCustomerNotification({
          customerId,
          title: "Pickup Completed",
          message: "Your pickup has been completed successfully.",
          type: "pickup_Completed",
          data: {
            pickupId: String(id),
            screen: "PickupDetails",
          },
        });

        await customerFcmService.sendToCustomer(
          customerId,
          {
            title: "✅ Item's = secured",
            body: "Your laundry's escape plan is in motion. Sit tight, we'll handle the rest!",
          },
          {
            type: "pickup_Completed",
            pickupId: String(id),
            screen: "PickupDetails",
          },
        );
      }

      res.status(200).json({
        message: "Files uploaded and order created successfully.",
        items: orderLineItems,
        imageUrls: orderLineItems.flatMap((item) => item.intransitImages || []),
        voiceUrl: voiceUpload?.Location || null,
      });
    } catch (error) {
      console.error("Error uploading files or updating order:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  });
};

export const addMoreIntransitImages = catchAsync(async (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: "Error uploading files.", err });
    }

    const groupedFiles = groupFilesByFieldname(req.files || []);
    const images = groupedFiles.image || [];
    const { id } = req.params;
    const { lineId } = req.body;

    if (!id) {
      return res.status(400).json({
        message: "Order ID is required.",
      });
    }

    if (!lineId) {
      return res.status(400).json({
        message: "lineId is required.",
      });
    }

    if (!images.length) {
      return res.status(400).json({
        message: "At least one image is required.",
      });
    }

    try {
      const imageUploads = await Promise.all(
        images.map((img) => uploadToS3(img, process.env.AWS_S3_BUCKET_NAME)),
      );
      const imageUrls = imageUploads.map((uploadData) => uploadData.Location);

      const updatedOrder = await Order.findOneAndUpdate(
        { _id: id, "items.lineId": lineId },
        {
          $push: {
            "items.$.intransitImages": { $each: imageUrls },
          },
        },
        { new: true },
      );

      if (!updatedOrder) {
        return res.status(404).json({ message: "Order or line item not found." });
      }

      const updatedItem = updatedOrder.items.find((item) => item.lineId === lineId);

      return res.status(200).json({
        message: "Images added successfully.",
        addedImages: imageUrls,
        lineId,
        intransitImages: updatedItem?.intransitImages || [],
      });
    } catch (error) {
      console.error("Error adding more intransit images:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  });
});

export const uploadReadyForDeliveryImages = catchAsync(
  async (req, res, next) => {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: "Error uploading files.", err });
      }

      const groupedFiles = groupFilesByFieldname(req.files || []);
      const images = groupedFiles.image || [];
      const { id } = req.params;
      const { lineId } = req.body;

      if (!id) {
        return res.status(400).json({
          message: "Order ID is required.",
        });
      }

      if (!lineId) {
        return res.status(400).json({
          message: "lineId is required.",
        });
      }

      if (!images.length) {
        return res.status(400).json({
          message: "At least one image is required.",
        });
      }

      try {
        const imageUploads = await Promise.all(
          images.map((img) =>
            uploadToS3(
              img,
              process.env.AWS_S3_BUCKET_NAME,
              "readyForDeliveryImages",
            ),
          ),
        );

        const imageUrls = imageUploads.map((uploadData) => uploadData.Location);

        const updatedOrder = await Order.findOneAndUpdate(
          { _id: id, "items.lineId": lineId },
          {
            $push: {
              "items.$.readyForDeliveryImages": { $each: imageUrls },
            },
          },
          { new: true },
        );

        if (!updatedOrder) {
          return res.status(404).json({ message: "Order or line item not found." });
        }

        const updatedItem = updatedOrder.items.find((item) => item.lineId === lineId);

        return res.status(200).json({
          message: "Ready for delivery images uploaded successfully.",
          addedImages: imageUrls,
          lineId,
          readyForDeliveryImages: updatedItem?.readyForDeliveryImages || [],
        });
      } catch (error) {
        console.error("Error uploading ready for delivery images:", error);
        return res.status(500).json({ message: "Internal server error." });
      }
    });
  },
);

// Reschedule Pickup Controller
export const reschedulePickup = async (req, res) => {
  const { id } = req.params;
  const { newDate,slot } = req.body;
  try {
    const pickup = await Pickup.findById(id);
    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    if(slot){
      if(pickup.bookingId){
        await slotBookingSchema.findOneAndUpdate(
          { bookingId: pickup.bookingId },
          { slotTime: slot,
            date: newDate,
          }
        );
      }
    }

    // Update the rescheduled date and mark as rescheduled
    pickup.rescheduledDate = newDate;
    pickup.pickup_date = newDate;
    pickup.PickupStatus = "pending";
    // pickup.isRescheduled = true;
    pickup.type = "reschdule";
    await pickup.save();

    if (pickup.appCustomerId) {
      await createCustomerNotification({
        customerId: pickup.appCustomerId,
        title: "Pickup Updated",
        message: "Your pickup timing has been updated.",
        type: "pickup_Rescheduled",
        data: {
          pickupId: pickup._id,
        },
      });

      await customerFcmService.sendToCustomer(
        String(pickup.appCustomerId),
        {
          title: "Plans changed 👀",
          body: "Your pickup’s been rescheduled. Sit back, we’ve got it.",
        },
        {
          type: "pickup_Rescheduled",
          pickupId: String(pickup._id),
          screen: "PickupDetails",
        },
      );
    }

    res.status(200).json({ message: "Pickup rescheduled successfully" });
  } catch (error) {
    console.error("Error in rescheduling:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Function to move rescheduled pickups back to live
const moveRescheduledPickups = async () => {
  try {
    const today = new Date();
    const pickupsToMove = await Pickup.find({
      rescheduledDate: { $gte: today },
      isRescheduled: true,
      type: "reschdule",
    });

    for (const pickup of pickupsToMove) {
      pickup.type = "live";
      pickup.PickupStatus = "pending";
      pickup.isRescheduled = false;
      pickup.rescheduledDate = null;
      // pickup.pickup_date = today;
      await pickup.save();
    }

    console.log("Rescheduled pickups moved back to live");
  } catch (error) {
    console.error("Error moving rescheduled pickups:", error);
  }
};

// Function to move rescheduled Orders back to ready for deliveries
const moveRescheduledOrders = async () => {
  try {
    const today = new Date();
    const ordersToMove = await Order.find({
      rescheduledDate: { $lte: today },
      isRescheduled: true,
    });

    for (const order of ordersToMove) {
      order.isRescheduled = false; // Mark as live
      order.rescheduledDate = null; // Clear the rescheduled date
      await order.save();
    }

    console.log("Rescheduled orders moved back to live");
  } catch (error) {
    console.error("Error moving rescheduled orders:", error);
  }
};

// Schedule a cron job to run every day at midnight
cron.schedule("0 0 * * *", () => {
  console.log("Running daily rescheduled orders check...");
  moveRescheduledPickups();
  moveRescheduledOrders();
});

// Get all rescheduled pickups
export const getRescheduledPickups = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 8;
    const email = req.query.email;

    // Check if email is provided
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find the user to get the plant name associated with the email
    const user = await User.findOne({ email });
    if (!user || !user.plant) {
      return res.status(404).json({ message: "User or Plant not found" });
    }

    // Use the user's plant name to filter rescheduled pickups
    const plantName = user.plantName || user.plant;

    // Query to find rescheduled pickups for the specific plant
    const rescheduledPickups = await Pickup.find({
      isRescheduled: true,
      type: "reschdule",
      plantName: plantName, // Filter by the user's plant name
    })
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    const total = await Pickup.countDocuments({
      isRescheduled: true,
      type: "reschdule",
      plantName: plantName, // Filter count by the user's plant name
    });

    res.status(200).json({
      data: rescheduledPickups,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching rescheduled pickups", error });
  }
};

// cencelled pickup
export const deletePickup = catchAsync(async (req, res, next) => {
  const pickupData = await Pickup.findByIdAndUpdate(req.params.id, {
    isDeleted: true,
    PickupStatus: "deleted",
    cancelledAt: new Date(),
    cancelNote : "cancelled by customer",
    cancelledBy: {
        name : "",
        role : "Customer"
      }
  });
  if (!pickupData) {
    return next(new AppError("No pickup found with that ID", 404));
  }
  if (pickupData?.bookingId) {
    await slotBookingSchema.findOneAndUpdate(
      { bookingId: pickupData.bookingId },
      { status: "cancelled" },
    );
  }

  if(req.socket)
  {
    req.socket.emitToAll("pickupCancelled", { pickupId: pickupData?._id, cancelledBy: "Customer" });

  //   req.socket.emitToAdmin("pickupDeleted", {
  //   message: "customer deleted pickup successfully",
  //   role: "Customer"
  // });
  }


  res.status(200).json({
    message: "Pickup Deleted Sucessfully",
  });
});

// Configure multer for file upload (note and optional voice)
const uploadNote = multer({
  storage: multer.memoryStorage(),
  limits: { fieldSize: 100 * 1024 * 1024 },
}).fields([
  { name: "note", maxCount: 1 }, // `note` text field
  { name: "voice", maxCount: 1 }, // `voice` is optional and can be provided from the frontend
]);

// Function to upload files to S3
const uploadNoteToS3 = (file, bucketName, folder) => {
  const params = {
    Bucket: bucketName,
    Key: `${folder}/${Date.now()}_${file.originalname}`, // Store files in the specified folder
    Body: file.buffer,
    ContentType: file.mimetype,
  };
  return s3.upload(params).promise();
};

export const uploadCancelInfo = catchAsync(async (req, res, next) => {
  uploadNote(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: "Error uploading files.", err });
    }

    const { id } = req.params;
    const { voice } = req.files;
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({ message: "Short note is required." });
    }
    if (!id) {
      return res.status(400).json({ message: "Pickup ID is required." });
    }

    try {
      let voiceUpload = null;

      if (voice && voice.length > 0) {
        voiceUpload = await uploadNoteToS3(
          voice[0],
          process.env.AWS_S3_BUCKET_NAME,
          "pickupCancelVoices",
        );
      }

      const updatedPickup = await Pickup.findByIdAndUpdate(
        id,
        {
          cancelNote: note,
          cancelVoice: voiceUpload ? voiceUpload.Location : null,
          isDeleted: true,
          PickupStatus: "deleted",
          type: "",
        },
        { new: true },
      );

      if (!updatedPickup) {
        return next(new AppError("No pickup found with that ID", 404));
      }

      res.status(200).json({
        message: "Files uploaded successfully and pickup status updated.",
        pickup: updatedPickup,
      });
    } catch (error) {
      console.error("Error uploading files or updating pickup:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  });
});

// Configure multer for file upload (image) when rider compelet order
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fieldSize: 100 * 1024 * 1024 },
}).fields([{ name: "image", maxCount: 1 }]);

export const uploadDeliverImage = catchAsync(async (req, res) => {
  uploadImage(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: "Error uploading files.", err });
    }

    const { id } = req.params; // Get pickup ID from request params
    const { image } = req.files;
    console.log(id, image);

    if (!image) {
      return res.status(400).json({
        message: "Image is required.",
      });
    }
    if (!id) {
      return res.status(400).json({
        message: "Order ID is required.",
      });
    }
    try {
      // Upload files to S3
      const imageUpload = await uploadNoteToS3(
        image[0],
        process.env.AWS_S3_BUCKET_NAME,
        "CompleteOrderImage",
      );

      // Update the pickup in the database with the note and voice URLs
      await Order.findByIdAndUpdate(id, {
        deliverImage: imageUpload.Location, // URL of the uploaded voice (if available)
      });
      res.status(200).json({
        message: "Files uploaded successfully and pickup status updated.",
      });
    } catch (error) {
      console.error("Error uploading files or updating pickup:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  });
});

export const createFollowupPickup = catchAsync(async (req, res) => {
  const { orderId } = req.params;
  const { riderId, riderName } = req.body;

  if (!riderId || !riderName) {
    return res.status(400).json({
      message: "riderId and riderName are required",
    });
  }

  const deliveredOrder = await Order.findById(orderId);

  if (!deliveredOrder) {
    return res.status(404).json({
      message: "Order not found",
    });
  }

  if (deliveredOrder.status !== "delivered") {
    return res.status(400).json({
      message: "Follow-up pickup can only be created for delivered orders",
    });
  }

  const sourcePickup = await Pickup.findOne({ orderId: deliveredOrder._id });

  const appCustomerId =
    deliveredOrder.appCustomerId || sourcePickup?.appCustomerId || null;
  const tempPickupAdresssId =
    deliveredOrder.tempPickupAdresssId || sourcePickup?.tempPickupAdresssId || null;
  const tempDeliveryAddressId =
    deliveredOrder.tempDeliveryAddressId ||
    sourcePickup?.tempDeliveryAddressId ||
    null;

  const customerName = deliveredOrder.customerName || sourcePickup?.Name;
  const contactNo = deliveredOrder.contactNo || sourcePickup?.Contact;

  if (!customerName || !contactNo) {
    return res.status(400).json({
      message: "Customer name or contact number is missing on the delivered order",
    });
  }

  let pickupAddressRecord = null;
  let deliveryAddressRecord = null;

  if (appCustomerId && (tempPickupAdresssId || tempDeliveryAddressId)) {
    const addresses = await fetchCustomerAddresses(appCustomerId);

    if (tempPickupAdresssId) {
      pickupAddressRecord =
        addresses.find((addr) => addr.id === tempPickupAdresssId) || null;
    }

    if (tempDeliveryAddressId) {
      deliveryAddressRecord =
        addresses.find((addr) => addr.id === tempDeliveryAddressId) || null;
    }
  }

  const pickupPayload = {
    Name: customerName,
    Contact: contactNo,
    plantName: sourcePickup?.plantName || deliveredOrder.plantName || "Delhi",
    type: "live",
    PickupStatus: "pending",
    pickup_date: new Date(),
    platform_type:
      appCustomerId != null
        ? "app"
        : sourcePickup?.platform_type || deliveredOrder.platform_type || "wati",
    totalAmount: 0,
    slot: "NA",
    items: [],
    isHeavy: sourcePickup?.isHeavy ?? false,
    morning_delivery: sourcePickup?.morning_delivery ?? true,
  };

  if (appCustomerId) {
    pickupPayload.appCustomerId = appCustomerId;
  }

  if (tempPickupAdresssId) {
    pickupPayload.tempPickupAdresssId = tempPickupAdresssId;
  }

  if (tempDeliveryAddressId) {
    pickupPayload.tempDeliveryAddressId = tempDeliveryAddressId;
  }

  pickupPayload.Address =
    buildFullAddress(pickupAddressRecord) ||
    sourcePickup?.Address ||
    deliveredOrder.address;

  pickupPayload.deliveryAddress =
    buildFullAddress(deliveryAddressRecord) ||
    sourcePickup?.deliveryAddress ||
    deliveredOrder.address;

  const pickupLocation = buildLocation(
    pickupAddressRecord,
    sourcePickup?.pickupLocation,
  );
  if (pickupLocation) {
    pickupPayload.pickupLocation = pickupLocation;
  }

  const deliveryLocation = buildLocation(deliveryAddressRecord, {
    latitude:
      sourcePickup?.deliveryLocation?.latitude ??
      deliveredOrder.orderLocation?.latitude,
    longitude:
      sourcePickup?.deliveryLocation?.longitude ??
      deliveredOrder.orderLocation?.longitude,
  });
  if (deliveryLocation) {
    pickupPayload.deliveryLocation = deliveryLocation;
  }

  pickupPayload.contactName =
    deliveryAddressRecord?.contactName ||
    sourcePickup?.contactName ||
    deliveredOrder.contactName ||
    null;

  pickupPayload.contactPhone =
    deliveryAddressRecord?.contactPhone ||
    sourcePickup?.contactPhone ||
    deliveredOrder.contactPhone ||
    null;

  const pickupData = await Pickup.create(pickupPayload);
  const assignedPickup = await assignPickupToRider({
    pickupId: pickupData._id,
    riderId,
    riderName,
    socket: req.socket,
  });

  req.socket.emitToAll("addPickup", assignedPickup);

  return res.status(201).json({
    message: "Follow-up pickup created and assigned successfully",
    data: assignedPickup,
  });
});

// Reschedule deliveries order Controller
export const rescheduleOrder = async (req, res) => {
  const { id } = req.params;
  const { newDate } = req.body;

  try {
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Update the rescheduled date and mark as rescheduled
    order.rescheduledDate = newDate;
    order.isRescheduled = true;
    await order.save();

    res.status(200).json({ message: "Order rescheduled successfully" });
  } catch (error) {
    console.error("Error in rescheduling order : ", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all rescheduled deliveries order
export const getRescheduledOrders = async (req, res) => {
  try {
    const { email } = req.query;

    // Fetch the plant name associated with this email
    const user = await User.findOne({ email: email });
    if (!user || !user.plant) {
      return res.status(404).json({ message: "User or Plant not found" });
    }

    // Use the user's plant name to filter pickups
    const plantName = user.plantName || user.plant;

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 8;

    // Query to find rescheduled pickups
    const rescheduledOrders = await Order.find({
      isRescheduled: true,
      plantName: plantName,
    })
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    const total = await Order.countDocuments({
      isRescheduled: true,
      plantName: plantName,
    });

    res.status(200).json({
      data: rescheduledOrders,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching rescheduled Orders", error });
  }
};

// get note and voice

export const getCancelMedia = async (req, res) => {
  const { pickupId } = req.params;

  try {
    // Find the order by ID
    const pickup = await Pickup.findById(pickupId);

    if (!pickup) {
      return res.status(404).json({ message: "pickup not found" });
    }

    const cancelNote = pickup.cancelNote;
    const voiceUrl = pickup.cancelVoice;

    res.status(200).json({ voiceUrl, cancelNote });
  } catch (error) {
    console.error("Error fetching pickup media:", error);
    res.status(500).json({ message: "Failed to fetch pickup media" });
  }
};

// Function to list and delete files from S3 for multiple directories
const deleteOrderRelatedFiles = async () => {
  const directories = [
    "intransiteOrderImage/",
    "pickupCancelVoices/",
    "beforeOrderImage/",
    "CompleteOrderImage/",
  ];

  try {
    for (const dir of directories) {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Prefix: dir,
      };

      const listedObjects = await s3.listObjectsV2(params).promise();

      if (listedObjects.Contents.length === 0) continue; // Skip if no files found in the directory

      const deleteParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Delete: { Objects: [] },
      };

      listedObjects.Contents.forEach(({ Key }) => {
        deleteParams.Delete.Objects.push({ Key });
      });

      await s3.deleteObjects(deleteParams).promise();

      // Handle truncated lists (if too many objects exist in the directory)
      if (listedObjects.IsTruncated) {
        await deleteOrderRelatedFiles(); // Recursively delete remaining objects
      }

      console.log(`Files from ${dir} deleted successfully`);
    }
  } catch (err) {
    console.error("Error deleting files from S3:", err);
  }
};

// Schedule cron job to run every Sunday at midnight 0 0 * * 0
// cron.schedule("0 1 * * 0", () => {
//   console.log("Running a task every Sunday at midnight");
//   deleteOrderRelatedFiles();
// });

// Rider Dashboard Data Controller
// export const getRiderDashboardData = async (req, res) => {
//   try {
//     const { riderName, riderDate } = req.query; // Rider ka name aur date frontend se query params me aayega

//     if (!riderName || !riderDate) {
//       return res
//         .status(400)
//         .json({ message: "Rider name and date are required" });
//     }

//     // Total pickups assigned to the rider on the given date
//     const totalPickups = await Pickup.countDocuments({
//       riderName: riderName,
//       riderDate: riderDate,
//       isDeleted: false,
//     });

//     // Completed pickups for the rider on the given date
//     const completedPickups = await Pickup.countDocuments({
//       riderName: riderName,
//       riderDate: riderDate,
//       PickupStatus: "completed",
//       isDeleted: true,
//     });

//     // Response with counts
//     res.status(200).json({
//       totalPickups,
//       completedPickups,
//     });
//   } catch (error) {
//     console.error("Error fetching rider dashboard data:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

export const getRiderDashboardData = async (req, res) => {
  try {
    const { riderName, riderDate } = req.query; // Rider ka name aur date frontend se query params me aayega

    if (!riderName || !riderDate) {
      return res
        .status(400)
        .json({ message: "Rider name and date are required" });
    }

    // Completed pickups for the rider on the given date
    const completedPickups = await Pickup.countDocuments({
      riderName: riderName,
      riderDate: riderDate,
      PickupStatus: "completed",
      isDeleted: true,
    });

    // Delivered orders for the rider on the given date
    const deliveredOrders = await Order.countDocuments({
      riderName: riderName,
      riderDate: riderDate,
      status: "delivered",
    });

    // Response with counts
    res.status(200).json({
      completedPickups,
      deliveredOrders,
    });
  } catch (error) {
    console.error("Error fetching rider dashboard data:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//get all rider pickups

export const getRiderPickups = async (req, res) => {
  try {
    const { email } = req.query;

    const user = await User.findOne({ email: email });
    if (!user || !user.plant) {
      return res.status(404).json({ message: "User or Plant not found" });
    }
    const riderName = user.name;

    const [pickups, countTotal] = await Promise.all([
      new APIFeatures(
        pickup.find({
          PickupStatus: "assigned",
          isDeleted: false,
          riderName: riderName,
        }),
        req.query,
      )
        .sort()
        .limitFields()
        .paginate().query,
      pickup.countDocuments({
        PickupStatus: "assigned",
        isDeleted: false,
        riderName: riderName,
      }),
    ]);
    res.status(200).json({
      status: "success",
      total: countTotal,
      Pickups: pickups,
    });
  } catch (error) {
    console.log("there is some error", error);
    res.status(500).json({ message: error });
  }
};

export const getRiderTasksById = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { date } = req.query; // optional: YYYY-MM-DD
    console.log("Rider ID:", riderId, "Date:", date);

    if (!riderId) {
      return res.status(400).json({ message: "Rider ID is required" });
    }

    // 1️⃣ Get Rider Details
    const rider = await User.findById(riderId).select(
      "name email phone role plant",
    );

    if (!rider || rider.role !== "rider") {
      return res.status(404).json({ message: "Rider not found" });
    }

    const riderName = rider.name;

    // 2️⃣ Build filters
    const pickupFilter = {
      riderName,
      isDeleted: false,
    };

    const orderFilter = {
      riderName,
    };

    if (date) {
      pickupFilter.riderDate = date;
      orderFilter.riderDate = date;
    }

    // 3️⃣ Fetch data in parallel
    const [pickups, deliveries] = await Promise.all([
      Pickup.find(pickupFilter).sort({ createdAt: -1 }),
      Order.find(orderFilter).sort({ createdAt: -1 }),
    ]);

    const totalCompletedPickups = pickups.filter(
      (pickup) => pickup.PickupStatus === "complete",
    ).length;

    const totalCompletedDeliveries = deliveries.filter(
      (delivery) => delivery.status === "delivered",
    ).length;

    // 4️⃣ Response
    res.status(200).json({
      rider: {
        id: rider._id,
        name: rider.name,
        email: rider.email,
        phone: rider.phone,
        plant: rider.plant,
      },
      summary: {
        totalPickups: pickups.length,
        totalDeliveries: deliveries.length,
        totalCompletedPickups,
        totalCompletedDeliveries,
      },
      pickups,
      deliveries,
    });
  } catch (error) {
    console.error("Error fetching rider tasks:", error);
    res.status(500).json({ message: "Server error" });
  }
};
