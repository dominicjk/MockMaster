import pool from '../config/database.js';

/**
 * Database service for managing question attempts
 */
class AttemptsDatabase {
  /**
   * Save or update an attempt for a user
   * @param {Object} attemptData - The attempt data
   * @param {string} attemptData.userId - User ID
   * @param {string} attemptData.questionId - Question ID (e.g., 'alg-0007')
   * @param {number|null} attemptData.timeTakenSeconds - Time taken in seconds
   * @param {string|null} attemptData.notes - User notes (max 500 chars)
   * @param {string|null} attemptData.questionName - Question name
   * @param {string|null} attemptData.parentTopic - Parent topic
   * @param {string[]|null} attemptData.relatedTopics - Array of related topics
   * @param {string|null} attemptData.difficulty - Difficulty level
   * @param {string|null} attemptData.paper - Paper (P1/P2)
   * @param {string|null} attemptData.year - Year
   * @param {string|null} attemptData.questionType - Question type (state/custom)
   * @returns {Promise<Object>} The saved attempt
   */
  async saveAttempt(attemptData) {
    const {
      userId,
      questionId,
      timeTakenSeconds = null,
      notes = null,
      questionName = null,
      parentTopic = null,
      relatedTopics = null,
      difficulty = null,
      paper = null,
      year = null,
      questionType = null
    } = attemptData;

    // Validate required fields
    if (!userId || !questionId) {
      throw new Error('userId and questionId are required');
    }

    // Trim notes to 500 characters if provided
    const trimmedNotes = notes ? notes.substring(0, 500) : null;

    const query = `
      INSERT INTO attempts (
        user_id, question_id, time_taken_seconds, notes,
        question_name, parent_topic, related_topics, difficulty,
        paper, year, question_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_id, question_id) 
      DO UPDATE SET
        time_taken_seconds = EXCLUDED.time_taken_seconds,
        notes = EXCLUDED.notes,
        question_name = EXCLUDED.question_name,
        parent_topic = EXCLUDED.parent_topic,
        related_topics = EXCLUDED.related_topics,
        difficulty = EXCLUDED.difficulty,
        paper = EXCLUDED.paper,
        year = EXCLUDED.year,
        question_type = EXCLUDED.question_type,
        last_updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      userId,
      questionId,
      timeTakenSeconds,
      trimmedNotes,
      questionName,
      parentTopic,
      relatedTopics, // PostgreSQL will handle array conversion
      difficulty,
      paper,
      year,
      questionType
    ];

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error saving attempt:', error);
      throw new Error('Failed to save attempt to database');
    }
  }

  /**
   * Update only the notes for an existing attempt
   * @param {string} userId - User ID
   * @param {string} questionId - Question ID
   * @param {string} notes - Updated notes (max 500 chars)
   * @returns {Promise<Object>} The updated attempt
   */
  async updateAttemptNotes(userId, questionId, notes) {
    if (!userId || !questionId) {
      throw new Error('userId and questionId are required');
    }

    // Trim notes to 500 characters
    const trimmedNotes = notes ? notes.substring(0, 500) : null;

    const query = `
      UPDATE attempts
      SET notes = $1, last_updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2 AND question_id = $3
      RETURNING *
    `;

    const values = [trimmedNotes, userId, questionId];

    try {
      const result = await pool.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Attempt not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error updating attempt notes:', error);
      throw new Error('Failed to update attempt notes');
    }
  }

  /**
   * Get all attempts for a user, ordered by most recent first
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @param {string|null} options.topic - Filter by parent topic
   * @param {number|null} options.limit - Limit number of results
   * @param {number|null} options.offset - Offset for pagination
   * @returns {Promise<Array>} Array of attempts
   */
  async getUserAttempts(userId, options = {}) {
    if (!userId) {
      throw new Error('userId is required');
    }

    const { topic = null, limit = null, offset = 0 } = options;

    let query = `
      SELECT 
        id, user_id, question_id, time_taken_seconds, notes,
        question_name, parent_topic, related_topics, difficulty,
        paper, year, question_type, completed_at, last_updated_at
      FROM attempts
      WHERE user_id = $1
    `;

    const values = [userId];
    let paramIndex = 2;

    // Add topic filter if provided
    if (topic) {
      query += ` AND parent_topic = $${paramIndex}`;
      values.push(topic);
      paramIndex++;
    }

    // Order by most recent first
    query += ` ORDER BY completed_at DESC`;

    // Add pagination if limit provided
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      values.push(limit);
      paramIndex++;
    }

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      values.push(offset);
    }

    try {
      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error fetching user attempts:', error);
      throw new Error('Failed to fetch attempts from database');
    }
  }

  /**
   * Get a single attempt by user ID and question ID
   * @param {string} userId - User ID
   * @param {string} questionId - Question ID
   * @returns {Promise<Object|null>} The attempt or null if not found
   */
  async getAttempt(userId, questionId) {
    if (!userId || !questionId) {
      throw new Error('userId and questionId are required');
    }

    const query = `
      SELECT 
        id, user_id, question_id, time_taken_seconds, notes,
        question_name, parent_topic, related_topics, difficulty,
        paper, year, question_type, completed_at, last_updated_at
      FROM attempts
      WHERE user_id = $1 AND question_id = $2
    `;

    try {
      const result = await pool.query(query, [userId, questionId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error fetching attempt:', error);
      throw new Error('Failed to fetch attempt from database');
    }
  }

  /**
   * Delete an attempt
   * @param {string} userId - User ID
   * @param {string} questionId - Question ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteAttempt(userId, questionId) {
    if (!userId || !questionId) {
      throw new Error('userId and questionId are required');
    }

    const query = `
      DELETE FROM attempts
      WHERE user_id = $1 AND question_id = $2
      RETURNING id
    `;

    try {
      const result = await pool.query(query, [userId, questionId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting attempt:', error);
      throw new Error('Failed to delete attempt from database');
    }
  }

  /**
   * Get attempt statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Statistics object
   */
  async getUserStats(userId) {
    if (!userId) {
      throw new Error('userId is required');
    }

    const query = `
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(DISTINCT parent_topic) as topics_count,
        AVG(time_taken_seconds) FILTER (WHERE time_taken_seconds IS NOT NULL) as avg_time_seconds,
        COUNT(*) FILTER (WHERE difficulty = 'easy') as easy_count,
        COUNT(*) FILTER (WHERE difficulty = 'medium') as medium_count,
        COUNT(*) FILTER (WHERE difficulty = 'hard') as hard_count,
        COUNT(*) FILTER (WHERE difficulty = 'very hard') as very_hard_count,
        COUNT(*) FILTER (WHERE question_type = 'state') as state_count,
        COUNT(*) FILTER (WHERE question_type = 'custom') as custom_count
      FROM attempts
      WHERE user_id = $1
    `;

    try {
      const result = await pool.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching user stats:', error);
      throw new Error('Failed to fetch user statistics');
    }
  }
}

// Export singleton instance
export default new AttemptsDatabase();
