import express from "express";
import osrmService from "../services/osrmService.js";
import AppError from "../utills/appError.js";

const router = express.Router();

/**
 * @route GET /api/v1/osrm/distance
 * @desc Get distance between two points
 * @access Public (or add auth middleware as needed)
 */
router.get("/distance", async (req, res, next) => {
    console.log("Received distance request with query:", req.query);
    
  try {
    const { lat1, lng1, lat2, lng2 } = req.query;

    // Validate input
    if (!lat1 || !lng1 || !lat2 || !lng2) {
      return next(new AppError("Missing coordinates. Required: lat1, lng1, lat2, lng2", 400));
    }

    const origin = { 
      lat: parseFloat(lat1), 
      lng: parseFloat(lng1) 
    };
    const destination = { 
      lat: parseFloat(lat2), 
      lng: parseFloat(lng2) 
    };

    // Validate coordinates are numbers
    if (isNaN(origin.lat) || isNaN(origin.lng) || isNaN(destination.lat) || isNaN(destination.lng)) {
      return next(new AppError("Invalid coordinates. Must be valid numbers", 400));
    }

    const routeData = await osrmService.getRouteDistance(origin, destination);

    if (!routeData) {
      return res.status(200).json({
        success: true,
        data: null,
        message: "Could not calculate route"
      });
    }

    res.status(200).json({
      success: true,
      data: routeData
    });
  } catch (error) {
    console.error("Distance calculation error:", error);
    next(new AppError("Failed to calculate distance", 500));
  }
});

/**
 * @route POST /api/v1/osrm/batch-distances
 * @desc Get distances from a single origin to multiple destinations
 * @access Public (or add auth middleware as needed)
 */
router.post("/batch-distances", async (req, res, next) => {
  try {
    const { origin, destinations } = req.body;

    if (!origin || !origin.lat || !origin.lng) {
      return next(new AppError("Origin coordinates required", 400));
    }

    if (!Array.isArray(destinations) || destinations.length === 0) {
      return next(new AppError("Destinations array required", 400));
    }

    // Validate each destination has required fields
    const validDestinations = destinations.filter(d => 
      d.id && 
      typeof d.lat === 'number' && 
      typeof d.lng === 'number'
    );

    if (validDestinations.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No valid destinations provided"
      });
    }

    const originObj = { lat: origin.lat, lng: origin.lng };
    const results = await osrmService.getBatchDistances(originObj, validDestinations);

    res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error("Batch distance calculation error:", error);
    next(new AppError("Failed to calculate batch distances", 500));
  }
});

/**
 * @route POST /api/v1/osrm/route
 * @desc Calculate route for multiple points
 * @access Public (or add auth middleware as needed)
 */
router.post("/route", async (req, res, next) => {
  try {
    const { coordinates } = req.body;

    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return next(new AppError("At least 2 coordinates required", 400));
    }

    // Validate coordinates format [lng, lat]
    const validCoords = coordinates.every(coord => 
      Array.isArray(coord) && 
      coord.length === 2 &&
      typeof coord[0] === 'number' &&
      typeof coord[1] === 'number'
    );

    if (!validCoords) {
      return next(new AppError("Invalid coordinates format. Expected [[lng, lat], [lng, lat]]", 400));
    }

    const routeData = await osrmService.getRouteByCoordinates(coordinates);

    res.status(200).json({
      success: true,
      data: routeData
    });
  } catch (error) {
    console.error("Route calculation error:", error);
    next(new AppError("Failed to calculate route", 500));
  }
});

export default router;