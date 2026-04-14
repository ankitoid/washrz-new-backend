// scripts/seedZones.js

import mongoose from "mongoose";
import Zone from "../models/Zone.js";


const seed = async () => {
  try {

    await mongoose.connect("mongodb+srv://shivam_7542:ShivamK100@cluster0.z3dhk.mongodb.net/wxdotcom_test")

    await Zone.deleteMany({}); // optional reset

    await Zone.insertMany([
      {
        name: "Noida",
        city: "Noida",
        zoneId: "NOIDA_01",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [77.30, 28.50],
            [77.45, 28.50],
            [77.45, 28.65],
            [77.30, 28.65],
            [77.30, 28.50],
          ]]
        }
      },
      {
        name: "Greater Noida",
        city: "Greater Noida",
        zoneId: "GNOIDA_01",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [77.45, 28.45],
            [77.65, 28.45],
            [77.65, 28.60],
            [77.45, 28.60],
            [77.45, 28.45],
          ]]
        }
      },
      {
        name: "Gurgaon",
        city: "Gurgaon",
        zoneId: "GURGAON_01",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [76.95, 28.35],
            [77.15, 28.35],
            [77.15, 28.55],
            [76.95, 28.55],
            [76.95, 28.35],
          ]]
        }
      },
      {
        name: "South Delhi",
        city: "Delhi",
        zoneId: "DELHI_SOUTH",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [77.20, 28.45],
            [77.30, 28.45],
            [77.30, 28.60],
            [77.20, 28.60],
            [77.20, 28.45],
          ]]
        }
      },
      {
        name: "North Delhi",
        city: "Delhi",
        zoneId: "DELHI_NORTH",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [77.10, 28.65],
            [77.25, 28.65],
            [77.25, 28.80],
            [77.10, 28.80],
            [77.10, 28.65],
          ]]
        }
      },
      {
        name: "East Delhi",
        city: "Delhi",
        zoneId: "DELHI_EAST",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [77.25, 28.55],
            [77.40, 28.55],
            [77.40, 28.70],
            [77.25, 28.70],
            [77.25, 28.55],
          ]]
        }
      },
      {
        name: "West Delhi",
        city: "Delhi",
        zoneId: "DELHI_WEST",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [77.00, 28.55],
            [77.15, 28.55],
            [77.15, 28.70],
            [77.00, 28.70],
            [77.00, 28.55],
          ]]
        }
      }
    ]);

    console.log("Zones seeded successfully ✅");
    process.exit();

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();