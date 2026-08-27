import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Register from './Register';
import Login from './Login';


// ── Fare Configuration ────────────────────────────────────────────────────────
const PERSONAL_BASE_FARE    = 50;   // ₹ flat base fare
const PERSONAL_PER_KM_RATE  = 12;   // ₹ per km
const PERSONAL_PER_MIN_RATE = 1;    // ₹ per minute

/**
 * Calculates the estimated Personal ride fare.
 * @param {number} distanceKm - Road distance in kilometres.
 * @param {number} durationMinutes - Estimated travel time in minutes.
 * @returns {number} Total fare rounded to the nearest rupee.
 */
function calculatePersonalFare(distanceKm, durationMinutes) {
  const fare =
    PERSONAL_BASE_FARE +
    distanceKm * PERSONAL_PER_KM_RATE +
    durationMinutes * PERSONAL_PER_MIN_RATE;
  return Math.round(fare);
}
// ─────────────────────────────────────────────────────────────────────────────

function App() {
  const [view, setView] = useState('register');

  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [rideType, setRideType] = useState('Personal');

  const [pickupLat, setPickupLat] = useState(null);
  const [pickupLng, setPickupLng] = useState(null);
  const [destinationLat, setDestinationLat] = useState(null);
  const [destinationLng, setDestinationLng] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [distanceKm, setDistanceKm] = useState(null);
  const [durationMinutes, setDurationMinutes] = useState(null);
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [showResult, setShowResult] = useState(false);

  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');

  const [poolRides, setPoolRides] = useState([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolError, setPoolError] = useState('');

  const [joinedPoolRide, setJoinedPoolRide] = useState(null);
  const [joiningRideId, setJoiningRideId] = useState(null);

  const [startedPoolRide, setStartedPoolRide] = useState(null);
  const [startPoolLoading, setStartPoolLoading] = useState(false);

  const fetchPoolRides = async () => {
    setPoolLoading(true);
    setPoolError('');
    try {
      const backendUrl = import.meta.env.VITE_Backend_API || '';
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      let endpoint = `${backendUrl}/api/rides/pool/active`;
      if (
        pickupLat !== null &&
        pickupLng !== null &&
        destinationLat !== null &&
        destinationLng !== null
      ) {
        endpoint += `?pickupLat=${pickupLat}&pickupLng=${pickupLng}&destinationLat=${destinationLat}&destinationLng=${destinationLng}`;
      }

      const response = await axios.get(endpoint, { headers });
      if (response.data.success) {
        setPoolRides(response.data.rides || []);
      } else {
        throw new Error(response.data.message || 'Failed to load active pool rides');
      }
    } catch (err) {
      console.error('Fetch pool rides error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Error fetching active pool rides';
      setPoolError(errMsg);
    } finally {
      setPoolLoading(false);
    }
  };

  const handleJoinPoolRide = async (rideId) => {
    setBookingError('');
    setJoiningRideId(rideId);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setBookingError('Please log in to join a pool ride.');
        setJoiningRideId(null);
        return;
      }

      const backendUrl = import.meta.env.VITE_Backend_API || '';
      const response = await axios.post(
        `${backendUrl}/api/rides/pool/${rideId}/join`,
        {
          pickup: {
            address: pickup,
            latitude: pickupLat,
            longitude: pickupLng
          },
          destination: {
            address: destination,
            latitude: destinationLat,
            longitude: destinationLng
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setJoinedPoolRide({
          ...response.data.ride,
          passengerFare: response.data.passengerFare,
          fareSummary: response.data.fareSummary
        });
        fetchPoolRides();
      } else {
        throw new Error(response.data.message || 'Failed to join pool ride');
      }
    } catch (err) {
      console.error('Join pool ride error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Error joining pool ride';
      setBookingError(errMsg);
    } finally {
      setJoiningRideId(null);
    }
  };

  const handleStartPoolRide = async () => {
    setBookingError('');
    setStartPoolLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setBookingError('Please log in to start a pool ride.');
        setStartPoolLoading(false);
        return;
      }

      const backendUrl = import.meta.env.VITE_Backend_API || '';
      const response = await axios.post(
        `${backendUrl}/api/rides/pool/start`,
        {
          pickup: {
            address: pickup,
            latitude: pickupLat,
            longitude: pickupLng
          },
          destination: {
            address: destination,
            latitude: destinationLat,
            longitude: destinationLng
          },
          distanceKm,
          durationMinutes,
          routeGeometry
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setStartedPoolRide(response.data.ride);
        fetchPoolRides();
      } else {
        throw new Error(response.data.message || 'Failed to start pool ride');
      }
    } catch (err) {
      console.error('Start pool ride error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Error starting pool ride';
      setBookingError(errMsg);
    } finally {
      setStartPoolLoading(false);
    }
  };

  useEffect(() => {
    if (showResult && rideType === 'Pool') {
      fetchPoolRides();
    }
  }, [rideType, showResult]);

  const handleFindRide = async () => {
    setError('');
    setBookingError('');
    setBookingSuccess(false);
    setJoinedPoolRide(null);
    setStartedPoolRide(null);
    setLoading(true);
    setShowResult(false);

    if (!pickup.trim()) {
      setError('Pickup location is required');
      setLoading(false);
      return;
    }
    if (!destination.trim()) {
      setError('Destination is required');
      setLoading(false);
      return;
    }

    try {
      const backendUrl = import.meta.env.VITE_Backend_API || '';
      
      // Geocode pickup
      const pickupResponse = await axios.post(`${backendUrl}/api/location/geocode`, {
        address: pickup
      });
      
      if (!pickupResponse.data.success) {
        throw new Error('Failed to geocode pickup location');
      }

      // Geocode destination
      const destResponse = await axios.post(`${backendUrl}/api/location/geocode`, {
        address: destination
      });

      if (!destResponse.data.success) {
        throw new Error('Failed to geocode destination');
      }

      const pickupLoc = pickupResponse.data.location;
      const destLoc = destResponse.data.location;

      setPickupLat(pickupLoc.latitude);
      setPickupLng(pickupLoc.longitude);
      setDestinationLat(destLoc.latitude);
      setDestinationLng(destLoc.longitude);

      console.log('Geocoding success:', { pickupLoc, destLoc });

      // Calculate route using ORS
      const routeResponse = await axios.post(`${backendUrl}/api/location/route`, {
        pickup: { latitude: pickupLoc.latitude, longitude: pickupLoc.longitude },
        destination: { latitude: destLoc.latitude, longitude: destLoc.longitude }
      });

      if (routeResponse.data.success) {
        const route = routeResponse.data.route;
        setDistanceKm(route.distance);
        setDurationMinutes(route.duration);
        setRouteGeometry(route.geometry || null);
        setShowResult(true);
      } else {
        throw new Error('Failed to calculate route');
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Error geocoding locations';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEditRide = () => {
    setShowResult(false);
    setDistanceKm(null);
    setDurationMinutes(null);
    setRouteGeometry(null);
    setError('');
    setBookingError('');
    setBookingSuccess(false);
    setJoinedPoolRide(null);
    setStartedPoolRide(null);
  };

  const handleConfirmRide = async () => {
    if (rideType !== 'Personal') return;

    setBookingError('');
    setBookingLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setBookingError('Please log in to confirm your ride.');
        setBookingLoading(false);
        return;
      }

      const fare = calculatePersonalFare(distanceKm, durationMinutes);
      const backendUrl = import.meta.env.VITE_Backend_API || '';

      const response = await axios.post(
        `${backendUrl}/api/rides/personal`,
        {
          pickup: {
            address: pickup,
            latitude: pickupLat,
            longitude: pickupLng
          },
          destination: {
            address: destination,
            latitude: destinationLat,
            longitude: destinationLng
          },
          distanceKm,
          durationMinutes,
          fare
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setBookingSuccess(true);
      } else {
        throw new Error(response.data.message || 'Failed to book ride');
      }
    } catch (err) {
      console.error('Booking error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Error booking ride';
      setBookingError(errMsg);
    } finally {
      setBookingLoading(false);
    }
  };

  // Register Page
  if (view === 'register') {
    return (
      <Register
        onNavigateHome={() => setView('home')}
        onNavigateLogin={() => setView('login')}
      />
    );
  }

  // Login Page
  if (view === 'login') {
    return (
      <Login
        onNavigateHome={() => setView('home')}
        onNavigateRegister={() => setView('register')}
        onLoginSuccess={() => setView('home')}
      />
    );
  }

  // Home Page
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans relative overflow-hidden">

      {/* Background Accent Gradients */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between z-10 border-b border-slate-800/60">

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-indigo-500/20">
            T
          </div>

          <span className="font-extrabold tracking-wider text-2xl bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Tripza
          </span>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-3">

          <button
            onClick={() => setView('login')}
            className="px-4 py-2 rounded-xl border border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-white font-semibold text-sm transition-all"
          >
            Login
          </button>

          <button
            onClick={() => setView('register')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all"
          >
            Register
          </button>

        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-4xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center items-center text-center z-10">

        {/* Title */}
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-white mb-3">
          Tripza
        </h1>

        <p className="text-lg sm:text-2xl text-slate-400 font-medium mb-10 max-w-lg">
          Your smart local ride platform
        </p>

        {/* Ride Booking Form / Result */}
        <div className="w-full max-w-lg bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-left">

          {showResult ? (
            /* ── Route Result Panel ── */
            startedPoolRide ? (
              /* ── Started Pool Ride Success View (Driver Dashboard View) ── */
              <div className="py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-2xl mx-auto mb-3">
                  ✓
                </div>
                <h3 className="text-2xl font-bold text-white text-center mb-1">Pool Ride Active!</h3>
                <p className="text-slate-400 text-xs text-center mb-5">
                  Your pool ride is active and collecting passenger fares.
                </p>

                {/* Driver Earnings Summary Box */}
                <div className="bg-gradient-to-br from-indigo-950/40 to-slate-950/80 border border-indigo-500/30 rounded-2xl p-4 mb-5 text-left space-y-2.5 text-sm shadow-lg">
                  <div className="flex justify-between items-center pb-2 border-b border-indigo-500/20">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Driver Earning Summary</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase">
                      {startedPoolRide.status || 'ACTIVE'}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-300">
                    <span>Active Passengers</span>
                    <span className="font-semibold text-white">
                      {startedPoolRide.currentPassengerCount || (startedPoolRide.passengers ? startedPoolRide.passengers.length : 0)} passenger(s)
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-300">
                    <span>Available Seats</span>
                    <span className="font-semibold text-white">
                      {startedPoolRide.availableSeats ?? 5} of {startedPoolRide.maxPassengerCapacity ?? 5}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-300">
                    <span>Current Driver Incentive</span>
                    <span className="font-semibold text-emerald-400">
                      +₹{startedPoolRide.driverIncentive ?? 0}
                    </span>
                  </div>

                  <div className="h-px bg-slate-800 my-1" />

                  <div className="flex justify-between items-center pt-1 font-extrabold text-white text-base">
                    <span>Total Pool Earning</span>
                    <span className="text-emerald-400 text-lg">
                      ₹{startedPoolRide.driverEarnings || startedPoolRide.fare || 0}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleEditRide}
                  className="w-full py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-all cursor-pointer"
                >
                  Book Another Ride
                </button>
              </div>
            ) : joinedPoolRide ? (
              /* ── Joined Pool Ride Success View (Passenger View) ── */
              <div className="py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-2xl mx-auto mb-3">
                  ✓
                </div>
                <h3 className="text-2xl font-bold text-white text-center mb-1">Joined Pool Ride!</h3>
                <p className="text-slate-400 text-xs text-center mb-5">
                  Your pool fare has been calculated dynamically based on shared segments.
                </p>

                {/* Passenger Fare Breakdown Card */}
                {joinedPoolRide.passengerFare ? (
                  <div className="bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-4 mb-5 text-left space-y-2.5 text-sm shadow-xl">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Your Fare Breakdown</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase">
                        Confirmed
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-300">
                      <span>Base / Common Share</span>
                      <span className="font-medium text-white">₹{joinedPoolRide.passengerFare.baseShare ?? joinedPoolRide.passengerFare.segmentShareTotal}</span>
                    </div>

                    <div className="flex justify-between text-slate-300">
                      <span>Driver Incentive</span>
                      <span className="font-medium text-white">₹{joinedPoolRide.passengerFare.driverIncentive ?? joinedPoolRide.passengerFare.driverIncentiveContribution}</span>
                    </div>

                    {joinedPoolRide.passengerFare.extraDetourCost > 0 && (
                      <div className="flex justify-between text-amber-400">
                        <span>Extra Pickup/Detour Cost</span>
                        <span className="font-medium">+₹{joinedPoolRide.passengerFare.extraDetourCost}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-slate-400 text-xs">
                      <span>Subtotal</span>
                      <span>₹{joinedPoolRide.passengerFare.subtotal || ((joinedPoolRide.passengerFare.baseShare || 0) + (joinedPoolRide.passengerFare.driverIncentive || 0) + (joinedPoolRide.passengerFare.extraDetourCost || 0)).toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-slate-400 text-xs">
                      <span>GST (5%)</span>
                      <span>₹{joinedPoolRide.passengerFare.gst || (Math.round((joinedPoolRide.passengerFare.subtotal || 0) * 0.05 * 100) / 100).toFixed(2)}</span>
                    </div>

                    <div className="h-px bg-slate-800 my-1" />

                    <div className="flex justify-between items-center font-extrabold text-white text-base">
                      <span>Final Payable Fare</span>
                      <span className="text-emerald-400 text-xl">
                        ₹{joinedPoolRide.passengerFare.finalFare || joinedPoolRide.passengerFare.totalPayableFare}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 mb-5 text-left space-y-2 text-sm">
                    <div className="flex justify-between text-slate-400">
                      <span>Status</span>
                      <span className="text-emerald-400 font-semibold uppercase text-xs tracking-wider">Joined</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Pickup</span>
                      <span className="text-slate-200 truncate max-w-[200px]">{pickup}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Destination</span>
                      <span className="text-slate-200 truncate max-w-[200px]">{destination}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Available Seats Left</span>
                      <span className="text-slate-200">{joinedPoolRide.availableSeats} of {joinedPoolRide.maxPassengerCapacity}</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleEditRide}
                  className="w-full py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-all cursor-pointer"
                >
                  Book Another Ride
                </button>
              </div>
            ) : bookingSuccess ? (
              /* ── Booking Confirmed Success View ── */
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-3xl mx-auto mb-4">
                  ✓
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Ride Confirmed!</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Your personal ride has been successfully booked.
                </p>

                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 mb-6 text-left space-y-2 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>Status</span>
                    <span className="text-emerald-400 font-semibold uppercase text-xs tracking-wider">Confirmed</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Pickup</span>
                    <span className="text-slate-200 truncate max-w-[200px]">{pickup}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Destination</span>
                    <span className="text-slate-200 truncate max-w-[200px]">{destination}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Distance</span>
                    <span className="text-slate-200">{distanceKm?.toFixed(1)} km</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Est. Time</span>
                    <span className="text-slate-200">{Math.round(durationMinutes)} min</span>
                  </div>
                  <div className="h-px bg-slate-800 my-1" />
                  <div className="flex justify-between font-bold text-white text-base">
                    <span>Total Fare</span>
                    <span>₹{calculatePersonalFare(distanceKm, durationMinutes)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleEditRide}
                  className="w-full py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-all cursor-pointer"
                >
                  Book Another Ride
                </button>
              </div>
            ) : (
              <div>
                {/* Back button */}
                <button
                  type="button"
                  onClick={handleEditRide}
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-6 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  Edit locations
                </button>

                {/* Route summary */}
                <div className="mb-6 space-y-3">
                  {/* Pickup row */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-indigo-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Pickup</p>
                      <p className="text-sm font-medium text-slate-100">{pickup}</p>
                    </div>
                  </div>

                  {/* Connector line */}
                  <div className="ml-3.5 w-px h-4 bg-slate-700" />

                  {/* Destination row */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Destination</p>
                      <p className="text-sm font-medium text-slate-100">{destination}</p>
                    </div>
                  </div>
                </div>

                {/* Distance & Duration chips */}
                <div className="flex gap-3 mb-8">
                  <div className="flex-1 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Distance</p>
                    <p className="text-2xl font-black text-white">
                      {distanceKm !== null ? distanceKm.toFixed(1) : '—'}
                      <span className="text-sm font-semibold text-slate-400 ml-1">km</span>
                    </p>
                  </div>
                  <div className="flex-1 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Est. Time</p>
                    <p className="text-2xl font-black text-white">
                      {durationMinutes !== null ? Math.round(durationMinutes) : '—'}
                      <span className="text-sm font-semibold text-slate-400 ml-1">min</span>
                    </p>
                  </div>
                </div>

                {/* Ride type selection */}
                <div className="mb-6">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Choose Ride Type
                  </label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setRideType('Personal')}
                      className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        rideType === 'Personal'
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>🚗</span>
                      Personal
                    </button>
                    <button
                      type="button"
                      onClick={() => setRideType('Pool')}
                      className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        rideType === 'Pool'
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>👥</span>
                      Pool
                    </button>
                  </div>
                </div>

                {/* Fare Breakdown — Personal only */}
                {rideType === 'Personal' && distanceKm !== null && durationMinutes !== null && (() => {
                  const distCharge = Math.round(distanceKm * PERSONAL_PER_KM_RATE);
                  const timeCharge = Math.round(durationMinutes * PERSONAL_PER_MIN_RATE);
                  const total      = calculatePersonalFare(distanceKm, durationMinutes);
                  return (
                    <div className="mb-5 bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
                        Fare Estimate
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-slate-400">
                          <span>Base fare</span>
                          <span>₹{PERSONAL_BASE_FARE}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>{distanceKm.toFixed(1)} km × ₹{PERSONAL_PER_KM_RATE}</span>
                          <span>₹{distCharge}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>{Math.round(durationMinutes)} min × ₹{PERSONAL_PER_MIN_RATE}</span>
                          <span>₹{timeCharge}</span>
                        </div>
                        <div className="h-px bg-slate-800 my-1" />
                        <div className="flex justify-between font-bold text-white text-base">
                          <span>Total</span>
                          <span>₹{total}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Active Pool Rides */}
                {rideType === 'Pool' && (
                  <div className="mb-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Active Pool Rides
                      </p>
                      <button
                        type="button"
                        onClick={fetchPoolRides}
                        disabled={poolLoading}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {poolLoading ? 'Loading...' : 'Refresh'}
                      </button>
                    </div>

                    {poolLoading ? (
                      <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
                        <div className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
                        <p className="text-slate-400 text-sm">Fetching active pool rides...</p>
                      </div>
                    ) : poolError ? (
                      <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
                        <p className="font-semibold mb-1">Could not load active pool rides</p>
                        <p className="text-xs text-red-400/80 mb-3">{poolError}</p>
                        <button
                          type="button"
                          onClick={fetchPoolRides}
                          className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium cursor-pointer"
                        >
                          Retry
                        </button>
                      </div>
                    ) : poolRides.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
                        <p className="text-slate-300 font-semibold text-sm mb-1">No Active Pool Rides Available</p>
                        <p className="text-slate-500 text-xs">There are no active pool rides matching your route right now.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {poolRides.map((ride) => (
                          <div key={ride.id} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                            {/* Driver info & status */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-xs">
                                  {ride.driver?.name ? ride.driver.name.charAt(0).toUpperCase() : 'D'}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-white">
                                    {ride.driver?.name || 'Driver Assigned'}
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    {ride.availableSeats} of {ride.maxPassengerCapacity} seats available
                                  </p>
                                </div>
                              </div>
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                {ride.status}
                              </span>
                            </div>

                            {/* Pickup & Destination */}
                            <div className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                                <span className="truncate">{ride.pickup?.address || 'Pickup address'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                                <span className="truncate">{ride.destination?.address || 'Destination address'}</span>
                              </div>
                            </div>

                            {/* Distance, Duration & Join Button */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                              <div className="text-xs text-slate-400">
                                <span>{ride.distanceKm !== undefined ? `${ride.distanceKm.toFixed(1)} km` : '—'}</span>
                                <span className="mx-1.5">·</span>
                                <span>{ride.durationMinutes !== undefined ? `${Math.round(ride.durationMinutes)} min` : '—'}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleJoinPoolRide(ride.id)}
                                disabled={joiningRideId === ride.id || ride.availableSeats <= 0}
                                className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all cursor-pointer shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {joiningRideId === ride.id ? 'Joining...' : ride.availableSeats <= 0 ? 'Full' : 'Join Ride'}
                              </button>
                            </div>

                            {/* Pool Fare Estimate Section */}
                            {ride.fareBreakdown && (
                              <div className="mt-3 bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3.5 space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                  <div>
                                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 block">
                                      Pool Fare Preview
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      👥 Currently {ride.currentPassengerCount} active passenger(s) in pool
                                    </span>
                                  </div>
                                  <span className="text-xs text-slate-300 font-medium bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                                    {ride.fareBreakdown.distanceKm} km trip
                                  </span>
                                </div>

                                {/* Solo Fare vs Pool Fare Comparison Box */}
                                <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                                  <div className="text-left">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Solo Trip Price</p>
                                    <p className="text-sm font-bold text-slate-400 line-through">
                                      ₹{ride.fareBreakdown.soloPersonalFare || '—'}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Shared Pool Price</p>
                                    <p className="text-base font-extrabold text-emerald-400">
                                      ₹{ride.fareBreakdown.finalFare || ride.fareBreakdown.totalPayableFare}
                                    </p>
                                  </div>
                                </div>

                                {/* Savings Badge */}
                                {ride.fareBreakdown.savingsAmount > 0 && (
                                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300">
                                    <span>💰 Your Savings</span>
                                    <span>Save ₹{ride.fareBreakdown.savingsAmount} ({ride.fareBreakdown.savingsPercentage}% OFF)</span>
                                  </div>
                                )}

                                {/* Segment Breakdown */}
                                {ride.fareBreakdown.segmentsUsed && ride.fareBreakdown.segmentsUsed.length > 0 && (
                                  <div className="space-y-1.5 pt-1">
                                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                      Route Segments Breakdown
                                    </p>
                                    {ride.fareBreakdown.segmentsUsed.map((seg, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between text-xs bg-slate-950/70 p-2 rounded-lg border border-slate-800/60"
                                      >
                                        <div>
                                          <span className="text-slate-200 font-medium">Segment: {seg.segmentDistanceKm} km</span>
                                          <span className="text-slate-400 ml-2">
                                            (Active passengers: {seg.passengersCount})
                                          </span>
                                        </div>
                                        <span className="text-slate-100 font-semibold">Base share: ₹{seg.baseSharePerPassenger || seg.passengerShare}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Fare Summary */}
                                <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs">
                                  <div className="flex justify-between text-slate-400">
                                    <span>Base / Common Share</span>
                                    <span>₹{ride.fareBreakdown.baseShare || ride.fareBreakdown.segmentShareTotal}</span>
                                  </div>
                                  <div className="flex justify-between text-slate-400">
                                    <span>Driver Incentive</span>
                                    <span>₹{ride.fareBreakdown.driverIncentive || ride.fareBreakdown.driverIncentiveContribution}</span>
                                  </div>
                                  {ride.fareBreakdown.extraDetourCost > 0 && (
                                    <div className="flex justify-between text-amber-400">
                                      <span>Extra Pickup / Detour</span>
                                      <span>+₹{ride.fareBreakdown.extraDetourCost}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between text-slate-400">
                                    <span>GST (5%)</span>
                                    <span>₹{ride.fareBreakdown.gst || (Math.round((ride.fareBreakdown.subtotal || 0) * 0.05 * 100) / 100).toFixed(2)}</span>
                                  </div>
                                  <div className="h-px bg-slate-800 my-1" />
                                  <div className="flex justify-between font-bold text-emerald-400 text-sm">
                                    <span>Your Pool Fare</span>
                                    <span>₹{ride.fareBreakdown.finalFare || ride.fareBreakdown.totalPayableFare}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Booking Error Notice */}
                {bookingError && (
                  <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    {bookingError}
                  </div>
                )}

                {/* Action button */}
                <button
                  type="button"
                  onClick={rideType === 'Personal' ? handleConfirmRide : handleStartPoolRide}
                  disabled={bookingLoading || startPoolLoading}
                  className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.99] transition-all font-bold text-white shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2 text-base cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {rideType === 'Personal'
                    ? bookingLoading
                      ? 'Booking Ride...'
                      : distanceKm !== null && durationMinutes !== null
                        ? `Confirm · ₹${calculatePersonalFare(distanceKm, durationMinutes)}`
                        : 'Confirm Personal Ride'
                    : startPoolLoading
                      ? 'Starting Pool...'
                      : 'Start Pool Ride'}
                </button>
              </div>
            )

          ) : (
            /* ── Booking Form ── */
            <div>
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Inputs */}
              <div className="space-y-4 mb-6">

                {/* Pickup */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Pickup Location
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-indigo-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Enter pickup location"
                      value={pickup}
                      onChange={(e) => setPickup(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
                    />
                  </div>
                </div>

                {/* Destination */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Destination
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Enter destination"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Ride Type */}
              <div className="mb-8">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Ride Type
                </label>
                <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setRideType('Personal')}
                    className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      rideType === 'Personal'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>🚗</span>
                    Personal
                  </button>
                  <button
                    type="button"
                    onClick={() => setRideType('Pool')}
                    className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      rideType === 'Pool'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>👥</span>
                    Pool
                  </button>
                </div>
              </div>

              {/* Find Ride */}
              <button
                type="button"
                onClick={handleFindRide}
                disabled={loading}
                className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:scale-[0.99] transition-all font-bold text-white shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2 text-base cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Finding Ride...' : 'Find Ride'}
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-6 text-center text-xs text-slate-500 border-t border-slate-800/60 z-10">
        Tripza &copy; {new Date().getFullYear()} — Your smart local ride platform
      </footer>

    </div>
  );
}

export default App;