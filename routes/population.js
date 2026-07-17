// routes/population.js

import express from 'express';
import { getHexagonsInBBox, getPopulationStats } from '../services/populationService.js';

const router = express.Router();

/**
 * GET /api/v1/population/population-hex
 * Query params: bounds = "west,south,east,north"
 * Returns GeoJSON FeatureCollection of hexagons intersecting the bbox,
 * plus global min/max population for color scaling.
 */
router.get('/population-hex', (req, res) => {
  const { bounds } = req.query;

  if (!bounds) {
    return res.status(400).json({ error: 'bounds required (west,south,east,north)' });
  }

  const bbox = bounds.split(',').map(Number);
  if (bbox.length !== 4 || bbox.some(isNaN)) {
    return res.status(400).json({ error: 'invalid bounds format. Use: west,south,east,north' });
  }

  try {
    const features = getHexagonsInBBox(bbox);
    const stats = getPopulationStats();

    res.json({
      type: 'FeatureCollection',
      features,
      stats
    });
  } catch (err) {
    console.error('Error querying population:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;