import express from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { optionalAuth } from '../middleware/auth.js';
import UserModel from '../database/users.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
// Directory containing per-topic question pair JSON files
const PAIRS_PATH = path.resolve(__dirname, '../data/question-pairs');
console.log('[Config] PAIRS_PATH resolved to:', PAIRS_PATH);

// Year ordering for filtering (newest to oldest)
const YEAR_ORDER = [
  '2024', '2023', '2022', '2021', '2020',
  '2019', '2018', '2017', '2016', '2015',
  '2014', '2013', '2012', '2011', '2010'
];

// ...existing code...
async function readAllQuestions() {
  try {
    const topicFiles = await fs.readdir(PAIRS_PATH);
    const allQuestions = [];
    for (const topicFile of topicFiles) {
      if (!topicFile.endsWith('.json')) continue;
      const filePath = path.join(PAIRS_PATH, topicFile);
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        const questions = JSON.parse(data);
        console.log(`[Data Loading] Loaded ${questions.length} questions from ${topicFile}`);
        allQuestions.push(...questions);
      } catch (fileErr) {
        console.warn(`[Data Loading] Failed to load ${topicFile}:`, fileErr.message);
      }
    }
    console.log(`[Data Loading] Total questions loaded: ${allQuestions.length}`);
    return allQuestions;
  } catch (error) {
    console.error('[Data Loading] Error reading question-pairs directory:', error.message);
    return [];
  }
}

async function writeAllQuestions(questions) {
  // This function may need to be re-evaluated. For now, it's a no-op.
  console.warn('[Data Writing] writeAllQuestions is not implemented for multi-file structure and has been disabled.');
  return false;
  // try {
  //   await fs.writeFile(DATA_PATH, JSON.stringify(questions, null, 2));
  //   return true;
  // } catch (error) {
  //   console.error('Error writing questions:', error);
  //   return false;
  // }
}

function serializeQuestion(question) {
  // Respect existing URLs in JSON; only normalize their base prefix.
  const primaryTopic = Array.isArray(question.topic) ? (question.topic[0] || 'unknown') : (question.topic || 'unknown');

  const normalizeAssetPath = (p) => {
    if (!p) return null;
    if (p.startsWith('src/assets/questions/')) {
      return '/questions/' + p.substring('src/assets/questions/'.length);
    }
    // Already normalized or absolute
    if (p.startsWith('/questions/') || p.startsWith('http://') || p.startsWith('https://')) return p;
    return p; // leave any other relative path unchanged (frontend can decide)
  };

  const questionRaw = question.questionTifUrl || question.questionPngUrl || null;
  const solutionRaw = question.solutionTifUrl || question.solutionPngUrl || null;
  const questionUrl = normalizeAssetPath(questionRaw);
  const solutionUrl = normalizeAssetPath(solutionRaw);

  // Optional existence check (only if normalized points into /questions/)
  let existsQ = null, existsA = null;
  if (questionUrl && questionUrl.startsWith('/questions/')) {
    const rel = questionUrl.substring('/questions/'.length); // e.g. algebra/questions/alg-1001.png
    const fsPath = path.resolve(__dirname, '../data/questions', rel);
    existsQ = fsSync.existsSync(fsPath);
  }
  if (solutionUrl && solutionUrl.startsWith('/questions/')) {
    const rel = solutionUrl.substring('/questions/'.length);
    const fsPath = path.resolve(__dirname, '../data/questions', rel);
    existsA = fsSync.existsSync(fsPath);
  }
  console.log(`[Serialize] ${question.id} topic=${primaryTopic} qUrl=${questionUrl} sUrl=${solutionUrl} existsQ=${existsQ} existsA=${existsA}`);

  return {
    ...question,
    topic: question.topic, // preserve original (array or string)
    questionTifUrl: questionUrl || question.questionTifUrl || null,
    solutionTifUrl: solutionUrl || question.solutionTifUrl || null,
    questionPngUrl: questionUrl || question.questionPngUrl || null,
    solutionPngUrl: solutionUrl || question.solutionPngUrl || null,
    timeLimitSeconds: Math.max(0, Math.floor((question.timeLimitMinute || 0) * 60))
  };
}

// Attach optional auth to enrich completion status
router.use(optionalAuth);

// GET /api/questions - Get random question(s) or by filters
// Query params: id, topic, level, difficulty, onlyIncomplete, examOnly, longOnly, shortOnly, yearFrom, yearTo, topics, count
router.get('/', async (req, res) => {
  console.log(`[API Request] Received request for /api/questions with query:`, req.query);
  try {
    const questions = await readAllQuestions();
    const { id, topic, level, difficulty, onlyIncomplete, examOnly, longOnly, shortOnly, yearFrom, yearTo, topics, count } = req.query;

    // Direct ID lookup
    if (id) {
      const question = questions.find(q => q.id === id);
      if (!question) {
        console.log(`[API Response] Question with ID ${id} not found.`);
        return res.status(404).json({ error: 'Question not found' });
      }
      
      // Add cache headers for individual questions
      res.set({
        'Cache-Control': 'public, max-age=600, s-maxage=1200', // 10 minutes client, 20 minutes proxy
        'ETag': `"question-${id}-${Date.now()}"`,
        'Last-Modified': new Date().toUTCString()
      });
      
      const serialized = serializeQuestion(question);
      if (req.userId) {
        serialized.completedForUser = await UserModel.hasCompleted(req.userId, question.id);
      }
      console.log(`[API Response] Found and serving question ${id}:`, serialized);
      return res.json(serialized);
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
      const result = await Promise.all(selectedQuestions.map(async q => {
        const s = serializeQuestion(q);
        if (req.userId) s.completedForUser = await UserModel.hasCompleted(req.userId, q.id);
        return s;
      }));
      res.json(result);
    } else {
      // Return single random question (original behavior)
      const randomQuestion = filtered[Math.floor(Math.random() * filtered.length)];
      const s = serializeQuestion(randomQuestion);
      if (req.userId) s.completedForUser = await UserModel.hasCompleted(req.userId, randomQuestion.id);
      res.json(s);
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

// GET /api/questions/stats - lightweight counts per topic for progress bars
router.get('/stats', async (req, res) => {
  try {
    const questions = await readAllQuestions();
    const counts = {};
    for (const q of questions) {
      // Topic may be array or string
      const topics = Array.isArray(q.topic) ? q.topic : [q.topic];
      topics.filter(Boolean).forEach(t => {
        counts[t] = (counts[t] || 0) + 1;
      });
    }
    res.set({
      'Cache-Control': 'public, max-age=300, s-maxage=600'
    });
    res.json({ total: questions.length, topics: counts });
  } catch (error) {
    console.error('Error in GET /questions/stats:', error);
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
    
    const s = serializeQuestion(question);
    if (req.userId) s.completedForUser = await UserModel.hasCompleted(req.userId, question.id);
    res.json(s);
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
