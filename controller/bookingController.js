// backend/controllers/bookingController.js
import Booking from '../models/slotBookingSchema.js';
import Zone from '../models/Zone.js';
import SlotConfig from '../models/SlotConfig.js';

// Helper: Get current local date
const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper: Get available capacity for a slot
export const getSlotAvailability = async (zoneId, date, slotTime) => {
  try {
    // Get zone to find capacity
    const zone = await Zone.findOne({ zoneId: zoneId.toUpperCase() });
    if (!zone || !zone.slotTemplate) {
      return { totalCapacity: 0, bookedCount: 0, availableCapacity: 0 };
    }
    
    // Find slot template
    const slotTemplate = zone.slotTemplate.slots.find(s => s.time === slotTime);
    if (!slotTemplate) {
      return { totalCapacity: 0, bookedCount: 0, availableCapacity: 0 };
    }
    
    // Check for date override
    const config = await SlotConfig.findOne({ date });
    let totalCapacity = slotTemplate.defaultCapacity;
    
    if (config) {
      const zoneConfig = config.zones.find(z => z.zoneId === zoneId.toUpperCase());
      if (zoneConfig && zoneConfig.overrides) {
        const override = zoneConfig.overrides.find(o => o.time === slotTime);
        if (override && override.capacity !== undefined) {
          totalCapacity = override.capacity;
        }
      }
    }
    
    // Count confirmed bookings
    const bookedCount = await Booking.countDocuments({
      zoneId: zoneId.toUpperCase(),
      date,
      slotTime,
      status: 'confirmed'
    });
    
    return {
      totalCapacity,
      bookedCount,
      availableCapacity: totalCapacity - bookedCount
    };
  } catch (error) {
    console.error('Error getting slot availability:', error);
    return { totalCapacity: 0, bookedCount: 0, availableCapacity: 0 };
  }
};

