const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { bookPersonalRide, getActivePoolRides, joinPoolRide, startPoolRide } = require('../controllers/rideController');

// GET /api/rides/pool/active — fetches active pool rides
router.get('/pool/active', getActivePoolRides);

// POST /api/rides/pool/start — requires a valid JWT
router.post('/pool/start', protect, startPoolRide);

// POST /api/rides/pool/:rideId/join — requires a valid JWT
router.post('/pool/:rideId/join', protect, joinPoolRide);

// POST /api/rides/personal — requires a valid JWT
router.post('/personal', protect, bookPersonalRide);

module.exports = router;
