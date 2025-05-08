import mongoose from "mongoose";
const customerSchema = mongoose.Schema;

const schema = new customerSchema(
  {
    Name: String,
    Phone: Number,
    Address: String,
    Date: String,
  },
  { timestamps: true }
);

const customer = mongoose.model("customer", schema);
export default customer;
