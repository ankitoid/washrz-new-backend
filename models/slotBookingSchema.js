// backend/models/Booking.js
import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true
  },
  zoneId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  date: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
    index: true
  },
  slotTime: {
    type: String,
    required: true
  },
    deliveryLabel: {
    type: String,
    default: null
  },

  isSameDayDelivery: {
    type: Boolean,
    default: false
  },

  customerDetails: {
    appCustomerId : {type:String,requried : true},
    name: { type: String, required: true },
    phone: { type: String, required: true },
  },
  status: {
    type: String,
    enum: ['confirmed', 'completed', 'cancelled', 'no_show'],
    default: 'confirmed',
    index: true
  },
//   paymentStatus: {
//     type: String,
//     enum: ['pending', 'paid', 'failed'],
//     default: 'pending'
//   },
//   paymentAmount: {
//     type: Number,
//     default: 0
//   },
//   paymentMethod: {
//     type: String,
//     enum: ['cash', 'card', 'upi', 'wallet'],
//     default: 'cash'
//   },
  pickupDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  pickupId : {type: String},
  completedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
bookingSchema.index({ zoneId: 1, date: 1, slotTime: 1 });
bookingSchema.index({ zoneId: 1, date: 1, status: 1 });

// Method to check if booking can be cancelled
bookingSchema.methods.canCancel = function() {
  const now = new Date();
  const bookingDate = new Date(this.date);
  
  // Can cancel if:
  // 1. Status is confirmed
  // 2. Booking date is today or future
  // 3. Not already completed or cancelled
  
  if (this.status !== 'confirmed') return false;
  
  // Parse slot time to get end time
  const [startTime, endTime] = this.slotTime.split(' - ');
  const [endHour, endMinute] = parseTimeToMinutes(endTime);
  const bookingEndDateTime = new Date(this.date);
  bookingEndDateTime.setHours(endHour, endMinute, 0);
  
  // Can cancel up to 1 hour before slot ends
  const oneHourBeforeEnd = new Date(bookingEndDateTime.getTime() - 60 * 60 * 1000);
  
  return now < oneHourBeforeEnd;
};

// Helper function to parse time
function parseTimeToMinutes(timeStr) {
  const match = timeStr.match(/(\d+):(\d+)\s+(AM|PM)/i);
  if (!match) return [0, 0];
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();
  
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  
  return [hours, minutes];
}

export default mongoose.model("Booking", bookingSchema);