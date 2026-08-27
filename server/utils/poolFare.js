/**
 * Projects a point P (lat, lng) onto line segment A-B and returns parameter t in [0, 1].
 */
function getProjectionParameter(pLat, pLng, aLat, aLng, bLat, bLng) {
  const dLat = bLat - aLat;
  const dLng = bLng - aLng;
  const lenSq = dLat * dLat + dLng * dLng;

  if (lenSq === 0) return 0;

  const t = ((pLat - aLat) * dLat + (pLng - aLng) * dLng) / lenSq;
  return Math.max(0, Math.min(1, t));
}

/**
 * Divides a pool ride route into ordered route segments based on driver route and passenger pickup/drop-off points.
 * Reusable backend function for pool route segmentation and multi-passenger fare distribution.
 *
 * @param {Object} driverRoute - Driver route object { pickup, destination, distanceKm }
 * @param {Array} [passengers=[]] - Array of passenger objects [{ user, pickup, destination }]
 * @param {number} [totalBaseFare=0] - Total base fare allocated for the driver's route
 * @returns {Object} Object containing totalDistanceKm, totalBaseFare, and ordered segments array
 */
function segmentPoolRoute(driverRoute, passengers = [], totalBaseFare = 0) {
  if (!driverRoute || !driverRoute.pickup || !driverRoute.destination) {
    return { totalDistanceKm: 0, totalBaseFare: 0, segments: [] };
  }

  const dPick = driverRoute.pickup;
  const dDest = driverRoute.destination;
  const totalDistanceKm = Number(driverRoute.distanceKm) || 0;

  // 1. Collect all route boundary points
  const rawBoundaries = [
    { t: 0, point: dPick, type: 'driver_start' },
    { t: 1, point: dDest, type: 'driver_end' }
  ];

  // Store passenger trip intervals { userId, tStart, tEnd }
  const passengerIntervals = [];

  passengers.forEach((passenger, idx) => {
    const userId = passenger.user ? (passenger.user._id || passenger.user.toString()) : `passenger_${idx}`;

    if (passenger.pickup && passenger.pickup.latitude !== undefined && passenger.pickup.longitude !== undefined) {
      const tStart = getProjectionParameter(
        passenger.pickup.latitude,
        passenger.pickup.longitude,
        dPick.latitude,
        dPick.longitude,
        dDest.latitude,
        dDest.longitude
      );
      rawBoundaries.push({ t: tStart, point: passenger.pickup, type: 'passenger_pickup', userId });

      let tEnd = 1;
      if (passenger.destination && passenger.destination.latitude !== undefined && passenger.destination.longitude !== undefined) {
        tEnd = getProjectionParameter(
          passenger.destination.latitude,
          passenger.destination.longitude,
          dPick.latitude,
          dPick.longitude,
          dDest.latitude,
          dDest.longitude
        );
        rawBoundaries.push({ t: tEnd, point: passenger.destination, type: 'passenger_dropoff', userId });
      }

      passengerIntervals.push({
        userId,
        tStart: Math.min(tStart, tEnd),
        tEnd: Math.max(tStart, tEnd)
      });
    }
  });

  // 2. Sort boundaries by t ascending
  rawBoundaries.sort((a, b) => a.t - b.t);

  // 3. Deduplicate boundary points that are virtually identical (t difference < 1e-4)
  const uniqueBoundaries = [];
  rawBoundaries.forEach((b) => {
    if (uniqueBoundaries.length === 0) {
      uniqueBoundaries.push(b);
    } else {
      const last = uniqueBoundaries[uniqueBoundaries.length - 1];
      if (Math.abs(b.t - last.t) > 1e-4) {
        uniqueBoundaries.push(b);
      }
    }
  });

  // 4. Construct route segments
  const segments = [];

  for (let i = 0; i < uniqueBoundaries.length - 1; i++) {
    const startBoundary = uniqueBoundaries[i];
    const endBoundary = uniqueBoundaries[i + 1];

    const segmentDistanceKm = Math.round((endBoundary.t - startBoundary.t) * totalDistanceKm * 100) / 100;
    const segmentBaseFare = totalDistanceKm > 0
      ? Math.round(((segmentDistanceKm / totalDistanceKm) * totalBaseFare) * 100) / 100
      : 0;

    // Find active passengers on this segment (passengers whose trip overlaps [startBoundary.t, endBoundary.t])
    const midT = (startBoundary.t + endBoundary.t) / 2;
    const activePassengers = passengerIntervals
      .filter((p) => midT >= p.tStart && midT <= p.tEnd)
      .map((p) => p.userId);

    segments.push({
      segmentIndex: i,
      startPoint: startBoundary.point,
      endPoint: endBoundary.point,
      startT: Math.round(startBoundary.t * 1000) / 1000,
      endT: Math.round(endBoundary.t * 1000) / 1000,
      segmentDistanceKm,
      segmentBaseFare,
      activePassengers
    });
  }

  return {
    totalDistanceKm,
    totalBaseFare,
    segments
  };
}

