const Ride = require('../models/Ride');
const { segmentPoolRoute, calculatePoolFares } = require('../utils/poolFare');

/**
 * POST /api/rides/personal
 * Authenticated — books a Personal ride and persists it in MongoDB.
 *
 * Expects req.user.id (or req.user._id) to be set by the protect middleware.
 */
const bookPersonalRide = async (req, res) => {
  try {
    const { pickup, destination, distanceKm, durationMinutes, fare } = req.body;

    // ── Validate required top-level fields ──────────────────────────────────
    if (!pickup || !destination) {
      return res.status(400).json({
        success: false,
        message: 'pickup and destination are required'
      });
    }

    // ── Validate pickup sub-fields ──────────────────────────────────────────
    if (
      !pickup.address ||
      pickup.latitude === undefined ||
      pickup.latitude === null ||
      pickup.longitude === undefined ||
      pickup.longitude === null
    ) {
      return res.status(400).json({
        success: false,
        message: 'pickup must include address, latitude, and longitude'
      });
    }

    // ── Validate destination sub-fields ─────────────────────────────────────
    if (
      !destination.address ||
      destination.latitude === undefined ||
      destination.latitude === null ||
      destination.longitude === undefined ||
      destination.longitude === null
    ) {
      return res.status(400).json({
        success: false,
        message: 'destination must include address, latitude, and longitude'
      });
    }

    // ── Validate numeric route fields ───────────────────────────────────────
    if (distanceKm === undefined || distanceKm === null || isNaN(distanceKm) || distanceKm < 0) {
      return res.status(400).json({
        success: false,
        message: 'distanceKm must be a non-negative number'
      });
    }

    if (durationMinutes === undefined || durationMinutes === null || isNaN(durationMinutes) || durationMinutes < 0) {
      return res.status(400).json({
        success: false,
        message: 'durationMinutes must be a non-negative number'
      });
    }

    if (fare === undefined || fare === null || isNaN(fare) || fare < 0) {
      return res.status(400).json({
        success: false,
        message: 'fare must be a non-negative number'
      });
    }

    // ── Resolve userId from JWT (authController signs { userId, role }) ────────
    const userId = req.user.userId || req.user.id || req.user._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User identity could not be determined from token'
      });
    }

    // ── Create and persist the ride ─────────────────────────────────────────
    const ride = await Ride.create({
      user: userId,
      pickup: {
        address: pickup.address,
        latitude: pickup.latitude,
        longitude: pickup.longitude
      },
      destination: {
        address: destination.address,
        latitude: destination.latitude,
        longitude: destination.longitude
      },
      distanceKm,
      durationMinutes,
      fare,
      rideType: 'personal',
      status: 'confirmed'
    });

    return res.status(201).json({
      success: true,
      message: 'Personal ride booked successfully',
      ride: {
        id: ride._id,
        user: ride.user,
        pickup: ride.pickup,
        destination: ride.destination,
        distanceKm: ride.distanceKm,
        durationMinutes: ride.durationMinutes,
        fare: ride.fare,
        rideType: ride.rideType,
        status: ride.status,
        createdAt: ride.createdAt
      }
    });
  } catch (error) {
    console.error('bookPersonalRide error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while booking ride'
    });
  }
};

// ── Geographic Proximity & Route Compatibility Helpers ────────────────────────
const DEFAULT_PROXIMITY_THRESHOLD_KM = 5;

/**
 * Calculates Great-Circle distance between two (lat, lng) points in kilometres using Haversine formula.
 */
function getHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Decodes an encoded polyline string into an array of { latitude, longitude } objects.
 * OpenRouteService uses standard 5-decimal precision encoded polylines.
 */
function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];
  const points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

/**
 * Fetches ORS route polyline points dynamically if no pre-decoded polyline is available.
 */
async function fetchORSGeometryPoints(pickup, destination) {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey || apiKey === 'your_openrouteservice_api_key') return null;

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

    if (!response.ok) return null;
    const data = await response.json();
    if (data.routes && data.routes.length > 0 && data.routes[0].geometry) {
      return decodePolyline(data.routes[0].geometry);
    }
  } catch (err) {
    console.error('fetchORSGeometryPoints error:', err);
  }
  return null;
}

/**
 * Finds the nearest position (in cumulative km from route start) and minimum proximity distance (in km)
 * for a target coordinate point on an ordered polyline.
 */
