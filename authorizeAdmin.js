export const authorizeAdmin = (req, res, next) => {
  if (req.user?.is_admin !== true) {
    return res.status(403).json({ error: 'Administrator access is required.' });
  }

  return next();
};

export default authorizeAdmin;