const POOL_BASE_FARE = 50;         // ₹ flat base fare per passenger
const POOL_PER_KM_RATE = 12;       // ₹ per km distance rate
const DRIVER_INCENTIVE_RATE = 0.20; // 20% driver incentive rate

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
 * Segment-based Pool Ride fare and 20% driver incentive calculation engine for Tripza.
 *
 * Divides driver route into ordered segments based on passenger pickup and drop-off points.
 * Calculates segment distance fare at ₹12/km, splits each segment's distance fare equally among
 * active passengers sharing that segment, adds ₹50 flat base fare ONCE per passenger, and calculates
 * the 20% driver incentive per segment distributed equally among active passengers.
 *
 * @param {Object} driverRoute - Driver route { pickup, destination, distanceKm, routeGeometry }
 * @param {Array} passengers - Array of passenger objects [{ user, pickup, destination }]
 * @returns {Object} Detailed breakdown containing overall segments, driver total incentive, and per-passenger breakdown
 */
/**
 * Segment-based Dynamic Pool Fare Engine for Tripza.
 *
 * Recalculates all active passenger fares whenever a passenger joins a pool ride.
 * Segments driver ORS polyline, divides segment base fare equally among active passengers,
 * calculates driver incentive per active passenger, applies extra detour cost if applicable,
 * and adds 5% GST on subtotal.
 *
 * @param {Object} driverRoute - Driver route { pickup, destination, distanceKm, fare, routeGeometry }
 * @param {Array} passengers - Array of passenger objects [{ user, pickup, destination, extraDetourCost, extraDistanceKm }]
 * @returns {Object} Detailed pool breakdown containing segments, driver earnings, and updated passenger fares
 */
