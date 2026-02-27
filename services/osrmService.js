import axios from "axios";

// const OSRM_BASE_URL = "https://router.project-osrm.org";
const OSRM_BASE_URL = "https://routing.openstreetmap.de/routed-bike";


class OSRMService {
  /**
   * Calculate route distance and duration between two points
   * @param {Object} origin - { lat, lng }
   * @param {Object} destination - { lat, lng }
   * @returns {Promise<{distance: number, duration: number} | null>}
   */
  async getRouteDistance(origin, destination) {
    try {
      const response = await axios.get(
        `${OSRM_BASE_URL}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`,
        {
          params: {
            overview: "false",
            alternatives: "false",
            steps: "false",
          },
          timeout: 5000, // 5 second timeout
        }
      );

      if (response.data?.routes?.length > 0) {
        const route = response.data.routes[0];
        return {
          distance: route.distance / 1000, // Convert to kilometers
          duration: route.duration / 60, // Convert to minutes
          distanceMeters: route.distance,
          durationSeconds: route.duration,
        };
      }
      return null;
    } catch (error) {
      console.error("OSRM API Error:", error.message);
      return null;
    }
  }

  /**
   * Calculate distances for multiple destinations from a single origin
   * @param {Object} origin - { lat, lng }
   * @param {Array} destinations - Array of { id, lat, lng }
   * @returns {Promise<Array>}
   */
  async getBatchDistances(origin, destinations) {
    if (!destinations.length) return [];

    // Process sequentially to avoid rate limiting
    const results = [];
    for (const dest of destinations) {
      const routeData = await this.getRouteDistance(origin, dest);
      results.push({
        id: dest.id,
        ...routeData,
      });
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return results;
  }

  /**
   * Calculate distance using coordinates array format
   * @param {Array} coordinates - [[lng, lat], [lng, lat]]
   * @returns {Promise<Object|null>}
   */
  async getRouteByCoordinates(coordinates) {
    try {
      const coordString = coordinates.map(c => `${c[0]},${c[1]}`).join(";");
      
      const response = await axios.get(
        `${OSRM_BASE_URL}/route/v1/driving/${coordString}`,
        {
          params: {
            overview: "false",
            alternatives: "false",
            steps: "false",
          },
          timeout: 5000,
        }
      );

      if (response.data?.routes?.length > 0) {
        const route = response.data.routes[0];
        return {
          distance: route.distance / 1000,
          duration: route.duration / 60,
          distanceMeters: route.distance,
          durationSeconds: route.duration,
        };
      }
      return null;
    } catch (error) {
      console.error("OSRM Route Error:", error.message);
      return null;
    }
  }
}

export default new OSRMService();