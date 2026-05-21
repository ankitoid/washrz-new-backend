// // controllers/admin.controller.js

// import SlotConfig from "../models/SlotConfig.js";

// export const saveSlots = async (req, res) => {
//   try {
//     const { date, serviceEnabled, zones } = req.body;

//     console.log(
//     "this is the dataa==>>",date,serviceEnabled,zones
//     )

//     if (!date || !zones) {
//       return res.status(400).json({ error: "Invalid payload" });
//     }

//     const formattedZones = zones.map((zone) => ({
//       zoneId: zone.zoneId,
//       enabled: zone.enabled,
//       slots: zone.slots,
//     }));

//     const result = await SlotConfig.findOneAndUpdate(
//       { date },
//       {
//         date,
//         serviceEnabled,
//         zones: formattedZones,
//       },
//       { upsert: true, new: true }
//     );

//     res.json(result);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Save slots failed" });
//   }
// };


// export const getSlots = async (req, res) => {
//   try {
//     const { date } = req.query;

//     console.log("this is the dateeee",date)

//     const config = await SlotConfig.findOne({ date });

//     res.json(config);
//   } catch (err) {
//     res.status(500).json({ error: "Fetch failed" });
//   }
// };


// export const resetSlots = async (req,res) =>
// {
//     try {
//           await SlotConfig.deleteMany({});
//     res.json({ message: "All slot configs deleted" });
//     } catch (error) {
//         res.status(500).json({ error: "Failed to delete" });
//     }
// }

// controllers/adminSlots.controller.js

import axios from "axios";
import SlotConfig from "../models/SlotConfig.js";
import Zone from "../models/Zone.js";
import Booking from "../models/slotBookingSchema.js";

// const getAllTimeSlots = () => [
//   "08AM - 11AM", "09AM - 12PM", "10AM - 01PM", "11AM - 02PM",
//   "12PM - 03PM", "01PM - 04PM", "02PM - 05PM", "03PM - 06PM",
//   "04PM - 07PM", "05PM - 08PM", "06PM - 09PM"
// ];

// const getDefaultZoneConfig = async () => {
//   const zones = await Zone.find({});
//   const allTimeSlots = getAllTimeSlots();
  
//   return zones.map(zone => ({
//     zoneId: zone.zoneId,
//     enabled: true,
//     slots: allTimeSlots.map(time => ({
//       time,
//       enabled: true
//     }))
//   }));
// };

// export const saveSlots = async (req, res) => {
//   try {
//     const { date, serviceEnabled, zones } = req.body;

//     if (!date || !zones) {
//       return res.status(400).json({ error: "Invalid payload" });
//     }

//     const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
//     if (!dateRegex.test(date)) {
//       return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
//     }

//     const result = await SlotConfig.findOneAndUpdate(
//       { date },
//       {
//         date,
//         serviceEnabled: serviceEnabled !== undefined ? serviceEnabled : true,
//         zones: zones.map(zone => ({
//           zoneId: zone.zoneId,
//           enabled: zone.enabled,
//           slots: zone.slots
//         }))
//       },
//       { 
//         upsert: true, 
//         new: true,
//         runValidators: true
//       }
//     );

//     res.json({
//       success: true,
//       data: result,
//       message: "Slots saved successfully"
//     });
//   } catch (err) {
//     console.error("Error saving slots:", err);
    
//     if (err.code === 11000) {
//       return res.status(409).json({ error: "Configuration for this date already exists" });
//     }
    
//     res.status(500).json({ error: "Save slots failed: " + err.message });
//   }
// };

// export const getSlots = async (req, res) => {
//   try {
//     const { date } = req.query;

//     if (!date) {
//       return res.status(400).json({ error: "Date parameter is required" });
//     }

//     let config = await SlotConfig.findOne({ date });

//     if (!config) {
//       const defaultZones = await getDefaultZoneConfig();
//       return res.json({
//         date,
//         serviceEnabled: true,
//         zones: defaultZones,
//         isDefault: true
//       });
//     }

//     res.json(config);
//   } catch (err) {
//     console.error("Error fetching slots:", err);
//     res.status(500).json({ error: "Fetch failed: " + err.message });
//   }
// };

// export const resetSlots = async (req, res) => {
//   try {
//     const { date } = req.query;
    
//     if (date) {
//       await SlotConfig.deleteOne({ date });
//       res.json({ message: `Slot config for ${date} deleted successfully` });
//     } else {
//       await SlotConfig.deleteMany({});
//       res.json({ message: "All slot configs deleted successfully" });
//     }
//   } catch (error) {
//     console.error("Error deleting slots:", error);
//     res.status(500).json({ error: "Failed to delete: " + error.message });
//   }
// };

// export const copySlots = async (req, res) => {
//   try {
//     const { fromDate, toDate } = req.body;
    
//     const sourceConfig = await SlotConfig.findOne({ date: fromDate });
//     if (!sourceConfig) {
//       return res.status(404).json({ error: "Source date configuration not found" });
//     }
    
//     const newConfig = await SlotConfig.create({
//       date: toDate,
//       serviceEnabled: sourceConfig.serviceEnabled,
//       zones: sourceConfig.zones
//     });
    
//     res.json({
//       success: true,
//       data: newConfig,
//       message: `Configuration copied from ${fromDate} to ${toDate}`
//     });
//   } catch (err) {
//     console.error("Error copying slots:", err);
//     res.status(500).json({ error: "Copy failed: " + err.message });
//   }
// };



// export const CreateZone = async (req,res) =>{
//   try {
//     const { search } = req.body;

//     if (!search) {
//       return res.status(400).json({
//         success: false,
//         message: "search is required"
//       });
//     }

//     const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

//     console.log("this is the key==>>",GOOGLE_KEY)

//     // STEP 1: Search location using Google
//     const response = await axios.get(
//       "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
//       {
//         params: {
//           input: search,
//           inputtype: "textquery",
//           fields: "name,formatted_address,geometry",
//           key: `${GOOGLE_KEY}`
//         }
//       }
//     );

//     const place = response.data.candidates?.[0];

//     if (!place) {
//       return res.status(404).json({
//         success: false,
//         message: "Location not found"
//       });
//     }

//     // STEP 2: Build polygon using viewport
//     const polygon = buildPolygon(place.geometry.viewport);

//     // STEP 3: Generate zoneId
//     const zoneId = generateZoneId(place.name);

//     // STEP 4: Prevent duplicate zone
//     const exists = await Zone.findOne({ zoneId });

//     if (exists) {
//       return res.status(409).json({
//         success: false,
//         message: "Zone already exists"
//       });
//     }

//     // STEP 5: Save zone
//     const zone = await Zone.create({
//       name: place.name,
//       city: getCity(place.formatted_address),
//       zoneId,
//       geometry: {
//         type: "Polygon",
//         coordinates: [polygon]
//       }
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Zone created successfully",
//       data: zone
//     });

//   } catch (error) {
//     console.error(error);

//     return res.status(500).json({
//       success: false,
//       message: "Internal server error"
//     });
//   }
// };



// /*
// ========================================
// HELPERS
// ========================================
// */

// // Convert Google viewport to polygon
// function buildPolygon(viewport) {
//   const ne = viewport.northeast;
//   const sw = viewport.southwest;

//   return [
//     [sw.lng, sw.lat],
//     [ne.lng, sw.lat],
//     [ne.lng, ne.lat],
//     [sw.lng, ne.lat],
//     [sw.lng, sw.lat]
//   ];
// }

// // Create zone id
// function generateZoneId(name) {
//   return name
//     .toUpperCase()
//     .replace(/[^A-Z0-9]/g, "_")
//     .replace(/_+/g, "_")
//     .replace(/^_|_$/g, "");
// }

// // Extract city from address
// function getCity(address) {
//   const parts = address.split(",").map(i => i.trim());

//   if (parts.length >= 3) {
//     return parts[parts.length - 3];
//   }

//   return "";
// }

// SEARCH ENDPOINT (for dashboard autocomplete/search)
// export const SearchZones = async (req, res) => {
//   try {
//     const { q, limit = 10 } = req.query;

//     if (!q || q.length < 2) {
//       return res.status(400).json({
//         success: false,
//         message: "Search query must be at least 2 characters"
//       });
//     }

//     // Search in database only (fast, no API calls)
//     const zones = await Zone.find({
//       $or: [
//         { name: { $regex: new RegExp(q, 'i') } },
//         { zoneId: { $regex: new RegExp(q, 'i') } },
//         { city: { $regex: new RegExp(q, 'i') } }
//       ]
//     })
//     .limit(parseInt(limit))
//     .sort({ name: 1 });

//     return res.status(200).json({
//       success: true,
//       count: zones.length,
//       data: zones
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error"
//     });
//   }
// };

// // CREATE ZONE ENDPOINT (with caching)
// export const CreateZone = async (req, res) => {
//   try {
//     const { search } = req.body;

//     if (!search) {
//       return res.status(400).json({
//         success: false,
//         message: "search is required"
//       });
//     }

//     // Quick exact match search
//     const exactMatch = await Zone.findOne({
//       $or: [
//         { name: { $regex: new RegExp(`^${search}$`, 'i') } },
//         { zoneId: { $regex: new RegExp(`^${search}$`, 'i') } }
//       ]
//     });

//     if (exactMatch) {
//       return res.status(200).json({
//         success: true,
//         message: "Zone already exists",
//         data: exactMatch,
//         fromCache: true
//       });
//     }

//     // Generate potential zoneId
//     const potentialZoneId = search
//       .toUpperCase()
//       .replace(/[^A-Z0-9]/g, "_")
//       .replace(/_+/g, "_")
//       .replace(/^_|_$/g, "");

//     const zoneIdMatch = await Zone.findOne({ zoneId: potentialZoneId });

//     if (zoneIdMatch) {
//       return res.status(200).json({
//         success: true,
//         message: "Zone already exists",
//         data: zoneIdMatch,
//         fromCache: true
//       });
//     }

//     // Call Google API only if not found in DB
//     const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

//     if (!GOOGLE_KEY) {
//       return res.status(500).json({
//         success: false,
//         message: "Google Maps API key not configured"
//       });
//     }

//     const response = await axios.get(
//       "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
//       {
//         params: {
//           input: search,
//           inputtype: "textquery",
//           fields: "name,formatted_address,geometry",
//           key: GOOGLE_KEY
//         },
//         timeout: 5000
//       }
//     );

//     const place = response.data.candidates?.[0];

//     if (!place) {
//       return res.status(404).json({
//         success: false,
//         message: "Location not found in Google Maps"
//       });
//     }

//     // Final check
//     const googleMatch = await Zone.findOne({
//       name: { $regex: new RegExp(`^${place.name}$`, 'i') }
//     });

//     if (googleMatch) {
//       return res.status(200).json({
//         success: true,
//         message: "Zone already exists",
//         data: googleMatch,
//         fromCache: true
//       });
//     }

//     // Create new zone
//     const polygon = buildPolygon(place.geometry.viewport);
//     const zoneId = generateZoneId(place.name);

