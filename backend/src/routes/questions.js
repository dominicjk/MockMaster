import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const DATA_PATH = path.resolve(__dirname, '../../data/questions.json');

// Year ordering for filtering (newest to oldest)
const YEAR_ORDER = [
  '2024', '2024 Deferred', '2023', '2023 Deferred', '2022', '2022 Deferred', 
  '2021', '2020', '2019', '2018', '2017', '2016', '2015', '2014', '2014 Sample',
  '2013', '2012', '2012 Sample', '2011', '2010'
];

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

// GET /api/questions - Get random question(s) or by filters
// Query params: id, topic, level, difficulty, onlyIncomplete, examOnly, longOnly, shortOnly, yearFrom, yearTo, topics, count
router.get('/', async (req, res) => {
  try {
    const questions = await readAllQuestions();
    const { id, topic, level, difficulty, onlyIncomplete, examOnly, longOnly, shortOnly, yearFrom, yearTo, topics, count } = req.query;

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

    // Handle multiple topics (comma-separated)
    if (topics) {
      const topicList = topics.split(',').map(t => t.trim()).filter(t => t);
      if (topicList.length > 0) {
        filtered = filtered.filter(q => topicList.includes(q.topic));
      }
    }

    // Filter by exam questions only (ID starts with 1, e.g., stat-1001)
    if (examOnly === 'true') {
      filtered = filtered.filter(q => {
        const numericPart = q.id.split('-')[1];
        return numericPart && numericPart.startsWith('1');
      });
    }

    // Filter by long questions only (>15 minutes)
    if (longOnly === 'true') {
      filtered = filtered.filter(q => (q.timeLimitMinute || 0) > 15);
    }

    // Filter by short questions only (<=15 minutes)
    if (shortOnly === 'true') {
      filtered = filtered.filter(q => (q.timeLimitMinute || 0) <= 15);
    }

    // Filter by year range
    if (yearFrom || yearTo) {
      filtered = filtered.filter(q => {
        // Extract year from question name (e.g., "2010 P2 Question 19" -> "2010")
        const nameMatch = q.name?.match(/^(\d{4}(?:\s+\w+)?)/);
        if (!nameMatch) return false;
        
        const questionYear = nameMatch[1];
        const questionYearIndex = YEAR_ORDER.indexOf(questionYear);
        
        // If year not found in our order, try just the numeric part for basic validation
        if (questionYearIndex === -1) {
          const numericYear = questionYear.match(/^\d{4}/)?.[0];
          if (!numericYear || parseInt(numericYear) < 2010) {
            return false; // Too old or invalid, not in our supported range
          }
        }
        
        let withinRange = true;
        
        // Year range filtering: yearFrom (newer bound) to yearTo (older bound)
        // In YEAR_ORDER array: index 0 = newest (2024), higher index = older
        let yearFromIndex = -1, yearToIndex = -1;
        
        if (yearFrom) {
          yearFromIndex = YEAR_ORDER.indexOf(yearFrom);
        }
        if (yearTo) {
          yearToIndex = YEAR_ORDER.indexOf(yearTo);
        }
        
        // If both years are provided, ensure question is within the range
        if (yearFromIndex !== -1 && yearToIndex !== -1) {
          // Question must be between yearFrom and yearTo (inclusive)
          // questionYearIndex >= yearFromIndex (question is same year or older than yearFrom)
          // questionYearIndex <= yearToIndex (question is same year or newer than yearTo)
          if (questionYearIndex !== -1) {
            withinRange = withinRange && questionYearIndex >= yearFromIndex && questionYearIndex <= yearToIndex;
          } else {
            // Fallback to numeric comparison
            const numericQuestionYear = parseInt(questionYear.match(/^\d{4}/)?.[0] || '0');
            const numericYearFrom = parseInt(yearFrom.match(/^\d{4}/)?.[0] || '0');
            const numericYearTo = parseInt(yearTo.match(/^\d{4}/)?.[0] || '0');
            withinRange = withinRange && numericQuestionYear <= numericYearFrom && numericQuestionYear >= numericYearTo;
          }
        } else if (yearFromIndex !== -1) {
          // Only yearFrom provided - question must be same year or older
          if (questionYearIndex !== -1) {
            withinRange = withinRange && questionYearIndex >= yearFromIndex;
          } else {
            const numericQuestionYear = parseInt(questionYear.match(/^\d{4}/)?.[0] || '0');
            const numericYearFrom = parseInt(yearFrom.match(/^\d{4}/)?.[0] || '0');
            withinRange = withinRange && numericQuestionYear <= numericYearFrom;
          }
        } else if (yearToIndex !== -1) {
          // Only yearTo provided - question must be same year or newer
          if (questionYearIndex !== -1) {
            withinRange = withinRange && questionYearIndex <= yearToIndex;
          } else {
            const numericQuestionYear = parseInt(questionYear.match(/^\d{4}/)?.[0] || '0');
            const numericYearTo = parseInt(yearTo.match(/^\d{4}/)?.[0] || '0');
            withinRange = withinRange && numericQuestionYear >= numericYearTo;
          }
        }
        
        return withinRange;
      });
    }

    if (filtered.length === 0) {
      return res.status(404).json({ error: 'No questions found matching the criteria' });
    }

    // Handle count parameter for multiple questions
    const requestedCount = count ? parseInt(count) : 1;
    if (requestedCount > 1) {
      // Return multiple random questions (shuffled)
      const shuffled = [...filtered].sort(() => Math.random() - 0.5);
      const selectedQuestions = shuffled.slice(0, Math.min(requestedCount, shuffled.length));
      res.json(selectedQuestions.map(serializeQuestion));
    } else {
      // Return single random question (original behavior)
      const randomQuestion = filtered[Math.floor(Math.random() * filtered.length)];
      res.json(serializeQuestion(randomQuestion));
    }

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
