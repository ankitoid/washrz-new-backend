import customer from "../models/customerSchema.js";
import order from "../models/orderSchema.js";
import pickup from "../models/pickupSchema.js";
import APIFeatures from "../utills/apiFeatures.js";
import AppError from "../utills/appError.js";
import catchAsync from "../utills/catchAsync.js";
import cron from "node-cron";
import User from "./../models/userModel.js";
import mongoose from "mongoose";
import ErrorHandler from "../utills/errorHandler.js";
import AWS from "aws-sdk";
import multer from "multer";
import customerFcmService from "../services/customerFcmService.js";
import { createCustomerNotification } from "./customerNotificationController.js";
import CustomerNotification from "../models/customerNotificationSchema.js";
import CatalogItem from "../models/catalogItemSchema.js";

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  region: process.env.AWS_S3_REGION,
});

const uploadVoice = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
}).single("voice");

const uploadToS3 = (file, folder = "pickupCancelVoices") => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `${folder}/${Date.now()}_${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
    ContentDisposition: "inline",
  };
  return s3.upload(params).promise();
};

export const addCustomer = catchAsync(async (req, res, next) => {
  const { name, address, mobile, date } = req.body;
  const socket = req.socket;
  if (!name || !address || !mobile || !date) {
    return next(new AppError("Please fill the all field", 404));
  }
  await customer.create({
    Name: name,
    Address: address,
    Phone: mobile,
    Date: date,
  });
  // socket.emit("customeradded", { message: "customer added sucessfully" });
  req.socket.emitToAdmin("customeradded", {
    message: "customer added successfully",
  });
  res.status(200).json({
    message: "Customer Sucessfully Added",
  });
});

export const getCustomers = catchAsync(async (req, res, next) => {
  const [customers, countTotal] = await Promise.all([
    new APIFeatures(customer.find(), req.query).sort().limitFields().paginate()
      .query,
    customer.countDocuments(),
  ]);

  res.status(200).json({
    result: customers,
    total: countTotal,
    message: "Customers Retrieved Successfully",
  });
});

export const addPickup = catchAsync(async (req, res, next) => {
  const { name, contact, address } = req.body;

  console.log("this is the dataaaa===>>>>",name, contact, address)

  const pickupData = await pickup.create({
    Name: name,
    Contact: contact,
    Address: address,
    plantName: "Delhi",
    type: "live",
    PickupStatus: "pending",
    pickup_date: new Date(),
  });
  req.socket.emit("addPickup", pickupData);
  // req.socket.emitToAdmin("addPickup", pickupData);
  res.status(200).json({
    message: "Pickup Added Sucessfully",
    data: pickupData,
  });
});

// export const addPickupthroughApp = catchAsync(async (req, res, next) => {

//   const { firstName,lastName, contact, appCustomerId, tempPickupAdresssId,tempDeliveryAddressId,date,slot,note} = req.body;

//   let name = firstName

//   if(lastName)
//   {
//     name = name + " " + lastName
//   }

//     console.log("called",name, contact, appCustomerId, tempPickupAdresssId,tempDeliveryAddressId,date,slot,note)

//   let obj = {
//      Name: name,
//     Contact: contact,
//     plantName: "Delhi",
//     tempPickupAdresssId : tempPickupAdresssId,
//     tempDeliveryAddressId : tempDeliveryAddressId,
//     appCustomerId : appCustomerId,
//     platform_type : "app",
//     type: "live",
//     PickupStatus: "pending",
//     pickup_date: new Date(date),
//   }

//   if(slot)
//   {
//     obj.slot = slot
//     obj.type = "schedule"
//   }

//   if(note)
//   {
//     obj.note = note
//   }

//    const addr_obj = await fetch(`http://localhost:3000/v1/addresses?customerid=${appCustomerId}`)

//    let full_addr = "";
//   let keys = Object.keys(addr_obj[0]);

//   for (let i = 0; i < keys.length; i++) {
//   let key = keys[i];

//   if (
//     key === "addressLine1" ||
//     key === "landmark" ||
//     key === "city" ||
//     key === "state" ||
//     key === "pincode"
//   ) {
//     full_addr += addr_obj[0][key] + " ";
//   }
//   }

//   const pickupData = await pickup.create({
//     Name: name,
//     Contact: contact,
//     Address: full_addr,
//     plantName: "Delhi",
//     type: "live",
//     PickupStatus: "pending",
//     pickup_date: new Date(),
//     pickupLocation: {
//     "latitude": addr_obj[0].latitude,
//     "longitude": addr_obj[0].longitude
//   },
//    contactName : addr_obj[0].contactName ? addr_obj[0].contactName : null,
//   contactPhone: addr_obj[0].contactPhone ? addr_obj[0].contactPhone : null,
//      appCustomerId,
//     tempDeliveryAddressId,
//     tempPickupAdresssId,
//     platform_type: "app",

// });
//   req.socket.emit("addPickup", pickupData);
//   res.status(200).json({
//     message: "Pickup Added Sucessfully",
//     data : pickupData
//   });
// });

// export const getPickups = catchAsync(async (req, res, next) => {
//   const [pickups, countTotal] = await Promise.all([
//     new APIFeatures(pickup.find({ type: "live", isDeleted: false }), req.query)
//       .sort()
//       .limitFields()
//       .paginate().query,
//     pickup.countDocuments({ type: "live", isDeleted: false }),
//   ]);

//   res.status(200).json({
//     Pickups: pickups,
//     total: countTotal,
//     message: "Pickup Retrieved Successfully",
//   });
// });

//ready for delivery

// export const getPickups = catchAsync(async (req, res, next) => {
//   const [pickups, countTotal] = await Promise.all([
//     new APIFeatures(
//       pickup.find({
//         type: "live",
//         isDeleted: false,
//         isRescheduled: false,
//       }),
//       req.query
//     )
//       .sort()
//       .limitFields()
//       .paginate().query,
//     pickup.countDocuments({
//       type: "live",
//       isDeleted: false,
//       isRescheduled: false,
//     }),
//   ]);

//   res.status(200).json({
//     Pickups: pickups,
//     total: countTotal,
//     message: "Pickup Retrieved Successfully",
//   });
// });

