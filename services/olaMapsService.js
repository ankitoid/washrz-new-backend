import axios from "axios";

/**
 * Geocode an address using Ola Maps Geocoding API
 * @param {string} address - The physical address to geocode
 * @returns {Promise<{lat: number, lng: number}>} Coordinates object
 */
export const geocodeWithOla = async (address) => {
  const apiKey = process.env.OLA_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("OLA_MAPS_API_KEY environment variable is not set");
  }

  try {
    const response = await axios.get("https://api.olamaps.io/places/v1/geocode", {
      params: { address, api_key: apiKey },
      timeout: 10000,
    });

    const data = response.data;
    if (data.status !== "ok" && data.message) {
      throw new Error(`Ola Maps API error: ${data.message}`);
    }

    const results = data.geocodingResults || [];
    if (results.length === 0) {
      throw new Error("No results found for this address");
    }

    const location = results[0]?.geometry?.location;
    const lat = location?.lat;
    const lng = location?.lng;

    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      throw new Error("Invalid response format from Ola Maps (missing lat/lng)");
    }

    return { lat: parseFloat(lat), lng: parseFloat(lng) };
  } catch (error) {
    console.error("[geocodeWithOla] Failed to geocode address:", address, error.message);
    throw error;
  }
};
