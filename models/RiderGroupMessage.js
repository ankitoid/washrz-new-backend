import mongoose from "mongoose";

const RiderGroupMessageSchema = new mongoose.Schema({
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "RiderGroup", required: true, index: true },
    senderId: { type: String, required: true },
    senderType: { type: String, enum: ["admin", "rider"], required: true },
    senderName: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    readBy: [{ userId: String, readAt: Date }]
}, { timestamps: true });

export default mongoose.model("RiderGroupMessage", RiderGroupMessageSchema);