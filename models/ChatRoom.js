import mongoose from "mongoose";

const ChatRoomSchema =
new mongoose.Schema({
    customerId: {
        type: String,
        required: true,
        index: true
    },
    orderId: {
        type: String,
        index: true,
        default: null
    },
    chatType: {
        type: String,
        enum: [
            "global",
            "order"
        ],
        default: "global"
    },
    adminId: {
        type: String,
        default: null
    },
    lastMessage: {
        type: String,
        default: ""
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    unreadAdminCount: {
        type: Number,
        default: 0
    },
    unreadCustomerCount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: [
            "open",
            "closed"
        ],
        default: "open"
    },
    lastMessageSender: {
        type: String,
        enum: [
            "customer",
            "admin",
            "bot"
        ],
        default: "customer"
    }

}, {
    timestamps: true
});

ChatRoomSchema.index({
    customerId: 1,
    chatType: 1,
    orderId: 1
}, {
    unique: true,
    partialFilterExpression: {
        orderId: {
            $type: "string"
        }
    }
});

const ChatRoom =
mongoose.model(
    "chatrooms",
    ChatRoomSchema
);

export default ChatRoom;