// GET /api/bookings/availability
export const checkAvailability = async (req, res) => {
  try {
    const { zoneId, date, slotTime } = req.query;
    
    if (!zoneId) {
      return res.status(400).json({ error: 'zoneId is required' });
    }
    
    const targetDate = date || getLocalDateString();
    
    let availability = [];
    
    if (slotTime) {
      // Check specific slot
      const slotAvailability = await getSlotAvailability(zoneId, targetDate, slotTime);
      availability = [{
        slotTime,
        ...slotAvailability
      }];
    } else {
      // Check all slots for zone
      const zone = await Zone.findOne({ zoneId: zoneId.toUpperCase() });
      if (!zone || !zone.slotTemplate) {
        return res.status(404).json({ error: 'Zone not found or not configured' });
      }
      
      for (const slot of zone.slotTemplate.slots) {
        const slotAvail = await getSlotAvailability(zoneId, targetDate, slot.time);
        availability.push({
          slotTime: slot.time,
          ...slotAvail
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        zoneId,
        date: targetDate,
        availability
      }
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ error: 'Failed to check availability: ' + error.message });
  }
};

// POST /api/bookings/create
export const createBooking = async (req, res) => {
  try {
    const {
      zoneId,
      date,
      slotTime,
      customerDetails,
      pickupDetails = {},
      pickupId,
    } = req.body;
    
    // Validation
    if (!zoneId || !slotTime || !customerDetails || !customerDetails.name || !customerDetails.phone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: zoneId, slotTime, customerDetails.name, customerDetails.phone'
      });
    }
    
    const bookingDate = date || getLocalDateString();
    
    // Check availability before creating booking
    const availability = await getSlotAvailability(zoneId, bookingDate, slotTime);
    
    if (availability.availableCapacity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Slot is fully booked',
        availableCapacity: 0,
        totalCapacity: availability.totalCapacity,
        bookedCount: availability.bookedCount
      });
    }
    
    // Check if zone is enabled for this date
    const config = await SlotConfig.findOne({ date: bookingDate });
    let zoneEnabled = true;
    if (config) {
      const zoneConfig = config.zones.find(z => z.zoneId === zoneId.toUpperCase());
      if (zoneConfig && zoneConfig.enabled === false) {
        return res.status(400).json({
          success: false,
          error: 'Service is disabled in this zone for the selected date'
        });
      }
    }
    
    // Check if slot is enabled
    const zone = await Zone.findOne({ zoneId: zoneId.toUpperCase() });
    if (zone && zone.slotTemplate) {
      const slotTemplate = zone.slotTemplate.slots.find(s => s.time === slotTime);
      if (slotTemplate) {
        let slotEnabled = slotTemplate.defaultEnabled;
        
        if (config) {
          const zoneConfig = config.zones.find(z => z.zoneId === zoneId.toUpperCase());
          if (zoneConfig && zoneConfig.overrides) {
            const override = zoneConfig.overrides.find(o => o.time === slotTime);
            if (override && override.enabled !== undefined) {
              slotEnabled = override.enabled;
            }
          }
        }
        
        if (!slotEnabled) {
          return res.status(400).json({
            success: false,
            error: 'This time slot is currently disabled'
          });
        }
      }
    }
    
    // Generate unique booking ID
    const bookingId = `BKG${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    // Create booking
    const booking = await Booking.create({
      bookingId,
      zoneId: zoneId.toUpperCase(),
      date: bookingDate,
      slotTime,
      customerDetails: {
        name: customerDetails.name,
        phone: customerDetails.phone,
      },
    //   paymentStatus: paymentMethod === 'cash' ? 'pending' : 'pending',
    //   paymentMethod,
    //   paymentAmount,
      pickupDetails,
      pickupId,
      status: 'confirmed'
    });
    
    // Get updated availability
    const newAvailability = await getSlotAvailability(zoneId, bookingDate, slotTime);
    
    res.status(201).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: {
        booking: {
          bookingId: booking.bookingId,
          zoneId: booking.zoneId,
          date: booking.date,
          slotTime: booking.slotTime,
          customerDetails: booking.customerDetails,
          status: booking.status,
          createdAt: booking.createdAt
        },
        availability: newAvailability
      }
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking: ' + error.message
    });
  }
};

// PUT /api/bookings/:bookingId/cancel
export const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    
    const booking = await Booking.findOne({ bookingId });
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }
    
    if (!booking.canCancel()) {
      return res.status(400).json({
        success: false,
        error: 'Booking cannot be cancelled. Either slot has ended or booking is already completed/cancelled.'
      });
    }
    
    // Update booking status
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason || 'Customer cancelled';
    await booking.save();
    
    // Get updated availability
    const availability = await getSlotAvailability(booking.zoneId, booking.date, booking.slotTime);
    
    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        bookingId: booking.bookingId,
        status: booking.status,
        availability
      }
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel booking: ' + error.message
    });
  }
};

// PUT /api/bookings/:bookingId/complete
export const completeBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const booking = await Booking.findOne({ bookingId });
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }
    
    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        error: `Cannot complete booking with status: ${booking.status}`
      });
    }
    
    booking.status = 'completed';
    booking.completedAt = new Date();
    await booking.save();
    
    res.json({
      success: true,
      message: 'Booking marked as completed',
      data: {
        bookingId: booking.bookingId,
        status: booking.status,
        completedAt: booking.completedAt
      }
    });
  } catch (error) {
    console.error('Error completing booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete booking: ' + error.message
    });
  }
};

// GET /api/bookings
export const getBookings = async (req, res) => {
  try {
    const { zoneId, date, status, startDate, endDate, limit = 50, page = 1 } = req.query;
    
    let query = {};
    
    if (zoneId) query.zoneId = zoneId.toUpperCase();
    if (date) query.date = date;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Booking.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings: ' + error.message
    });
  }
};

// GET /api/bookings/stats
export const getBookingStats = async (req, res) => {
  try {
    const { zoneId, date } = req.query;
    const targetDate = date || getLocalDateString();
    
    let query = { date: targetDate };
    if (zoneId) query.zoneId = zoneId.toUpperCase();
    
    const stats = await Booking.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            zoneId: '$zoneId',
            slotTime: '$slotTime',
            status: '$status'
          },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get zone capacities for context
    const zones = await Zone.find(
      zoneId ? { zoneId: zoneId.toUpperCase() } : {}
    );
    
    const capacityInfo = {};
    for (const zone of zones) {
      if (zone.slotTemplate) {
        capacityInfo[zone.zoneId] = {};
        for (const slot of zone.slotTemplate.slots) {
          capacityInfo[zone.zoneId][slot.time] = slot.defaultCapacity;
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        date: targetDate,
        stats,
        capacityInfo
      }
    });
  } catch (error) {
    console.error('Error getting booking stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats: ' + error.message
    });
  }
};