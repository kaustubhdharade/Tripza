const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const bcrypt = require('bcryptjs');

async function testRegister() {
  try {
    console.log("Connecting to MongoDB...");
    const connStr = process.env.MONGO_URI || 'mongodb://localhost:27017/tripza';
    await mongoose.connect(connStr);
    console.log("MongoDB connected.");

    const testEmail = `testuser_${Date.now()}@example.com`;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    const user = await User.create({
      name: 'Test Passenger',
      email: testEmail,
      password: hashedPassword,
      role: 'passenger',
      userType: 'college_student',
      mis: 'MIS123456',
      emergencyContact: {
        name: 'Parent Name',
        phone: '9876543210',
        relationship: 'Parent'
      }
    });

    console.log("Registration successful! Created User ID:", user._id);
    await mongoose.disconnect();
    console.log("MongoDB disconnected. TEST PASSED.");
  } catch (err) {
    console.error("Test Register Failed:", err);
    process.exit(1);
  }
}

testRegister();