export const addPickupthroughApp = catchAsync(async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      contact,
      appCustomerId,
      tempPickupAdresssId,
      tempDeliveryAddressId,
      date,
      slot,
      note,
      items,
      morning_delivery,
      isHeavy,
      bookingId
// ✅ NEW //  Format:
//  [
//    { "itemId": "catalogItemId", "quantity": 2 },
//    { "itemId": "catalogItemId2", "quantity": 1 }
//  ]
    } = req.body;

    console.log("REQ BODY 👉", req.body);

    // -------------------------
    // Basic validation
    // -------------------------
    if (!firstName || !contact || !appCustomerId) {
      return res.status(400).json({
        message: "Required fields are missing",
      });
    }

    const name = lastName ? `${firstName} ${lastName}` : firstName;
    // -------------------------
    // Validate Items (if provided)
    // -------------------------
    let processedItems = [];

    if (items && Array.isArray(items) && items.length > 0) {
      // quantity validation
      if (items.some((i) => !i.itemId || !i.quantity || i.quantity < 1)) {
        return res.status(400).json({
          message: "Invalid items payload",
        });
      }

      const itemIds = items.map((i) => i.itemId);

      const catalogItems = await CatalogItem.find({
        _id: { $in: itemIds },
        isActive: true,
      });

      if (catalogItems.length !== itemIds.length) {
        return res.status(400).json({
          message: "Some items are invalid or inactive",
        });
      }

      processedItems = items.map((reqItem) => {
        const catalogItem = catalogItems.find(
          (ci) => ci._id.toString() === reqItem.itemId
        );

        return {
          itemId: catalogItem._id,
          label: catalogItem.label,   // snapshot
          price: catalogItem.price,   // snapshot
          unit: catalogItem.unit,     // snapshot
          quantity: reqItem.quantity,
        };
      });
    }

    // -------------------------
    // Fetch addresses
    // -------------------------
    const addrRes = await fetch(
      `https://live.drydash.in/v1/addresses?customerid=${appCustomerId}`
    );

    const addrData = await addrRes.json();

    console.log("ADDR API RESPONSE 👉", addrData);

    const addresses = addrData?.results;

    if (!Array.isArray(addresses) || addresses.length === 0) {
      return res.status(404).json({
        message: "No address found for this customer",
      });
    }

    // -------------------------
    // Map pickup & delivery addresses
    // -------------------------
    const pickupAddress = addresses.find(
      (addr) => addr.id === tempPickupAdresssId
    );

    const deliveryAddress = addresses.find(
      (addr) => addr.id === tempDeliveryAddressId
    );

    if (!pickupAddress) {
      return res.status(400).json({
        message: "Invalid pickup address ID",
      });
    }

    if (!deliveryAddress) {
      return res.status(400).json({
        message: "Invalid delivery address ID",
      });
    }

    // -------------------------
    // Helper: build full address
    // -------------------------
    const buildFullAddress = (address) => {
      const keys = ["addressLine1", "landmark", "city", "state", "pincode"];

      return keys
        .filter((key) => address[key])
        .map((key) => address[key])
        .join(" ");
    };

    // -------------------------
    // Calculate total (optional)
    // -------------------------
    const totalAmount = processedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // -------------------------
    // Create pickup payload
    // -------------------------
    const pickupPayload = {
      Name: name,
      Contact: contact,

      Address: buildFullAddress(pickupAddress),

      plantName: "Delhi",
      type: slot ? "schedule" : "live",
      PickupStatus: "pending",
      pickup_date: new Date(),

      pickupLocation: {
        latitude: pickupAddress.latitude,
        longitude: pickupAddress.longitude,
      },

      contactName: pickupAddress.contactName || null,
      contactPhone: pickupAddress.contactPhone || null,

      deliveryAddress: buildFullAddress(deliveryAddress),
      deliveryLocation: {
        latitude: deliveryAddress.latitude,
        longitude: deliveryAddress.longitude,
      },

      appCustomerId,
      tempPickupAdresssId,
      tempDeliveryAddressId,

      morning_delivery,   // for deciding the delivery needed before 11 AM or after 11 AM

      platform_type: "app",
      items: processedItems, // ✅ NEW
      totalAmount,           // ✅ OPTIONAL
    };

    if (slot) {
      pickupPayload.slot = slot;
      pickupPayload.pickup_date = new Date(date);
    }

    if (note) pickupPayload.note = note;

    if(isHeavy){
      pickupPayload.isHeavy = isHeavy
    }


    if(bookingId){
      pickupPayload.bookingId = bookingId
    }

    console.log("FINAL PAYLOAD 👉", pickupPayload);

    // -------------------------
    // Save pickup
    // -------------------------
    const pickupData = await pickup.create(pickupPayload);

    // -------------------------
    // Notification
    // -------------------------
    const notification = await createCustomerNotification({
      customerId: pickupData.appCustomerId,
      title: "Pickup Scheduled",
      message: "Your pickup has been scheduled successfully.",
      type: "pickup_Created",
      data: {
        pickupId: pickupData._id,
        screen: "PickupDetails",
      },
    });

    const unreadCount = await CustomerNotification.countDocuments({
      customerId: pickupData.appCustomerId,
      isRead: false,
    });

    req.socket.emitToUser(
      String(pickupData.appCustomerId),
      "CUSTOMER_NOTIFICATION",
      {
        notification: {
          id: notification._id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          data: notification.data,
          createdAt: notification.createdAt,
          isRead: false,
        },
        unreadCount,
      }
    );

    // req.socket.emitToAdmin("addPickup", pickupData);
      req.socket.emit("addPickup", pickupData);

    // -------------------------
    // Push notification
    // -------------------------
    const pushResult = await customerFcmService.sendToCustomer(
      String(appCustomerId),
      {
        title: "Woo!, Pickup booked 🧺",
        body: "We’ll be there soon to collect your laundry.",
      },
      {
        type: "pickup_Created",
        pickupId: String(pickupData._id),
        screen: "PickupDetails",
      }
    );

    return res.status(200).json({
      message: "Pickup added successfully",
      data: pickupData,
      push: pushResult,
    });
  } catch (error) {
    console.error("addPickupthroughApp ERROR ❌", error);

    return res.status(500).json({
      message: "Failed to add pickup",
      error: error.message,
    });
  }
});

