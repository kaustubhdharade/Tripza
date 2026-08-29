import React, { useState, useEffect, useCallback } from 'react';
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
  const [view, setView] = useState('home');

  // Authenticated user state
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

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
  const [expandedRideId, setExpandedRideId] = useState(null);

  const [joinedPoolRide, setJoinedPoolRide] = useState(null);
  const [joiningRideId, setJoiningRideId] = useState(null);
  const [refreshingJoined, setRefreshingJoined] = useState(false);

  const [startedPoolRide, setStartedPoolRide] = useState(null);
  const [startPoolLoading, setStartPoolLoading] = useState(false);

  // Synchronize currentUser from localStorage
  const refreshCurrentUser = () => {
    try {
      const saved = localStorage.getItem('user');
      setCurrentUser(saved ? JSON.parse(saved) : null);
    } catch {
      setCurrentUser(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
    setJoinedPoolRide(null);
    setStartedPoolRide(null);
    setBookingSuccess(false);
  };

  const fetchPoolRides = useCallback(async () => {
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
  }, [pickupLat, pickupLng, destinationLat, destinationLng]);

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
        const rideData = response.data.ride;
        const passengerFare = response.data.passengerFare;
        const fareSummary = response.data.fareSummary;

        setJoinedPoolRide({
          ...rideData,
          passengerFare,
          fareSummary
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

  const handleRefreshJoinedRide = async () => {
    if (!joinedPoolRide) return;
    setRefreshingJoined(true);
    try {
      const backendUrl = import.meta.env.VITE_Backend_API || '';
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.get(`${backendUrl}/api/rides/pool/active`, { headers });
      if (response.data.success) {
        const activeList = response.data.rides || [];
        setPoolRides(activeList);

        const currentUserId = (currentUser?.id || currentUser?._id || '').toString();
        const updated = activeList.find(r => r.id === (joinedPoolRide.id || joinedPoolRide._id));

        if (updated) {
          const myPassenger = updated.passengers?.find(
            p => {
              const pId = (p.user?.id || p.user?._id || p.user || '').toString();
              return pId && pId === currentUserId;
            }
          );

          setJoinedPoolRide({
            ...updated,
            passengerFare: myPassenger?.fareBreakdown || joinedPoolRide.passengerFare,
            segments: updated.segments || joinedPoolRide.segments
          });
        }
      }
    } catch (err) {
      console.error('Refresh joined pool ride error:', err);
    } finally {
      setRefreshingJoined(false);
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
  }, [rideType, showResult, fetchPoolRides]);

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
        onNavigateHome={() => {
          refreshCurrentUser();
          setView('home');
        }}
        onNavigateLogin={() => setView('login')}
      />
    );
  }

  // Login Page
  if (view === 'login') {
    return (
      <Login
        onNavigateHome={() => {
          refreshCurrentUser();
          setView('home');
        }}
        onNavigateRegister={() => setView('register')}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setView('home');
        }}
      />
    );
  }

  // Helper to check if current logged in user is already in a pool ride
  const isUserInRide = (ride) => {
    if (!currentUser || !ride || !ride.passengers) return false;
    const currentUserId = (currentUser.id || currentUser._id || '').toString();
    return ride.passengers.some(p => {
      const pId = p.user?.id || p.user?._id || p.user;
      return pId && pId.toString() === currentUserId;
    });
  };

  // Home Page
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans relative overflow-hidden">

      {/* Background Accent Gradients */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between z-10 border-b border-slate-800/60">
        <div className="flex items-center gap-3 cursor-pointer" onClick={handleEditRide}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-indigo-500/20">
            T
          </div>
          <span className="font-extrabold tracking-wider text-2xl bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Tripza
          </span>
        </div>

        {/* User Status / Navigation Buttons */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-200">{currentUser.name}</span>
                <span className="text-[10px] text-indigo-400 uppercase font-semibold tracking-wider">
                  {currentUser.role || 'Passenger'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3.5 py-1.5 rounded-xl border border-slate-800 hover:border-red-500/50 text-slate-400 hover:text-red-400 font-semibold text-xs transition-all cursor-pointer"
              >
                Logout
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setView('login')}
                className="px-4 py-2 rounded-xl border border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-white font-semibold text-sm transition-all cursor-pointer"
              >
                Login
              </button>

              <button
                onClick={() => setView('register')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all cursor-pointer"
              >
                Register
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-10 flex-1 flex flex-col justify-center items-center text-center z-10">

        {/* Title */}
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-2">
          Tripza
        </h1>

        <p className="text-base sm:text-xl text-slate-400 font-medium mb-8 max-w-lg">
          Smart, Dynamic & Shared Local Rides
        </p>

        {/* Ride Booking Form / Result Container */}
        <div className="w-full max-w-xl bg-slate-900/85 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl text-left">

          {showResult ? (
            /* ── Route Result Panel ── */
            startedPoolRide ? (
              /* ── Started Pool Ride View (Driver Dashboard Context) ── */
              <div className="py-2 space-y-5">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-xl mx-auto mb-2">
                    ✓
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">Pool Ride Active!</h3>
                  <p className="text-slate-400 text-xs">
                    Your pool route is open and collecting passengers dynamically.
                  </p>
                </div>

                {/* Driver Earnings Summary Box (Driver-facing only) */}
                <div className="bg-gradient-to-br from-indigo-950/50 to-slate-950/90 border border-indigo-500/30 rounded-2xl p-4 space-y-3 shadow-lg">
                  <div className="flex justify-between items-center pb-2 border-b border-indigo-500/20">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                      Driver Earnings Dashboard
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase">
                      {startedPoolRide.status || 'ACTIVE'}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Active Passengers</span>
                    <span className="font-semibold text-white">
                      {startedPoolRide.currentPassengerCount || (startedPoolRide.passengers ? startedPoolRide.passengers.length : 0)} passenger(s)
                    </span>
                  </div>

                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Available Seats</span>
                    <span className="font-semibold text-white">
                      {startedPoolRide.availableSeats ?? (startedPoolRide.maxPassengerCapacity || 5)} of {startedPoolRide.maxPassengerCapacity || 5}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Total Driver Incentive (20%)</span>
                    <span className="font-semibold text-emerald-400">
                      +₹{startedPoolRide.driverIncentive ?? 0}
                    </span>
                  </div>

                  <div className="h-px bg-slate-800 my-1" />

                  <div className="flex justify-between items-center pt-1 font-extrabold text-white text-base">
                    <span>Total Driver Earnings</span>
                    <span className="text-emerald-400 text-xl">
                      ₹{startedPoolRide.driverEarnings || startedPoolRide.fare || 0}
                    </span>
                  </div>
                </div>

                {/* Pool Route Details */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Route Information
                  </span>
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                    <span className="truncate">{startedPoolRide.pickup?.address || pickup}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="truncate">{startedPoolRide.destination?.address || destination}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 pt-2 border-t border-slate-800/80">
                    <span>Route Distance</span>
                    <span className="text-white font-medium">{startedPoolRide.distanceKm?.toFixed(1) || distanceKm?.toFixed(1)} km</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleEditRide}
                  className="w-full py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-all cursor-pointer"
                >
                  Book / Offer Another Ride
                </button>
              </div>
            ) : joinedPoolRide ? (
              /* ── Joined Pool Ride Details View (Passenger View) ── */
              <div className="py-2 space-y-5">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-xl mx-auto mb-2">
                    ✓
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">Pool Ride Joined!</h3>
                  <p className="text-slate-400 text-xs">
                    Your dynamic pool fare is automatically recalculated and shared across route segments.
                  </p>
                </div>

                {/* 1. Pool Ride Details Section (Requirement 4) */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2.5 text-xs shadow-md">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      Pool Ride Details
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase">
                      {joinedPoolRide.status || 'ACTIVE'}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Driver</span>
                    <span className="font-semibold text-white">
                      {joinedPoolRide.driver?.name || 'Assigned Driver'} {joinedPoolRide.driver?.email ? `(${joinedPoolRide.driver.email})` : ''}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Driver Pickup</span>
                    <span className="font-medium text-slate-200 truncate max-w-[220px]">
                      {joinedPoolRide.pickup?.address || '—'}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Driver Destination</span>
                    <span className="font-medium text-slate-200 truncate max-w-[220px]">
                      {joinedPoolRide.destination?.address || '—'}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Total Route Distance</span>
                    <span className="font-medium text-white">
                      {joinedPoolRide.distanceKm !== undefined ? `${joinedPoolRide.distanceKm.toFixed(1)} km` : '—'}
                      {joinedPoolRide.durationMinutes !== undefined && ` (${Math.round(joinedPoolRide.durationMinutes)} min)`}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Available Seats</span>
                    <span className="font-semibold text-emerald-400">
                      {joinedPoolRide.availableSeats ?? 0} seats left (of {joinedPoolRide.maxPassengerCapacity || 5})
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Current Passenger Count</span>
                    <span className="font-semibold text-white">
                      {joinedPoolRide.currentPassengerCount ?? (joinedPoolRide.passengers?.length || 1)} passenger(s)
                    </span>
                  </div>
                </div>

                {/* 2. Current Logged-in Passenger's Pool Fare (Requirement 6) */}
                {joinedPoolRide.passengerFare && (
                  <div className="bg-slate-950/90 border border-indigo-500/40 rounded-2xl p-4 space-y-3 text-xs shadow-xl">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                        Your Fare Breakdown
                      </span>
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-500/30 uppercase">
                        Dynamic Pool Rate
                      </span>
                    </div>

                    {/* Solo vs Shared Pool comparison */}
                    {joinedPoolRide.passengerFare.soloPersonalFare && (
                      <div className="grid grid-cols-2 gap-2 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                        <div>
                          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Solo Trip Fare</p>
                          <p className="text-sm font-bold text-slate-400 line-through">
                            ₹{joinedPoolRide.passengerFare.soloPersonalFare}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Shared Pool Fare</p>
                          <p className="text-base font-extrabold text-emerald-400">
                            ₹{joinedPoolRide.passengerFare.finalFare || joinedPoolRide.passengerFare.totalPayableFare}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Savings Badge */}
                    {joinedPoolRide.passengerFare.savingsAmount > 0 && (
                      <div className="flex items-center justify-between bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300">
                        <span>💰 Your Pool Savings</span>
                        <span>Save ₹{joinedPoolRide.passengerFare.savingsAmount} ({joinedPoolRide.passengerFare.savingsPercentage}% OFF)</span>
                      </div>
                    )}

                    {/* Line-item items */}
                    <div className="space-y-1.5 pt-1 text-slate-300">
                      <div className="flex justify-between text-slate-400">
                        <span>Base / Common Segment Share</span>
                        <span className="text-white font-medium">₹{joinedPoolRide.passengerFare.baseShare ?? joinedPoolRide.passengerFare.segmentShareTotal}</span>
                      </div>

                      <div className="flex justify-between text-slate-400">
                        <span>Driver Incentive Contribution</span>
                        <span className="text-white font-medium">₹{joinedPoolRide.passengerFare.driverIncentive ?? joinedPoolRide.passengerFare.driverIncentiveContribution ?? 0}</span>
                      </div>

                      {joinedPoolRide.passengerFare.extraDetourCost > 0 && (
                        <div className="flex justify-between text-amber-400">
                          <span>Extra Pickup / Detour Cost ({joinedPoolRide.passengerFare.extraDistanceKm} km)</span>
                          <span className="font-medium">+₹{joinedPoolRide.passengerFare.extraDetourCost}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-slate-400">
                        <span>Subtotal</span>
                        <span>₹{joinedPoolRide.passengerFare.subtotal || ((joinedPoolRide.passengerFare.baseShare || 0) + (joinedPoolRide.passengerFare.driverIncentive || 0) + (joinedPoolRide.passengerFare.extraDetourCost || 0)).toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-slate-400">
                        <span>GST (5%)</span>
                        <span>₹{joinedPoolRide.passengerFare.gst || (Math.round((joinedPoolRide.passengerFare.subtotal || 0) * 0.05 * 100) / 100).toFixed(2)}</span>
                      </div>

                      <div className="h-px bg-slate-800 my-1" />

                      <div className="flex justify-between items-center font-extrabold text-white text-sm pt-0.5">
                        <span className="text-sm">Final Payable Pool Fare</span>
                        <span className="text-emerald-400 text-xl font-black">
                          ₹{joinedPoolRide.passengerFare.finalFare || joinedPoolRide.passengerFare.totalPayableFare}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Passenger Information List (Requirement 5) */}
                {joinedPoolRide.passengers && joinedPoolRide.passengers.length > 0 && (
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs shadow-md">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        All Passengers in Pool ({joinedPoolRide.passengers.length})
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Live Repriced Fares
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {joinedPoolRide.passengers.map((p, idx) => {
                        const currentUserId = (currentUser?.id || currentUser?._id || '').toString();
                        const passengerUserId = (p.user?.id || p.user?._id || p.user || '').toString();
                        const isSelf = currentUserId && passengerUserId === currentUserId;
                        const pDist = p.fareBreakdown?.distanceKm || p.detourKm;
                        const pFare = p.fare || p.fareBreakdown?.finalFare;

                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border transition-all ${
                              isSelf
                                ? 'bg-indigo-950/40 border-indigo-500/40'
                                : 'bg-slate-900/60 border-slate-800'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-white">
                                  {p.user?.name || `Passenger ${idx + 1}`}
                                </span>
                                {isSelf && (
                                  <span className="bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                                    You
                                  </span>
                                )}
                              </div>
                              <span className="text-emerald-400 font-extrabold text-sm">
                                ₹{pFare !== undefined ? pFare : '—'}
                              </span>
                            </div>

                            <div className="space-y-1 text-slate-400 text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                                <span className="truncate">{p.pickup?.address || 'Pickup'}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                                <span className="truncate">{p.destination?.address || 'Destination'}</span>
                              </div>
                              {pDist !== undefined && (
                                <div className="text-[10px] text-slate-500 pt-0.5">
                                  Trip Distance: {typeof pDist === 'number' ? pDist.toFixed(1) : pDist} km
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. Segment-Level Fare Breakdown (Requirement 7) */}
                {((joinedPoolRide.segments && joinedPoolRide.segments.length > 0) ||
                  (joinedPoolRide.passengerFare?.segmentsUsed && joinedPoolRide.passengerFare.segmentsUsed.length > 0)) && (
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2.5 text-xs shadow-md">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Segment-Level Fare Breakdown
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Equal Share per Segment
                      </span>
                    </div>

                    <div className="space-y-2">
                      {(joinedPoolRide.passengerFare?.segmentsUsed || joinedPoolRide.segments).map((seg, idx) => {
                        const passCount = seg.passengersCount || seg.passengerCount || (seg.activePassengers ? seg.activePassengers.length : 1);
                        const segDist = seg.segmentDistanceKm;
                        const segBaseShare = seg.baseSharePerPassenger ?? seg.passengerShare ?? seg.segmentBaseFare;
                        const segIncentive = seg.incentivePerPassenger || 0;

                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80 text-[11px]"
                          >
                            <div>
                              <div className="font-semibold text-slate-200">
                                Segment #{seg.segmentIndex !== undefined ? seg.segmentIndex + 1 : idx + 1}
                                <span className="text-slate-400 font-normal ml-1">({segDist} km)</span>
                              </div>
                              <div className="text-slate-400 text-[10px]">
                                👥 {passCount} passenger{passCount > 1 ? 's' : ''} sharing segment
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-white">₹{segBaseShare}</div>
                              {segIncentive > 0 ? (
                                <div className="text-[9px] text-emerald-400 font-medium">+₹{segIncentive} incentive</div>
                              ) : (
                                <div className="text-[9px] text-slate-500">share / person</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Actions & Refresh */}
                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleRefreshJoinedRide}
                    disabled={refreshingJoined}
                    className="w-full py-3 px-4 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {refreshingJoined ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        Refreshing Live Fares...
                      </>
                    ) : (
                      <>
                        <span>🔄</span>
                        Refresh Live Ride & Repriced Fares
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleEditRide}
                    className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs transition-all cursor-pointer"
                  >
                    Book Another Ride
                  </button>
                </div>
              </div>
            ) : bookingSuccess ? (
              /* ── Personal Ride Confirmed Success View ── */
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
                    <span className="text-emerald-400">₹{calculatePersonalFare(distanceKm, durationMinutes)}</span>
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
              /* ── Form Result / Ride Selection View ── */
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
                <div className="flex gap-3 mb-6">
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
                        Personal Fare Estimate
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
                          <span className="text-emerald-400">₹{total}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Active Pool Rides Section */}
                {rideType === 'Pool' && (
                  <div className="mb-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Compatible Pool Rides
                      </p>
                      <button
                        type="button"
                        onClick={fetchPoolRides}
                        disabled={poolLoading}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {poolLoading ? 'Loading...' : 'Refresh Rides'}
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
                        <p className="text-slate-300 font-semibold text-sm mb-1">No Compatible Pool Rides Available</p>
                        <p className="text-slate-500 text-xs">
                          You can start a new Pool Ride as a driver below, or check back shortly.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {poolRides.map((ride) => {
                          const userJoined = isUserInRide(ride);
                          const currentUserId = (currentUser?.id || currentUser?._id || '').toString();
                          const myPassengerObj = ride.passengers?.find(
                            p => p.user && (p.user.id === currentUserId || p.user._id === currentUserId || p.user === currentUserId)
                          );
                          const isExpanded = expandedRideId === ride.id;

                          return (
                            <div key={ride.id} className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
                              {/* Driver info & status */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-xs">
                                    {ride.driver?.name ? ride.driver.name.charAt(0).toUpperCase() : 'D'}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-white">
                                      {ride.driver?.name || 'Driver Assigned'} {ride.driver?.email ? <span className="text-xs font-normal text-slate-400">({ride.driver.email})</span> : null}
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                      {ride.availableSeats} of {ride.maxPassengerCapacity || 5} seats available · {ride.currentPassengerCount} passenger(s)
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

                              {/* Distance, Duration & Action Button */}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                                <div className="text-xs text-slate-400">
                                  <span>{ride.distanceKm !== undefined ? `${ride.distanceKm.toFixed(1)} km` : '—'}</span>
                                  <span className="mx-1.5">·</span>
                                  <span>{ride.durationMinutes !== undefined ? `${Math.round(ride.durationMinutes)} min` : '—'}</span>
                                </div>

                                {userJoined ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setJoinedPoolRide({
                                        ...ride,
                                        passengerFare: myPassengerObj?.fareBreakdown || ride.fareBreakdown
                                      });
                                    }}
                                    className="py-2 px-3 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 font-semibold text-xs transition-all cursor-pointer"
                                  >
                                    View Joined Details (₹{myPassengerObj?.fare || '—'})
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleJoinPoolRide(ride.id)}
                                    disabled={joiningRideId === ride.id || ride.availableSeats <= 0}
                                    className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all cursor-pointer shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {joiningRideId === ride.id ? 'Joining...' : ride.availableSeats <= 0 ? 'Full' : 'Join Ride'}
                                  </button>
                                )}
                              </div>

                              {/* Candidate Preview if available */}
                              {!userJoined && ride.fareBreakdown && (
                                <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3 space-y-2 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                                      Your Dynamic Fare Preview
                                    </span>
                                    <span className="text-emerald-400 font-extrabold text-sm">
                                      ₹{ride.fareBreakdown.finalFare || ride.fareBreakdown.totalPayableFare}
                                    </span>
                                  </div>

                                  {ride.fareBreakdown.savingsAmount > 0 && (
                                    <div className="text-[10px] text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 flex justify-between">
                                      <span>Solo Fare: ₹{ride.fareBreakdown.soloPersonalFare}</span>
                                      <span className="font-bold">Save ₹{ride.fareBreakdown.savingsAmount} ({ride.fareBreakdown.savingsPercentage}% OFF)</span>
                                    </div>
                                  )}

                                  <div className="pt-1 space-y-1 text-[11px] text-slate-400 border-t border-slate-800">
                                    <div className="flex justify-between">
                                      <span>Base Segment Share</span>
                                      <span className="text-slate-200">₹{ride.fareBreakdown.baseShare}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Driver Incentive Contribution</span>
                                      <span className="text-slate-200">₹{ride.fareBreakdown.driverIncentive}</span>
                                    </div>
                                    {ride.fareBreakdown.extraDetourCost > 0 && (
                                      <div className="flex justify-between text-amber-400">
                                        <span>Detour Cost ({ride.fareBreakdown.extraDistanceKm} km)</span>
                                        <span>+₹{ride.fareBreakdown.extraDetourCost}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between">
                                      <span>Subtotal + GST (5%)</span>
                                      <span className="text-slate-200">₹{ride.fareBreakdown.subtotal} + ₹{ride.fareBreakdown.gst}</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Toggle Details / Passengers & Segments */}
                              <div className="pt-1">
                                <button
                                  type="button"
                                  onClick={() => setExpandedRideId(isExpanded ? null : ride.id)}
                                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <span>{isExpanded ? '▲ Hide Details' : '▼ View Passengers & Segments'}</span>
                                </button>

                                {isExpanded && (
                                  <div className="mt-3 space-y-3 pt-2 border-t border-slate-800/80 text-xs">
                                    {/* Existing Passengers */}
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                        Current Passengers ({ride.passengers?.length || 0})
                                      </p>
                                      {ride.passengers && ride.passengers.length > 0 ? (
                                        <div className="space-y-1.5">
                                          {ride.passengers.map((p, pIdx) => (
                                            <div key={pIdx} className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 text-[11px] flex justify-between items-center">
                                              <div>
                                                <span className="text-white font-medium">{p.user?.name || `Passenger ${pIdx + 1}`}</span>
                                                <span className="text-slate-400 ml-1.5 text-[10px]">
                                                  ({p.pickup?.address?.split(',')[0]} → {p.destination?.address?.split(',')[0]})
                                                </span>
                                              </div>
                                              <span className="text-emerald-400 font-bold">₹{p.fare || '—'}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-slate-500 text-[11px]">No passengers yet. Be the first!</p>
                                      )}
                                    </div>

                                    {/* Route Segments */}
                                    {ride.segments && ride.segments.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                          Route Segments Breakdown
                                        </p>
                                        <div className="space-y-1">
                                          {ride.segments.map((seg, sIdx) => (
                                            <div key={sIdx} className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800 text-[10px] flex justify-between text-slate-300">
                                              <span>Segment {sIdx + 1} ({seg.segmentDistanceKm} km)</span>
                                              <span className="text-slate-400">{seg.passengerCount || (seg.activePassengers?.length || 0)} passenger(s) sharing</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
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
                      : 'Start New Pool Ride (As Driver)'}
                </button>
              </div>
            )

          ) : (
            /* ── Initial Booking Form ── */
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
                      placeholder="Enter pickup location (e.g. Mumbai, Lonavala)"
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
                      placeholder="Enter destination (e.g. Pune)"
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
                {loading ? 'Finding Route...' : 'Find Ride'}
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