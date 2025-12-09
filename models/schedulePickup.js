import mongoose from 'mongoose';
const pickupSchema = mongoose.Schema;

const schema = new pickupSchema(
    {
        Name: String,
        Contact: String,
        Address: String,
        slot: String,
        PickupStatus: String,
        isDeleted: { type: Boolean, default: false }
    },
    { timestamps: true }
)

const schedulePickup = mongoose.model('schedulePickup', schema);
export default schedulePickup;