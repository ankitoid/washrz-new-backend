import mongoose from "mongoose";

const FaqSchema =
new mongoose.Schema({
    question: {
        type: String,
        required: true
    },
    answer: {
        type: String,
        default: ""
    },
    category: {
        type: String,
        enum: [
            "general",
            "order",
            "payment",
            "pickup",
            "refund"
        ],
        default: "general"
    },
    answerType: {
        type: String,
        enum: [
            "static",
            "dynamic"
        ],
        default: "static"
    },
    action: {
        type: String,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true
});

const Faq =
mongoose.model(
    "faqs",
    FaqSchema
);

export default Faq;
