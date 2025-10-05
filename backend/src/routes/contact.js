import { Router } from 'express';
import EmailService from '../services/emailService.js';

const router = Router();

// Basic rate limiting per IP in-memory (lightweight); for heavy use consider dedicated store
const recentMap = new Map(); // ip -> { count, ts }
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_PER_WINDOW = 10;

router.post('/', async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = recentMap.get(ip) || { count: 0, ts: now };
    if (now - entry.ts > WINDOW_MS) { entry.count = 0; entry.ts = now; }
    entry.count += 1; recentMap.set(ip, entry);
    if (entry.count > MAX_PER_WINDOW) {
      return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
    }

    const { name, email, subject, message } = req.body || {};
    if (!email || !message || !name || !subject) {
      return res.status(400).json({ error: 'Missing required fields (name, email, subject, message).' });
    }
    if (String(message).length > 5000) {
      return res.status(413).json({ error: 'Message too long (max 5000 chars).' });
    }
    // Primitive email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    try {
      const result = await EmailService.sendContactEmail({
        name: String(name).trim().slice(0, 120),
        fromEmail: String(email).trim().slice(0, 200),
        subject: String(subject).trim().slice(0, 200),
        message: String(message).trim()
      });
      res.json({ ok: true, delivered: !result.skipped, skipped: !!result.skipped });
    } catch (err) {
      res.status(500).json({ error: 'Failed to send message.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Unexpected error.' });
  }
});

export default router;