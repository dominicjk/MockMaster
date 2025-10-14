// JWT + (optional future) OAuth authentication middleware & helpers
// This file intentionally keeps passport/google stubs light so core email + code login works without external providers.

import jwt from 'jsonwebtoken';
import UserModel from '../database/users.js';

const ACCESS_SECRET = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET || 'dev-access-secret-change';
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret-change';

// Token helpers -------------------------------------------------------------
export function generateTokens(userId) {
	const accessToken = jwt.sign({ sub: userId, type: 'access' }, ACCESS_SECRET, { expiresIn: '15m' });
	const refreshToken = jwt.sign({ sub: userId, type: 'refresh' }, REFRESH_SECRET, { expiresIn: '7d' });
	return { accessToken, refreshToken };
}

export function verifyRefreshToken(token) {
	try {
		const payload = jwt.verify(token, REFRESH_SECRET);
		if (payload.type !== 'refresh') throw new Error('Wrong token type');
		return payload.sub;
	} catch (e) {
		throw new Error('Invalid refresh token');
	}
}

// Middleware ----------------------------------------------------------------
export function verifyToken(req, res, next) {
	const token = req.cookies?.accessToken;
	if (!token) return res.status(401).json({ error: 'Not authenticated' });
	try {
		const payload = jwt.verify(token, ACCESS_SECRET);
		if (payload.type !== 'access') return res.status(401).json({ error: 'Invalid token' });
		req.userId = payload.sub;
		return next();
	} catch (e) {
		return res.status(401).json({ error: 'Invalid or expired token' });
	}
}

export function optionalAuth(req, _res, next) {
	const token = req.cookies?.accessToken;
	if (!token) return next();
	try {
		const payload = jwt.verify(token, ACCESS_SECRET);
		if (payload.type === 'access') req.userId = payload.sub;
	} catch {/* ignore */}
	next();
}

export async function loadUser(req, _res, next) {
	if (!req.userId) return next();
	try {
		const user = await UserModel.findUserById(req.userId);
		if (user) {
			req.user = {
				...user,
				email: UserModel.decryptEmail(user.email)
			};
		}
	} catch (e) {
		// swallow
	}
	next();
}

// Passport stub (only activated if Google creds provided & real passport strategy configured elsewhere)
// For now we provide minimal surface so existing route code does not crash if env vars absent.
const passportStub = {
	authenticate: () => (req, res, next) => next(),
	initialize: () => (req, res, next) => next(),
	session: () => (req, res, next) => next()
};

export default passportStub;
