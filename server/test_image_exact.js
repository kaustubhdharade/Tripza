const { calculatePoolFares } = require('./utils/poolFare');

// Driver Route: 25 km, Fare: ₹500
const driverRoute = {
  pickup: { address: 'Start (0 km)', latitude: 19.0000, longitude: 72.8000 },
  destination: { address: 'End (25 km)', latitude: 19.2250, longitude: 72.8000 },
  distanceKm: 25,
  fare: 500
};

// 5 Passengers along the route
const passengerA = {
  user: 'Passenger_A',
  pickup: { address: 'A Pickup (0 km)', latitude: 19.0000, longitude: 72.8000 },
  destination: { address: 'End (25 km)', latitude: 19.2250, longitude: 72.8000 },
  extraDetourCost: 0
};

const passengerB = {
  user: 'Passenger_B',
  pickup: { address: 'B Pickup (5 km)', latitude: 19.0450, longitude: 72.8000 },
  destination: { address: 'End (25 km)', latitude: 19.2250, longitude: 72.8000 },
  extraDetourCost: 30
};

const passengerC = {
  user: 'Passenger_C',
  pickup: { address: 'C Pickup (10 km)', latitude: 19.0900, longitude: 72.8000 },
  destination: { address: 'End (25 km)', latitude: 19.2250, longitude: 72.8000 },
  extraDetourCost: 40
};

const passengerD = {
  user: 'Passenger_D',
  pickup: { address: 'D Pickup (15 km)', latitude: 19.1350, longitude: 72.8000 },
  destination: { address: 'End (25 km)', latitude: 19.2250, longitude: 72.8000 },
  extraDetourCost: 35
};

const passengerE = {
  user: 'Passenger_E',
  pickup: { address: 'E Pickup (20 km)', latitude: 19.1800, longitude: 72.8000 },
  destination: { address: 'End (25 km)', latitude: 19.2250, longitude: 72.8000 },
  extraDetourCost: 50
};

const result = calculatePoolFares(driverRoute, [passengerA, passengerB, passengerC, passengerD, passengerE]);

console.log('====================================================');
console.log('EXACT IMAGE VERIFICATION TEST');
console.log('====================================================\n');

console.log('--- SEGMENT BREAKDOWN (STEP 1 & STEP 2) ---');
result.segments.forEach(s => {
  console.log(`Segment ${s.segmentIndex + 1} (${s.startPositionKm} km - ${s.endPositionKm} km): Dist=${s.segmentDistanceKm} km, SegFare=₹${s.segmentBaseFare}, ActivePass=${s.passengerCount}, BaseShare=₹${s.baseSharePerPassenger}, DriverIncPerPass=₹${s.incentivePerPassenger}, SegDriverInc=₹${s.segmentDriverIncentive}`);
});

console.log('\n--- PASSENGER FARE BREAKDOWN (STEP 3) ---');
result.passengerFares.forEach(p => {
  console.log(`Passenger ${p.userId.replace('Passenger_', '')}: BaseShare=₹${p.baseShare}, DriverInc=₹${p.driverIncentive}, Detour=₹${p.extraDetourCost}, Subtotal=₹${p.subtotal}, GST(5%)=₹${p.gst}, TOTAL FARE=₹${p.finalFare}`);
});

console.log('\n--- DRIVER EARNING SUMMARY ---');
console.log(`Original Full Route Fare: ₹${result.driverBaseFare}`);
console.log(`Driver Incentive (Total): ₹${result.totalDriverIncentive}`);
console.log(`Extra Detour Compensation: ₹${result.totalDetourCompensation}`);
console.log(`TOTAL DRIVER EARNING: ₹${result.driverTotalEarnings}`);
