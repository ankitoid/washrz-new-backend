import Faq from "../models/Faq.js";


export const getFaqs = async (req, res) => {

    try {

        const category =
            req.query.category
            || "general";

        const faqs =
        await Faq.find({

            category,

            isActive: true
        });

        res.status(200).json({

            success: true,

            faqs
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            success: false,

            message:
                "Server Error"
        });
    }
};

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
            answer = faq.answer;
        }

        const botMessage = await Message.create({
            roomId,
            senderType: "admin",
            senderId: "bot",
            message: answer
        });

        await ChatRoom.findByIdAndUpdate(roomId, {
            lastMessage: answer,
            lastMessageAt: new Date(),
            lastMessageSender: "admin",
            $inc: { unreadCustomerCount: 1 } // mark as unread for customer (optional)
        });

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

