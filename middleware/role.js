const roleMiddleware = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied',
        details: `User role '${req.user.role}' is not authorized. Required roles: ${roles.join(', ')}`
      });
    }
    next();
  };
};

module.exports = roleMiddleware;