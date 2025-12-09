import express from "express";
const router = express.Router();

router.get("/admin", (req, res) => {
  res.status(200).send({
    message: "hii from admin side",
    code: 200,
  });
});

export { router as default };
