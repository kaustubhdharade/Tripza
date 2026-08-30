const axios = require('axios');

const PUNE_LOCATIONS = {
  coep: { address: 'COEP Technological University, Pune', latitude: 18.5293, longitude: 73.8565 },
  shivajinagar: { address: 'Shivajinagar Railway Station, Pune', latitude: 18.5314, longitude: 73.8446 },
  swargate: { address: 'Swargate Bus Stand, Pune', latitude: 18.5018, longitude: 73.8636 },
  'pune station': { address: 'Pune Junction Railway Station', latitude: 18.5289, longitude: 73.8744 },
  hinjewadi: { address: 'Hinjewadi IT Park, Pune', latitude: 18.5912, longitude: 73.7389 },
  kothrud: { address: 'Kothrud, Pune', latitude: 18.5074, longitude: 73.8077 },
  'viman nagar': { address: 'Viman Nagar, Pune', latitude: 18.5679, longitude: 73.9143 },
  baner: { address: 'Baner, Pune', latitude: 18.5590, longitude: 73.7868 },
  katraj: { address: 'Katraj, Pune', latitude: 18.4575, longitude: 73.8508 },
  hadapsar: { address: 'Hadapsar, Pune', latitude: 18.5089, longitude: 73.9260 },
  airport: { address: 'Pune International Airport', latitude: 18.5822, longitude: 73.9197 }
};

function getFallbackLocation(addressStr) {
  const query = addressStr.toLowerCase().trim();
  for (const key of Object.keys(PUNE_LOCATIONS)) {
    if (query.includes(key)) {
      return PUNE_LOCATIONS[key];
    }
  }
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    hash = (hash << 5) - hash + query.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = ((Math.abs(hash) % 100) - 50) / 1000;
  const lngOffset = ((Math.abs(hash >> 3) % 100) - 50) / 1000;
  return {
    address: addressStr.trim(),
    latitude: Math.round((18.5204 + latOffset) * 10000) / 10000,
    longitude: Math.round((73.8567 + lngOffset) * 10000) / 10000
  };
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const directDist = R * c;
  const roadDist = Math.max(1, Math.round(directDist * 1.3 * 10) / 10);
  return roadDist;
}

const geocodeLocation = async (req, res) => {
  console.log("ORS_KEY Loaded:", !!process.env.ORS_API_KEY);
  const { address } = req.body;

  // Validate that address is provided
  if (!address || typeof address !== 'string' || !address.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Address is required'
    });
  }

  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey || apiKey === 'your_openrouteservice_api_key') {
    // Fallback mode when ORS API key is not configured
    const loc = getFallbackLocation(address);
    return res.status(200).json({
      success: true,
      location: loc,
      isFallback: true
    });
  }

  try {
    const response = await axios.get('https://api.openrouteservice.org/geocode/search', {
      params: {
        api_key: apiKey,
        text: address
      }
    });

    const data = response.data;

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [longitude, latitude] = feature.geometry.coordinates;
      const formattedAddress = feature.properties.label || feature.properties.name || address;
      
      console.log(`[ORS API SUCCESS] Geocoded "${address}" -> Lat: ${latitude}, Lng: ${longitude}`);

      return res.status(200).json({
        success: true,
        source: 'ORS_API',
        isFallback: false,
        location: {
          address: formattedAddress,
          latitude: latitude,
          longitude: longitude
        }
      });
    } else {
      console.log('[ORS API WARN] No features returned for address:', address, '- using fallback');
      const loc = getFallbackLocation(address);
      return res.status(200).json({
        success: true,
        location: loc,
        isFallback: true
      });
    }
  } catch (error) {
    console.error('ORS Geocode API Error:', error.response?.data || error.message || error);
    const loc = getFallbackLocation(address);
    return res.status(200).json({
      success: true,
      location: loc,
      isFallback: true
    });
  }
};

const calculateRoute = async (req, res) => {
  console.log("ORS_KEY Loaded:", !!process.env.ORS_API_KEY);
  const { pickup, destination } = req.body;

  const validateCoordinate = (lat, lng) => {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  };

  // Validate coordinates
  if (
    !pickup ||
    !destination ||
    !validateCoordinate(pickup.latitude, pickup.longitude) ||
    !validateCoordinate(destination.latitude, destination.longitude)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Valid pickup and destination coordinates (latitude and longitude) are required.'
    });
  }

  const apiKey = process.env.ORS_API_KEY;

  const fallbackRoute = () => {
    const distanceInKm = calculateHaversineDistance(
      pickup.latitude,
      pickup.longitude,
      destination.latitude,
      destination.longitude
    );
    const durationInMins = Math.max(3, Math.round((distanceInKm / 30) * 60));
    return res.status(200).json({
      success: true,
      distance: distanceInKm,
      duration: durationInMins,
      geometry: null,
      route: {
        distance: distanceInKm,
        duration: durationInMins,
        geometry: null
      },
      isFallback: true
    });
  };

  if (!apiKey || apiKey === 'your_openrouteservice_api_key') {
    return fallbackRoute();
  }

  try {
    const response = await axios.post(
      'https://api.openrouteservice.org/v2/directions/driving-car',
      {
        coordinates: [
          [pickup.longitude, pickup.latitude],
          [destination.longitude, destination.latitude]
        ]
      },
      {
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = response.data;

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distanceInKm = route.summary.distance / 1000;
      const durationInMins = route.summary.duration / 60;

      console.log(`[ORS API SUCCESS] Route calculated -> Distance: ${distanceInKm.toFixed(1)} km, Duration: ${Math.round(durationInMins)} min`);

      return res.status(200).json({
        success: true,
        source: 'ORS_API',
        isFallback: false,
        distance: distanceInKm,
        duration: durationInMins,
        geometry: route.geometry || null,
        route: {
          distance: distanceInKm,
          duration: durationInMins,
          geometry: route.geometry || null
        }
      });
    } else {
      console.log('[ORS API WARN] No routes returned between coordinates - using fallback');
      return fallbackRoute();
    }
  } catch (error) {
    console.error('ORS CalculateRoute API Error:', error.response?.data || error.message || error);
    return fallbackRoute();
  }
};

module.exports = {
  geocodeLocation,
  calculateRoute
};
