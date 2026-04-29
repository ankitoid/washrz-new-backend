// controllers/location.controller.js

import axios from "axios";
import Zone from "../models/Zone.js";
import { createFallbackBoundary, pickEvenPoints } from "../services/slots.service.js";

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