export const updatePickup = catchAsync(async (req, res, next) => {
  try {
    const { pickupId } = req.params;
    const { items, specialInstructions, isHeavy, morning_delivery } = req.body;

    // -------------------------
    // Validation
    // -------------------------
    if (!pickupId) {
      return res.status(400).json({
        message: "Pickup ID is required",
      });
    }

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        message: "Items array is required",
      });
    }

    // -------------------------
    // Find existing pickup
    // -------------------------
    const existingPickup = await pickup.findById(pickupId);

    if (!existingPickup) {
      return res.status(404).json({
        message: "Pickup not found",
      });
    }

    // Check if pickup can be edited (pending pickups and assigned pickups)
    if (existingPickup.PickupStatus !== "pending" && existingPickup.PickupStatus !== "assigned") {
      return res.status(400).json({
        message: "Cannot update items for pickup that is already processed",
        currentStatus: existingPickup.PickupStatus,
      });
    }

    // -------------------------
    // Process items update
    // -------------------------
    let updatedItems = [];
    let operationLog = {
      added: [],
      removed: [],
      updated: [],
    };

    // Get current items as a map for easy lookup
    const currentItemsMap = new Map();
    existingPickup.items.forEach((item) => {
      currentItemsMap.set(item.itemId._id.toString(), {
        ...item.toObject(),
        oldQuantity: item.quantity,
      });
    });

    // Process each item from request
    for (const reqItem of items) {
      // Validate required fields
      if (!reqItem.itemId) {
        return res.status(400).json({
          message: "Each item must have itemId",
        });
      }

      const catalogItem = await CatalogItem.findOne({
        _id: reqItem.itemId,
        isActive: true,
      });

      if (!catalogItem) {
        return res.status(400).json({
          message: `Item with ID ${reqItem.itemId} is invalid or inactive`,
        });
      }

      const currentItem = currentItemsMap.get(reqItem.itemId);

      // Case 1: Item exists in current pickup
      if (currentItem) {
        // If quantity is 0 or negative, remove the item
        if (!reqItem.quantity || reqItem.quantity <= 0) {
          operationLog.removed.push({
            itemId: reqItem.itemId,
            label: currentItem.label,
            oldQuantity: currentItem.quantity,
          });
          currentItemsMap.delete(reqItem.itemId);
        } 
        // Update quantity
        else if (reqItem.quantity !== currentItem.quantity) {
          operationLog.updated.push({
            itemId: reqItem.itemId,
            label: currentItem.label,
            oldQuantity: currentItem.quantity,
            newQuantity: reqItem.quantity,
          });
          
          currentItemsMap.set(reqItem.itemId, {
            ...currentItem,
            quantity: reqItem.quantity,
          });
        }
        // Quantity unchanged, keep as is
        else {
          currentItemsMap.set(reqItem.itemId, currentItem);
        }
      } 
      // Case 2: New item being added
      else if (reqItem.quantity && reqItem.quantity > 0) {
        operationLog.added.push({
          itemId: reqItem.itemId,
          label: catalogItem.label,
          quantity: reqItem.quantity,
        });
        
        currentItemsMap.set(reqItem.itemId, {
          itemId: catalogItem._id,
          label: catalogItem.label,
          price: catalogItem.price,
          unit: catalogItem.unit,
          quantity: reqItem.quantity,
        });
      }
    }

    // Convert map back to array
    updatedItems = Array.from(currentItemsMap.values());

    // -------------------------
    // Calculate new total amount
    // -------------------------
    const totalAmount = updatedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // -------------------------
    // Prepare update object for note
    // -------------------------
    let updatedNote = existingPickup.note || "";
    let noteUpdated = false;
    let oldNote = updatedNote;

    // Update note/specialInstructions if provided
    if (specialInstructions !== undefined && specialInstructions !== null) {
      if (specialInstructions === "") {
        // Clear the note if empty string is sent
        updatedNote = "";
        noteUpdated = true;
      } else {
        // Check if the content already exists in the note to avoid duplicates
        if (!updatedNote.includes(specialInstructions)) {
          // Append the new text with a comma separator
          if (updatedNote && updatedNote.trim() !== "") {
            updatedNote = `${updatedNote}, ${specialInstructions}`;
          } else {
            updatedNote = specialInstructions;
          }
          noteUpdated = true;
        }
      }
    }

    // -------------------------
    // Prepare update object for isHeavy
    // -------------------------
    let heavyStatusUpdated = false;
    let oldHeavyStatus = existingPickup.isHeavy || false;
    let newHeavyStatus = oldHeavyStatus;

    if (isHeavy !== undefined && isHeavy !== null) {
      const booleanIsHeavy = typeof isHeavy === 'boolean' ? isHeavy : Boolean(isHeavy);
      
      if (booleanIsHeavy !== existingPickup.isHeavy) {
        newHeavyStatus = booleanIsHeavy;
        heavyStatusUpdated = true;
      }
    }

    // -------------------------
    // Prepare update object for morning_delivery (NEW)
    // -------------------------
    let morningDeliveryUpdated = false;
    let oldMorningDelivery = existingPickup.morning_delivery || false;
    let newMorningDelivery = oldMorningDelivery;

    if (morning_delivery !== undefined && morning_delivery !== null) {
      const booleanMorningDelivery = typeof morning_delivery === 'boolean' ? morning_delivery : Boolean(morning_delivery);
      
      if (booleanMorningDelivery !== existingPickup.morning_delivery) {
        newMorningDelivery = booleanMorningDelivery;
        morningDeliveryUpdated = true;
      }
    }

    // -------------------------
    // Prepare update data
    // -------------------------
    const updateData = {
      items: updatedItems,
      totalAmount: totalAmount,
      $push: {
        updateHistory: {
          timestamp: new Date(),
          operation: "items_updated",
          changes: operationLog,
          previousTotal: existingPickup.totalAmount,
          newTotal: totalAmount,
        },
      },
    };

    // Add note to update if changed
    if (noteUpdated) {
      updateData.note = updatedNote;
      
      if (!updateData.$push.updateHistory.changes) {
        updateData.$push.updateHistory.changes = {};
      }
      updateData.$push.updateHistory.changes.noteUpdated = {
        oldNote: oldNote || "",
        newNote: updatedNote,
        appendedText: specialInstructions !== "" ? specialInstructions : null,
      };
    }

    // Add isHeavy to update if changed
    if (heavyStatusUpdated) {
      updateData.isHeavy = newHeavyStatus;
      
      if (!updateData.$push.updateHistory.changes) {
        updateData.$push.updateHistory.changes = {};
      }
      updateData.$push.updateHistory.changes.heavyStatusUpdated = {
        oldStatus: oldHeavyStatus,
        newStatus: newHeavyStatus,
      };
    }

    // Add morning_delivery to update if changed (NEW)
    if (morningDeliveryUpdated) {
      updateData.morning_delivery = newMorningDelivery;
      
      if (!updateData.$push.updateHistory.changes) {
        updateData.$push.updateHistory.changes = {};
      }
      updateData.$push.updateHistory.changes.morningDeliveryUpdated = {
        oldStatus: oldMorningDelivery,
        newStatus: newMorningDelivery,
      };
    }

    // -------------------------
    // Update pickup
    // -------------------------
    const updatedPickup = await pickup.findByIdAndUpdate(
      pickupId,
      updateData,
      { new: true, runValidators: true }
    );

    // -------------------------
    // Send notification to customer
    // -------------------------
    let notificationMessage = getUpdateNotificationMessage(operationLog);
    
    if (noteUpdated && specialInstructions && specialInstructions !== "") {
      const noteMessage = `Special instructions updated: "${specialInstructions}" added to your notes`;
      notificationMessage = notificationMessage 
        ? `${notificationMessage}. ${noteMessage}`
        : noteMessage;
    }
    
    if (heavyStatusUpdated) {
      const heavyMessage = `Heavy item status changed to: ${newHeavyStatus ? "Yes (Heavy items)" : "No (Standard items)"}`;
      notificationMessage = notificationMessage 
        ? `${notificationMessage}. ${heavyMessage}`
        : heavyMessage;
    }

    // Add morning delivery update to notification message (NEW)
    if (morningDeliveryUpdated) {
      const morningMessage = `Morning delivery preference changed to: ${newMorningDelivery ? "Yes" : "No"}`;
      notificationMessage = notificationMessage 
        ? `${notificationMessage}. ${morningMessage}`
        : morningMessage;
    }

    if (notificationMessage) {
      const notification = await createCustomerNotification({
        customerId: existingPickup.appCustomerId,
        title: "Pickup Updated",
        message: notificationMessage,
        type: "pickup_Updated",
        data: {
          pickupId: pickupId,
          screen: "PickupDetails",
          changes: operationLog,
          noteUpdated: noteUpdated ? {
            oldNote: oldNote,
            newNote: updatedNote,
          } : undefined,
          heavyStatusUpdated: heavyStatusUpdated ? {
            oldStatus: oldHeavyStatus,
            newStatus: newHeavyStatus,
          } : undefined,
          morningDeliveryUpdated: morningDeliveryUpdated ? {    // NEW
            oldStatus: oldMorningDelivery,
            newStatus: newMorningDelivery,
          } : undefined,
        },
      });

      const unreadCount = await CustomerNotification.countDocuments({
        customerId: existingPickup.appCustomerId,
        isRead: false,
      });

      req.socket.emitToUser(
        String(existingPickup.appCustomerId),
        "CUSTOMER_NOTIFICATION",
        {
          notification: {
            id: notification._id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            data: notification.data,
            createdAt: notification.createdAt,
            isRead: false,
          },
          unreadCount,
        }
      );

      await customerFcmService.sendToCustomer(
        String(existingPickup.appCustomerId),
        {
          title: "Pickup Order Updated 🧺",
          body: notificationMessage,
        },
        {
          type: "pickup_Updated",
          pickupId: String(pickupId),
          screen: "PickupDetails",
        }
      );
    }

    // Notify admin
    req.socket.emitToAdmin("updatePickup", {
      pickupId: pickupId,
      changes: operationLog,
      oldTotal: existingPickup.totalAmount,
      newTotal: totalAmount,
      noteUpdated: noteUpdated ? {
        oldNote: oldNote,
        newNote: updatedNote,
        appendedText: specialInstructions,
      } : false,
      heavyStatusUpdated: heavyStatusUpdated ? {
        oldStatus: oldHeavyStatus,
        newStatus: newHeavyStatus,
      } : false,
      morningDeliveryUpdated: morningDeliveryUpdated ? {       // NEW
        oldStatus: oldMorningDelivery,
        newStatus: newMorningDelivery,
      } : false,
    });

    // -------------------------
    // Response
    // -------------------------
    return res.status(200).json({
      message: "Pickup updated successfully",
      data: {
        pickup: updatedPickup,
        changes: operationLog,
        oldTotal: existingPickup.totalAmount,
        newTotal: totalAmount,
        noteUpdated: noteUpdated ? {
          oldNote: oldNote,
          newNote: updatedNote,
        } : undefined,
        heavyStatusUpdated: heavyStatusUpdated ? {
          oldStatus: oldHeavyStatus,
          newStatus: newHeavyStatus,
        } : undefined,
        morningDeliveryUpdated: morningDeliveryUpdated ? {    // NEW
          oldStatus: oldMorningDelivery,
          newStatus: newMorningDelivery,
        } : undefined,
      },
    });

  } catch (error) {
    console.error("updatePickupItems ERROR ❌", error);
    return res.status(500).json({
      message: "Failed to update pickup",
      error: error.message,
    });
  }
});

