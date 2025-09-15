import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const QUESTION_PAIRS_PATH = path.resolve(__dirname, '../data/question-pairs');

// Helper function to read all question-pairs JSON files
async function readAllQuestionPairs() {
  try {
    const files = await fs.readdir(QUESTION_PAIRS_PATH);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    const allQuestions = [];
    
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(QUESTION_PAIRS_PATH, file);
        const data = await fs.readFile(filePath, 'utf-8');
        const questions = JSON.parse(data);
        
        // Add each question to the collection
        if (Array.isArray(questions)) {
          allQuestions.push(...questions);
        }
      } catch (error) {
        console.error(`Error reading ${file}:`, error);
      }
    }
    
    return allQuestions;
  } catch (error) {
    console.error('Error reading question-pairs directory:', error);
    return [];
  }
}

// Helper function to normalize topics for comparison
function normalizeTopics(topics) {
  if (typeof topics === 'string') {
    return [topics.toLowerCase().trim()];
  }
  if (Array.isArray(topics)) {
    return topics.map(topic => topic.toLowerCase().trim());
  }
  return [];
}

// Helper function to check if question matches any of the requested topics
function questionMatchesTopics(question, requestedTopics) {
  const questionTopics = normalizeTopics(question.topic || question.topics);
  const normalizedRequestedTopics = normalizeTopics(requestedTopics);
  
  // Check if any of the question's topics match any of the requested topics
  return questionTopics.some(qTopic => 
    normalizedRequestedTopics.some(rTopic => 
      qTopic.includes(rTopic) || rTopic.includes(qTopic)
    )
  );
}

// Helper function to format question response
function formatQuestionResponse(question) {
  // Convert the JSON paths to actual accessible URLs
  const baseUrl = '/questions'; // This matches our static file serving
  
  let questionImageUrl = question.questionTifUrl || question.questionPngUrl;
  let solutionImageUrl = question.solutionTifUrl || question.solutionPngUrl;
  
  // Convert src/assets/questions/ paths to /questions/ URLs
  if (questionImageUrl) {
    questionImageUrl = questionImageUrl.replace('src/assets/questions/', baseUrl + '/');
  }
  if (solutionImageUrl) {
    solutionImageUrl = solutionImageUrl.replace('src/assets/questions/', baseUrl + '/');
  }
  
  return {
    id: question.id,
    name: question.name || question.id || 'Unknown', // Add name field using id as fallback
    topic: question.topic || question.topics,
    level: question.level,
    difficulty: question.difficulty,
    timeLimitMinute: question.timeLimitMinute,
    questionImageUrl,
    solutionImageUrl,
    tags: question.tags || [],
    complete: question.complete || false
  };
}

// POST /api/topics/questions - Get questions by topic list
// Body: { topics: ["algebra", "geometry"] } or { topics: "algebra" }
router.post('/questions', async (req, res) => {
  try {
    const { topics } = req.body;
    
    if (!topics) {
      return res.status(400).json({ 
        error: 'Topics parameter is required',
        message: 'Please provide a topics field with a string or array of topics'
      });
    }
    
    const allQuestions = await readAllQuestionPairs();
    
    if (allQuestions.length === 0) {
      return res.status(404).json({ 
        error: 'No questions found',
        message: 'No question files could be loaded'
      });
    }
    
    // Filter questions that match the requested topics
    const matchingQuestions = allQuestions.filter(question => 
      questionMatchesTopics(question, topics)
    );
    
    if (matchingQuestions.length === 0) {
      return res.json({ 
        message: 'No questions found for the specified topics',
        requestedTopics: topics,
        matchingQuestions: []
      });
    }
    
    // Format and return the matching questions
    const formattedQuestions = matchingQuestions.map(formatQuestionResponse);
    
    res.json({
      message: 'Questions found successfully',
      requestedTopics: topics,
      totalMatches: formattedQuestions.length,
      matchingQuestions: formattedQuestions
    });
    
  } catch (error) {
    console.error('Error in /topics/questions:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to retrieve questions'
    });
  }
});

// GET /api/topics/questions - Get questions by topic query params
// Query params: topics (comma-separated string)
router.get('/questions', async (req, res) => {
  try {
    const { topics } = req.query;
    
    if (!topics) {
      return res.status(400).json({ 
        error: 'Topics parameter is required',
        message: 'Please provide topics as a query parameter (comma-separated for multiple topics)'
      });
    }
    
    // Convert comma-separated string to array
    const topicsArray = topics.split(',').map(topic => topic.trim());
    
    // Use the same logic as POST endpoint
    const allQuestions = await readAllQuestionPairs();
    
    if (allQuestions.length === 0) {
      return res.status(404).json({ 
        error: 'No questions found',
        message: 'No question files could be loaded'
      });
    }
    
    const matchingQuestions = allQuestions.filter(question => 
      questionMatchesTopics(question, topicsArray)
    );
    
    if (matchingQuestions.length === 0) {
      return res.json({ 
        message: 'No questions found for the specified topics',
        requestedTopics: topicsArray,
        matchingQuestions: []
      });
    }
    
    const formattedQuestions = matchingQuestions.map(formatQuestionResponse);
    
    res.json({
      message: 'Questions found successfully',
      requestedTopics: topicsArray,
      totalMatches: formattedQuestions.length,
      matchingQuestions: formattedQuestions
    });
    
  } catch (error) {
    console.error('Error in GET /topics/questions:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to retrieve questions'
    });
  }
});

// GET /api/topics - Get list of all available topics (main endpoint)
router.get('/', async (req, res) => {
  try {
    const allQuestions = await readAllQuestionPairs();
    
    const topicsSet = new Set();
    
    allQuestions.forEach(question => {
      const questionTopics = normalizeTopics(question.topic || question.topics);
      questionTopics.forEach(topic => topicsSet.add(topic));
    });
    
    const availableTopics = Array.from(topicsSet).sort();
    
    res.json({
      message: 'Available topics retrieved successfully',
      totalTopics: availableTopics.length,
      topics: availableTopics
    });
    
  } catch (error) {
    console.error('Error in /topics:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to retrieve available topics'
    });
  }
});

// GET /api/topics/available - Get list of all available topics
router.get('/available', async (req, res) => {
  try {
    const allQuestions = await readAllQuestionPairs();
    
    const topicsSet = new Set();
    
    allQuestions.forEach(question => {
      const questionTopics = normalizeTopics(question.topic || question.topics);
      questionTopics.forEach(topic => topicsSet.add(topic));
    });
    
    const availableTopics = Array.from(topicsSet).sort();
    
    res.json({
      message: 'Available topics retrieved successfully',
      totalTopics: availableTopics.length,
      topics: availableTopics
    });
    
  } catch (error) {
    console.error('Error in /topics/available:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to retrieve available topics'
    });
  }
});

export default router;
