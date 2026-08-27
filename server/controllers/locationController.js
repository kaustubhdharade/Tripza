const geocodeLocation = async (req, res) => {
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
    return res.status(500).json({
      success: false,
      message: 'OpenRouteService API key is not configured on the server'
    });
  }

  try {
    const url = `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(address)}&size=1`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `OpenRouteService API returned HTTP ${response.status}`
      });
    }

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [longitude, latitude] = feature.geometry.coordinates;
      const formattedAddress = feature.properties.label || feature.properties.name || address;
      
      return res.status(200).json({
        success: true,
        location: {
          address: formattedAddress,
          latitude: latitude,
          longitude: longitude
        }
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'No results found for the provided address'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Server Error: ${error.message}`
    });
  }
};

const calculateRoute = async (req, res) => {
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
  if (!apiKey || apiKey === 'your_openrouteservice_api_key') {
    return res.status(500).json({
      success: false,
      message: 'OpenRouteService API key is not configured on the server'
    });
  }

  try {
    const url = 'https://api.openrouteservice.org/v2/directions/driving-car';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey
      },
      body: JSON.stringify({
        coordinates: [
          [pickup.longitude, pickup.latitude],
          [destination.longitude, destination.latitude]
        ]
      })
    });

    if (!response.ok) {
      let errMsg = `OpenRouteService API returned HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error && errorData.error.message) {
          errMsg = `OpenRouteService Error: ${errorData.error.message}`;
        }
      } catch (e) {
        // response is not json
      }
      return res.status(response.status).json({
        success: false,
        message: errMsg
      });
    }

    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distanceInKm = route.summary.distance / 1000;
      const durationInMins = route.summary.duration / 60;

      return res.status(200).json({
        success: true,
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
      return res.status(404).json({
        success: false,
        message: 'No route found between the specified coordinates'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Server Error: ${error.message}`
    });
  }
};

module.exports = {
  geocodeLocation,
  calculateRoute
};


