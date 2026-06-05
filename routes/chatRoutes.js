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
    getRoomByCustomer
} from "../controller/chatController.js";

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



export default router;