function findNearestPolylinePosition(point, polylinePoints) {
  if (!polylinePoints || polylinePoints.length === 0) {
    return { minDistanceKm: Infinity, positionKm: 0 };
  }

  if (polylinePoints.length === 1) {
    const dist = getHaversineDistanceKm(
      point.latitude, point.longitude,
      polylinePoints[0].latitude, polylinePoints[0].longitude
    );
    return { minDistanceKm: dist, positionKm: 0 };
  }

  let minDistanceKm = Infinity;
  let bestPositionKm = 0;
  let currentCumulativeKm = 0;

  for (let i = 0; i < polylinePoints.length - 1; i++) {
    const p1 = polylinePoints[i];
    const p2 = polylinePoints[i + 1];
    const segLengthKm = getHaversineDistanceKm(p1.latitude, p1.longitude, p2.latitude, p2.longitude);

    const dLat = p2.latitude - p1.latitude;
    const dLng = p2.longitude - p1.longitude;
    const lenSq = dLat * dLat + dLng * dLng;

    let t = 0;
    if (lenSq > 0) {
      t = ((point.latitude - p1.latitude) * dLat + (point.longitude - p1.longitude) * dLng) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projLat = p1.latitude + t * dLat;
    const projLng = p1.longitude + t * dLng;
    const distKm = getHaversineDistanceKm(point.latitude, point.longitude, projLat, projLng);

    if (distKm < minDistanceKm) {
      minDistanceKm = distKm;
      bestPositionKm = currentCumulativeKm + (t * segLengthKm);
    }

    currentCumulativeKm += segLengthKm;
  }

  return { minDistanceKm, positionKm: bestPositionKm };
}

/**
 * Checks if a passenger's requested route is compatible with a driver's pool ride route using actual ORS geometry.
 *
 * Requirements met:
 * 1. Uses driver's actual ORS route geometry.
 * 2. Determines passenger pickup position along the ORS route polyline (cumulative km from route start).
 * 3. Determines passenger destination position along the ORS route polyline (cumulative km from route start).
 * 4. Enforces 5 km proximity tolerance for both locations.
 * 5. Enforces pickupPosition <= destinationPosition (forward-direction order).
 * 6. Rejects trips in the opposite direction even if both points are close to the route.
 */
async function isRouteCompatible(driverRoute, passengerRoute, thresholdKm = DEFAULT_PROXIMITY_THRESHOLD_KM) {
  if (
    !driverRoute ||
    !driverRoute.pickup ||
    !driverRoute.destination ||
    !passengerRoute ||
    !passengerRoute.pickup ||
    !passengerRoute.destination
  ) {
    return false;
  }

  // 1. Obtain ORS polyline points for driver route
  let polylinePoints = [];

  if (driverRoute.routeGeometry) {
    polylinePoints = decodePolyline(driverRoute.routeGeometry);
  } else if (driverRoute.routePoints && Array.isArray(driverRoute.routePoints)) {
    polylinePoints = driverRoute.routePoints;
  }

  // Fallback to dynamic ORS fetch if polyline points are not cached
  if (!polylinePoints || polylinePoints.length < 2) {
    const fetchedPoints = await fetchORSGeometryPoints(driverRoute.pickup, driverRoute.destination);
    if (fetchedPoints && fetchedPoints.length >= 2) {
      polylinePoints = fetchedPoints;
    } else {
      // Endpoint fallback if fetch unavailable
      polylinePoints = [driverRoute.pickup, driverRoute.destination];
    }
  }

  const pPick = passengerRoute.pickup;
  const pDest = passengerRoute.destination;

  // 2. Find passenger pickup position along ORS route and proximity distance
  const pickupRes = findNearestPolylinePosition(pPick, polylinePoints);

  // 3. Find passenger destination position along ORS route and proximity distance
  const destRes = findNearestPolylinePosition(pDest, polylinePoints);

  // 4. Validate proximity tolerance (both pickup and destination must be within thresholdKm)
  if (pickupRes.minDistanceKm > thresholdKm || destRes.minDistanceKm > thresholdKm) {
    return false;
  }

  // 5. Validate forward-direction order (pickup position <= destination position)
  if (pickupRes.positionKm > destRes.positionKm) {
    return false;
  }

  return true;
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/rides/pool/active
 * Returns active pool rides from MongoDB, filtered by route compatibility if passenger coordinates are supplied.
 */
const getActivePoolRides = async (req, res) => {
  try {
    const { pickupLat, pickupLng, destinationLat, destinationLng, threshold } = req.query;

    const hasPassengerCoords =
      pickupLat !== undefined &&
      pickupLng !== undefined &&
      destinationLat !== undefined &&
      destinationLng !== undefined &&
      !isNaN(parseFloat(pickupLat)) &&
      !isNaN(parseFloat(pickupLng)) &&
      !isNaN(parseFloat(destinationLat)) &&
      !isNaN(parseFloat(destinationLng));

    const thresholdKm = (threshold && !isNaN(parseFloat(threshold)) && parseFloat(threshold) > 0)
      ? parseFloat(threshold)
      : DEFAULT_PROXIMITY_THRESHOLD_KM;

    let rides = await Ride.find({
      rideType: 'pool',
      status: 'active'
    })
      .populate('driver', 'name email')
      .populate('passengers.user', 'name email')
      .sort({ createdAt: -1 });

    if (hasPassengerCoords) {
      const passengerRoute = {
        pickup: { latitude: parseFloat(pickupLat), longitude: parseFloat(pickupLng) },
        destination: { latitude: parseFloat(destinationLat), longitude: parseFloat(destinationLng) }
      };

      const filteredRides = [];
      for (const ride of rides) {
        const compatible = await isRouteCompatible(
          {
            pickup: ride.pickup,
            destination: ride.destination,
            routeGeometry: ride.routeGeometry
          },
          passengerRoute,
          thresholdKm
        );
        if (compatible) {
          filteredRides.push(ride);
        }
      }
      rides = filteredRides;
    }

    const formattedRides = rides.map(ride => {
      const passengerCount = ride.passengers ? ride.passengers.length : 0;
      const maxCapacity = ride.maxPassengers || 4;
      const availableSeats = Math.max(0, maxCapacity - passengerCount);

      let fareBreakdown = null;
      if (hasPassengerCoords) {
        const candidatePassenger = {
          user: 'candidate',
          pickup: { latitude: parseFloat(pickupLat), longitude: parseFloat(pickupLng) },
          destination: { latitude: parseFloat(destinationLat), longitude: parseFloat(destinationLng) }
        };
        const allPassengers = [...(ride.passengers || []), candidatePassenger];
        const fareResult = calculatePoolFares(
          {
            pickup: ride.pickup,
            destination: ride.destination,
            distanceKm: ride.distanceKm,
            routeGeometry: ride.routeGeometry
          },
          allPassengers
        );
        if (fareResult && fareResult.passengerFares && fareResult.passengerFares.length > 0) {
          fareBreakdown = fareResult.passengerFares.find(pf => pf.userId === 'candidate') || null;
        }
      }

      return {
        id: ride._id,
        driver: ride.driver
          ? {
              id: ride.driver._id,
              name: ride.driver.name,
              email: ride.driver.email
            }
          : null,
        pickup: ride.pickup,
        destination: ride.destination,
        distanceKm: ride.distanceKm,
        durationMinutes: ride.durationMinutes,
        currentPassengerCount: passengerCount,
        maxPassengerCapacity: maxCapacity,
        availableSeats,
        status: ride.status,
        createdAt: ride.createdAt,
        fareBreakdown,
        segments: ride.segmentsBreakdown || [],
        driverIncentive: ride.driverIncentive || 0,
        driverEarnings: ride.driverEarnings || 0,
        passengers: ride.passengers
          ? ride.passengers.map(p => ({
              user: p.user
                ? {
                    id: p.user._id || p.user.id || p.user,
                    name: p.user.name || 'Passenger',
                    email: p.user.email || ''
                  }
                : null,
              pickup: p.pickup,
              destination: p.destination,
              fare: p.fare,
              fareBreakdown: p.fareBreakdown,
              detourKm: p.detourKm || 0,
              detourCost: p.detourCost || 0,
              joinedAt: p.joinedAt
            }))
          : []
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedRides.length,
      rides: formattedRides
    });
  } catch (error) {
    console.error('getActivePoolRides error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching active pool rides'
    });
  }
};

/**
 * POST /api/rides/pool/:rideId/join
 * Authenticated — joins an active pool ride as a passenger.
 *
 * Flow:
 * 1. Authenticate user.
 * 2. Find active pool ride.
 * 3. Validate passenger is not already in ride.
 * 4. Validate available seats.
 * 5. Validate route compatibility.
 * 6. Add passenger to calculation set.
 * 7. Recalculate COMPLETE pool fare for ALL passengers in the pool.
 * 8. Update ALL passenger fares & breakdowns in DB.
 * 9. Update driver incentive & total earnings in DB.
 * 10. Save Ride.
 * 11. Return updated ride + fare breakdown for all passengers.
 */
const joinPoolRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.userId || req.user.id || req.user._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User identity could not be determined from token'
      });
    }

    // 1. Verify ride exists
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Pool ride not found'
      });
    }

    // 2. Verify rideType = "pool"
    if (ride.rideType !== 'pool') {
      return res.status(400).json({
        success: false,
        message: 'This ride is not a pool ride'
      });
    }

    // 3. Verify status = "active"
    if (ride.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'This pool ride is no longer active'
      });
    }

    // 4. Check capacity
    const currentPassengerCount = ride.passengers ? ride.passengers.length : 0;
    const maxCapacity = ride.maxPassengers || 4;
    if (currentPassengerCount >= maxCapacity) {
      return res.status(400).json({
        success: false,
        message: 'Pool ride is full'
      });
    }

    // 5. Prevent double joining
    const alreadyJoined = ride.passengers && ride.passengers.some(
      p => p.user && p.user.toString() === userId.toString()
    );
    if (alreadyJoined) {
      return res.status(400).json({
        success: false,
        message: 'You have already joined this pool ride'
      });
    }

    // 6. Extract passenger pickup/destination from body or fallback to ride's locations
    const { pickup, destination } = req.body || {};
    const passengerPickup = (pickup && pickup.address && pickup.latitude !== undefined && pickup.longitude !== undefined)
      ? { address: pickup.address, latitude: pickup.latitude, longitude: pickup.longitude }
      : ride.pickup;

    const passengerDestination = (destination && destination.address && destination.latitude !== undefined && destination.longitude !== undefined)
      ? { address: destination.address, latitude: destination.latitude, longitude: destination.longitude }
      : ride.destination;

    // 7. Validate route compatibility
    const driverRouteInfo = {
      pickup: ride.pickup,
      destination: ride.destination,
      routeGeometry: ride.routeGeometry
    };
    const passengerRouteInfo = {
      pickup: passengerPickup,
      destination: passengerDestination
    };

    const compatible = await isRouteCompatible(driverRouteInfo, passengerRouteInfo, DEFAULT_PROXIMITY_THRESHOLD_KM);
    if (!compatible) {
      return res.status(400).json({
        success: false,
        message: 'Your pickup or destination is not compatible with this pool ride route'
      });
    }

    // 8. Prepare calculation set including existing passengers + new passenger
    const existingPassengersList = (ride.passengers || []).map(p => ({
      user: p.user,
      pickup: p.pickup,
      destination: p.destination,
      joinedAt: p.joinedAt,
      detourKm: p.detourKm || 0,
      detourCost: p.detourCost || 0
    }));

    const newPassengerObj = {
      user: userId,
      pickup: passengerPickup,
      destination: passengerDestination,
      joinedAt: new Date()
    };

    const calculationPassengers = [...existingPassengersList, newPassengerObj];

    // 9. Recalculate COMPLETE pool fare across ALL passengers
    const fareResult = calculatePoolFares(
      {
        pickup: ride.pickup,
        destination: ride.destination,
        distanceKm: ride.distanceKm,
        fare: ride.fare,
        routeGeometry: ride.routeGeometry
      },
      calculationPassengers
    );

    if (!fareResult || !fareResult.passengerFares || fareResult.passengerFares.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to calculate dynamic pool fare'
      });
    }

    // 10. Update ALL passengers in ride.passengers with updated fare & fareBreakdown
    const updatedPassengersArray = calculationPassengers.map((p) => {
      const pUserId = p.user ? (p.user._id ? p.user._id.toString() : p.user.toString()) : '';
      const breakdown = fareResult.passengerFares.find(
        pf => pf.userId.toString() === pUserId.toString()
      ) || fareResult.passengerFares[fareResult.passengerFares.length - 1];

      return {
        user: p.user,
        pickup: p.pickup,
        destination: p.destination,
        joinedAt: p.joinedAt || new Date(),
        fare: breakdown.finalFare,
        fareBreakdown: breakdown,
        detourKm: breakdown.extraDistanceKm || 0,
        detourCost: breakdown.extraDetourCost || 0
      };
    });

    ride.passengers = updatedPassengersArray;

    // 11. Update driver incentive and earnings
    ride.driverIncentive = fareResult.totalDriverIncentive;
    ride.driverEarnings = fareResult.driverTotalEarnings;
    ride.segmentsBreakdown = fareResult.segments;

    await ride.save();

    await ride.populate('driver', 'name email');
    await ride.populate('passengers.user', 'name email');

    const updatedPassengerCount = ride.passengers.length;
    const updatedAvailableSeats = Math.max(0, maxCapacity - updatedPassengerCount);

    const joiningPassengerFare = ride.passengers.find(
      p => p.user && p.user._id.toString() === userId.toString()
    );

    return res.status(200).json({
      success: true,
      message: 'Successfully joined pool ride. Fares recalculated for all passengers.',
      ride: {
        id: ride._id,
        driver: ride.driver
          ? { id: ride.driver._id, name: ride.driver.name, email: ride.driver.email }
          : null,
        pickup: ride.pickup,
        destination: ride.destination,
        distanceKm: ride.distanceKm,
        durationMinutes: ride.durationMinutes,
        currentPassengerCount: updatedPassengerCount,
        maxPassengerCapacity: maxCapacity,
        availableSeats: updatedAvailableSeats,
        driverIncentive: ride.driverIncentive,
        driverEarnings: ride.driverEarnings,
        status: ride.status,
        createdAt: ride.createdAt,
        segments: fareResult.segments,
        passengers: ride.passengers.map(p => ({
          user: p.user ? { id: p.user._id, name: p.user.name, email: p.user.email } : null,
          pickup: p.pickup,
          destination: p.destination,
          fare: p.fare,
          fareBreakdown: p.fareBreakdown
        }))
      },
      passengerFare: joiningPassengerFare ? joiningPassengerFare.fareBreakdown : null,
      fareSummary: fareResult
    });
  } catch (error) {
    console.error('joinPoolRide error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error joining pool ride'
    });
  }
};

