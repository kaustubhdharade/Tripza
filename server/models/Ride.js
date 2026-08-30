const mongoose = require('mongoose');

// Sub-schema reused for both pickup and destination
const locationSchema = new mongoose.Schema(
  {
    address: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  { _id: false }
);

// Sub-schema for individual passengers in a pool ride
const passengerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    pickup: {
      type: locationSchema,
      required: true
    },
    destination: {
      type: locationSchema,
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    fare: {
      type: Number,
      min: 0
    },
    fareBreakdown: {
      type: mongoose.Schema.Types.Mixed
    },
    detourKm: {
      type: Number,
      default: 0
    },
    detourCost: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['joined', 'confirmed'],
      default: 'joined'
    },
    confirmedAt: {
      type: Date
    }
  }
);

const rideSchema = new mongoose.Schema({
  // Primary user (for personal rides or ride creator)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Driver assigned to the ride
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Route details
  pickup: {
    type: locationSchema
  },
  destination: {
    type: locationSchema
  },
  distanceKm: {
    type: Number,
    min: 0
  },
  durationMinutes: {
    type: Number,
    min: 0
  },
  fare: {
    type: Number,
    min: 0
  },
  routeGeometry: {
    type: String
  },
  rideType: {
    type: String,
    required: true,
    enum: ['personal', 'pool'],
    default: 'personal'
  },
  // List of passengers for a pool ride
  passengers: [passengerSchema],
  maxPassengers: {
    type: Number,
    default: 15,
    min: 1
  },
  driverIncentive: {
    type: Number,
    default: 0
  },
  driverEarnings: {
    type: Number,
    default: 0
  },
  segmentsBreakdown: {
    type: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'confirmed', 'in_progress', 'completed', 'cancelled'],
    default: 'confirmed'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Ride = mongoose.model('Ride', rideSchema);

module.exports = Ride;
