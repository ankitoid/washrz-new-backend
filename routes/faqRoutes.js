import express from "express";

import {
    getFaqs,
    botReply
} from "../controller/faqController.js";

const router =
express.Router();

router.get("/", getFaqs);
router.post("/bot-reply", botReply); 

export {
    router as default
};

