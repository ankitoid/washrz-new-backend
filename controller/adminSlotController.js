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

import SlotConfig from "../models/SlotConfig.js";
import Zone from "../models/Zone.js";

const getAllTimeSlots = () => [
  "08AM - 11AM", "09AM - 12PM", "10AM - 01PM", "11AM - 02PM",
  "12PM - 03PM", "01PM - 04PM", "02PM - 05PM", "03PM - 06PM",
  "04PM - 07PM", "05PM - 08PM", "06PM - 09PM"
];

const getDefaultZoneConfig = async () => {
  const zones = await Zone.find({});
  const allTimeSlots = getAllTimeSlots();
  
  return zones.map(zone => ({
    zoneId: zone.zoneId,
    enabled: true,
    slots: allTimeSlots.map(time => ({
      time,
      enabled: true
    }))
  }));
};

export const saveSlots = async (req, res) => {
  try {
    const { date, serviceEnabled, zones } = req.body;

    if (!date || !zones) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    const result = await SlotConfig.findOneAndUpdate(
      { date },
      {
        date,
        serviceEnabled: serviceEnabled !== undefined ? serviceEnabled : true,
        zones: zones.map(zone => ({
          zoneId: zone.zoneId,
          enabled: zone.enabled,
          slots: zone.slots
        }))
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true
      }
    );

    res.json({
      success: true,
      data: result,
      message: "Slots saved successfully"
    });
  } catch (err) {
    console.error("Error saving slots:", err);
    
    if (err.code === 11000) {
      return res.status(409).json({ error: "Configuration for this date already exists" });
    }
    
    res.status(500).json({ error: "Save slots failed: " + err.message });
  }
};

export const getSlots = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Date parameter is required" });
    }

    let config = await SlotConfig.findOne({ date });

    if (!config) {
      const defaultZones = await getDefaultZoneConfig();
      return res.json({
        date,
        serviceEnabled: true,
        zones: defaultZones,
        isDefault: true
      });
    }

    res.json(config);
  } catch (err) {
    console.error("Error fetching slots:", err);
    res.status(500).json({ error: "Fetch failed: " + err.message });
  }
};

export const resetSlots = async (req, res) => {
  try {
    const { date } = req.query;
    
    if (date) {
      await SlotConfig.deleteOne({ date });
      res.json({ message: `Slot config for ${date} deleted successfully` });
    } else {
      await SlotConfig.deleteMany({});
      res.json({ message: "All slot configs deleted successfully" });
    }
  } catch (error) {
    console.error("Error deleting slots:", error);
    res.status(500).json({ error: "Failed to delete: " + error.message });
  }
};

export const copySlots = async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    
    const sourceConfig = await SlotConfig.findOne({ date: fromDate });
    if (!sourceConfig) {
      return res.status(404).json({ error: "Source date configuration not found" });
    }
    
    const newConfig = await SlotConfig.create({
      date: toDate,
      serviceEnabled: sourceConfig.serviceEnabled,
      zones: sourceConfig.zones
    });
    
    res.json({
      success: true,
      data: newConfig,
      message: `Configuration copied from ${fromDate} to ${toDate}`
    });
  } catch (err) {
    console.error("Error copying slots:", err);
    res.status(500).json({ error: "Copy failed: " + err.message });
  }
};