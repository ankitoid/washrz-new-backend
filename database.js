import mongoose from "mongoose";
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("DataBase Connected!:)"))
  .catch((err) => console.log("hii error", err));

// import mongoose from "mongoose";
// import dns from "node:dns/promises";
// dns.setServers(["1.1.1.1"]); 
// await mongoose
//   .connect(process.env.MONGO_URI)
//   .then(() => console.log("DataBase Connected!:)"))
//   .catch((err) => console.log("hii error", err));