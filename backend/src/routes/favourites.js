// backend/src/routes/favourites.js
import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Get all favourites for the authenticated user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    
    const result = await pool.query(
      `SELECT 
        id,
        question_id,
        question_name,
        parent_topic,
        difficulty,
        paper,
        year,
        question_type,
        created_at
      FROM favourites 
      WHERE user_id = $1 
      ORDER BY created_at DESC`,
      [userId]
    );
    
    res.json({ favourites: result.rows });
  } catch (error) {
    console.error('Error fetching favourites:', error);
    res.status(500).json({ error: 'Failed to fetch favourites' });
  }
});

// Check if a specific question is favourited
router.get('/check/:questionId', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { questionId } = req.params;
    
    const result = await pool.query(
      'SELECT EXISTS(SELECT 1 FROM favourites WHERE user_id = $1 AND question_id = $2) as is_favourite',
      [userId, questionId]
    );
    
    res.json({ isFavourite: result.rows[0].is_favourite });
  } catch (error) {
    console.error('Error checking favourite:', error);
    res.status(500).json({ error: 'Failed to check favourite' });
  }
});

// Add a question to favourites
router.post('/add', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { 
      questionId, 
      questionName, 
      parentTopic, 
      difficulty, 
      paper, 
      year, 
      questionType 
    } = req.body;
    
    console.log('⭐ [POST /add] Request received:', {
      userId,
      questionId,
      questionName,
      parentTopic,
      difficulty,
      paper,
      year,
      questionType
    });
    
    if (!questionId) {
      console.log('❌ [POST /add] Missing questionId');
      return res.status(400).json({ error: 'Question ID is required' });
    }
    
    // Insert or ignore if already exists
    console.log('💾 [POST /add] Inserting into database...');
    const result = await pool.query(
      `INSERT INTO favourites (
        user_id, 
        question_id, 
        question_name, 
        parent_topic, 
        difficulty, 
        paper, 
        year, 
        question_type
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, question_id) DO NOTHING
      RETURNING *`,
      [userId, questionId, questionName, parentTopic, difficulty, paper, year, questionType]
    );
    
    if (result.rows.length > 0) {
      console.log('✅ [POST /add] Successfully added to favourites:', result.rows[0]);
      res.json({ 
        success: true, 
        message: 'Question added to favourites',
        favourite: result.rows[0]
      });
    } else {
      console.log('ℹ️ [POST /add] Question already in favourites');
      res.json({ 
        success: true, 
        message: 'Question already in favourites'
      });
    }
  } catch (error) {
    console.error('❌ [POST /add] Error adding favourite:', error);
    res.status(500).json({ error: 'Failed to add favourite' });
  }
});

// Remove a question from favourites
router.delete('/remove/:questionId', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { questionId } = req.params;
    
    console.log('🗑️ [DELETE /remove] Request received:', { userId, questionId });
    
    const result = await pool.query(
      'DELETE FROM favourites WHERE user_id = $1 AND question_id = $2 RETURNING *',
      [userId, questionId]
    );
    
    if (result.rows.length > 0) {
      console.log('✅ [DELETE /remove] Successfully removed from favourites');
      res.json({ 
        success: true, 
        message: 'Question removed from favourites'
      });
    } else {
      res.status(404).json({ error: 'Favourite not found' });
    }
  } catch (error) {
    console.error('Error removing favourite:', error);
    res.status(500).json({ error: 'Failed to remove favourite' });
  }
});

// Get favourites count by topic
router.get('/stats/by-topic', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    
    const result = await pool.query(
      `SELECT parent_topic, COUNT(*) as count
      FROM favourites 
      WHERE user_id = $1 
      GROUP BY parent_topic
      ORDER BY count DESC`,
      [userId]
    );
    
    res.json({ stats: result.rows });
  } catch (error) {
    console.error('Error fetching favourite stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
