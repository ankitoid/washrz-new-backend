import mongoose from "mongoose";
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("DataBase Connected!:)"))
  .catch((err) => console.log("hii error", err));
