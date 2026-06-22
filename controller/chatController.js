import ChatRoom from "../models/ChatRoom.js";
import Message from "../models/Message.js";
import User from "../models/userModel.js";
import Customer from "../models/customerSchema.js";
import Order from "../models/orderSchema.js";
import Pickup from "../models/pickupSchema.js";
import Faq from "../models/Faq.js";
import customerFcmService from "../services/customerFcmService.js";

export const createRoom = async (req, res) => {
    try {

        const {
            customerId,
            orderId,
            chatType = "global"
        } = req.body;

        let query = {
            customerId,
            chatType
        };

        if (chatType === "order") {
            query.orderId = orderId;
        }

        const room = await ChatRoom.findOneAndUpdate(
            query,
            {
                $setOnInsert: {
                    customerId,
                    orderId: chatType === "order" ? orderId : null,
                    chatType
                }
            },
            {
                new: true,
                upsert: true
            }
        );

        res.json({
            success: true,
            room
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

export const getRoom = async (req, res) => {

    try {

        const {
            customerId,
            orderId,
            chatType = "global"
        } = req.body;

        let query = {
            customerId,
            chatType
        };

        if (chatType === "order") {
            query.orderId = orderId;
        }

        const room = await ChatRoom.findOne(query);

        res.json({
            success: true,
            room
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

export const getMessages = async (req, res) => {

    try {

        const messages = await Message.find({
            roomId: req.params.roomId
        }).sort({
            createdAt: 1
        });

        res.json({
            success: true,
            messages
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

export const adminReadMessages = async (req, res) => {

    try {

        await ChatRoom.findByIdAndUpdate(
            req.params.roomId,
            {
                unreadAdminCount: 0
            }
        );

        await Message.updateMany(
            {
                roomId: req.params.roomId,
                senderType: "customer",
                isRead: false
            },
            {
                isRead: true,
                readAt: new Date()
            }
        );

        res.json({
            success: true
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false
        });
    }
};

export const customerReadMessages = async (req, res) => {

    try {

        await ChatRoom.findByIdAndUpdate(
            req.params.roomId,
            {
                unreadCustomerCount: 0
            }
        );

        await Message.updateMany(
            {
                roomId: req.params.roomId,
                senderType: "admin",
                isRead: false
            },
            {
                isRead: true,
                readAt: new Date()
            }
        );

        res.json({
            success: true
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false
        });
    }
};

export const getRooms = async (req, res) => {

    try {

        const rooms = await ChatRoom.find()
        .sort({
            updatedAt: -1
        });

        res.json({
            success: true,
            rooms
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

export const getCustomerOrders = async (req, res) => {

    try {

        const contactNo = req.params.contactNo;

        const orders = await Order.find({
            contactNo
        }).sort({
            createdAt: -1
        });

        res.json({
            success: true,
            orders
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

export const getOrderStatus = async (req, res) => {

    try {

        const order = await Order.findOne({
            order_id: req.params.orderId
        });

        if (!order) {

            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.json({
            success: true,
            order
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

export const getFaqs = async (req, res) => {

    try {

        const { category } = req.query;

        let query = {
            isActive: true
        };

        if (category) {
            query.category = category;
        }

        const faqs = await Faq.find(query);

        res.json({
            success: true,
            faqs
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

export const adminChatrooms = async (req, res) => {

    try {

        const rooms = await ChatRoom.find()
        .sort({
            lastMessageAt: -1
        });

        const formattedRooms = await Promise.all(

            rooms.map(async (room) => {

                const normalizedPhone =
                room.customerId.startsWith("91")
                    ? room.customerId.slice(2)
                    : room.customerId;

                const user = await User.findOne({
                    phone: normalizedPhone
                });

                let customer = null;

                if (user?._id) {

                    customer = await Customer.findOne({
                        user: user._id
                    });
                }

                let order = null;

                if (room.orderId) {

                    order = await Order.findOne({
                        order_id: room.orderId
                    });
                }

                return {

                    ...room.toObject(),

                    customerName:
                        customer?.firstName ||
                        user?.name ||
                        room.customerId,

                    customerLastName:
                        customer?.lastName || "",

                    customerPhone:
                        user?.phone ||
                        room.customerId,

                    customerEmail:
                        user?.email || "",

                    customerAvatar:
                        user?.avatar || "",

                    customerRole:
                        user?.role || "",

                    orderStatus:
                        order?.status || "",

                    plantName:
                        order?.plantName || "",

                    deliveryType:
                        order?.deliveryType || ""
                };
            })
        );

        res.json({
            success: true,
            rooms: formattedRooms
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};


export const sendMessage = async (req, res) => {
    try {
        const { roomId, senderType, senderId, message } = req.body;

        const messageData = await Message.create({
            roomId, senderType, senderId, message
        });

        const updatedRoom = await ChatRoom.findByIdAndUpdate(roomId, {
            lastMessage: message,
            lastMessageAt: new Date(),
            lastMessageSender: senderType,
            $inc: {
                unreadAdminCount: senderType === "customer" ? 1 : 0,
                unreadCustomerCount: senderType === "admin" ? 1 : 0
            }
        }, { new: true });
        // fcm emit (ss)
        if (updatedRoom && senderType === "admin") {
            try {
                await customerFcmService.sendToCustomer(
                    updatedRoom.customerId,
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
            } catch (fcmError) {
                console.error("Failed to send chat FCM:", fcmError);
            }
        }

        const io = req.app.locals.io;
        if (io) {
            io.to(roomId.toString()).emit("receiveChatMessage", messageData);
            io.emit("chatRoomsUpdated");
            console.log(`Message emitted to room ${roomId}`);
        } else {
            console.error("Socket.IO instance not found in app.locals");
        }

        res.status(200).json({
            success: true,
            messageData
        });
    } catch (error) {
        console.error("Send message error:", error);
        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

// export const botReply = async (req, res) => {
//     try {
//         const { roomId, question } = req.body;
//         if (!roomId || !question) {
//             return res.status(400).json({ success: false, message: "Missing roomId or question" });
//         }

//         // Find matching FAQ (case-insensitive, partial match)
//         const faq = await Faq.findOne({
//             question: { $regex: new RegExp(question, "i") },
//             isActive: true
//         });

//         let answer = "Sorry, I couldn't find an answer to that. Please contact support.";
//         if (faq) {
//             answer = faq.answer;
//         }

//         // Create admin (bot) message
//         const botMessage = await Message.create({
//             roomId,
//             senderType: "admin",
//             senderId: "bot",
//             message: answer
//         });

//         // Update room last message info
//         await ChatRoom.findByIdAndUpdate(roomId, {
//             lastMessage: answer,
//             lastMessageAt: new Date(),
//             lastMessageSender: "admin",
//             $inc: { unreadCustomerCount: 1 }
//         });

//         // Emit real-time event
//         const io = req.app.locals.io;
//         if (io) {
//             io.to(roomId.toString()).emit("receiveChatMessage", botMessage);
//             io.emit("chatRoomsUpdated");
//         }

//         res.status(200).json({ success: true, message: botMessage });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ success: false, message: "Server Error" });
//     }
// };

async function orderStatus(orderId) {
    const order = await Order.findOne({ order_id: orderId });
    if (!order) return "Order not found.";
    let deliveredDate = null;
    if (order.actualDeliveryAt) {
        deliveredDate = order.actualDeliveryAt;
    } else if (order.statusHistory && order.statusHistory.delivered) {
        deliveredDate = order.statusHistory.delivered;
    }
    let message = `Your order ${order.order_id} is currently ${order.status}.`;
    if (order.status === 'delivered' && deliveredDate) {
        message += ` It was delivered on ${new Date(deliveredDate).toDateString()}.`;
    }
    return message;
}

// Helper: Get delivery ETA
async function getDeliveryEta(orderId) {
    const order = await Order.findOne({ order_id: orderId });
    if (!order) return "Order not found.";
    if (order.status === 'delivered') return "Your order has already been delivered.";
    if (order.estimatedDeliveryAt) {
        return `Estimated delivery: ${new Date(order.estimatedDeliveryAt).toDateString()}`;
    }
    return "We are processing your order. You will receive an update soon.";
}

async function getPickupStatus(orderId) {
    const pickup = await Pickup.findOne({ orderId: orderId });
    if (!pickup) return "No pickup information available for this order.";
    return `Pickup status: ${pickup.status}. Scheduled for ${new Date(pickup.scheduledAt).toLocaleString()}`;
}

export const botReply = async (req, res) => {
    try {
        const { roomId, question } = req.body;
        if (!roomId || !question) {
            return res.status(400).json({ success: false, message: "Missing roomId or question" });
        }

        const faq = await Faq.findOne({
            question: { $regex: new RegExp(question, "i") },
            isActive: true
        });

        let answer = "Sorry, I couldn't find an answer to that. Please contact support.";
        
        if (faq) {
            if (faq.answerType === "dynamic" && faq.action) {
                const room = await ChatRoom.findById(roomId);
                const orderId = room?.orderId;
                
                if (!orderId) {
                    answer = "I need your order ID to help you. Could you please provide it?";
                } else {
                    switch (faq.action) {
                        case "GET_ORDER_STATUS":
                            answer = await orderStatus(orderId);
                            break;
                        case "GET_DELIVERY_ETA":
                            answer = await getDeliveryEta(orderId);
                            break;
                        case "GET_PICKUP_STATUS":
                            answer = await getPickupStatus(orderId);
                            break;
                        default:
                            answer = faq.answer || "I'm unable to process that request right now.";
                    }
                }
            } else {
                // Static answer
                answer = faq.answer || "Sorry, no answer available.";
            }
        }

        const botMessage = await Message.create({
            roomId,
            senderType: "admin",
            senderId: "bot",
            message: answer
        });

        const updatedRoom = await ChatRoom.findByIdAndUpdate(roomId, {
            lastMessage: answer,
            lastMessageAt: new Date(),
            lastMessageSender: "admin",
            $inc: { unreadCustomerCount: 1 }
        }, { new: true });
        //fcm emit(ss)
        if (updatedRoom) {
            try {
                await customerFcmService.sendToCustomer(
                    updatedRoom.customerId,
                    {
                        title: "Support Bot Reply",
                        body: answer,
                    },
                    {
                        roomId: roomId.toString(),
                        type: "chat",
                        senderId: "bot",
                    }
                );
            } catch (fcmError) {
                console.error("Failed to send bot FCM:", fcmError);
            }
        }

        const io = req.app.locals.io;
        if (io) {
            io.to(roomId.toString()).emit("receiveChatMessage", botMessage);
            io.emit("chatRoomsUpdated");
        }

        res.status(200).json({ success: true, message: botMessage });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Get orders by customer phone
export const getOrdersByPhone = async (req, res) => {
    try {
        let { phone } = req.params;
        phone = phone.replace(/\D/g, '');
        const possibleNumbers = [phone];
        if (phone.startsWith('91')) {
            possibleNumbers.push(phone.slice(2));
        } else {
            possibleNumbers.push('91' + phone);
        }
        
        const orders = await Order.find({ contactNo: { $in: possibleNumbers } })
            .sort({ createdAt: -1 })
            .select('order_id status deliveryType plantName createdAt');
        
        res.json({ success: true, orders });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getRoomByCustomer = async (req, res) => {
    try {
        const { customerId, orderId, chatType = "global" } = req.query;
        let query = { customerId, chatType };
        if (chatType === "order" && orderId) query.orderId = orderId;
        const room = await ChatRoom.findOne(query);
        res.json({ success: true, room });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};