// Helper function for notification message
function getUpdateNotificationMessage(operationLog) {
  const messages = [];
  
  if (operationLog.added.length > 0) {
    const items = operationLog.added.map(i => `${i.label} (x${i.quantity})`).join(", ");
    messages.push(`Added: ${items}`);
  }
  
  if (operationLog.removed.length > 0) {
    const items = operationLog.removed.map(i => i.label).join(", ");
    messages.push(`Removed: ${items}`);
  }
  
  if (operationLog.updated.length > 0) {
    const items = operationLog.updated.map(i => `${i.label}: ${i.oldQuantity} → ${i.newQuantity}`).join(", ");
    messages.push(`Updated: ${items}`);
  }
  
  return messages.length > 0 ? messages.join(" | ") : null;
}

export const getPickups = catchAsync(async (req, res, next) => {
  const { date, status } = req.query; // Date filter from query and status filter
  const startDate = date ? new Date(date) : new Date(); // Default to current date
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date();

  // ✅ Base filter
  const baseFilter = {
    PickupStatus: status,
    type: "live",
    isRescheduled: false,
  };

  // ✅ Apply date filter ONLY when status is NOT deleted
  if (status !== "deleted") {
    baseFilter.pickup_date = { $gte: startDate, $lte: endDate };
  }

  if (status === "deleted") {
    ((baseFilter.type = ""), (baseFilter.isDeleted = true));
  }

  const [pickups, countTotal] = await Promise.all([
    new APIFeatures(pickup.find(baseFilter), req.query)
      .sort()
      .limitFields()
      .paginate().query,
    pickup.countDocuments({
      PickupStatus: status,
      type: "live",
      isDeleted: false,
      isRescheduled: false,
      pickup_date: { $gte: startDate, $lte: endDate },
    }),
  ]);

  res.status(200).json({
    Pickups: pickups,
    total: countTotal,
    message: "Pickup Retrieved Successfully",
  });
});

export const getPickupById = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;

    const requiredPickup = await pickup.findById(id);

    if (!requiredPickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    res
      .status(200)
      .json({ message: "Pickup retrived successfully!", data: requiredPickup });
  } catch (error) {
    console.log("this is the error==>>", error);
  }
});

