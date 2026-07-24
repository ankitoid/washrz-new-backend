import dotenv from "dotenv";
dotenv.config();

/**
 * Default constraint values for the Vehicle Routing Problem (VRP) optimizer.
 */
export const DEFAULT_CONSTRAINTS = {
  minRiders: 1,
  maxRiders: 3,
  minStops: 1,
  maxStops: 20,
  weightPerStopKg: 0.5,
  capacityKg: 20.0,
  penalty: 5000,
  maxTripHours: 10.0,
  avgSpeedKmph: 30.0,
  serviceTimeMinutes: 5.0,
};

/**
 * Depot location read from environment variables with fallback defaults.
 */
export const DEPOT = {
  lat: parseFloat(process.env.DEPOT_LAT) || 28.5,
  lng: parseFloat(process.env.DEPOT_LNG) || 77.3,
  name: process.env.DEPOT_NAME || "Main Depot",
};

/**
 * Endpoint for the external Python VRP Optimizer API.
 */
export const OPTIMIZER_API_URL =
  process.env.OPTIMIZER_API_URL || "http://optimizer.shiptos.com/api/optimize";
