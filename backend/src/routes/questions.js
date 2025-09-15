import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const DATA_PATH = path.resolve(__dirname, '../../data/questions.json');

// Helper functions
async function readAllQuestions() {
  try {
    const data = await fs.readFile(DATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading questions:', error);
    return [];
  }
}

async function writeAllQuestions(questions) {
  try {
    await fs.writeFile(DATA_PATH, JSON.stringify(questions, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing questions:', error);
    return false;
  }
}

function serializeQuestion(question) {
  return {
    ...question,
    questionTifUrl: question.questionTifUrl || question.questionPngUrl,
    solutionTifUrl: question.solutionTifUrl || question.solutionPngUrl,
    questionPngUrl: question.questionPngUrl || question.questionTifUrl,
    solutionPngUrl: question.solutionPngUrl || question.solutionTifUrl,
    timeLimitSeconds: Math.max(0, Math.floor((question.timeLimitMinute || 0) * 60))
  };
}

// GET /api/questions - Get random question or by filters
// Query params: id, topic, level, difficulty, onlyIncomplete
router.get('/', async (req, res) => {
  try {
    const questions = await readAllQuestions();
    const { id, topic, level, difficulty, onlyIncomplete } = req.query;

    // Direct ID lookup
    if (id) {
      const question = questions.find(q => q.id === id);
      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }
      
      // Add cache headers for individual questions
      res.set({
        'Cache-Control': 'public, max-age=600, s-maxage=1200', // 10 minutes client, 20 minutes proxy
        'ETag': `"question-${id}-${Date.now()}"`,
        'Last-Modified': new Date().toUTCString()
      });
      
      return res.json(serializeQuestion(question));
    }

    // Filter questions
    let filtered = [...questions];
    
    if (topic) {
      filtered = filtered.filter(q => q.topic === topic);
    }
    
    if (level) {
      filtered = filtered.filter(q => q.level === level);
    }
    
    if (difficulty) {
      filtered = filtered.filter(q => String(q.difficulty) === String(difficulty));
    }
    
    if (onlyIncomplete === 'true') {
      filtered = filtered.filter(q => !q.complete);
    }

    if (filtered.length === 0) {
      return res.status(404).json({ error: 'No questions found matching the criteria' });
    }

    // Return random question from filtered set
    const randomQuestion = filtered[Math.floor(Math.random() * filtered.length)];
    res.json(serializeQuestion(randomQuestion));

  } catch (error) {
    console.error('Error in GET /questions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/questions/all - Get all questions (for admin/debug)
router.get('/all', async (req, res) => {
  try {
    // Add cache headers for better browser caching
    res.set({
      'Cache-Control': 'public, max-age=300, s-maxage=600', // 5 minutes client, 10 minutes proxy
      'ETag': `"questions-${Date.now()}"`,
      'Last-Modified': new Date().toUTCString()
    });
    
    const questions = await readAllQuestions();
    res.json(questions.map(serializeQuestion));
  } catch (error) {
    console.error('Error in GET /questions/all:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/questions/:id - Get specific question
router.get('/:id', async (req, res) => {
  try {
    const questions = await readAllQuestions();
    const question = questions.find(q => q.id === req.params.id);
    
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    res.json(serializeQuestion(question));
  } catch (error) {
    console.error('Error in GET /questions/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/questions/:id - Update question (mark complete, etc.)
router.patch('/:id', async (req, res) => {
  try {
    const questions = await readAllQuestions();
    const questionIndex = questions.findIndex(q => q.id === req.params.id);
    
    if (questionIndex === -1) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Update allowed fields
    const { complete } = req.body;
    if (typeof complete === 'boolean') {
      questions[questionIndex].complete = complete;
    }

    const success = await writeAllQuestions(questions);
    if (!success) {
      return res.status(500).json({ error: 'Failed to update question' });
    }

    res.json(serializeQuestion(questions[questionIndex]));
  } catch (error) {
    console.error('Error in PATCH /questions/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/questions/reset - Reset all questions to incomplete
router.post('/reset', async (req, res) => {
  try {
    const questions = await readAllQuestions();
    questions.forEach(q => q.complete = false);
    
    const success = await writeAllQuestions(questions);
    if (!success) {
      return res.status(500).json({ error: 'Failed to reset questions' });
    }

    res.json({ message: 'All questions reset to incomplete', count: questions.length });
  } catch (error) {
    console.error('Error in POST /questions/reset:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