export const updatePickupById = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;

    const { name, address } = req.body;

    console.log("this is the resss-->>>", id, name, address);

    const requiredPickup = await pickup.findByIdAndUpdate(id, {
      Name: name,
      Address: address,
    });

    if (!requiredPickup) {
      return res.status(404).json({ message: "no data found to edit!" });
    }

    res
      .status(200)
      .json({ message: "Address Edited Sucessfully !", data: requiredPickup });
  } catch (error) {
    console.log("this is the error==>>", error);
  }
});

export const getAssignedPickups = catchAsync(async (req, res, next) => {
  const { email } = req.query;

  // Fetch the plant name associated with this email
  const user = await User.findOne({ email: email });
  if (!user || !user.plant) {
    return res.status(404).json({ message: "User or Plant not found" });
  }

  // Use the user's plant name to filter pickups
  // const plantName = user.plant;
  const riderName = user.name;

  const todayDate = new Date().toISOString().split("T")[0];

  if (user.role === "admin" || user.role === "plant-manager") {
    const [pickups, countTotal] = await Promise.all([
      new APIFeatures(
        pickup.find({
          PickupStatus: "pending",
          type: "live",
          isDeleted: false,
          isRescheduled: false,
          // plantName: plantName, // Filter based on user's plant name
        }),
        req.query,
      )
        .sort()
        .limitFields()
        .paginate().query,
      pickup.countDocuments({
        PickupStatus: "pending",
        type: "live",
        isDeleted: false,
        isRescheduled: false,
        // plantName: plantName,
      }),
    ]);
    res.status(200).json({
      status: "success",
      total: countTotal,
      Pickups: pickups,
    });
  }
  // if (user.role === "rider") {
  //   const [pickups, countTotal] = await Promise.all([
  //     new APIFeatures(
  //       pickup.find({
  //         type: "live",
  //         isDeleted: false,
  //         isRescheduled: false,
  //         plantName: plantName, // Filter based on user's plant name
  //         riderName: riderName,
  //       }),
  //       req.query
  //     )
  //       .sort()
  //       .limitFields()
  //       .paginate().query,
  //     pickup.countDocuments({
  //       type: "live",
  //       isDeleted: false,
  //       isRescheduled: false,
  //       plantName: plantName,
  //       riderName: riderName,
  //     }),
  //   ]);
  //   res.status(200).json({
  //     status: "success",
  //     total: countTotal,
  //     Pickups: pickups,
  //   });
  // }
  // Get today's date in YYYY-MM-DD format

  if (user.role === "rider") {
    const [pickups, countTotal] = await Promise.all([
      new APIFeatures(
        pickup.find({
          PickupStatus: "pending",
          type: "live",
          isDeleted: false,
          isRescheduled: false,
          // plantName: plantName, // Filter based on user's plant name
          riderName: riderName,
          riderDate: todayDate, // Filter for today's assigned pickups
        }),
        req.query,
      )
        .sort()
        .limitFields()
        .paginate().query,
      pickup.countDocuments({
        PickupStatus: "pending",
        type: "live",
        isDeleted: false,
        isRescheduled: false,
        // plantName: plantName,
        riderName: riderName,
        riderDate: todayDate, // Count only today's pickups
      }),
    ]);
    res.status(200).json({
      status: "success",
      total: countTotal,
      Pickups: pickups,
    });
  } else {
    res.status(403).json({ message: "Unauthorized access" });
  }
});

export const deletePickup = catchAsync(async (req, res, next) => {
  uploadVoice(req, res, async (multerErr) => {
    try {
      if (multerErr) {
        console.error("multer error", multerErr);
        return next(new AppError("Error uploading voice file", 400));
      }
      const { id } = req.params;
      const note = (req.body.note || "").trim();
      const { userName, userRole } = req.body;
      if (!userName || !userRole) {
        return next(
          new AppError(
            "User information (userName, userRole) is required",
            400,
          ),
        );
      }

      if (!mongoose.Types.ObjectId.isValid(String(id || "").trim())) {
        return next(new AppError("Invalid pickup id provided.", 400));
      }

      let voiceUrl = null;
      if (req.file) {
        const voiceUploadResult = await uploadToS3(
          req.file,
          "pickupCancelVoices",
        );
        voiceUrl = voiceUploadResult.Location;
      } else if (Array.isArray(req.files) && req.files.length > 0) {
        const voiceUploadResult = await uploadToS3(
          req.files[0],
          "pickupCancelVoices",
        );
        voiceUrl = voiceUploadResult.Location;
      }
      if (!note && !voiceUrl) {
        return next(
          new AppError(
            "Either cancellation note or voice note is required.",
            400,
          ),
        );
      }
      const updated = await pickup.findByIdAndUpdate(
        id,
        {
          isDeleted: true,
          PickupStatus: "deleted",
          type: "",
          cancelNote: note || null,
          cancelVoice: voiceUrl || null,
          cancelledBy: {
            name: userName,
            role: userRole,
          },
          cancelledAt: new Date(),
        },
        { new: true },
      );

      if (!updated) {
        return next(new AppError("No pickup found with that ID", 404));
      }

      // if (req.socket) {
      //   req.socket.emit("pickupCancelled", { pickupId: id, cancelledBy: userName });
      // }

      // req.socket.emitToAdmin("pickupCancelled", {
      //   pickupId: id,
      //   cancelledBy: userName,
      // });

      return res.status(200).json({
        message: "Pickup cancelled successfully",
        pickup: updated,
      });
    } catch (err) {
      console.error("deletePickup error:", err);
      return next(new AppError("Internal server error", 500));
    }
  });
});


export const completePickup = catchAsync(async (req, res, next) => {
  const pickupData = await pickup.findByIdAndUpdate(req.params.id, {
    PickupStatus: "complete",
  });
  if (!pickupData) {
    return next(new AppError("No pickup found with that ID", 404));
  }
  res.status(200).json({
    message: "Pickup Completed Sucessfully",
  });
});

export const addSchedulePickup = catchAsync(async (req, res, next) => {
  const { name, contact, address, slot } = req.body;
  const schedulePickupData = await pickup.create({
    Name: name,
    Contact: contact,
    Address: address,
    slot,
    plantName: "Delhi",
    type: "schedule",
    PickupStatus: "pending",
    pickup_date: new Date(),
  });
  // req.socket.emit("addSchedulePickup", schedulePickupData);
  req.socket.emitToAdmin("addSchedulePickup", schedulePickupData);
  res.status(200).json({
    message: "SchedulePickup Added Sucessfully",
    data: schedulePickupData,
  });
});

