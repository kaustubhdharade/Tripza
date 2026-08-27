const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true,
    enum: ['passenger', 'driver', 'admin']
  },
  userType: {
    type: String,
    required: true,
    enum: ['college_student', 'outsider']
  },
  mis: {
    type: String
  },
  emergencyContact: {
    name: {
      type: String
    },
    phone: {
      type: String
    },
    relationship: {
      type: String
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
