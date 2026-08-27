const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, userType, mis, emergencyContact } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role || !userType) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, password, role, and userType'
      });
    }

    // Validate userType enum
    const validUserTypes = ['college_student', 'outsider'];
    if (!validUserTypes.includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userType. Must be either "college_student" or "outsider"'
      });
    }

    // Validate role enum
    const validRoles = ['passenger', 'driver', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be "passenger", "driver", or "admin"'
      });
    }

    // Validate conditional requirements for college_student
    if (userType === 'college_student') {
      if (!mis) {
        return res.status(400).json({
          success: false,
          message: 'MIS is required for college_student userType'
        });
      }
    }

    // Validate emergencyContact requirement
    if (
      !emergencyContact ||
      !emergencyContact.name ||
      !emergencyContact.phone ||
      !emergencyContact.relationship
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide complete emergencyContact details: name, phone, and relationship'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Hash password using bcryptjs
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user with hashed password and additional fields
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      userType,
      mis: userType === 'college_student' ? mis : undefined,
      emergencyContact
    });

    // Return created user details without password
    res.status(201).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        userType: user.userType,
        mis: user.mis,
        emergencyContact: user.emergencyContact
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration'
    });
  }
};

// @desc    Authenticate / Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email and password inputs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Compare password with stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token containing userId and role
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Return token and user details without password
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during login'
    });
  }
};

// @desc    Get current authenticated user payload
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user
  });
};

module.exports = {
  registerUser,
  loginUser,
  getMe
};
