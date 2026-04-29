// // controllers/service.controller.js

// import SlotConfig from "../models/SlotConfig.js";
// import moment from "moment";

// export const checkService = async (req, res) => {
//   try {
//     const { zoneId } = req.query;

//     const now = moment();
//     const currentTime = now.format("HH:mm");
//     const today = now.format("YYYY-MM-DD");

//     const config = await SlotConfig.findOne({ date: today });

//     if (!config || !config.serviceEnabled) {
//       return res.json({ serviceAvailable: false });
//     }

//     const zone = config.zones.find((z) => z.zoneId === zoneId);

//     if (!zone || !zone.enabled) {
//       return res.json({ serviceAvailable: false });
//     }

//     const activeSlot = zone.slots.find((slot) => {
//       const [start, end] = convertSlot(slot.time);
//       return currentTime >= start && currentTime <= end;
//     });

//     if (!activeSlot || !activeSlot.enabled) {
//       return res.json({ serviceAvailable: false });
//     }

//     return res.json({ serviceAvailable: true });

//   } catch (err) {
//     res.status(500).json({ error: "Service check failed" });
//   }
// };

// function convertSlot(slot) {
//   const [start, end] = slot.split(" - ");
//   return [
//     moment(start, "hhA").format("HH:mm"),
//     moment(end, "hhA").format("HH:mm"),
//   ];
// }

// controllers/service.controller.js

// import SlotConfig from "../models/SlotConfig.js";
// import moment from "moment";

// export const checkService = async (req, res) => {
//   try {
//     const { zoneId } = req.body;

//     if (!zoneId) {
//       return res.status(400).json({ 
//         serviceAvailable: false,
//         error: "zoneId is required" 
//       });
//     }

//     const now = moment();
//     const currentTime = now.format("HH:mm");
//     const today = now.format("YYYY-MM-DD");


//     console.log("this is the currentTime and today",currentTime,today)

//     const config = await SlotConfig.findOne({ date: today });

//     console.log('this is the config-->>',config)

//     if (!config || !config.serviceEnabled) {
//       return res.json({ 
//         serviceAvailable: false,
//         message: "Service is currently disabled globally"
//       });
//     }

//     const zone = config.zones.find((z) => z.zoneId === zoneId);

//     console.log("this is the zone",zone)

//     if (!zone || !zone.enabled) {
//       return res.json({ 
//         serviceAvailable: false,
//         message: "Service is disabled in your area"
//       });
//     }

//     const convertToMinutes = (timeStr) => {
//       const [time, modifier] = timeStr.split(/(?=[AP]M)/);
//       let [hours, minutes] = time.split(':');
//       if (hours === '12') hours = '00';
//       if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
//       return parseInt(hours, 10) * 60 + parseInt(minutes, 10);
//     };

//     const activeSlot = zone.slots.find((slot) => {
//       if (!slot.enabled) return false;
      
//       const [startTime, endTime] = slot.time.split(" - ");
//       const startMinutes = convertToMinutes(startTime);
//       const endMinutes = convertToMinutes(endTime);
//       const currentMinutes = convertToMinutes(currentTime);
      
//       return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
//     });

//     if (!activeSlot) {
//       return res.json({ 
//         serviceAvailable: false,
//         message: "No active time slot available for your location at this time"
//       });
//     }

//     return res.json({ 
//       serviceAvailable: true,
//       message: "Service is available",
//       slot: activeSlot.time
//     });

//   } catch (err) {
//     console.error("Service check error:", err);
//     res.status(500).json({ 
//       serviceAvailable: false,
//       error: "Service check failed" 
//     });
//   }
// };


// controllers/service.controller.js - Simplified Version

import SlotConfig from "../models/SlotConfig.js";

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
//     const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
//     const currentHours = now.getHours();
//     const currentMinutes = now.getMinutes();
//     const currentTimeInMinutes = (currentHours * 60) + currentMinutes;

//     console.log("Current time:", `${currentHours}:${currentMinutes}`, "Minutes:", currentTimeInMinutes);
//     console.log("Today:", today);

//     const config = await SlotConfig.findOne({ date: today });

//     if (!config) {
//       return res.json({
//         serviceAvailable: false,
//         message: "No configuration found for today"
//       });
//     }

//     if (!config.serviceEnabled) {
//       return res.json({
//         serviceAvailable: false,
//         message: "Service is currently disabled"
//       });
//     }

//     const zone = config.zones.find((z) => z.zoneId === zoneId);

//     if (!zone || !zone.enabled) {
//       return res.json({
//         serviceAvailable: false,
//         message: "Service is disabled in your area"
//       });
//     }

//     // Function to convert time string to minutes
//     const timeToMinutes = (timeStr) => {
//       // Remove AM/PM and split
//       let time = timeStr.toUpperCase();
//       let hours = parseInt(time.match(/\d+/)[0]);
//       const isPM = time.includes('PM');
//       const isAM = time.includes('AM');
      
//       // Extract minutes if present (like 08:30AM)
//       let minutes = 0;
//       const minuteMatch = time.match(/\d+:(\d+)/);
//       if (minuteMatch) {
//         minutes = parseInt(minuteMatch[1]);
//       }
      
//       // Convert to 24-hour format
//       if (isPM && hours !== 12) {
//         hours += 12;
//       }
//       if (isAM && hours === 12) {
//         hours = 0;
//       }
      
//       return (hours * 60) + minutes;
//     };

//     // Find active time slot
//     let activeSlot = null;
    
//     for (const slot of zone.slots) {
//       if (!slot.enabled) continue;
      
//       const [startTime, endTime] = slot.time.split(" - ");
//       const startMinutes = timeToMinutes(startTime);
//       const endMinutes = timeToMinutes(endTime);
      
//       console.log(`Checking slot ${slot.time}: ${startMinutes} - ${endMinutes}, Current: ${currentTimeInMinutes}`);
      
//       if (currentTimeInMinutes >= startMinutes && currentTimeInMinutes <= endMinutes) {
//         activeSlot = slot;
//         break;
//       }
//     }

//     if (!activeSlot) {
//       // Return available slots for debugging
//       const availableSlots = zone.slots
//         .filter(s => s.enabled)
//         .map(s => s.time);
      
//       return res.json({
//         serviceAvailable: false,
//         message: "No active time slot available for your location at this time",
//         currentTime: `${currentHours}:${currentMinutes}`,
//         availableSlots: availableSlots
//       });
//     }

//     return res.json({
//       serviceAvailable: true,
//       message: "Service is available",
//       slot: activeSlot.time
//     });

//   } catch (err) {
//     console.error("Service check error:", err);
//     res.status(500).json({
//       serviceAvailable: false,
//       error: "Service check failed"
//     });
//   }
// };


export const pickEvenPoints = (points, count) => {
  if (points.length <= count) return points;

  const step = Math.floor(points.length / count);
  const result = [];

  for (let i = 0; i < points.length; i += step) {
    result.push(points[i]);
    if (result.length === count) break;
  }

  return result;
}

export const createFallbackBoundary = (lat, lng, diff) => {
  return [
    [lng - diff, lat - diff],
    [lng + diff, lat - diff],
    [lng + diff, lat + diff],
    [lng - diff, lat + diff],
    [lng - diff, lat - diff],
  ]
};