// This function will be called every 24 hours
const schedulePickuptolive = async () => {
  try {
    const currentDate = new Date();

    // Find all pickups that are rescheduled and where the rescheduled date has passed or is today
    const rescheduledPickups = await pickup.find({
      type: "schedule",
    });

    // Update each rescheduled pickup back to "regular"
    for (const pickupData of rescheduledPickups) {
      pickupData.type = "live";
      pickupData.isRescheduled = false;
      pickupData.isDeleted = false;
      pickupData.PickupStatus = "pending";
      // pickupData.pickup_date = currentDate;

      await pickupData.save(); // Save the changes
    }

    console.log("Rescheduled pickups have been updated successfully");
  } catch (error) {
    console.error("Error in reschedulePickupJob:", error);
  }
};

// Schedule the cron job to run every 24 hours (you can set it to run at midnight every day)
cron.schedule("0 0 * * *", schedulePickuptolive); // This runs at 00:00 (midnight) every day

export const getSchedulePickups = catchAsync(async (req, res, next) => {
  const [pickups, countTotal] = await Promise.all([
    new APIFeatures(
      pickup.find({ type: "schedule", PickupStatus: "pending" }),
      req.query,
    )
      .sort()
      .limitFields()
      .paginate().query,
    pickup.countDocuments({ type: "schedule", PickupStatus: "pending" }),
  ]);

  res.status(200).json({
    Pickups: pickups,
    total: countTotal,
    message: "SchedulePickups Retrieved Successfully",
  });
});

// export const addOrder = catchAsync(async (req, res, next) => {
//   const { contactNo, customerName, address, items, price } = req.body;
//   const latestOrder = await order.find().sort({ _id: -1 });
//   console.log("this is the latesoder---> ", latestOrder);
//   let order_id = `WZ1001`;
//   if (latestOrder.length > 0) {
//     order_id = latestOrder[0].order_id.split("WZ")[1] * 1 + 1;
//     order_id = "WZ" + order_id;
//     console.log("updated order id---> ", order_id);
//   }
//   await order.create({
//     contactNo,
//     customerName,
//     address,
//     items,
//     price,
//     order_id,
//   });
//   res.status(200).json({
//     message: "Order Added Sucessfully",
//   });
// });

export const addOrder = catchAsync(async (req, res, next) => {
  try {
    const {
      contactNo,
      customerName,
      items,
      price,
      appCustomerId,
      tempPickupAdresssId,
      tempDeliveryAddressId,
    } = req.body;

    // -------------------------
    // Generate order ID
    // -------------------------
    const latestOrder = await order.find().sort({ _id: -1 }).limit(1);

    let order_id = "WZ1001";
    if (latestOrder.length > 0 && latestOrder[0].order_id) {
      const lastNumber = Number(latestOrder[0].order_id.replace("WZ", ""));
      order_id = "WZ" + (lastNumber + 1);
    }

    // -------------------------
    // Create base order first
    // -------------------------
    await order.create({
      contactNo,
      customerName,
      items,
      price,
      order_id,
    });

    // -------------------------
    // If app customer → fetch delivery address
    // -------------------------
    if (appCustomerId && tempDeliveryAddressId) {
      const addrRes = await fetch(
        `http://localhost:3000/v1/addresses?customerid=${appCustomerId}`,
      );

      const addrData = await addrRes.json();

      const addresses = addrData?.results;

      if (!Array.isArray(addresses) || addresses.length === 0) {
        return res.status(404).json({
          message: "No address found for this customer",
        });
      }

      // -------------------------
      // Find DELIVERY address only
      // -------------------------
      const deliveryAddress = addresses.find(
        (addr) => addr.id === tempDeliveryAddressId,
      );

      if (!deliveryAddress) {
        return res.status(400).json({
          message: "Invalid delivery address ID",
        });
      }

      // -------------------------
      // Helper: build full address
      // -------------------------
      const buildFullAddress = (address) => {
        const keys = ["addressLine1", "landmark", "city", "state", "pincode"];

        return keys
          .filter((key) => address[key])
          .map((key) => address[key])
          .join(" ");
      };

      const fullAddress = buildFullAddress(deliveryAddress);

      // -------------------------
      // Update order with delivery details
      // -------------------------
      await order.update(
        {
          address: fullAddress,

          appCustomerId,
          tempDeliveryAddressId,
          tempPickupAdresssId,
          platform_type: "app",

          orderLocation: {
            latitude: deliveryAddress.latitude,
            longitude: deliveryAddress.longitude,
          },

          contactName: deliveryAddress.contactName || null,
          contactPhone: deliveryAddress.contactPhone || null,
        },
        {
          where: { order_id },
        },
      );
    }

    return res.status(200).json({
      message: "Order Added Successfully",
      order_id,
    });
  } catch (error) {
    console.error("addOrder ERROR ❌", error);

    return res.status(500).json({
      message: "Failed to add order",
      error: error.message,
    });
  }
});

// const changeStateofOrder = async (status, appOrderId) =>
// {
// try {
//    const url = `v1/orders/${appOrderId}`
//   const options = {
//   method: 'PATCH',
//   headers: {
//     'content-type': 'application/json-patch+json',
//   },
//   body: {status}
// }

// const res = await fetch(url,options)
// const json = await res.json()
// // console.log("this is json",json)
// return json
// } catch (error) {
//   console.log('this is the error',error)
// }
// }

// export const getOrders = catchAsync(async (req, res, next) => {
//   const { email } = req.query;

//   // Fetch the plant name associated with this email
//   const user = await User.findOne({ email: email });
//   if (!user || !user.plant) {
//     return res.status(404).json({ message: "User or Plant not found" });
//   }

//   // Use the user's plant name to filter pickups
//   const plantName = user.plant;

//   const [orders, countTotal] = await Promise.all([
//     new APIFeatures(order.find({ plantName: plantName }), req.query)
//       .sort()
//       .limitFields()
//       .paginate().query,
//     order.countDocuments({ plantName: plantName }),
//   ]);

//   res.status(200).json({
//     orders: orders,
//     total: countTotal,
//     message: "orders Retrieved Successfully",
//   });
// });

export const getOrders = catchAsync(async (req, res, next) => {
  const { email, date } = req.query;

  // Fetch the plant name associated with this email
  const user = await User.findOne({ email: email });
  if (!user || !user.plant) {
    return res.status(404).json({ message: "User or Plant not found" });
  }

  // Use the user's plant name to filter orders
  const plantName = user.plant;

  const startDate = date ? new Date(date) : new Date(); // Default to current date
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setHours(23, 59, 59, 999);

  const [orders, countTotal] = await Promise.all([
    new APIFeatures(
      order.find({
        plantName: plantName,
        createdAt: { $gte: startDate, $lte: endDate },
      }),
      req.query,
    )
      .sort()
      .limitFields()
      .paginate().query,
    order.countDocuments({
      plantName: plantName,
      createdAt: { $gte: startDate, $lte: endDate },
    }),
  ]);

  res.status(200).json({
    orders: orders,
    total: countTotal,
    message: "Orders Retrieved Successfully",
  });
});

