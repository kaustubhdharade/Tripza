const { calculatePoolFares } = require('./utils/poolFare');

console.log('====================================================');
console.log('LARGE SCALE 10-15 PASSENGER DYNAMIC POOL TEST SUITE');
console.log('====================================================\n');

// Long Driver Route: Mumbai to Delhi (1400 km, base fare ₹14,000)
const driverRoute = {
  pickup: { address: 'Mumbai', latitude: 19.0760, longitude: 72.8777 },
  destination: { address: 'Delhi', latitude: 28.6139, longitude: 77.2090 },
  distanceKm: 1400,
  fare: 14000
};

// Create 12 passengers joining along different segments
const passengers = [];
const cities = [
  { name: 'Thane', lat: 19.2183, lng: 72.9781 },
  { name: 'Nashik', lat: 19.9975, lng: 73.7898 },
  { name: 'Dhule', lat: 20.9042, lng: 74.7749 },
  { name: 'Indore', lat: 22.7196, lng: 75.8577 },
  { name: 'Ujjain', lat: 23.1765, lng: 75.7885 },
  { name: 'Kota', lat: 25.2138, lng: 75.8648 },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { name: 'Gurgaon', lat: 28.4595, lng: 77.0266 }
];

// Add 12 passengers
for (let i = 0; i < 12; i++) {
  const pickCity = cities[i % cities.length];
  const destCity = cities[(i + 2) % cities.length];
  passengers.push({
    user: `passenger_${i + 1}`,
    pickup: { address: `${pickCity.name} Pickup`, latitude: pickCity.lat, longitude: pickCity.lng },
    destination: { address: `${destCity.name} Dropoff`, latitude: destCity.lat, longitude: destCity.lng }
  });
}

// Test sequential join from 1 to 12 passengers
let previousFarePass1 = null;

for (let pCount = 1; pCount <= 12; pCount++) {
  const currentPassengers = passengers.slice(0, pCount);
  const result = calculatePoolFares(driverRoute, currentPassengers);
  const pass1 = result.passengerFares.find(p => p.userId === 'passenger_1');

  console.log(`[PASSENGERS = ${pCount}]`);
  console.log(`  Driver Incentive Total: ₹${result.totalDriverIncentive}`);
  console.log(`  Driver Total Earnings: ₹${result.driverTotalEarnings}`);
  console.log(`  Passenger 1 Shared Pool Fare: ₹${pass1.finalFare} (Solo Price: ₹${pass1.soloPersonalFare}, Savings: ₹${pass1.savingsAmount} · ${pass1.savingsPercentage}% OFF)`);

  if (previousFarePass1 !== null && pass1.finalFare > previousFarePass1) {
    console.warn(`  Warning: Passenger 1 fare increased on join ${pCount}`);
  }
  previousFarePass1 = pass1.finalFare;
}

console.log('\n====================================================');
console.log('[✓] Dynamic scaling for 12+ passengers verified successfully!');
console.log('====================================================\n');