//     const zone = await Zone.create({
//       name: place.name,
//       city: getCity(place.formatted_address),
//       zoneId,
//       geometry: {
//         type: "Polygon",
//         coordinates: [polygon]
//       }
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Zone created successfully",
//       data: zone,
//       fromCache: false
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error"
//     });
//   }
// };


// export const getAllZones = async (req, res) => {
//   try {
//     const zones = await Zone.find({}).sort({ city: 1, name: 1 });
    
//     res.json({
//       success: true,
//       count: zones.length,
//       data: zones
//     });
//   } catch (error) {
//     console.error("Error fetching zones:", error);
//     res.status(500).json({ 
//       success: false, 
//       message: "Failed to fetch zones" 
//     });
//   }
// };


// // =====================================================
// // ZONE HELPERS
// // =====================================================

// export const pickEvenPoints = (points, count) => {
//   if (points.length <= count) return points;
//   const step = Math.floor(points.length / count);
//   const result = [];
//   for (let i = 0; i < points.length; i += step) {
//     result.push(points[i]);
//     if (result.length === count) break;
//   }
//   return result;
// };

// export const createFallbackBoundary = (lat, lng, diff) => {
//   return [
//     [lng - diff, lat - diff],
//     [lng + diff, lat - diff],
//     [lng + diff, lat + diff],
//     [lng - diff, lat + diff],
//     [lng - diff, lat - diff],
//   ];
// };

// // Convert Google viewport to polygon
// function buildPolygon(viewport) {
//   const ne = viewport.northeast;
//   const sw = viewport.southwest;
//   return [
//     [sw.lng, sw.lat],
//     [ne.lng, sw.lat],
//     [ne.lng, ne.lat],
//     [sw.lng, ne.lat],
//     [sw.lng, sw.lat]
//   ];
// }

// // Create zone id
// function generateZoneId(name) {
//   return name
//     .toUpperCase()
//     .replace(/[^A-Z0-9]/g, "_")
//     .replace(/_+/g, "_")
//     .replace(/^_|_$/g, "");
// }

// // Extract city from address
// function getCity(address) {
//   const parts = address.split(",").map(i => i.trim());
//   if (parts.length >= 3) {
//     return parts[parts.length - 3];
//   }
//   return "";
// }

// // =====================================================
// // ZONE CONTROLLERS
// // =====================================================

// export const getAllZones = async (req, res) => {
//   try {
//     const zones = await Zone.find({}).sort({ city: 1, name: 1 });
//     res.json({
//       success: true,
//       count: zones.length,
//       data: zones
//     });
//   } catch (error) {
//     console.error("Error fetching zones:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch zones"
//     });
//   }
// };

// export const SearchZones = async (req, res) => {
//   try {
//     const { q, limit = 10 } = req.query;

//     if (!q || q.length < 2) {
//       return res.status(400).json({
//         success: false,
//         message: "Search query must be at least 2 characters"
//       });
//     }

//     const zones = await Zone.find({
//       $or: [
//         { name: { $regex: new RegExp(q, 'i') } },
//         { zoneId: { $regex: new RegExp(q, 'i') } },
//         { city: { $regex: new RegExp(q, 'i') } }
//       ]
//     })
//     .limit(parseInt(limit))
//     .sort({ name: 1 });

//     return res.status(200).json({
//       success: true,
//       count: zones.length,
//       data: zones
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error"
//     });
//   }
// };

// export const CreateZone = async (req, res) => {
//   try {
//     const { search } = req.body;

//     if (!search) {
//       return res.status(400).json({
//         success: false,
//         message: "search is required"
//       });
//     }

//     // Quick exact match search
//     const exactMatch = await Zone.findOne({
//       $or: [
//         { name: { $regex: new RegExp(`^${search}$`, 'i') } },
//         { zoneId: { $regex: new RegExp(`^${search}$`, 'i') } }
//       ]
//     });

//     if (exactMatch) {
//       return res.status(200).json({
//         success: true,
//         message: "Zone already exists",
//         data: exactMatch,
//         fromCache: true
//       });
//     }

//     // Generate potential zoneId
//     const potentialZoneId = search
//       .toUpperCase()
//       .replace(/[^A-Z0-9]/g, "_")
//       .replace(/_+/g, "_")
//       .replace(/^_|_$/g, "");

//     const zoneIdMatch = await Zone.findOne({ zoneId: potentialZoneId });

//     if (zoneIdMatch) {
//       return res.status(200).json({
//         success: true,
//         message: "Zone already exists",
//         data: zoneIdMatch,
//         fromCache: true
//       });
//     }

//     // Call Google API only if not found in DB
//     const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

//     if (!GOOGLE_KEY) {
//       return res.status(500).json({
//         success: false,
//         message: "Google Maps API key not configured"
//       });
//     }

//     const response = await axios.get(
//       "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
//       {
//         params: {
//           input: search,
//           inputtype: "textquery",
//           fields: "name,formatted_address,geometry",
//           key: GOOGLE_KEY
//         },
//         timeout: 5000
//       }
//     );

//     const place = response.data.candidates?.[0];

//     if (!place) {
//       return res.status(404).json({
//         success: false,
//         message: "Location not found in Google Maps"
//       });
//     }

//     // Final check
//     const googleMatch = await Zone.findOne({
//       name: { $regex: new RegExp(`^${place.name}$`, 'i') }
//     });

//     if (googleMatch) {
//       return res.status(200).json({
//         success: true,
//         message: "Zone already exists",
//         data: googleMatch,
//         fromCache: true
//       });
//     }

//     // Create new zone
//     const polygon = buildPolygon(place.geometry.viewport);
//     const zoneId = generateZoneId(place.name);

//     const zone = await Zone.create({
//       name: place.name,
//       city: getCity(place.formatted_address),
//       zoneId,
//       geometry: {
//         type: "Polygon",
//         coordinates: [polygon]
//       }
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Zone created successfully",
//       data: zone,
//       fromCache: false
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error"
//     });
//   }
// };

// export const resolveZone = async (req, res) => {
//   try {
//     const { lat, lng } = req.query;

//     if (!lat || !lng) {
//       return res.status(400).json({
//         error: "Latitude and longitude are required"
//       });
//     }

//     const zone = await Zone.findOne({
//       geometry: {
//         $geoIntersects: {
//           $geometry: {
//             type: "Point",
//             coordinates: [parseFloat(lng), parseFloat(lat)],
//           },
//         },
//       },
//     });

//     if (!zone) {
//       return res.json({
//         zoneFound: false,
//         message: "Location not within any service zone"
//       });
//     }

//     return res.json({
//       zoneFound: true,
//       zoneId: zone.zoneId,
//       city: zone.city,
//       name: zone.name,
//     });
//   } catch (err) {
//     console.error("Zone resolve error:", err);
//     res.status(500).json({ error: "Zone resolve failed: " + err.message });
//   }
// };

// // =====================================================
// // SLOT HELPERS
// // =====================================================

// const getAllTimeSlots = () => [
//   "08AM - 11AM", "09AM - 12PM", "10AM - 01PM", "11AM - 02PM",
//   "12PM - 03PM", "01PM - 04PM", "02PM - 05PM", "03PM - 06PM",
//   "04PM - 07PM", "05PM - 08PM", "06PM - 09PM"
// ];

// const getDefaultConfig = async (date) => {
//   const zones = await Zone.find({});
//   const allTimeSlots = getAllTimeSlots();

//   return {
//     date,
//     serviceEnabled: true,
//     defaultPattern: true,
//     zones: zones.map(zone => ({
//       zoneId: zone.zoneId,
//       enabled: true,
//       totalCapacity: 100,
//       slotMinCapacity: 6,
//       morningDelivery: false,
//       slots: allTimeSlots.map(time => ({
//         time,
//         enabled: true,
//         capacity: 7
//       }))
//     }))
//   };
// };

// const generateSlots = (startTime, endTime, slotDuration) => {
//   const parseTime = (timeStr) => {
//     const match = timeStr.match(/(\d+):(\d+)\s+(AM|PM)/);
//     if (!match) return 0;

//     let hours = parseInt(match[1]);
//     const minutes = parseInt(match[2]);
//     const period = match[3];

//     if (period === 'PM' && hours !== 12) hours += 12;
//     if (period === 'AM' && hours === 12) hours = 0;

//     return hours * 60 + minutes;
//   };

//   const formatToSlotTime = (minutes) => {
//     let hours = Math.floor(minutes / 60);
//     const mins = minutes % 60;
//     const period = hours >= 12 ? 'PM' : 'AM';
//     hours = hours % 12;
//     hours = hours === 0 ? 12 : hours;
//     const minsStr = mins > 0 ? `:${mins.toString().padStart(2, '0')}` : '';
//     return `${hours}${minsStr}${period}`;
//   };

//   const startMinutes = parseTime(startTime);
//   let endMinutes = parseTime(endTime);

//   if (endMinutes <= startMinutes) {
//     endMinutes += 24 * 60;
//   }

//   const durationMinutes = slotDuration * 60;
//   const slots = [];
//   let currentStart = startMinutes;

//   while (currentStart + durationMinutes <= endMinutes) {
//     const currentEnd = currentStart + durationMinutes;
//     const startFormatted = formatToSlotTime(currentStart);
//     const endFormatted = formatToSlotTime(currentEnd);

//     slots.push(`${startFormatted} - ${endFormatted}`);
//     currentStart += 60; // Overlap by 1 hour
//   }

//   return slots;
// };

// const assignRandomCapacities = (numSlots, totalCapacity, slotMinCapacity) => {
//   const effectiveMinCapacity = Math.max(1, slotMinCapacity);

//   if (totalCapacity < effectiveMinCapacity * numSlots) {
//     throw new Error(`Total capacity (${totalCapacity}) is insufficient for ${numSlots} slots with minimum ${effectiveMinCapacity} each`);
//   }

//   let capacities = new Array(numSlots).fill(effectiveMinCapacity);
//   let remainingCapacity = totalCapacity - (effectiveMinCapacity * numSlots);

//   for (let i = 0; i < remainingCapacity; i++) {
//     const randomIndex = Math.floor(Math.random() * numSlots);
//     capacities[randomIndex]++;
//   }

//   // Shuffle for better distribution
//   for (let i = capacities.length - 1; i > 0; i--) {
//     const j = Math.floor(Math.random() * (i + 1));
//     [capacities[i], capacities[j]] = [capacities[j], capacities[i]];
//   }

//   return capacities;
// };

// // =====================================================
// // SLOT CONTROLLERS
// // =====================================================

// // GET - Fetch slot configuration for a date
// export const getSlots = async (req, res) => {
//   try {
//     const { date } = req.query;

//     if (!date) {
//       return res.status(400).json({ error: "Date parameter is required" });
//     }

//     // Validate date format
//     const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
//     if (!dateRegex.test(date)) {
//       return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
//     }

//     let config = await SlotConfig.findOne({ date });

//     if (!config) {
//       console.log(`No config found for ${date}, returning default`);
//       const defaultConfig = await getDefaultConfig(date);
//       return res.json({
//         ...defaultConfig,
//         isDefault: true
//       });
//     }

