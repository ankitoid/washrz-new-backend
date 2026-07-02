import express from "express";
import { 
    createGroup, 
    getAllGroups, 
    getGroupsForRider, 
    addMember, 
    removeMember, 
    getGroupMessages, 
    sendGroupMessage,
    getAllRoomsForAdmin,      // new
    getOrCreateDirectChat,    // new
    markAsRead               // new
} from "../controller/riderGroupController.js";


const router = express.Router();


router.post("/group", createGroup);
router.get("/groups", getAllGroups);
router.get("/groups/rider/:riderId", getGroupsForRider);
router.post("/group/add-member", addMember);
router.post("/group/remove-member", removeMember);
router.get("/group/:groupId/messages", getGroupMessages);
router.post("/group/message", sendGroupMessage);
router.get("/admin/rooms", getAllRoomsForAdmin);
router.get("/direct/:riderId", getOrCreateDirectChat);
router.post("/mark-read", markAsRead);


export default router;