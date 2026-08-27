const express = require('express');
const router = express.Router();
const { geocodeLocation, calculateRoute } = require('../controllers/locationController');

router.post('/geocode', geocodeLocation);
router.post('/route', calculateRoute);

module.exports = router;
