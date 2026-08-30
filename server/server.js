const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const locationRoutes = require('./routes/locationRoutes');
const rideRoutes = require('./routes/rideRoutes');


const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/rides', rideRoutes);


app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Tripza backend is running'
  });
});

app.listen(PORT, () => {
  console.log(`Tripza backend server running on port ${PORT}`);
});
