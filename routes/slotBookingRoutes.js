// backend/routes/bookingRoutes.js
import express from 'express';
import { cancelBooking, checkAvailability, completeBooking, createBooking, getBookings, getBookingStats } from '../controller/bookingController.js';

const router = express.Router();

// Public routes (for app users)
router.get('/availability', checkAvailability);
router.post('/create', createBooking);
router.put('/:bookingId/cancel', cancelBooking);

// Protected routes (admin only - add your auth middleware)
router.get('/', getBookings);
router.get('/stats', getBookingStats);
router.put('/:bookingId/complete', completeBooking);

export default router;