//     res.json({
//       ...config.toObject(),
//       isDefault: false
//     });
//   } catch (err) {
//     console.error("Error fetching slots:", err);
//     res.status(500).json({ error: "Fetch failed: " + err.message });
//   }
// };

// // POST - Save/Create slot configuration
// export const saveSlots = async (req, res) => {
//   try {
//     const { date, serviceEnabled, zones } = req.body;

//     if (!date || !zones) {
//       return res.status(400).json({
//         error: "Invalid payload",
//         details: "Date and zones are required"
//       });
//     }

//     const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
//     if (!dateRegex.test(date)) {
//       return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
//     }

//     // Validate zone configuration
//     for (const zone of zones) {
//       if (!zone.zoneId) {
//         return res.status(400).json({ error: "Each zone must have a zoneId" });
//       }

//       if (zone.slots && zone.slots.length > 0) {
//         for (const slot of zone.slots) {
//           if (!slot.time) {
//             return res.status(400).json({
//               error: "Each slot must have a 'time' field"
//             });
//           }
//           if (slot.capacity !== undefined && slot.capacity < 0) {
//             return res.status(400).json({
//               error: `Invalid capacity for ${slot.time}. Must be >= 0`
//             });
//           }
//         }
//       }
//     }

//     // Upsert configuration
//     const result = await SlotConfig.findOneAndUpdate(
//       { date },
//       {
//         date,
//         serviceEnabled: serviceEnabled !== undefined ? serviceEnabled : true,
//         defaultPattern: false,
//         zones: zones.map(zone => ({
//           zoneId: zone.zoneId,
//           enabled: zone.enabled !== undefined ? zone.enabled : true,
//           totalCapacity: zone.totalCapacity || 100,
//           slotMinCapacity: zone.slotMinCapacity || 6,
//           morningDelivery: zone.morningDelivery || false,
//           slots: zone.slots && zone.slots.length > 0
//             ? zone.slots.map(slot => ({
//                 time: slot.time,
//                 enabled: slot.enabled !== undefined ? slot.enabled : true,
//                 capacity: slot.capacity || 7
//               }))
//             : getAllTimeSlots().map(time => ({
//                 time,
//                 enabled: true,
//                 capacity: 7
//               }))
//         }))
//       },
//       {
//         upsert: true,
//         new: true,
//         runValidators: true
//       }
//     );

//     res.json({
//       success: true,
//       data: result,
//       message: "Slots saved successfully"
//     });
//   } catch (err) {
//     console.error("Error saving slots:", err);

//     if (err.code === 11000) {
//       return res.status(409).json({ error: "Configuration for this date already exists" });
//     }

//     res.status(500).json({ error: "Save slots failed: " + err.message });
//   }
// };

// // POST - Generate dynamic slots
// export const generateSlotsConfig = async (req, res) => {
//   try {
//     const {
//       zoneId,
//       startTime,
//       endTime,
//       slotDuration,
//       totalCapacity,
//       slotMinCapacity,
//       morningDelivery
//     } = req.body;

//     if (!zoneId || !startTime || !endTime) {
//       return res.status(400).json({
//         error: "zoneId, startTime, and endTime are required"
//       });
//     }

//     const duration = slotDuration || 2;
//     const total = totalCapacity || 100;
//     const min = slotMinCapacity || 6;

//     const generatedSlots = generateSlots(startTime, endTime, duration);

//     if (generatedSlots.length === 0) {
//       return res.status(400).json({
//         error: "No slots could be generated with given parameters"
//       });
//     }

//     const capacities = assignRandomCapacities(generatedSlots.length, total, min);

//     const zoneConfig = {
//       zoneId: zoneId.toUpperCase().trim(),
//       enabled: true,
//       totalCapacity: total,
//       slotMinCapacity: min,
//       morningDelivery: morningDelivery || false,
//       slots: generatedSlots.map((slotTime, index) => ({
//         time: slotTime,
//         enabled: true,
//         capacity: capacities[index]
//       }))
//     };

//     res.json({
//       success: true,
//       data: zoneConfig,
//       message: `Generated ${generatedSlots.length} slots for zone ${zoneId}`,
//       metadata: {
//         numberOfSlots: generatedSlots.length,
//         totalAllocatedCapacity: capacities.reduce((sum, cap) => sum + cap, 0)
//       }
//     });
//   } catch (err) {
//     console.error("Error generating slots:", err);
//     res.status(500).json({ error: "Generation failed: " + err.message });
//   }
// };

// // POST - Copy slots from one date to another
// export const copySlots = async (req, res) => {
//   try {
//     const { fromDate, toDate } = req.body;

//     if (!fromDate || !toDate) {
//       return res.status(400).json({ error: "Both fromDate and toDate are required" });
//     }

//     const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
//     if (!dateRegex.test(fromDate) || !dateRegex.test(toDate)) {
//       return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
//     }

//     const sourceConfig = await SlotConfig.findOne({ date: fromDate });

//     if (!sourceConfig) {
//       return res.status(404).json({
//         error: "Source date configuration not found",
//         message: `No configuration exists for ${fromDate}. Create one first.`
//       });
//     }

//     const existingDestConfig = await SlotConfig.findOne({ date: toDate });

//     let newConfig;
//     if (existingDestConfig) {
//       newConfig = await SlotConfig.findOneAndUpdate(
//         { date: toDate },
//         {
//           serviceEnabled: sourceConfig.serviceEnabled,
//           defaultPattern: false,
//           zones: sourceConfig.zones
//         },
//         { new: true }
//       );
//     } else {
//       newConfig = await SlotConfig.create({
//         date: toDate,
//         serviceEnabled: sourceConfig.serviceEnabled,
//         defaultPattern: false,
//         zones: sourceConfig.zones
//       });
//     }

//     res.json({
//       success: true,
//       data: newConfig,
//       message: `Configuration copied from ${fromDate} to ${toDate}`
//     });
//   } catch (err) {
//     console.error("Error copying slots:", err);
//     res.status(500).json({ error: "Copy failed: " + err.message });
//   }
// };

// // DELETE - Reset slot configurations
// export const resetSlots = async (req, res) => {
//   try {
//     const { date } = req.query;

//     if (date) {
//       const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
//       if (!dateRegex.test(date)) {
//         return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
//       }

//       const result = await SlotConfig.deleteOne({ date });

//       if (result.deletedCount === 0) {
//         return res.status(404).json({
//           message: `No configuration found for ${date}`
//         });
//       }

//       res.json({
//         success: true,
//         message: `Slot configuration for ${date} deleted successfully`
//       });
//     } else {
//       const result = await SlotConfig.deleteMany({});

//       res.json({
//         success: true,
//         message: `All slot configurations deleted (${result.deletedCount} records)`
//       });
//     }
//   } catch (error) {
//     console.error("Error deleting slots:", error);
//     res.status(500).json({ error: "Failed to delete: " + error.message });
//   }
// };

// // POST - Check service availability (App API)
// export const checkService = async (req, res) => {
//   try {
//     const { zoneId } = req.body;

//     if (!zoneId) {
//       return res.status(400).json({
//         serviceAvailable: false,
//         error: "zoneId is required"
//       });
//     }

//     const now = new Date();
//     const today = now.toISOString().split('T')[0];
//     const currentHours = now.getHours();
//     const currentMinutes = now.getMinutes();
//     const currentTimeInMinutes = (currentHours * 60) + currentMinutes;

//     console.log(`Service check - Zone: ${zoneId}, Date: ${today}, Time: ${currentHours}:${currentMinutes}`);

//     // Find configuration for today
//     let config = await SlotConfig.findOne({ date: today });

//     // If no config exists, use default
//     if (!config) {
//       console.log(`No config for ${today}, using default`);
//       const defaultConfig = await getDefaultConfig(today);
//       config = defaultConfig;
//     }

//     // Check if service is globally enabled
//     if (!config.serviceEnabled) {
//       return res.json({
//         serviceAvailable: false,
//         message: "Service is currently disabled globally",
//         data: {
//           zoneId,
//           currentTime: `${currentHours}:${String(currentMinutes).padStart(2, '0')}`,
//           activeSlot: null,
//           allSlots: [],
//           zoneInfo: null,
//           summary: null
//         }
//       });
//     }

//     // Find zone configuration
//     const zone = config.zones.find((z) => z.zoneId === zoneId);

//     if (!zone) {
//       return res.json({
//         serviceAvailable: false,
//         message: "Zone not found or not configured",
//         data: {
//           zoneId,
//           currentTime: `${currentHours}:${String(currentMinutes).padStart(2, '0')}`,
//           activeSlot: null,
//           allSlots: [],
//           zoneInfo: null,
//           summary: null
//         }
//       });
//     }

//     // If zone is disabled
//     if (!zone.enabled) {
//       return res.json({
//         serviceAvailable: false,
//         message: "Service is disabled in your area",
//         data: {
//           zoneId,
//           currentTime: `${currentHours}:${String(currentMinutes).padStart(2, '0')}`,
//           activeSlot: null,
//           allSlots: [],
//           zoneInfo: {
//             enabled: false,
//             morningDelivery: zone.morningDelivery || false,
//             totalCapacity: zone.totalCapacity,
//             slotMinCapacity: zone.slotMinCapacity
//           },
//           summary: null
//         }
//       });
//     }

//     // Time conversion helper
//     const timeToMinutes = (timeStr) => {
//       let time = timeStr.toUpperCase().trim();
//       let hours = parseInt(time.match(/\d+/)[0]);
//       const isPM = time.includes('PM');
//       const isAM = time.includes('AM');

//       let minutes = 0;
//       const minuteMatch = time.match(/\d+:(\d+)/);
//       if (minuteMatch) {
//         minutes = parseInt(minuteMatch[1]);
//       }

//       if (isPM && hours !== 12) hours += 12;
//       if (isAM && hours === 12) hours = 0;

//       return (hours * 60) + minutes;
//     };

//     // Build ALL slots
//     const allSlots = zone.slots.map(slot => {
//       const [startTime, endTime] = slot.time.split(" - ");
//       const startMinutes = timeToMinutes(startTime.trim());
//       const endMinutes = timeToMinutes(endTime.trim());

//       const isActive = currentTimeInMinutes >= startMinutes &&
//                        currentTimeInMinutes <= endMinutes;

//       let status;
//       if (!slot.enabled) {
//         status = 'disabled';
//       } else if (isActive) {
//         status = 'active';
//       } else if (startMinutes > currentTimeInMinutes) {
//         status = 'upcoming';
//       } else {
//         status = 'expired';
//       }

//       return {
//         time: slot.time,
//         startTime: startTime.trim(),
//         endTime: endTime.trim(),
//         enabled: slot.enabled,
//         totalCapacity: slot.capacity,
//         bookedCapacity: 0,
//         availableCapacity: slot.capacity,
//         isActive,
//         status,
//         bookingPercentage: 0
//       };
//     });

//     const activeSlot = allSlots.find(slot => slot.isActive && slot.enabled) || null;

