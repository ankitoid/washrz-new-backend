// services/populationService.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import GeoJSONRBush from "geojson-rbush";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let index = null;
let minPop = 0;
let maxPop = 0;
let isLoaded = false;
let popKey = 'population';

function loadData() {
  try {
    const possiblePaths = [
      path.join(__dirname, '../data/delhi_ncr_population.geojson'),
      path.join(process.cwd(), 'data/delhi_ncr_population.geojson'),
    ];

    let filePath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        filePath = p;
        break;
      }
    }

    if (!filePath) {
      console.error('❌ Population data file not found.');
      return;
    }

    console.log(`📂 Loading population data from: ${filePath}`);
    const stats = fs.statSync(filePath);
    console.log(`📄 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    const raw = fs.readFileSync(filePath, 'utf8');
    const geojson = JSON.parse(raw);
    const features = geojson.features;

    if (!features || features.length === 0) {
      console.error('❌ No features found in the file.');
      return;
    }

    // Detect population property
    const sampleFeature = features[0];
    const popKeys = ['population', 'pop', 'Population', 'POP', 'value'];
    for (const key of popKeys) {
      if (sampleFeature.properties && sampleFeature.properties[key] !== undefined) {
        popKey = key;
        break;
      }
    }
    console.log(`📊 Using property "${popKey}" for population values.`);

    // Validate and clean features (remove invalid ones)
    const validFeatures = [];
    for (const feature of features) {
      if (feature.geometry && feature.geometry.type && feature.geometry.coordinates) {
        // Basic validation: ensure coordinates are arrays of numbers
        try {
          JSON.stringify(feature.geometry); // quick check
          validFeatures.push(feature);
        } catch (e) {
          console.warn('⚠️ Skipping invalid feature (geometry not serializable)');
        }
      } else {
        console.warn('⚠️ Skipping feature without valid geometry');
      }
    }

    if (validFeatures.length === 0) {
      console.error('❌ No valid features after cleaning.');
      return;
    }

    console.log(`✅ Loaded ${validFeatures.length} valid features out of ${features.length}`);

    // Build RBush index
    index = GeoJSONRBush();
    index.load(validFeatures);

    // Compute min/max
    const pops = validFeatures.map(f => f.properties[popKey] || 0);
    minPop = Math.min(...pops);
    maxPop = Math.max(...pops);
    const totalPop = pops.reduce((a, b) => a + b, 0);

    isLoaded = true;
    console.log(`✅ Index built. Population range: ${minPop} - ${maxPop}`);
    console.log(`📊 Total population across all hexagons: ${totalPop.toLocaleString()}`);
  } catch (err) {
    console.error('❌ Failed to load population data:', err.message);
    console.error(err.stack);
  }
}

loadData();

export function getHexagonsInBBox(bbox) {
  if (!isLoaded || !index) {
    console.warn('⚠️ Data not loaded.');
    return [];
  }

  // Build the query polygon
  const queryPolygon = {
    type: 'Polygon',
    coordinates: [[
      [bbox[0], bbox[1]],
      [bbox[2], bbox[1]],
      [bbox[2], bbox[3]],
      [bbox[0], bbox[3]],
      [bbox[0], bbox[1]]
    ]]
  };

  // Wrap it in a Feature (required by geojson-rbush)
  const queryFeature = {
    type: 'Feature',
    geometry: queryPolygon,
    properties: {}
  };

  console.log(`🔍 Querying bbox: [${bbox.join(', ')}]`);

  try {
    const result = index.search(queryFeature);
    console.log(`✅ Found ${result.features.length} hexagons.`);
    return result.features.map(f => ({
      geometry: f.geometry,
      properties: {
        population: f.properties.population || f.properties.pop || 0
      }
    }));
  } catch (err) {
    console.error('❌ Spatial search error:', err.message);
    return [];
  }
}

export function getPopulationStats() {
  return { min: minPop, max: maxPop };
}