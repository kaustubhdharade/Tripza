const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { bookPersonalRide, getActivePoolRides, joinPoolRide, confirmPoolRide, startPoolRide, getDriverActiveRide } = require('../controllers/rideController');

// GET /api/rides/pool/active — fetches active pool rides
router.get('/pool/active', getActivePoolRides);

// GET /api/rides/driver/active — fetches driver's active pool ride (requires JWT)
router.get('/driver/active', protect, getDriverActiveRide);

// POST /api/rides/pool/start — requires a valid JWT
router.post('/pool/start', protect, startPoolRide);

// POST /api/rides/pool/:rideId/join — requires a valid JWT
router.post('/pool/:rideId/join', protect, joinPoolRide);

// POST /api/rides/pool/:rideId/confirm — requires a valid JWT
router.post('/pool/:rideId/confirm', protect, confirmPoolRide);

// POST /api/rides/personal — requires a valid JWT
router.post('/personal', protect, bookPersonalRide);

module.exports = router;