export const getOrdersByFilter = catchAsync(async (req, res, next) => {
  const { email } = req.query;

  // Fetch the plant name associated with this email
  const user = await User.findOne({ email: email });
  if (!user || !user.plant) {
    return res.status(404).json({ message: "User or Plant not found" });
  }

  // Use the user's plant name to filter pickups
  const plantName = user.plant;

  if (req.query.status === "processing") {
    const status = req.query.status;
    const [orders, countTotal] = await Promise.all([
      new APIFeatures(order.find({ status, plantName: plantName }), req.query)
        .sort()
        .limitFields()
        .paginate().query,
      order.countDocuments({ status, plantName: plantName }),
    ]);

    res.status(200).json({
      orders: orders,
      total: countTotal,
      message: "Orders retrieved successfully",
    });
  }
  //ready for intransit
  if (req.query.status === "intransit") {
    const status = req.query.status;
    const [orders, countTotal] = await Promise.all([
      new APIFeatures(order.find({ status, plantName: plantName }), req.query)
        .sort()
        .limitFields()
        .paginate().query,
      order.countDocuments({ status, plantName: plantName }),
    ]);

    res.status(200).json({
      orders: orders,
      total: countTotal,
      message: "Orders retrieved successfully",
    });
  }

  if (req.query.status === "ready for delivery") {
    if (user.role === "admin" || user.role === "plant-manager") {
      const status = req.query.status;
      const [orders, countTotal] = await Promise.all([
        new APIFeatures(
          order.find({ status, isRescheduled: false, plantName: plantName }),
          req.query,
        )
          .sort()
          .limitFields()
          .paginate().query,
        order.countDocuments({
          status,
          isRescheduled: false,
          plantName: plantName,
        }),
      ]);

      res.status(200).json({
        orders: orders,
        total: countTotal,
        message: "Orders retrieved successfully",
      });
    }
    // if (user.role === "rider") {
    //   const status = req.query.status;
    //   const riderName = user.name;
    //   const [orders, countTotal] = await Promise.all([
    //     new APIFeatures(
    //       order.find({
    //         status,
    //         isRescheduled: false,
    //         plantName: plantName,
    //         riderName: riderName,
    //       }),
    //       req.query
    //     )
    //       .sort()
    //       .limitFields()
    //       .paginate().query,
    //     order.countDocuments({
    //       status,
    //       isRescheduled: false,
    //       plantName: plantName,
    //       riderName: riderName,
    //     }),
    //   ]);

    //   res.status(200).json({
    //     orders: orders,
    //     total: countTotal,
    //     message: "Orders retrieved successfully",
    //   });
    // }
    if (user.role === "rider") {
      const todayDate = new Date().toISOString().split("T")[0];
      const status = req.query.status;
      const riderName = user.name;
      const RiderDate = todayDate;

      // Query ke andar riderDate ko bhi filter mein add karte hain
      const [orders, countTotal] = await Promise.all([
        new APIFeatures(
          order.find({
            status,
            isRescheduled: false,
            plantName: plantName,
            riderName: riderName,
            riderDate: RiderDate, // Rider Date filter yahan add kiya hai
          }),
          req.query,
        )
          .sort()
          .limitFields()
          .paginate().query,
        order.countDocuments({
          status,
          plantName: plantName,
          riderName: riderName,
          riderDate: RiderDate, // Rider Date filter yahan add kiya hai
        }),
      ]);

      res.status(200).json({
        orders: orders,
        total: countTotal,
        message: "Orders retrieved successfully",
      });
    }
  }

  // delivery rider assigned
  if (req.query.status === "delivery rider assigned") {
    const status = req.query.status;
    if (user.role === "admin" || user.role === "plant-manager") {
      const [orders, countTotal] = await Promise.all([
        new APIFeatures(order.find({ status, plantName }), req.query)
          .sort()
          .limitFields()
          .paginate().query,
        order.countDocuments({ status, plantName }),
      ]);

      return res.status(200).json({
        orders,
        total: countTotal,
        message: "Orders retrieved successfully",
      });
    }

    if (user.role === "rider") {
      const riderName = user.name;

      const [orders, countTotal] = await Promise.all([
        new APIFeatures(
          order.find({
            status,
            // plantName,
            riderName,
          }),
          req.query,
        )
          .sort()
          .limitFields()
          .paginate().query,
        order.countDocuments({
          status,
          // plantName,
          riderName,
        }),
      ]);

      return res.status(200).json({
        orders,
        total: countTotal,
        message: "Orders retrieved successfully",
      });
    }
  }

  if (req.query.status === "cancelled") {
    if (user.role === "admin" || user.role === "plant-manager") {
      const status = req.query.status;
      const [orders, countTotal] = await Promise.all([
        new APIFeatures(order.find({ status, plantName: plantName }), req.query)
          .sort()
          .limitFields()
          .paginate().query,
        order.countDocuments({ status, plantName: plantName }),
      ]);

      return res.status(200).json({
        orders,
        total: countTotal,
        message: "Orders retrieved successfully",
      });
    }

    return res
      .status(403)
      .json({ message: "Not authorized to view cancelled orders" });
  }

  if (req.query.status === "delivered") {
    const dateStr = req.query.date || new Date().toISOString().split("T")[0];
    const start = new Date(dateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const deliveredDateFilter = {
      "statusHistory.delivered": { $gte: start, $lt: end },
    };
    if (user.role === "admin" || user.role === "plant-manager") {
      const status = req.query.status;
      const baseFilter = {
        status,
        plantName: plantName,
        ...deliveredDateFilter,
      };
      const [orders, countTotal] = await Promise.all([
        new APIFeatures(order.find(baseFilter), req.query)
          .sort()
          .limitFields()
          .paginate().query,
        order.countDocuments(baseFilter),
      ]);

      return res.status(200).json({
        orders,
        total: countTotal,
        message: "Orders retrieved successfully",
      });
    }
    return res
      .status(403)
      .json({ message: "Not authorized to view delivered orders" });
  }

  // delivered
  // if (req.query.status === "delivered") {
  //   if (user.role === "admin" || user.role === "plant-manager") {
  //     const status = req.query.status;
  //     const [orders, countTotal] = await Promise.all([
  //       new APIFeatures(order.find({ status, plantName: plantName }), req.query)
  //         .sort()
  //         .limitFields()
  //         .paginate().query,
  //       order.countDocuments({ status, plantName: plantName }),
  //     ]);

  //     res.status(200).json({
  //       orders: orders,
  //       total: countTotal,
  //       message: "Orders retrieved successfully",
  //     });
  //   }
  // }
  // if (user.role === "rider") {
  //   const status = req.query.status;
  //   const riderName = user.name;
  //   const [orders, countTotal] = await Promise.all([
  //     new APIFeatures(
  //       order.find({ status, plantName: plantName, riderName: riderName }),
  //       req.query
  //     )
  //       .sort()
  //       .limitFields()
  //       .paginate().query,
  //     order.countDocuments({
  //       status,
  //       plantName: plantName,
  //       riderName: riderName,
  //     }),
  //   ]);

  //   res.status(200).json({
  //     orders: orders,
  //     total: countTotal,
  //     message: "Orders retrieved successfully",
  //   });
  // }
});

export const getOrderTotalBill = catchAsync(async (req, res, next) => {
  const Price = await order
    .findOne({
      contactNo: req.params.number,
    })
    .select("price -_id");

  return res.status(200).json({
    Price,
    message: "Price Retrieved Successfully",
  });
});

export const getCancelPickups = catchAsync(async (req, res, next) => {
  const { email } = req.query;

  // Validate if the email exists
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  // Find the user by email to get their associated plant name
  const user = await User.findOne({ email });
  if (!user || !user.plant) {
    return res.status(404).json({ message: "User or Plant not found" });
  }

  const plantName = user.plant;

  // Fetch pickups that match the plant name and are marked as deleted
  const [pickups, countTotal] = await Promise.all([
    new APIFeatures(
      pickup.find({
        isDeleted: true,
        PickupStatus: "deleted",
        plantName: plantName,
      }), // Filter by plant name
      req.query,
    )
      .sort()
      .limitFields()
      .paginate().query,
    pickup.countDocuments({
      isDeleted: true,
      PickupStatus: "deleted",
      plantName: plantName,
    }), // Count filtered documents
  ]);

  res.status(200).json({
    Pickups: pickups,
    total: countTotal,
    message: "Cancelled Pickups Retrieved Successfully",
  });
});

// export const changeOrderStatus = catchAsync(async (req, res, next) =>
// {
//    const _id = req.params.id;
//    const status = (req.body.status).toLowerCase();
//    const updatedOrder = await order.findOneAndUpdate({_id}, {status});
//    res.status(200).json({
//     result: updatedOrder,
//     message: `Added in ${status} tab`,
//   });
// })

export const changeOrderStatus = catchAsync(async (req, res, next) => {
  const _id = req.params.id;
  const status = req.body.status.toLowerCase();
  const validStatuses = [
    "intransit",
    "processing",
    "ready for delivery",
    "cancelled",
    "delivery rider assigned",
    "delivered",
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      message: "Invalid status provided.",
    });
  }

  const updatedOrder = await order.findOneAndUpdate(
    { _id },
    { status },
    { new: true },
  );

  if (!updatedOrder) {
    return res.status(404).json({
      message: "Order not found.",
    });
  }

  res.status(200).json({
    result: updatedOrder,
    message: `Order status updated to ${status}`,
  });
});

