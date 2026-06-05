import mongoose from "mongoose";

const RiderGroupSchema = new mongoose.Schema({
    groupName: { type: String, default: null },
    chatType: { type: String, enum: ['direct', 'group'], required: true },
    members: [{
        userId: { type: String, required: true }, // riderId or adminId
        userType: { type: String, enum: ['rider', 'admin'], required: true },
        name: String,
        phone: String,
        joinedAt: { type: Date, default: Date.now }
    }],
    createdBy: { type: String, required: true }, // admin ID
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageSender: { type: String, enum: ['rider', 'admin'], default: 'rider' },
    unreadCounts: { type: Map, of: Number, default: {} }, // key = userId, value = unread count
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

RiderGroupSchema.index({ chatType: 1, 'members.userId': 1 }, { unique: true, partialFilterExpression: { chatType: 'direct' } });

export default mongoose.model("RiderGroup", RiderGroupSchema);