function calculatePoolFares(driverRoute, passengers = []) {
  if (!driverRoute || !driverRoute.pickup || !driverRoute.destination) {
    return {
      totalRouteDistanceKm: 0,
      driverBaseFare: 0,
      totalDriverIncentive: 0,
      totalDetourCompensation: 0,
      driverTotalEarnings: 0,
      segments: [],
      passengerFares: []
    };
  }

  const dPick = driverRoute.pickup;
  const dDest = driverRoute.destination;

  // 1. Resolve polyline points
  let polylinePoints = [];
  if (driverRoute.routeGeometry) {
    polylinePoints = decodePolyline(driverRoute.routeGeometry);
  } else if (driverRoute.routePoints && Array.isArray(driverRoute.routePoints)) {
    polylinePoints = driverRoute.routePoints;
  }

  if (!polylinePoints || polylinePoints.length < 2) {
    polylinePoints = [dPick, dDest];
  }

  // Calculate total route distance from polyline points or driverRoute.distanceKm
  let totalPolylineKm = 0;
  for (let i = 0; i < polylinePoints.length - 1; i++) {
    totalPolylineKm += getHaversineDistanceKm(
      polylinePoints[i].latitude, polylinePoints[i].longitude,
      polylinePoints[i + 1].latitude, polylinePoints[i + 1].longitude
    );
  }
  if (totalPolylineKm === 0) {
    totalPolylineKm = Number(driverRoute.distanceKm) || 0;
  }

  // Determine total driver route base fare
  const driverBaseFare = (driverRoute.fare && Number(driverRoute.fare) > 0)
    ? Number(driverRoute.fare)
    : Math.round(totalPolylineKm * POOL_PER_KM_RATE * 100) / 100;

  // 2. Map driver & passenger endpoints to route positions (cumulative km from start)
  const rawBoundaries = [
    { positionKm: 0, point: dPick, type: 'driver_start' },
    { positionKm: totalPolylineKm, point: dDest, type: 'driver_end' }
  ];

  const passengerIntervals = [];

  passengers.forEach((passenger, idx) => {
    const userId = passenger.user
      ? (passenger.user._id || passenger.user.id || passenger.user.toString())
      : `passenger_${idx + 1}`;

    const pickPosRes = findNearestPolylinePosition(passenger.pickup, polylinePoints);
    const destPosRes = findNearestPolylinePosition(passenger.destination, polylinePoints);

    const posPickKm = pickPosRes.positionKm;
    const posDestKm = destPosRes.positionKm;

    rawBoundaries.push({ positionKm: posPickKm, point: passenger.pickup, type: 'passenger_pickup', userId });
    rawBoundaries.push({ positionKm: posDestKm, point: passenger.destination, type: 'passenger_dropoff', userId });

    // Explicit or calculated detour (distance off-route)
    let extraDistanceKm = 0;
    let extraDetourCost = 0;

    if (passenger.extraDetourCost !== undefined && passenger.extraDetourCost !== null) {
      extraDetourCost = Number(passenger.extraDetourCost) || 0;
      extraDistanceKm = Number(passenger.extraDistanceKm) || 0;
    } else if (passenger.detourCost !== undefined && passenger.detourCost !== null) {
      extraDetourCost = Number(passenger.detourCost) || 0;
      extraDistanceKm = Number(passenger.detourKm) || 0;
    } else if (pickPosRes.minDistanceKm > 0.1) {
      extraDistanceKm = Math.round(pickPosRes.minDistanceKm * 100) / 100;
      extraDetourCost = Math.round(extraDistanceKm * POOL_PER_KM_RATE * 100) / 100;
    }

    passengerIntervals.push({
      userId,
      passenger,
      posPickKm: Math.min(posPickKm, posDestKm),
      posDestKm: Math.max(posPickKm, posDestKm),
      extraDistanceKm,
      extraDetourCost
    });
  });

  // 3. Sort & deduplicate boundary positions along route
  rawBoundaries.sort((a, b) => a.positionKm - b.positionKm);

  const uniqueBoundaries = [];
  rawBoundaries.forEach((b) => {
    if (uniqueBoundaries.length === 0) {
      uniqueBoundaries.push(b);
    } else {
      const last = uniqueBoundaries[uniqueBoundaries.length - 1];
      if (Math.abs(b.positionKm - last.positionKm) > 0.001) {
        uniqueBoundaries.push(b);
      }
    }
  });

  // 4. Construct route segments, split base fare & driver incentive
  const segments = [];
  let totalDriverIncentive = 0;

  for (let i = 0; i < uniqueBoundaries.length - 1; i++) {
    const b1 = uniqueBoundaries[i];
    const b2 = uniqueBoundaries[i + 1];

    const segmentDistanceKm = Math.round((b2.positionKm - b1.positionKm) * 100) / 100;
    const segmentBaseFare = totalPolylineKm > 0
      ? Math.round(((segmentDistanceKm / totalPolylineKm) * driverBaseFare) * 100) / 100
      : 0;

    const midPosKm = (b1.positionKm + b2.positionKm) / 2;
    const activePassengers = passengerIntervals
      .filter(p => midPosKm >= p.posPickKm && midPosKm <= p.posDestKm)
      .map(p => p.userId);

    const passengerCount = activePassengers.length;
    const baseSharePerPassenger = passengerCount > 0
      ? Math.round((segmentBaseFare / passengerCount) * 100) / 100
      : 0;

    // Driver Incentive calculation per active passenger per segment
    // Business Rule (User Specified Formula):
    // Driver incentive applies ONLY when multiple passengers share a segment (activePassengers > 1).
    // Formula for activePassengers > 1:
    //   remainingAmount = segmentBaseFare - baseSharePerPassenger
    //   remainingPerPassenger = remainingAmount / activePassengers
    //   incentivePerPassenger = remainingPerPassenger * 20%
    //   segmentDriverIncentive = incentivePerPassenger * activePassengers
    // For activePassengers <= 1:
    //   incentivePerPassenger = 0
    let incentivePerPassenger = 0;
    let segmentDriverIncentive = 0;

    if (passengerCount > 1) {
      const remainingAmount = Math.max(0, segmentBaseFare - baseSharePerPassenger);
      const remainingPerPassenger = remainingAmount / passengerCount;
      incentivePerPassenger = Math.round((remainingPerPassenger * DRIVER_INCENTIVE_RATE) * 100) / 100;
      segmentDriverIncentive = Math.round((incentivePerPassenger * passengerCount) * 100) / 100;
    }

    totalDriverIncentive += segmentDriverIncentive;

    segments.push({
      segmentIndex: i,
      startPoint: b1.point,
      endPoint: b2.point,
      startPositionKm: Math.round(b1.positionKm * 100) / 100,
      endPositionKm: Math.round(b2.positionKm * 100) / 100,
      segmentDistanceKm,
      segmentBaseFare,
      passengerCount,
      activePassengers,
      baseSharePerPassenger,
      incentivePerPassenger,
      segmentDriverIncentive,
      // Backward compatibility alias
      passengerShare: baseSharePerPassenger
    });
  }

  // 5. Calculate per-passenger fare breakdown
  let totalDetourCompensation = 0;

  const passengerFares = passengerIntervals.map(p => {
    const usedSegments = segments.filter(s => s.activePassengers.includes(p.userId));

    let baseShare = 0;
    let driverIncentive = 0;

    const segmentsUsed = usedSegments.map(s => {
      baseShare += s.baseSharePerPassenger;
      driverIncentive += s.incentivePerPassenger;

      return {
        segmentIndex: s.segmentIndex,
        startPoint: s.startPoint,
        endPoint: s.endPoint,
        segmentDistanceKm: s.segmentDistanceKm,
        segmentBaseFare: s.segmentBaseFare,
        passengersCount: s.passengerCount,
        baseSharePerPassenger: s.baseSharePerPassenger,
        incentivePerPassenger: s.incentivePerPassenger,
        segmentDriverIncentive: s.segmentDriverIncentive,
        passengerShare: s.baseSharePerPassenger
      };
    });

    baseShare = Math.round(baseShare * 100) / 100;
    driverIncentive = Math.round(driverIncentive * 100) / 100;
    const extraDetourCost = Math.round(p.extraDetourCost * 100) / 100;
    totalDetourCompensation += extraDetourCost;

    const subtotal = Math.round((baseShare + driverIncentive + extraDetourCost) * 100) / 100;
    const gst = Math.round((subtotal * 0.05) * 100) / 100;
    const finalFare = Math.round((subtotal + gst) * 100) / 100;

    const tripDistanceKm = Math.round((p.posDestKm - p.posPickKm) * 100) / 100;

    // Solo trip fare (if traveling alone on personal ride)
    const soloBaseFare = Math.round((tripDistanceKm * POOL_PER_KM_RATE + POOL_BASE_FARE) * 100) / 100;
    const soloGst = Math.round(soloBaseFare * 0.05 * 100) / 100;
    const soloPersonalFare = Math.round((soloBaseFare + soloGst) * 100) / 100;

    const savingsAmount = Math.max(0, Math.round((soloPersonalFare - finalFare) * 100) / 100);
    const savingsPercentage = soloPersonalFare > 0 ? Math.round((savingsAmount / soloPersonalFare) * 100) : 0;

    return {
      userId: p.userId,
      passengerRoute: {
        pickup: p.passenger.pickup,
        destination: p.passenger.destination
      },
      distanceKm: tripDistanceKm,
      pickupPositionKm: Math.round(p.posPickKm * 100) / 100,
      destinationPositionKm: Math.round(p.posDestKm * 100) / 100,
      baseShare,
      driverIncentive,
      extraDistanceKm: Math.round(p.extraDistanceKm * 100) / 100,
      extraDetourCost,
      subtotal,
      gst,
      finalFare,
      soloPersonalFare,
      savingsAmount,
      savingsPercentage,
      segmentsUsed,
      // Backward compatibility aliases
      baseFare: POOL_BASE_FARE,
      segmentShareTotal: baseShare,
      basePoolFare: baseShare,
      driverIncentiveContribution: driverIncentive,
      totalPayableFare: finalFare
    };
  });

  totalDriverIncentive = Math.round(totalDriverIncentive * 100) / 100;
  totalDetourCompensation = Math.round(totalDetourCompensation * 100) / 100;
  const driverTotalEarnings = Math.round((driverBaseFare + totalDriverIncentive + totalDetourCompensation) * 100) / 100;

  return {
    totalRouteDistanceKm: Math.round(totalPolylineKm * 100) / 100,
    perKmRate: POOL_PER_KM_RATE,
    driverBaseFare,
    driverIncentiveRate: DRIVER_INCENTIVE_RATE,
    totalDriverIncentive,
    totalDetourCompensation,
    driverTotalEarnings,
    segments,
    passengerFares
  };
}

module.exports = {
  segmentPoolRoute,
  calculatePoolFares,
  getProjectionParameter
};