// cron.schedule("0 0 * * 0", async () => {
//   try {
//     const deletedOrders = await order.deleteMany({});
//     console.log(`Successfully deleted ${deletedOrders.deletedCount} orders.`);
//   } catch (error) {
//     console.log("Error deleting orders:", error);
//   }
// });

/* get order by order_id */
export const getOrderByOrderId = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ErrorHandler("Invalid project ID format.", 400));
    }

    const orderData = await order.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(id) },
      },
      {
        $project: {
          _id: 0,
          contactNo: 1,
          address: 1,
          customerName: 1,
          price: 1,
          order_id: 1,
        },
      },
    ]);

    if (!orderData || orderData.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      data: orderData[0],
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

/* Update order by order id */
export const updateOrderById = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ErrorHandler("Invalid project ID format.", 400));
    }
    const { customerName, contactNo, address, price } = req.body;

    const updated = await order.findByIdAndUpdate(
      id,
      { customerName, contactNo, address, price },
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

/* Delete order by order id */
export const deleteOrderById = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    const deletedOrder = await order.findByIdAndDelete(id);

    if (!deletedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

export const getOrdersByEmailAndDate = catchAsync(async (req, res, next) => {
  const { email, date } = req.query;

  if (!email) return next(new AppError("Email is required", 400));
  if (!date) return next(new AppError("Date is required (YYYY-MM-DD)", 400));

  const user = await User.findOne({ email });
  if (!user || !user.plant) {
    return next(new AppError("User or Plant not found", 404));
  }

  const plantName = user.plant;

  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  // ✅ Match if ANY statusHistory field falls in date range
  const filter = {
    plantName,
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      // { "statusHistory.processing": { $gte: startDate, $lte: endDate } },
      // { "statusHistory.intransit": { $gte: startDate, $lte: endDate } },
      // { "statusHistory.readyForDelivery": { $gte: startDate, $lte: endDate } },
      // { "statusHistory.deliveryriderassigned": { $gte: startDate, $lte: endDate } },
      // { "statusHistory.delivered": { $gte: startDate, $lte: endDate } },
    ],
  };

  const features = new APIFeatures(order.find(filter), req.query)
    .sort()
    .paginate();

  const orders = await features.query;

  const total = await order.countDocuments(filter);

  res.status(200).json({
    orders,
    total,
    message: "Orders Retrieved Successfully",
  });
});

export const getOrdersByEmailAndDateRange = catchAsync(
  async (req, res, next) => {
    const {
      email,
      startDate,
      endDate,
      status,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    if (!email) return next(new AppError("Email is required", 400));

    const user = await User.findOne({ email });
    if (!user || !user.plant) {
      return next(new AppError("User or Plant not found", 404));
    }

    const plantName = user.plant;

    let filter = { plantName };

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      filter.createdAt = { $gte: start, $lte: end };
    }

    if (status && status !== "All Orders") {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { order_id: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { contactNo: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
      ];
    }

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const total = await order.countDocuments(filter);

    const orders = await order
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    const revenueData = await order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$price" },
        },
      },
    ]);

    const totalRevenue =
      revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

    res.status(200).json({
      status: "success",
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
      results: orders.length,
      totalRevenue,
      orders,
    });
  },
);
