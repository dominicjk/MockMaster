import express from 'express';
import attemptsDb from '../database/attempts.js';

const router = express.Router();

/**
 * Middleware to check if user is authenticated
 */
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  next();
};

/**
 * POST /api/attempts
 * Save or update an attempt
 * Body: {
 *   questionId, timeTakenSeconds, notes, questionName,
 *   parentTopic, relatedTopics, difficulty, paper, year, questionType
 * }
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const {
      questionId,
      timeTakenSeconds,
      notes,
      questionName,
      parentTopic,
      relatedTopics,
      difficulty,
      paper,
      year,
      questionType
    } = req.body;

    // Validate required fields
    if (!questionId) {
      return res.status(400).json({ error: 'questionId is required' });
    }

    const attemptData = {
      userId,
      questionId,
      timeTakenSeconds: timeTakenSeconds || null,
      notes: notes || null,
      questionName: questionName || null,
      parentTopic: parentTopic || null,
      relatedTopics: relatedTopics || null,
      difficulty: difficulty || null,
      paper: paper || null,
      year: year || null,
      questionType: questionType || null
    };

    const savedAttempt = await attemptsDb.saveAttempt(attemptData);

    res.status(200).json({
      success: true,
      attempt: savedAttempt,
      message: 'Attempt saved successfully'
    });
  } catch (error) {
    console.error('Error in POST /api/attempts:', error);
    res.status(500).json({ 
      error: 'Failed to save attempt',
      message: error.message 
    });
  }
});

/**
 * GET /api/attempts
 * Get all attempts for the logged-in user
 * Query params: topic (optional), limit (optional), offset (optional)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { topic, limit, offset } = req.query;

    const options = {
      topic: topic || null,
      limit: limit ? parseInt(limit) : null,
      offset: offset ? parseInt(offset) : 0
    };

    const attempts = await attemptsDb.getUserAttempts(userId, options);

    res.status(200).json({
      success: true,
      attempts,
      count: attempts.length
    });
  } catch (error) {
    console.error('Error in GET /api/attempts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch attempts',
      message: error.message 
    });
  }
});

/**
 * GET /api/attempts/:questionId
 * Get a specific attempt
 */
router.get('/:questionId', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { questionId } = req.params;

    const attempt = await attemptsDb.getAttempt(userId, questionId);

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    res.status(200).json({
      success: true,
      attempt
    });
  } catch (error) {
    console.error(`Error in GET /api/attempts/${req.params.questionId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch attempt',
      message: error.message 
    });
  }
});

/**
 * PATCH /api/attempts/:questionId/notes
 * Update only the notes for an attempt
 * Body: { notes }
 */
router.patch('/:questionId/notes', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { questionId } = req.params;
    const { notes } = req.body;

    if (notes === undefined) {
      return res.status(400).json({ error: 'notes field is required' });
    }

    const updatedAttempt = await attemptsDb.updateAttemptNotes(userId, questionId, notes);

    res.status(200).json({
      success: true,
      attempt: updatedAttempt,
      message: 'Notes updated successfully'
    });
  } catch (error) {
    console.error(`Error in PATCH /api/attempts/${req.params.questionId}/notes:`, error);
    
    if (error.message === 'Attempt not found') {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    res.status(500).json({ 
      error: 'Failed to update notes',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/attempts/:questionId
 * Delete an attempt
 */
router.delete('/:questionId', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { questionId } = req.params;

    const deleted = await attemptsDb.deleteAttempt(userId, questionId);

    if (!deleted) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Attempt deleted successfully'
    });
  } catch (error) {
    console.error(`Error in DELETE /api/attempts/${req.params.questionId}:`, error);
    res.status(500).json({ 
      error: 'Failed to delete attempt',
      message: error.message 
    });
  }
});

/**
 * GET /api/attempts/stats/summary
 * Get statistics summary for the logged-in user
 */
router.get('/stats/summary', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const stats = await attemptsDb.getUserStats(userId);

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error in GET /api/attempts/stats/summary:', error);
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      message: error.message 
    });
  }
});

export default router;