//     // Zone specific information
//     const zoneInfo = {
//       zoneId: zone.zoneId,
//       enabled: zone.enabled,
//       morningDelivery: zone.morningDelivery || false,
//       totalCapacity: zone.totalCapacity,
//       slotMinCapacity: zone.slotMinCapacity
//     };

//     // Summary statistics
//     const summary = {
//       totalSlots: allSlots.length,
//       enabledSlots: allSlots.filter(s => s.enabled).length,
//       disabledSlots: allSlots.filter(s => s.status === 'disabled').length,
//       upcomingSlots: allSlots.filter(s => s.status === 'upcoming').length,
//       activeSlotCount: allSlots.filter(s => s.status === 'active').length,
//       expiredSlots: allSlots.filter(s => s.status === 'expired').length,
//       totalAvailableCapacity: allSlots.reduce((sum, s) => sum + (s.enabled ? s.availableCapacity : 0), 0),
//       totalBookedCapacity: allSlots.reduce((sum, s) => sum + (s.enabled ? s.bookedCapacity : 0), 0)
//     };

//     return res.json({
//       serviceAvailable: activeSlot !== null,
//       message: activeSlot
//         ? `Service is available. Current slot: ${activeSlot.time}`
//         : "No active time slot available at this time",
//       data: {
//         zoneId: zone.zoneId,
//         currentTime: `${currentHours}:${String(currentMinutes).padStart(2, '0')}`,
//         currentTimestamp: now.toISOString(),
//         activeSlot,
//         allSlots,
//         zoneInfo,
//         summary
//       }
//     });

//   } catch (err) {
//     console.error("Service check error:", err);
//     res.status(500).json({
//       serviceAvailable: false,
//       error: "Service check failed: " + err.message,
//       data: null
//     });
//   }
// };

// // GET - Get specific zone configuration for a date
// export const getZoneSlots = async (req, res) => {
//   try {
//     const { zoneId } = req.params;
//     const { date } = req.query;

//     if (!date) {
//       return res.status(400).json({ error: "Date parameter is required" });
//     }

//     const config = await SlotConfig.findOne({ date });

//     if (!config) {
//       const defaultConfig = await getDefaultConfig(date);
//       const defaultZone = defaultConfig.zones.find(z => z.zoneId === zoneId.toUpperCase());

//       if (!defaultZone) {
//         return res.status(404).json({ error: "Zone not found" });
//       }

//       return res.json({
//         success: true,
//         data: defaultZone,
//         isDefault: true
//       });
//     }

//     const zoneConfig = config.zones.find(z => z.zoneId === zoneId.toUpperCase());

//     if (!zoneConfig) {
//       return res.status(404).json({ error: "Zone not found in configuration" });
//     }

//     res.json({
//       success: true,
//       data: zoneConfig,
//       isDefault: false
//     });
//   } catch (err) {
//     console.error("Error fetching zone slots:", err);
//     res.status(500).json({ error: "Fetch failed: " + err.message });
//   }
// };

// // GET - Get all dates that have configurations
// export const getConfiguredDates = async (req, res) => {
//   try {
//     const { month, year } = req.query;

//     let query = {};
//     if (month && year) {
//       const monthStr = month.toString().padStart(2, '0');
//       query.date = {
//         $regex: `^${year}-${monthStr}-\\d{2}$`
//       };
//     }

//     const dates = await SlotConfig.find(query)
//       .select('date serviceEnabled defaultPattern')
//       .sort({ date: 1 });

//     res.json({
//       success: true,
//       data: dates,
//       count: dates.length
//     });
//   } catch (err) {
//     console.error("Error fetching dates:", err);
//     res.status(500).json({ error: "Fetch failed: " + err.message });
//   }
// };


// =====================================================
// ZONE HELPERS (Keep existing)
// =====================================================

export const pickEvenPoints = (points, count) => {
  if (points.length <= count) return points;
  const step = Math.floor(points.length / count);
  const result = [];
  for (let i = 0; i < points.length; i += step) {
    result.push(points[i]);
    if (result.length === count) break;
  }
  return result;
};

export const createFallbackBoundary = (lat, lng, diff) => {
  return [
    [lng - diff, lat - diff],
    [lng + diff, lat - diff],
    [lng + diff, lat + diff],
    [lng - diff, lat + diff],
    [lng - diff, lat - diff],
  ];
};

function buildPolygon(viewport) {
  const ne = viewport.northeast;
  const sw = viewport.southwest;
  return [
    [sw.lng, sw.lat],
    [ne.lng, sw.lat],
    [ne.lng, ne.lat],
    [sw.lng, ne.lat],
    [sw.lng, sw.lat]
  ];
}

function generateZoneId(name) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function getCity(address) {
  const parts = address.split(",").map(i => i.trim());
  if (parts.length >= 3) {
    return parts[parts.length - 3];
  }
  return "";
}

// =====================================================
// NEW: Helper to merge template with overrides
// =====================================================

const mergeWithOverrides = (template, overridesMap) => {
  if (!template || !template.slots) {
    return { slots: [], morningDelivery: false, totalCapacity: 100, slotMinCapacity: 6 };
  }
  
  const mergedSlots = template.slots.map(templateSlot => {
    const override = overridesMap.get(templateSlot.time);
    
    return {
      time: templateSlot.time,
      enabled: override?.enabled !== undefined ? override.enabled : templateSlot.defaultEnabled,
      capacity: override?.capacity !== undefined ? override.capacity : templateSlot.defaultCapacity
    };
  });
  
  return {
    slots: mergedSlots,
    morningDelivery: template.morningDelivery || false,
    totalCapacity: template.totalCapacity || 100,
    slotMinCapacity: template.slotMinCapacity || 6
  };
};

// NEW: Get last known capacities for a zone (from most recent date)
const getLastKnownCapacities = async (zoneId, currentDate) => {
  try {
    // Find the most recent configuration before current date
    const lastConfig = await SlotConfig.findOne({
      date: { $lt: currentDate },
      "zones.zoneId": zoneId
    }).sort({ date: -1 });
    
    if (lastConfig) {
      const zoneConfig = lastConfig.zones.find(z => z.zoneId === zoneId);
      if (zoneConfig && zoneConfig.overrides.length > 0) {
        const overridesMap = new Map(
          zoneConfig.overrides.map(o => [o.time, { enabled: o.enabled, capacity: o.capacity }])
        );
        return overridesMap;
      }
    }
    return new Map();
  } catch (error) {
    console.error("Error getting last known capacities:", error);
    return new Map();
  }
};

// =====================================================
// ZONE CONTROLLERS (Keep existing)
// =====================================================

export const getAllZones = async (req, res) => {
  try {
    const zones = await Zone.find({}).sort({ city: 1, name: 1 });
    res.json({
      success: true,
      count: zones.length,
      data: zones
    });
  } catch (error) {
    console.error("Error fetching zones:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch zones"
    });
  }
};

