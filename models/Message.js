import mongoose from "mongoose";

const MessageSchema =
new mongoose.Schema({
    roomId: {
        type:
            mongoose.Schema.Types.ObjectId,
        ref:
            "chatrooms",
        required: true,
        index: true
    },
    senderType: {
        type: String,
        enum: [
            "customer",
            "admin",
            "bot"
        ],
        required: true
    },
    senderId: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: false
    },
    messageType: {
        type: String,
        enum: [
            "text",
            "image",
            "file"
        ],
        default: "text"
    },
    fileUrl: {
        type: String,
        default: null
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    },
    delivered: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});
MessageSchema.index({
    roomId: 1,
    createdAt: 1
});
const Message =
mongoose.model(
    "messages",
    MessageSchema
);

export default Message;
