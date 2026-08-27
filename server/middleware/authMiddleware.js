const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  let token;

  // Read Authorization header formatted as: Bearer <token>
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Return 401 if token is missing
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided, authorization denied'
    });
  }

  try {
    // Verify token using JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach decoded user data to req.user
    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

module.exports = {
  protect
};
