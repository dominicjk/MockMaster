import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import UserModel from '../database/users.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const QUESTION_PAIRS_PATH = path.resolve(__dirname, '../data/question-pairs');

const router = express.Router();

async function loadAllQuestionsIndex() {
  const files = await fs.readdir(QUESTION_PAIRS_PATH);
  const index = new Map();
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const data = JSON.parse(await fs.readFile(path.join(QUESTION_PAIRS_PATH, f), 'utf-8'));
      for (const q of data) {
        index.set(q.id, q);
      }
    } catch (e) {
      console.warn('[Progress] Failed loading', f, e.message);
    }
  }
  return index;
}

// Save / update attempt
router.post('/:questionId/attempt', verifyToken, async (req, res) => {
  try {
    const { questionId } = req.params;
    const { timeTakenSeconds, notes } = req.body || {};
    const attempt = await UserModel.addOrUpdateAttempt(req.userId, { questionId, timeTakenSeconds, notes });
    res.json({ success: true, attempt });
  } catch (e) {
    console.error('Error saving attempt', e);
    res.status(500).json({ error: 'Failed to save attempt' });
  }
});

// List attempts (raw)
router.get('/attempts', verifyToken, async (req, res) => {
  try {
    const attempts = await UserModel.getAttempts(req.userId);
    res.json({ attempts });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load attempts' });
  }
});

// Completed questions with question metadata
router.get('/completed', verifyToken, async (req, res) => {
  try {
    const attempts = await UserModel.getAttempts(req.userId);
    if (attempts.length === 0) return res.json({ attempts: [] });
    const index = await loadAllQuestionsIndex();
    const enriched = attempts.map(a => ({
      ...a,
      question: index.get(a.questionId) || null
    }));
    res.json({ attempts: enriched, total: enriched.length });
  } catch (e) {
    console.error('Error loading completed questions', e);
    res.status(500).json({ error: 'Failed to load completed questions' });
  }
});

export default router;
