import express from "express";

import {
    createRoom,
    getRoom,
    getMessages,
    adminReadMessages,
    customerReadMessages,
    getRooms,
    getCustomerOrders,
    getOrderStatus,
    getFaqs,
    adminChatrooms,
    sendMessage,
    botReply,
    getOrdersByPhone,
    getRoomByCustomer,
    uploadChatImage
} from "../controller/chatController.js";
import { upload } from "../services/s3services.js";

const router = express.Router();
router.get("/room/exists", getRoomByCustomer);

router.post("/create-room", createRoom);

router.post("/get-room", getRoom);

router.get("/messages/:roomId", getMessages);

router.put("/admin/read/:roomId", adminReadMessages);

router.put("/customer/read/:roomId", customerReadMessages);

router.get("/rooms", getRooms);

router.get("/orders/:contactNo", getCustomerOrders);

router.get("/order-status/:orderId", getOrderStatus);

router.get("/faqs", getFaqs);

router.get("/admin/chatrooms", adminChatrooms);
router.post("/send-message", sendMessage);
router.post("/bot-reply", botReply);
router.get('/orders-by-phone/:phone', getOrdersByPhone);


//upload image in the chat 

router.post("/upload-chat-image", (req, res) => {
  console.log('📥 Upload route hit');
  try {
    upload.single('image')(req, res, function (err) {
      if (err) {
        console.error("❌ Multer error:", err);
        return res.status(400).json({ success: false, message: err.message });
      }
      console.log('✅ Multer passed, calling controller');
      uploadChatImage(req, res);
    });
  } catch (error) {
    console.error('🔥 Unexpected error in upload route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


export default router;