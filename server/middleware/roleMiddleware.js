const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    // Check if user is attached to request by authMiddleware
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'User authorization required'
      });
    }

    // Check if user role is permitted
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: role '${req.user.role}' is not authorized to access this resource`
      });
    }

    next();
  };
};

module.exports = {
  authorizeRoles
};
