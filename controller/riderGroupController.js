import RiderGroup from "../models/RiderGroup.js";
import RiderGroupMessage from "../models/RiderGroupMessage.js";
import User from "../models/userModel.js";

// export const createGroup = async (req, res) => {
//     try {
//         const { groupName, description, memberIds, adminId } = req.body;
//         const members = [];
//         for (const riderId of memberIds) {
//             const rider = await User.findById(riderId).select("name phone");
//             if (rider) members.push({ riderId, name: rider.name, phone: rider.phone });
//         }
//         const group = await RiderGroup.create({ groupName, description, members, createdBy: adminId });
//         res.status(201).json({ success: true, group });
//     } catch (error) {
//         res.status(500).json({ success: false, message: error.message });
//     }
// };

export const createGroup = async (req, res) => {
    try {
        let { groupName, description, members, createdBy, chatType = "group" } = req.body;
        
        // If members not provided but memberIds provided (for backward compatibility)
        if (!members && req.body.memberIds) {
            const memberIds = req.body.memberIds;
            members = [];
            // Add admin
            members.push({
                userId: createdBy || "admin",
                userType: "admin",
                name: "Admin",
                phone: ""
            });
            for (const riderId of memberIds) {
                const rider = await User.findById(riderId).select("name phone");
                if (rider) {
                    members.push({
                        userId: riderId,
                        userType: "rider",
                        name: rider.name,
                        phone: rider.phone
                    });
                }
            }
        }
        
        if (!members || members.length === 0) {
            return res.status(400).json({ success: false, message: "Members array required" });
        }

        const group = await RiderGroup.create({
            groupName,
            description: description || "",
            chatType,
            members,
            createdBy: createdBy || "admin",
            lastMessage: "",
            lastMessageAt: new Date(),
            unreadCounts: new Map(),
            isActive: true
        });
        res.status(201).json({ success: true, group });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllGroups = async (req, res) => {
    const groups = await RiderGroup.find().sort({ updatedAt: -1 });
    res.json({ success: true, groups });
};

export const getGroupsForRider = async (req, res) => {
    try {
        const { riderId } = req.params;
        const rooms = await RiderGroup.find({ 
            "members.userId": riderId, 
            isActive: true 
        }).sort({ updatedAt: -1 });
        res.json({ success: true, groups: rooms });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const addMember = async (req, res) => {
    const { groupId, riderId } = req.body;
    const rider = await User.findById(riderId).select("name phone");
    if (!rider) return res.status(404).json({ success: false, message: "Rider not found" });
    const group = await RiderGroup.findById(groupId);
    if (!group) return res.status(404).json({ success: false });
    if (group.members.some(m => m.riderId === riderId)) return res.status(400).json({ success: false, message: "Already member" });
    group.members.push({ riderId, name: rider.name, phone: rider.phone });
    await group.save();
    res.json({ success: true, group });
};

export const removeMember = async (req, res) => {
    const { groupId, riderId } = req.body;
    const group = await RiderGroup.findById(groupId);
    group.members = group.members.filter(m => m.riderId !== riderId);
    await group.save();
    res.json({ success: true });
};

export const getGroupMessages = async (req, res) => {
    const { groupId } = req.params;
    const messages = await RiderGroupMessage.find({ groupId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
};

// export const sendGroupMessage = async (req, res) => {
//     const { groupId, senderId, senderType, senderName, message } = req.body;
//     const newMessage = await RiderGroupMessage.create({ groupId, senderId, senderType, senderName, message });
//     await RiderGroup.findByIdAndUpdate(groupId, { lastMessage: message, lastMessageAt: new Date() });
//     const io = req.app.locals.io;
//     io.to(`group_${groupId}`).emit("receiveGroupMessage", newMessage);
//     res.status(201).json({ success: true, message: newMessage });
// };



// Get or create a direct chat room between admin and a rider
export const getOrCreateDirectChat = async (req, res) => {
    try {
        const { riderId } = req.params;
        // Use a fixed admin ID instead of req.user for now
        const adminId = "admin"; 
        
        const rider = await User.findById(riderId).select("name phone");
        if (!rider) {
            return res.status(404).json({ success: false, message: "Rider not found" });
        }

        // Check if direct chat already exists
        let room = await RiderGroup.findOne({
            chatType: "direct",
            "members.userId": { $all: [adminId, riderId] }
        });
        if (!room) {
            room = await RiderGroup.create({
                chatType: "direct",
                members: [
                    { userId: adminId, userType: "admin", name: "Admin", phone: "" },
                    { userId: riderId, userType: "rider", name: rider.name, phone: rider.phone }
                ],
                createdBy: adminId,
                unreadCounts: new Map()
            });
        }
        res.json({ success: true, room });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all rooms for admin (both group and direct)
export const getAllRoomsForAdmin = async (req, res) => {
    try {
        const rooms = await RiderGroup.find({
            "members.userId": "admin",
            isActive: true
        }).sort({ updatedAt: -1 }).lean();

        // unreadCounts is already a plain object; no conversion needed
        const formattedRooms = rooms.map(room => ({
            ...room,
            unreadCounts: room.unreadCounts || {}
        }));

        res.json({ success: true, rooms: formattedRooms });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all rooms for a rider (both group and direct)
export const getRoomsForRider = async (req, res) => {
    try {
        const { riderId } = req.params;
        const rooms = await RiderGroup.find({
            "members.userId": riderId,
            isActive: true
        }).sort({ updatedAt: -1 }).lean();

        const formattedRooms = rooms.map(room => ({
            ...room,
            unreadCounts: room.unreadCounts || {}
        }));

        res.json({ success: true, rooms: formattedRooms });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const sendGroupMessage = async (req, res) => {
    try {
        const { groupId, senderId, senderType, senderName, message } = req.body;
        const room = await RiderGroup.findById(groupId);
        if (!room) return res.status(404).json({ success: false });

        const newMessage = await RiderGroupMessage.create({
            groupId,
            senderId,
            senderType,
            senderName,
            message
        });

        // Update room lastMessage, lastMessageAt
        room.lastMessage = message;
        room.lastMessageAt = new Date();
        room.lastMessageSender = senderType;
        // Increment unread counts for all members except sender
        for (const member of room.members) {
            if (member.userId !== senderId) {
                const current = room.unreadCounts.get(member.userId) || 0;
                room.unreadCounts.set(member.userId, current + 1);
            }
        }
        await room.save();

        const io = req.app.locals.io;
        io.to(`group_${groupId}`).emit("receiveGroupMessage", newMessage);
        io.emit("chatRoomsUpdated"); // for admin sidebar refresh
        res.status(201).json({ success: true, message: newMessage });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const { groupId, userId } = req.body;
        const room = await RiderGroup.findById(groupId);
        if (!room) return res.status(404).json({ success: false });
        room.unreadCounts.set(userId, 0);
        await room.save();
        // Also update messages' isRead if needed (optional)
        await RiderGroupMessage.updateMany(
            { groupId, senderId: { $ne: userId }, isRead: false },
            { isRead: true, readAt: new Date() }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};