/**
 * POST /api/rides/pool/start
 * Authenticated — starts a new active Pool Ride in MongoDB.
 */
const startPoolRide = async (req, res) => {
  try {
    const { pickup, destination, distanceKm, durationMinutes, routeGeometry } = req.body;

    // ── Validate required location and route fields ─────────────────────────
    if (!pickup || !destination) {
      return res.status(400).json({
        success: false,
        message: 'pickup and destination are required'
      });
    }

    if (
      !pickup.address ||
      pickup.latitude === undefined ||
      pickup.latitude === null ||
      pickup.longitude === undefined ||
      pickup.longitude === null
    ) {
      return res.status(400).json({
        success: false,
        message: 'pickup must include address, latitude, and longitude'
      });
    }

    if (
      !destination.address ||
      destination.latitude === undefined ||
      destination.latitude === null ||
      destination.longitude === undefined ||
      destination.longitude === null
    ) {
      return res.status(400).json({
        success: false,
        message: 'destination must include address, latitude, and longitude'
      });
    }

    if (distanceKm === undefined || distanceKm === null || isNaN(distanceKm) || distanceKm < 0) {
      return res.status(400).json({
        success: false,
        message: 'distanceKm must be a non-negative number'
      });
    }

    if (durationMinutes === undefined || durationMinutes === null || isNaN(durationMinutes) || durationMinutes < 0) {
      return res.status(400).json({
        success: false,
        message: 'durationMinutes must be a non-negative number'
      });
    }

    // ── Resolve driver / user ID strictly from JWT ──────────────────────────
    const driverId = req.user.userId || req.user.id || req.user._id;
    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: 'User identity could not be determined from token'
      });
    }

    // ── Create new active Pool Ride ─────────────────────────────────────────
    const ride = await Ride.create({
      driver: driverId,
      pickup: {
        address: pickup.address,
        latitude: pickup.latitude,
        longitude: pickup.longitude
      },
      destination: {
        address: destination.address,
        latitude: destination.latitude,
        longitude: destination.longitude
      },
      distanceKm,
      durationMinutes,
      routeGeometry: routeGeometry || undefined,
      rideType: 'pool',
      status: 'active',
      passengers: [],
      maxPassengers: 5
    });

    return res.status(201).json({
      success: true,
      message: 'Pool ride started successfully',
      ride: {
        id: ride._id,
        driver: ride.driver,
        pickup: ride.pickup,
        destination: ride.destination,
        distanceKm: ride.distanceKm,
        durationMinutes: ride.durationMinutes,
        rideType: ride.rideType,
        status: ride.status,
        currentPassengerCount: 0,
        maxPassengerCapacity: ride.maxPassengers,
        availableSeats: ride.maxPassengers,
        passengers: ride.passengers,
        createdAt: ride.createdAt
      }
    });
  } catch (error) {
    console.error('startPoolRide error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error starting pool ride'
    });
  }
};

module.exports = {
  bookPersonalRide,
  getActivePoolRides,
  joinPoolRide,
  startPoolRide,
  isRouteCompatible,
  segmentPoolRoute,
  calculatePoolFares
};
