// Authentication removed: export no-op helpers so existing imports won't break.
export const generateTokens = () => ({ accessToken: null, refreshToken: null });
export const verifyToken = (req, res, next) => { next(); };
export const optionalAuth = (req, res, next) => { req.userId = null; next(); };
export const verifyRefreshToken = () => null;
export const loadUser = (req, res, next) => { req.user = null; next(); };
export default { initialize: () => (req,res,next)=>next(), session: () => (req,res,next)=>next() };