export const SearchZones = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters"
      });
    }

    const zones = await Zone.find({
      $or: [
        { name: { $regex: new RegExp(q, 'i') } },
        { zoneId: { $regex: new RegExp(q, 'i') } },
        { city: { $regex: new RegExp(q, 'i') } }
      ]
    })
    .limit(parseInt(limit))
    .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: zones.length,
      data: zones
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const CreateZone = async (req, res) => {
  try {
    const { search } = req.body;

    if (!search) {
      return res.status(400).json({
        success: false,
        message: "search is required"
      });
    }

    const exactMatch = await Zone.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${search}$`, 'i') } },
        { zoneId: { $regex: new RegExp(`^${search}$`, 'i') } }
      ]
    });

    if (exactMatch) {
      return res.status(200).json({
        success: true,
        message: "Zone already exists",
        data: exactMatch,
        fromCache: true
      });
    }

    const potentialZoneId = search
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    const zoneIdMatch = await Zone.findOne({ zoneId: potentialZoneId });

    if (zoneIdMatch) {
      return res.status(200).json({
        success: true,
        message: "Zone already exists",
        data: zoneIdMatch,
        fromCache: true
      });
    }

    const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

    if (!GOOGLE_KEY) {
      return res.status(500).json({
        success: false,
        message: "Google Maps API key not configured"
      });
    }

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
      {
        params: {
          input: search,
          inputtype: "textquery",
          fields: "name,formatted_address,geometry",
          key: GOOGLE_KEY
        },
        timeout: 5000
      }
    );

    const place = response.data.candidates?.[0];

    if (!place) {
      return res.status(404).json({
        success: false,
        message: "Location not found in Google Maps"
      });
    }

    const googleMatch = await Zone.findOne({
      name: { $regex: new RegExp(`^${place.name}$`, 'i') }
    });

    if (googleMatch) {
      return res.status(200).json({
        success: true,
        message: "Zone already exists",
        data: googleMatch,
        fromCache: true
      });
    }

    const polygon = buildPolygon(place.geometry.viewport);
    const zoneId = generateZoneId(place.name);

    const zone = await Zone.create({
      name: place.name,
      city: getCity(place.formatted_address),
      zoneId,
      geometry: {
        type: "Polygon",
        coordinates: [polygon]
      }
      // slotTemplate will be added later when configured
    });

    return res.status(201).json({
      success: true,
      message: "Zone created successfully",
      data: zone,
      fromCache: false
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const resolveZone = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: "Latitude and longitude are required"
      });
    }

    const zone = await Zone.findOne({
      geometry: {
        $geoIntersects: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
        },
      },
    });

    if (!zone) {
      return res.json({
        zoneFound: false,
        message: "Location not within any service zone"
      });
    }

    return res.json({
      zoneFound: true,
      zoneId: zone.zoneId,
      city: zone.city,
      name: zone.name,
    });
  } catch (err) {
    console.error("Zone resolve error:", err);
    res.status(500).json({ error: "Zone resolve failed: " + err.message });
  }
};

// =====================================================
// SLOT HELPERS
// =====================================================

const generateSlots = (startTime, endTime, slotDuration) => {
  // Parse time string like "10:00 AM" or "02:00 AM" to minutes since midnight
  const parseTime = (timeStr) => {
    const match = timeStr.match(/(\d+):(\d+)\s+(AM|PM)/i);
    if (!match) return 0;

    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  };

  // Convert minutes to 12-hour format with AM/PM
  const formatTo12Hour = (totalMinutes) => {
    // Get minutes within 24-hour cycle for display
    let minutesInDay = totalMinutes % (24 * 60);
    let hours24 = Math.floor(minutesInDay / 60);
    let mins = minutesInDay % 60;
    
    // Determine AM/PM and 12-hour hour
    let period = 'AM';
    let hours12 = hours24;
    
    if (hours24 === 0) {
      // 12:00 AM (midnight)
      hours12 = 12;
      period = 'AM';
    } else if (hours24 === 12) {
      // 12:00 PM (noon)
      hours12 = 12;
      period = 'PM';
    } else if (hours24 > 12) {
      // Afternoon/evening (1 PM - 11 PM)
      hours12 = hours24 - 12;
      period = 'PM';
    } else {
      // Early morning (1 AM - 11 AM)
      hours12 = hours24;
      period = 'AM';
    }
    
    const minsStr = mins > 0 ? `:${mins.toString().padStart(2, '0')}` : '';
    return `${hours12}${minsStr}${period}`;
  };

  const startMinutes = parseTime(startTime);
  let endMinutes = parseTime(endTime);

  // Handle overnight slots: if end time is less than or equal to start time, add 24 hours
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  const durationMinutes = slotDuration * 60;
  const slots = [];
  let currentStart = startMinutes;
  
  // Safety limit to prevent infinite loops
  const maxSlots = 48;
  let iterations = 0;

  while (currentStart + durationMinutes <= endMinutes && iterations < maxSlots) {
    const currentEnd = currentStart + durationMinutes;
    
    const startFormatted = formatTo12Hour(currentStart);
    const endFormatted = formatTo12Hour(currentEnd);
    
    slots.push(`${startFormatted} - ${endFormatted}`);
    
    // Move to next slot (1 hour overlap as per your requirement)
    currentStart += 60;
    iterations++;
  }

  return slots;
};
const assignRandomCapacities = (numSlots, totalCapacity, slotMinCapacity) => {
  const effectiveMinCapacity = Math.max(1, slotMinCapacity);

  if (totalCapacity < effectiveMinCapacity * numSlots) {
    throw new Error(`Total capacity (${totalCapacity}) is insufficient for ${numSlots} slots with minimum ${effectiveMinCapacity} each`);
  }

  let capacities = new Array(numSlots).fill(effectiveMinCapacity);
  let remainingCapacity = totalCapacity - (effectiveMinCapacity * numSlots);

  for (let i = 0; i < remainingCapacity; i++) {
    const randomIndex = Math.floor(Math.random() * numSlots);
    capacities[randomIndex]++;
  }

  for (let i = capacities.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [capacities[i], capacities[j]] = [capacities[j], capacities[i]];
  }

  return capacities;
};

// =====================================================
// SLOT CONTROLLERS (REWRITTEN)
// =====================================================

// GET - Fetch slot configuration for a date (with template merge)
export const getSlots = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Date parameter is required" });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    // Get all zones with their templates
    const zones = await Zone.find({});
    
    // Get existing config for this date
    let config = await SlotConfig.findOne({ date });
    
    // Build response for each zone
    const zoneResponses = [];
    
    for (const zone of zones) {
      // Skip zones without template
      if (!zone.slotTemplate || !zone.slotTemplate.slots || zone.slotTemplate.slots.length === 0) {
        continue;
      }
      
      // Find zone config in date-specific config
      const zoneConfig = config?.zones.find(z => z.zoneId === zone.zoneId);
      
      // Build overrides map
      const overridesMap = new Map();
      if (zoneConfig && zoneConfig.overrides) {
        zoneConfig.overrides.forEach(override => {
          overridesMap.set(override.time, {
            enabled: override.enabled,
            capacity: override.capacity
          });
        });
      } else {
        // If no config for this date, get last known capacities from previous dates
        const lastKnownOverrides = await getLastKnownCapacities(zone.zoneId, date);
        lastKnownOverrides.forEach((value, key) => {
          overridesMap.set(key, value);
        });
      }
      
      // Merge template with overrides
      const merged = mergeWithOverrides(zone.slotTemplate, overridesMap);
      
      zoneResponses.push({
        zoneId: zone.zoneId,
        city: zone.city,
        name: zone.name,
        enabled: zoneConfig?.enabled !== undefined ? zoneConfig.enabled : true,
        morningDelivery: zone.slotTemplate.morningDelivery || false,
        totalCapacity: zoneConfig?.totalCapacity || zone.slotTemplate.totalCapacity,
        slotMinCapacity: zoneConfig?.slotMinCapacity || zone.slotTemplate.slotMinCapacity,
        slots: merged.slots
      });
    }

    
    res.json({
      date,
      serviceEnabled: config?.serviceEnabled !== undefined ? config.serviceEnabled : true,
      zones: zoneResponses,
      isDefault: !config
    });
    
  } catch (err) {
    console.error("Error fetching slots:", err);
    res.status(500).json({ error: "Fetch failed: " + err.message });
  }
};

// POST - Save/Create slot configuration (ONLY overrides)
export const saveSlots = async (req, res) => {
  try {
    const { date, serviceEnabled, zones } = req.body;

    if (!date || !zones) {
      return res.status(400).json({
        error: "Invalid payload",
        details: "Date and zones are required"
      });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    // Get zone templates to compare and find overrides
    const zoneTemplates = await Zone.find({});
    const templateMap = new Map();
    zoneTemplates.forEach(zone => {
      if (zone.slotTemplate) {
        templateMap.set(zone.zoneId, zone.slotTemplate);
      }
    });
    
    // Build zones with overrides only
    const zoneConfigs = zones.map(zone => {
      const template = templateMap.get(zone.zoneId);
      const overrides = [];
      
      if (template && zone.slots) {
        // Compare each slot with template to find overrides
        zone.slots.forEach(slot => {
          const templateSlot = template.slots.find(ts => ts.time === slot.time);
          
          // Check if enabled is different from template default
          if (templateSlot && slot.enabled !== templateSlot.defaultEnabled) {
            overrides.push({
              time: slot.time,
              enabled: slot.enabled
            });
          }
          
          // Check if capacity is different from template default
          if (templateSlot && slot.capacity !== templateSlot.defaultCapacity) {
            const existingOverride = overrides.find(o => o.time === slot.time);
            if (existingOverride) {
              existingOverride.capacity = slot.capacity;
            } else {
              overrides.push({
                time: slot.time,
                capacity: slot.capacity
              });
            }
          }
        });
      }
      
      return {
        zoneId: zone.zoneId,
        enabled: zone.enabled,
        totalCapacity: zone.totalCapacity !== template?.totalCapacity ? zone.totalCapacity : undefined,
        slotMinCapacity: zone.slotMinCapacity !== template?.slotMinCapacity ? zone.slotMinCapacity : undefined,
        overrides: overrides.length > 0 ? overrides : undefined
      };
    });
    
    // Upsert configuration
    const result = await SlotConfig.findOneAndUpdate(
      { date },
      {
        date,
        serviceEnabled: serviceEnabled !== undefined ? serviceEnabled : true,
        zones: zoneConfigs.filter(z => z.overrides || z.enabled === false || z.totalCapacity !== undefined)
      },
      {
        upsert: true,
        new: true,
        runValidators: true
      }
    );

    req.socket.emitToAll("slot_updated", { message: "please refetch the api for getting the slots." }); 

    res.json({
      success: true,
      data: result,
      message: "Slots saved successfully"
    });
  } catch (err) {
    console.error("Error saving slots:", err);
    res.status(500).json({ error: "Save slots failed: " + err.message });
  }
};

// POST - Generate slots AND save to zone template
export const generateSlotsConfig = async (req, res) => {
  try {
    const {
      zoneId,
      startTime,
      endTime,
      slotDuration,
      totalCapacity,
      slotMinCapacity,
      morningDelivery
    } = req.body;

    if (!zoneId || !startTime || !endTime) {
      return res.status(400).json({
        error: "zoneId, startTime, and endTime are required"
      });
    }

    const duration = slotDuration || 2;
    const total = totalCapacity || 100;
    const min = slotMinCapacity || 6;

    const generatedSlotTimes = generateSlots(startTime, endTime, duration);

    if (generatedSlotTimes.length === 0) {
      return res.status(400).json({
        error: "No slots could be generated with given parameters"
      });
    }

    const capacities = assignRandomCapacities(generatedSlotTimes.length, total, min);

    // Build slot template
    const slots = generatedSlotTimes.map((slotTime, index) => ({
      time: slotTime,
      defaultEnabled: true,
      defaultCapacity: capacities[index]
    }));

    const slotTemplate = {
      slots,
      morningDelivery: morningDelivery || false,
      totalCapacity: total,
      slotMinCapacity: min,
      startTime,
      endTime,
      slotDuration: duration,
      generatedAt: new Date()
    };

    // Save template to zone
    const updatedZone = await Zone.findOneAndUpdate(
      { zoneId: zoneId.toUpperCase().trim() },
      { slotTemplate },
      { new: true }
    );

    if (!updatedZone) {
      return res.status(404).json({
        error: "Zone not found"
      });
    }

    // Return the zone config (ready to be applied)
    const zoneConfig = {
      zoneId: zoneId.toUpperCase().trim(),
      enabled: true,
      totalCapacity: total,
      slotMinCapacity: min,
      morningDelivery: morningDelivery || false,
      slots: slots.map(slot => ({
        time: slot.time,
        enabled: true,
        capacity: slot.defaultCapacity
      }))
    };

    res.json({
      success: true,
      data: zoneConfig,
      message: `Generated ${generatedSlotTimes.length} slots and saved template to zone ${zoneId}`,
      metadata: {
        numberOfSlots: generatedSlotTimes.length,
        totalAllocatedCapacity: capacities.reduce((sum, cap) => sum + cap, 0)
      }
    });
  } catch (err) {
    console.error("Error generating slots:", err);
    res.status(500).json({ error: "Generation failed: " + err.message });
  }
};

// POST - Copy slots from one date to another
export const copySlots = async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: "Both fromDate and toDate are required" });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(fromDate) || !dateRegex.test(toDate)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    const sourceConfig = await SlotConfig.findOne({ date: fromDate });

    if (!sourceConfig) {
      return res.status(404).json({
        error: "Source date configuration not found",
        message: `No configuration exists for ${fromDate}. Create one first.`
      });
    }

    const result = await SlotConfig.findOneAndUpdate(
      { date: toDate },
      {
        date: toDate,
        serviceEnabled: sourceConfig.serviceEnabled,
        zones: sourceConfig.zones
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      data: result,
      message: `Configuration copied from ${fromDate} to ${toDate}`
    });
  } catch (err) {
    console.error("Error copying slots:", err);
    res.status(500).json({ error: "Copy failed: " + err.message });
  }
};

// DELETE - Reset slot configurations
export const resetSlots = async (req, res) => {
  try {
    const { date } = req.query;

    if (date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }

      const result = await SlotConfig.deleteOne({ date });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          message: `No configuration found for ${date}`
        });
      }

      res.json({
        success: true,
        message: `Slot configuration for ${date} deleted successfully`
      });
    } else {
      const result = await SlotConfig.deleteMany({});

      res.json({
        success: true,
        message: `All slot configurations deleted (${result.deletedCount} records)`
      });
    }
  } catch (error) {
    console.error("Error deleting slots:", error);
    res.status(500).json({ error: "Failed to delete: " + error.message });
  }
};

// POST - Check service availability (App API)
// export const checkService = async (req, res) => {
//   try {
//     const { zoneId } = req.body;

//     if (!zoneId) {
//       return res.status(400).json({
//         serviceAvailable: false,
//         error: "zoneId is required"
//       });
//     }

//     const now = new Date();
//     const year = now.getFullYear();
//     const month = String(now.getMonth() + 1).padStart(2, '0');
//     const day = String(now.getDate()).padStart(2, '0');
//     const today = `${year}-${month}-${day}`;
//     const currentHours = now.getHours();
//     const currentMinutes = now.getMinutes();
//     const currentTimeInMinutes = (currentHours * 60) + currentMinutes;

//     // Get zone with template
//     const zone = await Zone.findOne({ zoneId: zoneId.toUpperCase() });
    
//     if (!zone || !zone.slotTemplate || !zone.slotTemplate.slots.length) {
//       return res.json({
//         serviceAvailable: false,
//         message: "Zone not configured",
//         data: {
//           zoneId,
//           currentTime: `${currentHours}:${String(currentMinutes).padStart(2, '0')}`,
//           activeSlot: null,
//           allSlots: [],
//           zoneInfo: null,
//           summary: null
//         }
//       });
//     }

//     // Get date-specific overrides
//     let config = await SlotConfig.findOne({ date: today });
//     let zoneOverrides = new Map();
//     let zoneEnabled = true;
    
//     if (config) {
//       const zoneConfig = config.zones.find(z => z.zoneId === zoneId.toUpperCase());
//       if (zoneConfig) {
//         zoneEnabled = zoneConfig.enabled !== false;
//         if (zoneConfig.overrides) {
//           zoneOverrides = new Map(
//             zoneConfig.overrides.map(o => [o.time, { enabled: o.enabled, capacity: o.capacity }])
//           );
//         }
//       }
//     }

//     // Get ALL confirmed bookings for today in this zone
//     const bookings = await Booking.find({
//       zoneId: zoneId.toUpperCase(),
//       date: today,
//       status: 'confirmed'
//     });
    
//     // Create map: slotTime -> bookedCount
//     const bookedMap = new Map();
//     bookings.forEach(booking => {
//       bookedMap.set(booking.slotTime, (bookedMap.get(booking.slotTime) || 0) + 1);
//     });

//     const timeToMinutes = (timeStr) => {
//       let time = timeStr.toUpperCase().trim();
//       let hours = parseInt(time.match(/\d+/)[0]);
//       const isPM = time.includes('PM');
//       const isAM = time.includes('AM');

//       let minutes = 0;
//       const minuteMatch = time.match(/\d+:(\d+)/);
//       if (minuteMatch) {
//         minutes = parseInt(minuteMatch[1]);
//       }

//       if (isPM && hours !== 12) hours += 12;
//       if (isAM && hours === 12) hours = 0;

//       return (hours * 60) + minutes;
//     };

//     // Build slots from template + overrides + real bookings
//     const allSlots = zone.slotTemplate.slots.map(templateSlot => {
//       const override = zoneOverrides.get(templateSlot.time);
//       const enabled = override?.enabled !== undefined ? override.enabled : templateSlot.defaultEnabled;
//       const totalCapacity = override?.capacity !== undefined ? override.capacity : templateSlot.defaultCapacity;
//       const bookedCount = bookedMap.get(templateSlot.time) || 0;
//       const availableCapacity = totalCapacity - bookedCount;
      
//       const [startTime, endTime] = templateSlot.time.split(" - ");
//       const startMinutes = timeToMinutes(startTime.trim());
//       const endMinutes = timeToMinutes(endTime.trim());

//       // Slot is active if:
//       // 1. It's enabled
//       // 2. Current time is within slot window
//       // 3. Available capacity > 0
//       const isActive = enabled && 
//                        currentTimeInMinutes >= startMinutes && 
//                        currentTimeInMinutes <= endMinutes &&
//                        availableCapacity > 0;

//       let status;
//       if (!enabled) {
//         status = 'disabled';
//       } else if (isActive) {
//         status = 'active';
//       } else if (startMinutes > currentTimeInMinutes) {
//         status = 'upcoming';
//       } else {
//         status = 'expired';
//       }

//       return {
//         time: templateSlot.time,
//         startTime: startTime.trim(),
//         endTime: endTime.trim(),
//         enabled,
//         totalCapacity,
//         bookedCapacity: bookedCount,
//         availableCapacity,
//         isActive,
//         status,
//         bookingPercentage: totalCapacity > 0 ? (bookedCount / totalCapacity) * 100 : 0
//       };
//     });

//     const activeSlot = allSlots.find(slot => slot.isActive && slot.availableCapacity > 0) || null;

//     const zoneInfo = {
//       zoneId: zone.zoneId,
//       enabled: zoneEnabled,
//       morningDelivery: zone.slotTemplate.morningDelivery || false,
//       totalCapacity: zone.slotTemplate.totalCapacity,
//       slotMinCapacity: zone.slotTemplate.slotMinCapacity
//     };

//     const summary = {
//       totalSlots: allSlots.length,
//       enabledSlots: allSlots.filter(s => s.enabled).length,
//       disabledSlots: allSlots.filter(s => s.status === 'disabled').length,
//       upcomingSlots: allSlots.filter(s => s.status === 'upcoming').length,
//       activeSlotCount: allSlots.filter(s => s.status === 'active').length,
//       expiredSlots: allSlots.filter(s => s.status === 'expired').length,
//       totalAvailableCapacity: allSlots.reduce((sum, s) => sum + (s.enabled ? s.availableCapacity : 0), 0),
//       totalBookedCapacity: allSlots.reduce((sum, s) => sum + (s.enabled ? s.bookedCapacity : 0), 0),
//       totalCapacity: allSlots.reduce((sum, s) => sum + (s.enabled ? s.totalCapacity : 0), 0)
//     };

//     return res.json({
//       serviceAvailable: activeSlot !== null,
//       message: activeSlot
//         ? `Service is available. Current slot: ${activeSlot.time} (${activeSlot.availableCapacity} spots left)`
//         : "No active time slot available at this time",
//       data: {
//         zoneId: zone.zoneId,
//         currentTime: `${currentHours}:${String(currentMinutes).padStart(2, '0')}`,
//         currentTimestamp: now.toISOString(),
//         activeSlot,
//         allSlots,
//         zoneInfo,
//         summary
//       }
//     });

//   } catch (err) {
//     console.error("Service check error:", err);
//     res.status(500).json({
//       serviceAvailable: false,
//       error: "Service check failed: " + err.message,
//       data: null
//     });
//   }
// };

// export const checkService = async (req, res) => {
//   try {
//     const { zoneId } = req.body;

//     if (!zoneId) {
//       return res.status(400).json({
//         serviceAvailable: false,
//         error: "zoneId is required"
//       });
//     }

//     const now = new Date();
//     const year = now.getFullYear();
//     const month = String(now.getMonth() + 1).padStart(2, '0');
//     const day = String(now.getDate()).padStart(2, '0');
//     const today = `${year}-${month}-${day}`;
//     const currentHours = now.getHours();
//     const currentMinutes = now.getMinutes();
//     const currentTimeInMinutes = (currentHours * 60) + currentMinutes;

//     // Get zone with template
//     const zone = await Zone.findOne({ zoneId: zoneId.toUpperCase() });
    
//     if (!zone || !zone.slotTemplate || !zone.slotTemplate.slots.length) {
//       return res.json({
//         serviceAvailable: false,
//         message: "Zone not configured",
//         data: {
//           zoneId,
//           currentTime: `${currentHours}:${String(currentMinutes).padStart(2, '0')}`,
//           activeSlot: null,
//           allSlots: [],
//           zoneInfo: null,
//           summary: null
//         }
//       });
//     }

//     // Get date-specific overrides
//     let config = await SlotConfig.findOne({ date: today });
//     let zoneOverrides = new Map();
//     let zoneEnabled = true;
//     let globalServiceEnabled = true; // Default to true if no config exists
    
//     if (config) {
//       // ✅ Add check for global serviceEnabled
//       globalServiceEnabled = config.serviceEnabled !== false; // If serviceEnabled is false, service is disabled globally
      
//       const zoneConfig = config.zones.find(z => z.zoneId === zoneId.toUpperCase());
//       if (zoneConfig) {
//         zoneEnabled = zoneConfig.enabled !== false;
//         if (zoneConfig.overrides) {
//           zoneOverrides = new Map(
//             zoneConfig.overrides.map(o => [o.time, { enabled: o.enabled, capacity: o.capacity }])
//           );
//         }
//       }
//     }

//     // ✅ If global service is disabled, return immediately
//     if (!globalServiceEnabled) {
//       return res.json({
//         serviceAvailable: false,
//         message: "Service is currently disabled for today",
//         data: {
//           zoneId: zone.zoneId,
//           currentTime: `${currentHours}:${String(currentMinutes).padStart(2, '0')}`,
//           currentTimestamp: now.toISOString(),
//           activeSlot: null,
//           allSlots: [],
//           zoneInfo: {
//             zoneId: zone.zoneId,
//             enabled: zoneEnabled,
//             globalServiceEnabled: false,
//             morningDelivery: zone.slotTemplate.morningDelivery || false,
//             totalCapacity: zone.slotTemplate.totalCapacity,
//             slotMinCapacity: zone.slotTemplate.slotMinCapacity
//           },
//           summary: null
//         }
//       });
//     }

//     // Get ALL confirmed bookings for today in this zone
//     const bookings = await Booking.find({
//       zoneId: zoneId.toUpperCase(),
//       date: today,
//       status: 'confirmed'
//     });
    
//     // Create map: slotTime -> bookedCount
//     const bookedMap = new Map();
//     bookings.forEach(booking => {
//       bookedMap.set(booking.slotTime, (bookedMap.get(booking.slotTime) || 0) + 1);
//     });

//     const timeToMinutes = (timeStr) => {
//       let time = timeStr.toUpperCase().trim();
//       let hours = parseInt(time.match(/\d+/)[0]);
//       const isPM = time.includes('PM');
//       const isAM = time.includes('AM');

//       let minutes = 0;
//       const minuteMatch = time.match(/\d+:(\d+)/);
//       if (minuteMatch) {
//         minutes = parseInt(minuteMatch[1]);
//       }

//       if (isPM && hours !== 12) hours += 12;
//       if (isAM && hours === 12) hours = 0;

//       return (hours * 60) + minutes;
//     };

//     // Build slots from template + overrides + real bookings
//     const allSlots = zone.slotTemplate.slots.map(templateSlot => {
//       const override = zoneOverrides.get(templateSlot.time);
//       const enabled = override?.enabled !== undefined ? override.enabled : templateSlot.defaultEnabled;
//       const totalCapacity = override?.capacity !== undefined ? override.capacity : templateSlot.defaultCapacity;
//       const bookedCount = bookedMap.get(templateSlot.time) || 0;
//       const availableCapacity = totalCapacity - bookedCount;
      
//       const [startTime, endTime] = templateSlot.time.split(" - ");
//       const startMinutes = timeToMinutes(startTime.trim());
//       const endMinutes = timeToMinutes(endTime.trim());

//       // Slot is active if:
//       // 1. It's enabled
//       // 2. Current time is within slot window
//       // 3. Available capacity > 0
//       const isActive = enabled && 
//                        currentTimeInMinutes >= startMinutes && 
//                        currentTimeInMinutes <= endMinutes &&
//                        availableCapacity > 0;

//       let status;
//       if (!enabled) {
//         status = 'disabled';
//       } else if (isActive) {
//         status = 'active';
//       } else if (startMinutes > currentTimeInMinutes) {
//         status = 'upcoming';
//       } else {
//         status = 'expired';
//       }

//       return {
//         time: templateSlot.time,
//         startTime: startTime.trim(),
//         endTime: endTime.trim(),
//         enabled,
//         totalCapacity,
//         bookedCapacity: bookedCount,
//         availableCapacity,
//         isActive,
//         status,
//         bookingPercentage: totalCapacity > 0 ? (bookedCount / totalCapacity) * 100 : 0
//       };
//     });

//     const activeSlot = allSlots.find(slot => slot.isActive && slot.availableCapacity > 0) || null;

//     const zoneInfo = {
//       zoneId: zone.zoneId,
//       enabled: zoneEnabled,
//       globalServiceEnabled: true,
//       morningDelivery: zone.slotTemplate.morningDelivery || false,
//       totalCapacity: zone.slotTemplate.totalCapacity,
//       slotMinCapacity: zone.slotTemplate.slotMinCapacity
//     };

//     const summary = {
//       totalSlots: allSlots.length,
//       enabledSlots: allSlots.filter(s => s.enabled).length,
//       disabledSlots: allSlots.filter(s => s.status === 'disabled').length,
//       upcomingSlots: allSlots.filter(s => s.status === 'upcoming').length,
//       activeSlotCount: allSlots.filter(s => s.status === 'active').length,
//       expiredSlots: allSlots.filter(s => s.status === 'expired').length,
//       totalAvailableCapacity: allSlots.reduce((sum, s) => sum + (s.enabled ? s.availableCapacity : 0), 0),
//       totalBookedCapacity: allSlots.reduce((sum, s) => sum + (s.enabled ? s.bookedCapacity : 0), 0),
//       totalCapacity: allSlots.reduce((sum, s) => sum + (s.enabled ? s.totalCapacity : 0), 0)
//     };

//     return res.json({
//       serviceAvailable: activeSlot !== null,
//       message: activeSlot
//         ? `Service is available. Current slot: ${activeSlot.time} (${activeSlot.availableCapacity} spots left)`
//         : "No active time slot available at this time",
//       data: {
//         zoneId: zone.zoneId,
//         currentTime: `${currentHours}:${String(currentMinutes).padStart(2, '0')}`,
//         currentTimestamp: now.toISOString(),
//         activeSlot,
//         allSlots,
//         zoneInfo,
//         summary
//       }
//     });

//   } catch (err) {
//     console.error("Service check error:", err);
//     res.status(500).json({
//       serviceAvailable: false,
//       error: "Service check failed: " + err.message,
//       data: null
//     });
//   }
// };
 
// this is the verison of service check which was written only for the live pickup 
// export const checkService = async (req, res) => {
//   try {
//     const { zoneId } = req.body;

//     if (!zoneId) {
//       return res.status(400).json({
//         serviceAvailable: false,
//         error: "zoneId is required"
//       });
//     }

//     const now = new Date();
//     const year = now.getFullYear();
//     const month = String(now.getMonth() + 1).padStart(2, '0');
//     const day = String(now.getDate()).padStart(2, '0');
//     const today = `${year}-${month}-${day}`;
//     const currentHours = now.getHours();
//     const currentMinutes = now.getMinutes();
//     const currentTimeInMinutes = (currentHours * 60) + currentMinutes;

//     // Get zone with template
//     const zone = await Zone.findOne({ zoneId: zoneId.toUpperCase() });
    
//     if (!zone || !zone.slotTemplate || !zone.slotTemplate.slots.length) {
//       return res.json({
//         serviceAvailable: false,
//         message: "Zone not configured",
//         data: {
//           zoneId,
//           currentTime: `${currentHours}:${String(currentMinutes).padStart(2, '0')}`,
//           activeSlot: null,
//           allSlots: [],
//           zoneInfo: null,
//           summary: null
//         }
//       });
//     }

//     // Get date-specific overrides
//     let config = await SlotConfig.findOne({ date: today });
//     let zoneOverrides = new Map();
//     let zoneEnabled = true;
//     let globalServiceEnabled = true; // Default to true if no config exists
    
//     if (config) {
//       globalServiceEnabled = config.serviceEnabled !== false;
      
//       const zoneConfig = config.zones.find(z => z.zoneId === zoneId.toUpperCase());
//       if (zoneConfig) {
//         zoneEnabled = zoneConfig.enabled !== false;
//         if (zoneConfig.overrides) {
//           zoneOverrides = new Map(
//             zoneConfig.overrides.map(o => [o.time, { enabled: o.enabled, capacity: o.capacity }])
//           );
//         }
//       }
//     }

//     // ✅ If global service is disabled, return immediately
//     if (!globalServiceEnabled) {
//       return res.json({
//         serviceAvailable: false,
//         message: "Service is currently disabled for today",
//         data: {
//           zoneId: zone.zoneId,
//           currentTime: `${currentHours}:${String(currentMinutes).padStart(2, '0')}`,
//           currentTimestamp: now.toISOString(),
//           activeSlot: null,
//           allSlots: [],
//           zoneInfo: {
//             zoneId: zone.zoneId,
//             enabled: zoneEnabled,
//             globalServiceEnabled: false,
//             morningDelivery: zone.slotTemplate.morningDelivery || false,
//             totalCapacity: zone.slotTemplate.totalCapacity,
//             slotMinCapacity: zone.slotTemplate.slotMinCapacity
//           },
//           summary: null
//         }
//       });
//     }

//     // ✅ NEW: If zone is explicitly disabled for today, return immediately
//     if (!zoneEnabled) {
//       return res.json({
//         serviceAvailable: false,
//         message: `Zone ${zone.zoneId} is disabled for today`,
//         data: {
//           zoneId: zone.zoneId,
//           currentTime: `${currentHours}:${String(currentMinutes).padStart(2, '0')}`,
//           currentTimestamp: now.toISOString(),
//           activeSlot: null,
//           allSlots: [],   // or you could build allSlots and mark them all disabled
//           zoneInfo: {
//             zoneId: zone.zoneId,
//             enabled: false,
//             globalServiceEnabled: true,
//             morningDelivery: zone.slotTemplate.morningDelivery || false,
//             totalCapacity: zone.slotTemplate.totalCapacity,
//             slotMinCapacity: zone.slotTemplate.slotMinCapacity
//           },
//           summary: null
//         }
//       });
//     }

//     // Get ALL confirmed bookings for today in this zone
//     const bookings = await Booking.find({
//       zoneId: zoneId.toUpperCase(),
//       date: today,
//       status: 'confirmed'
//     });
    
//     // Create map: slotTime -> bookedCount
//     const bookedMap = new Map();
//     bookings.forEach(booking => {
//       bookedMap.set(booking.slotTime, (bookedMap.get(booking.slotTime) || 0) + 1);
//     });

//     const timeToMinutes = (timeStr) => {
//       let time = timeStr.toUpperCase().trim();
//       let hours = parseInt(time.match(/\d+/)[0]);
//       const isPM = time.includes('PM');
//       const isAM = time.includes('AM');

//       let minutes = 0;
//       const minuteMatch = time.match(/\d+:(\d+)/);
//       if (minuteMatch) {
//         minutes = parseInt(minuteMatch[1]);
//       }

//       if (isPM && hours !== 12) hours += 12;
//       if (isAM && hours === 12) hours = 0;

//       return (hours * 60) + minutes;
//     };

//     // Build slots from template + overrides + real bookings
//     const allSlots = zone.slotTemplate.slots.map(templateSlot => {
//       const override = zoneOverrides.get(templateSlot.time);
//       const enabled = override?.enabled !== undefined ? override.enabled : templateSlot.defaultEnabled;
//       const totalCapacity = override?.capacity !== undefined ? override.capacity : templateSlot.defaultCapacity;
//       const bookedCount = bookedMap.get(templateSlot.time) || 0;
//       const availableCapacity = totalCapacity - bookedCount;
      
//       const [startTime, endTime] = templateSlot.time.split(" - ");
//       const startMinutes = timeToMinutes(startTime.trim());
//       const endMinutes = timeToMinutes(endTime.trim());

//       // Slot is active if:
//       // 1. It's enabled
//       // 2. Current time is within slot window
//       // 3. Available capacity > 0
//       const isActive = enabled && 
//                        currentTimeInMinutes >= startMinutes && 
//                        currentTimeInMinutes <= endMinutes &&
//                        availableCapacity > 0;

//       let status;
//       if (!enabled) {
//         status = 'disabled';
//       } else if (isActive) {
//         status = 'active';
//       } else if (startMinutes > currentTimeInMinutes) {
//         status = 'upcoming';
//       } else {
//         status = 'expired';
//       }

//       return {
//         time: templateSlot.time,
//         startTime: startTime.trim(),
//         endTime: endTime.trim(),
//         enabled,
//         totalCapacity,
//         bookedCapacity: bookedCount,
//         availableCapacity,
//         isActive,
//         status,
//         bookingPercentage: totalCapacity > 0 ? (bookedCount / totalCapacity) * 100 : 0
//       };
//     });

//     const activeSlot = allSlots.find(slot => slot.isActive && slot.availableCapacity > 0) || null;

//     const zoneInfo = {
//       zoneId: zone.zoneId,
//       enabled: zoneEnabled,
//       globalServiceEnabled: true,
//       morningDelivery: zone.slotTemplate.morningDelivery || false,
//       totalCapacity: zone.slotTemplate.totalCapacity,
//       slotMinCapacity: zone.slotTemplate.slotMinCapacity
//     };

//     const summary = {
//       totalSlots: allSlots.length,
//       enabledSlots: allSlots.filter(s => s.enabled).length,
//       disabledSlots: allSlots.filter(s => s.status === 'disabled').length,
//       upcomingSlots: allSlots.filter(s => s.status === 'upcoming').length,
//       activeSlotCount: allSlots.filter(s => s.status === 'active').length,
//       expiredSlots: allSlots.filter(s => s.status === 'expired').length,
//       totalAvailableCapacity: allSlots.reduce((sum, s) => sum + (s.enabled ? s.availableCapacity : 0), 0),
//       totalBookedCapacity: allSlots.reduce((sum, s) => sum + (s.enabled ? s.bookedCapacity : 0), 0),
//       totalCapacity: allSlots.reduce((sum, s) => sum + (s.enabled ? s.totalCapacity : 0), 0)
//     };

//     return res.json({
//       serviceAvailable: activeSlot !== null,
//       message: activeSlot
//         ? `Service is available. Current slot: ${activeSlot.time} (${activeSlot.availableCapacity} spots left)`
//         : "No active time slot available at this time",
//       data: {
//         zoneId: zone.zoneId,
//         currentTime: `${currentHours}:${String(currentMinutes).padStart(2, '0')}`,
//         currentTimestamp: now.toISOString(),
//         activeSlot,
//         allSlots,
//         zoneInfo,
//         summary
//       }
//     });

//   } catch (err) {
//     console.error("Service check error:", err);
//     res.status(500).json({
//       serviceAvailable: false,
//       error: "Service check failed: " + err.message,
//       data: null
//     });
//   }
// };


// service check revised on date :- 21-05-2026
export const checkService = async (req, res) => {
  try {
    const { zoneId, date: requestedDate } = req.body;   // <-- accept date

    if (!zoneId) {
      return res.status(400).json({
        serviceAvailable: false,
        error: "zoneId is required"
      });
    }

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const targetDate = requestedDate || today;           // <-- use requested date or fallback to today
    const isToday = targetDate === today;

    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = (currentHours * 60) + currentMinutes;

    // Get zone with template
    const zone = await Zone.findOne({ zoneId: zoneId.toUpperCase() });
    
    if (!zone || !zone.slotTemplate || !zone.slotTemplate.slots.length) {
      return res.json({
        serviceAvailable: false,
        message: "Zone not configured",
        data: {
          zoneId,
          currentTime: `${currentHours}:${String(currentMinutes).padStart(2, '0')}`,
          activeSlot: null,
          allSlots: [],
          zoneInfo: null,
          summary: null
        }
      });
    }

    // Get date-specific overrides for the target date
    let config = await SlotConfig.findOne({ date: targetDate });
    let zoneOverrides = new Map();
    let zoneEnabled = true;
    let globalServiceEnabled = true;
    
    if (config) {
      globalServiceEnabled = config.serviceEnabled !== false;
      
      const zoneConfig = config.zones.find(z => z.zoneId === zoneId.toUpperCase());
      if (zoneConfig) {
        zoneEnabled = zoneConfig.enabled !== false;
        if (zoneConfig.overrides) {
          zoneOverrides = new Map(
            zoneConfig.overrides.map(o => [o.time, { enabled: o.enabled, capacity: o.capacity }])
          );
        }
      }
    }

    // If global service is disabled for this date
    if (!globalServiceEnabled) {
      return res.json({
        serviceAvailable: false,
        message: `Service is currently disabled for ${targetDate}`,
        data: {
          zoneId: zone.zoneId,
          currentTime: `${currentHours}:${String(currentMinutes).padStart(2, '0')}`,
          currentTimestamp: now.toISOString(),
          activeSlot: null,
          allSlots: [],
          zoneInfo: {
            zoneId: zone.zoneId,
            enabled: zoneEnabled,
            globalServiceEnabled: false,
            morningDelivery: zone.slotTemplate.morningDelivery || false,
            totalCapacity: zone.slotTemplate.totalCapacity,
            slotMinCapacity: zone.slotTemplate.slotMinCapacity
          },
          summary: null
        }
      });
    }

    // If zone is explicitly disabled for this date
    if (!zoneEnabled) {
      return res.json({
        serviceAvailable: false,
        message: `Zone ${zone.zoneId} is disabled for ${targetDate}`,
        data: {
          zoneId: zone.zoneId,
          currentTime: `${currentHours}:${String(currentMinutes).padStart(2, '0')}`,
          currentTimestamp: now.toISOString(),
          activeSlot: null,
          allSlots: [],
          zoneInfo: {
            zoneId: zone.zoneId,
            enabled: false,
            globalServiceEnabled: true,
            morningDelivery: zone.slotTemplate.morningDelivery || false,
            totalCapacity: zone.slotTemplate.totalCapacity,
            slotMinCapacity: zone.slotTemplate.slotMinCapacity
          },
          summary: null
        }
      });
    }

    // Get ALL confirmed bookings for the target date in this zone
    const bookings = await Booking.find({
      zoneId: zoneId.toUpperCase(),
      date: targetDate,
      status: 'confirmed'
    });
    
    // Create map: slotTime -> bookedCount
    const bookedMap = new Map();
    bookings.forEach(booking => {
      bookedMap.set(booking.slotTime, (bookedMap.get(booking.slotTime) || 0) + 1);
    });

    const timeToMinutes = (timeStr) => {
      let time = timeStr.toUpperCase().trim();
      let hours = parseInt(time.match(/\d+/)[0]);
      const isPM = time.includes('PM');
      const isAM = time.includes('AM');

      let minutes = 0;
      const minuteMatch = time.match(/\d+:(\d+)/);
      if (minuteMatch) {
        minutes = parseInt(minuteMatch[1]);
      }

      if (isPM && hours !== 12) hours += 12;
      if (isAM && hours === 12) hours = 0;

      return (hours * 60) + minutes;
    };

    // Build slots from template + overrides + real bookings
    const allSlots = zone.slotTemplate.slots.map(templateSlot => {
      const override = zoneOverrides.get(templateSlot.time);
      const enabled = override?.enabled !== undefined ? override.enabled : templateSlot.defaultEnabled;
      const totalCapacity = override?.capacity !== undefined ? override.capacity : templateSlot.defaultCapacity;
      const bookedCount = bookedMap.get(templateSlot.time) || 0;
      const availableCapacity = totalCapacity - bookedCount;
      
      const [startTime, endTime] = templateSlot.time.split(" - ");
      const startMinutes = timeToMinutes(startTime.trim());
      const endMinutes = timeToMinutes(endTime.trim());

      // Determine status based on whether date is today or future
      let status;
      let isActive = false;

      if (!enabled) {
        status = 'disabled';
      } else if (!isToday) {
        // For future dates: all enabled slots are "upcoming" (or you could use "available")
        status = 'upcoming';
      } else {
        // Today's logic: active, upcoming, expired based on current time
        if (currentTimeInMinutes >= startMinutes && currentTimeInMinutes <= endMinutes && availableCapacity > 0) {
          isActive = true;
          status = 'active';
        } else if (startMinutes > currentTimeInMinutes) {
          status = 'upcoming';
        } else {
          status = 'expired';
        }
      }

      return {
        time: templateSlot.time,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        enabled,
        totalCapacity,
        bookedCapacity: bookedCount,
        availableCapacity,
        isActive,
        status,
        bookingPercentage: totalCapacity > 0 ? (bookedCount / totalCapacity) * 100 : 0
      };
    });

    // For today: activeSlot is the first active slot with capacity > 0
    // For future dates: we can consider any upcoming slot as "available" but not "active"
    const activeSlot = isToday ? allSlots.find(slot => slot.isActive && slot.availableCapacity > 0) || null : null;

    // Determine service availability:
    // - Today: true if there is an active slot with capacity > 0
    // - Future: true if there is at least one enabled slot with available capacity > 0
    let serviceAvailable;
    let responseMessage;
    if (isToday) {
      serviceAvailable = activeSlot !== null;
      responseMessage = serviceAvailable
        ? `Service is available. Current slot: ${activeSlot.time} (${activeSlot.availableCapacity} spots left)`
        : "No active time slot available at this time";
    } else {
      const hasAvailableSlot = allSlots.some(slot => slot.enabled && slot.availableCapacity > 0);
      serviceAvailable = hasAvailableSlot;
      responseMessage = hasAvailableSlot
        ? `Service is available on ${targetDate}. Choose a slot below.`
        : `No available slots for ${targetDate}`;
    }

    const zoneInfo = {
      zoneId: zone.zoneId,
      enabled: zoneEnabled,
      globalServiceEnabled: true,
      morningDelivery: zone.slotTemplate.morningDelivery || false,
      totalCapacity: zone.slotTemplate.totalCapacity,
      slotMinCapacity: zone.slotTemplate.slotMinCapacity
    };

    const summary = {
      totalSlots: allSlots.length,
      enabledSlots: allSlots.filter(s => s.enabled).length,
      disabledSlots: allSlots.filter(s => s.status === 'disabled').length,
      upcomingSlots: allSlots.filter(s => s.status === 'upcoming').length,
      activeSlotCount: allSlots.filter(s => s.status === 'active').length,
      expiredSlots: allSlots.filter(s => s.status === 'expired').length,
      totalAvailableCapacity: allSlots.reduce((sum, s) => sum + (s.enabled ? s.availableCapacity : 0), 0),
      totalBookedCapacity: allSlots.reduce((sum, s) => sum + (s.enabled ? s.bookedCapacity : 0), 0),
      totalCapacity: allSlots.reduce((sum, s) => sum + (s.enabled ? s.totalCapacity : 0), 0)
    };

    return res.json({
      serviceAvailable,
      message: responseMessage,
      data: {
        zoneId: zone.zoneId,
        date: targetDate,                     // include the date used
        currentTime: `${currentHours}:${String(currentMinutes).padStart(2, '0')}`,
        currentTimestamp: now.toISOString(),
        activeSlot,
        allSlots,
        zoneInfo,
        summary
      }
    });

  } catch (err) {
    console.error("Service check error:", err);
    res.status(500).json({
      serviceAvailable: false,
      error: "Service check failed: " + err.message,
      data: null
    });
  }
};

// GET - Get specific zone configuration for a date
export const getZoneSlots = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Date parameter is required" });
    }

    const zone = await Zone.findOne({ zoneId: zoneId.toUpperCase() });
    
    if (!zone || !zone.slotTemplate) {
      return res.status(404).json({ error: "Zone not found or not configured" });
    }

    const config = await SlotConfig.findOne({ date });
    let zoneOverrides = new Map();
    let zoneEnabled = true;
    
    if (config) {
      const zoneConfig = config.zones.find(z => z.zoneId === zoneId.toUpperCase());
      if (zoneConfig) {
        zoneEnabled = zoneConfig.enabled;
        if (zoneConfig.overrides) {
          zoneOverrides = new Map(
            zoneConfig.overrides.map(o => [o.time, { enabled: o.enabled, capacity: o.capacity }])
          );
        }
      }
    }

    const slots = zone.slotTemplate.slots.map(templateSlot => {
      const override = zoneOverrides.get(templateSlot.time);
      return {
        time: templateSlot.time,
        enabled: override?.enabled !== undefined ? override.enabled : templateSlot.defaultEnabled,
        capacity: override?.capacity !== undefined ? override.capacity : templateSlot.defaultCapacity
      };
    });

    res.json({
      success: true,
      data: {
        zoneId: zone.zoneId,
        enabled: zoneEnabled,
        morningDelivery: zone.slotTemplate.morningDelivery,
        totalCapacity: zone.slotTemplate.totalCapacity,
        slotMinCapacity: zone.slotTemplate.slotMinCapacity,
        slots
      },
      isDefault: !config
    });
  } catch (err) {
    console.error("Error fetching zone slots:", err);
    res.status(500).json({ error: "Fetch failed: " + err.message });
  }
};

// GET - Get all dates that have configurations
export const getConfiguredDates = async (req, res) => {
  try {
    const { month, year } = req.query;

    let query = {};
    if (month && year) {
      const monthStr = month.toString().padStart(2, '0');
      query.date = {
        $regex: `^${year}-${monthStr}-\\d{2}$`
      };
    }

    const dates = await SlotConfig.find(query)
      .select('date serviceEnabled')
      .sort({ date: 1 });

    res.json({
      success: true,
      data: dates,
      count: dates.length
    });
  } catch (err) {
    console.error("Error fetching dates:", err);
    res.status(500).json({ error: "Fetch failed: " + err.message });
  }
};