import mongoose from "mongoose";

const b2bSchema = new mongoose.Schema(
  {
    orgType: {
      type: String,
      required: true,
      enum: ["Hospital", "Hotel", "School/University", "Corporate", "Other"],
    },
    orgName: {
      type: String,
      required: [true, "Organization Name is required"],
    },
    contactPerson: {
      type: String,
      required: [true, "Contact Person is required"],
    },
    phone: {
      type: String,
      required: [true, "Phone Number is required"],
    },
    email: {
      type: String,
    },
    requirements: {
      type: String,
    },
    status: {
      type: String,
      default: "Pending",
      enum: ["Pending", "Contacted", "Resolved"],
    },
  },
  { timestamps: true }
);

const B2b = mongoose.model("B2b", b2bSchema);
export default B2b;
