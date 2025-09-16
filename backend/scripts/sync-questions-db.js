import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const QUESTIONS_DIR = path.resolve(__dirname, '../src/data/questions');
const OUTPUT_FILE = path.resolve(__dirname, '../data/questions.json');

// Topic mapping from folder names to display names
const topicMapping = {
  'algebra': 'algebra',
  'algebra-functions-differentiation-integration': 'algebra-functions-differentiation-integration',
  'complex-numbers': 'complex-numbers',
  'differentiation': 'differentiation',
  'financial-mathematics': 'financial-mathematics',
  'functions': 'functions',
  'geometry': 'geometry',
  'induction': 'induction',
  'integration': 'integration',
  'number-systems': 'number-systems',
  'prob-stat': 'prob-stat',
  'probability': 'probability',
  'sequences-and-series': 'sequences-and-series',
  'statistics': 'statistics',
  'the-circle': 'the-circle',
  'the-line': 'the-line',
  'trigonometry': 'trigonometry'
};

// Parse question ID to extract details
function parseQuestionId(filename, topicFolder) {
  const baseId = filename.replace('.png', '');
  
  // Determine difficulty based on ID number range (you can adjust this logic)
  const match = baseId.match(/(\d+)$/);
  const number = match ? parseInt(match[1]) : 1001;
  
  let difficulty = 1; // Default easy
  if (number >= 1010 && number < 1020) difficulty = 2; // Medium
  if (number >= 1020) difficulty = 3; // Hard
  
  // Determine level - defaulting to 'lc' (leaving cert) for now
  // You can adjust this based on your numbering system
  const level = 'lc';
  
  return {
    id: baseId,
    difficulty,
    level,
    number
  };
}

// Get estimated time limit based on difficulty
function getTimeLimit(difficulty) {
  switch (difficulty) {
    case 1: return 3; // Easy: 3 minutes
    case 2: return 5; // Medium: 5 minutes  
    case 3: return 8; // Hard: 8 minutes
    default: return 3;
  }
}

// Generate default tags based on topic
function generateTags(topicFolder, questionId) {
  const baseTags = {
    'algebra': ['algebra', 'equations'],
    'geometry': ['geometry', 'shapes'],
    'trigonometry': ['trigonometry', 'angles'],
    'functions': ['functions', 'graphs'],
    'complex-numbers': ['complex-numbers', 'imaginary'],
    'differentiation': ['calculus', 'differentiation'],
    'integration': ['calculus', 'integration'],
    'probability': ['probability', 'statistics'],
    'statistics': ['statistics', 'data'],
    'sequences-and-series': ['sequences', 'series'],
    'the-circle': ['geometry', 'circle'],
    'the-line': ['geometry', 'coordinate-geometry']
  };
  
  return baseTags[topicFolder] || [topicFolder];
}

async function scanQuestionsDirectory() {
  console.log('🔍 Scanning questions directory...');
  
  const questions = [];
  const topics = await fs.readdir(QUESTIONS_DIR);
  
  for (const topicFolder of topics) {
    const topicPath = path.join(QUESTIONS_DIR, topicFolder);
    const stat = await fs.stat(topicPath);
    
    if (!stat.isDirectory()) continue;
    
    console.log(`📁 Processing topic: ${topicFolder}`);
    
    // Check if questions subfolder exists
    const questionsPath = path.join(topicPath, 'questions');
    try {
      const questionFiles = await fs.readdir(questionsPath);
      const pngFiles = questionFiles.filter(file => file.endsWith('.png'));
      
      console.log(`   Found ${pngFiles.length} PNG files`);
      
      for (const filename of pngFiles) {
        const parsedInfo = parseQuestionId(filename, topicFolder);
        
        // Check if corresponding answer file exists
        const answerFilename = filename.replace('.png', '-ans.png');
        const answersPath = path.join(topicPath, 'answers');
        let hasAnswer = false;
        
        try {
          await fs.access(path.join(answersPath, answerFilename));
          hasAnswer = true;
        } catch (e) {
          // Answer file doesn't exist, that's ok
        }
        
        const question = {
          id: parsedInfo.id,
          "question-type": "custom",
          topic: topicMapping[topicFolder] || topicFolder,
          level: parsedInfo.level,
          difficulty: parsedInfo.difficulty,
          timeLimitMinute: getTimeLimit(parsedInfo.difficulty),
          questionTifUrl: `/questions/${topicFolder}/questions/${filename}`,
          solutionTifUrl: hasAnswer ? `/questions/${topicFolder}/answers/${answerFilename}` : null,
          tags: generateTags(topicFolder, parsedInfo.id),
          complete: false
        };
        
        questions.push(question);
      }
    } catch (error) {
      console.log(`   ⚠️  No questions folder found for ${topicFolder}`);
    }
  }
  
  console.log(`✅ Found ${questions.length} total questions`);
  return questions;
}

async function main() {
  try {
    console.log('🚀 Starting questions database synchronization...');
    
    // Scan all question files
    const questions = await scanQuestionsDirectory();
    
    // Sort questions by topic and then by ID
    questions.sort((a, b) => {
      if (a.topic !== b.topic) {
        return a.topic.localeCompare(b.topic);
      }
      return a.id.localeCompare(b.id);
    });
    
    // Write to file
    console.log(`💾 Writing ${questions.length} questions to ${OUTPUT_FILE}`);
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(questions, null, 2));
    
    // Summary statistics
    const topicCounts = {};
    questions.forEach(q => {
      topicCounts[q.topic] = (topicCounts[q.topic] || 0) + 1;
    });
    
    console.log('\n📊 Summary by topic:');
    Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([topic, count]) => {
        console.log(`   ${topic}: ${count} questions`);
      });
    
    console.log('\n🎉 Database synchronization complete!');
    console.log('\nNext steps:');
    console.log('1. Review the generated questions.json file');
    console.log('2. Adjust difficulty levels, time limits, and tags as needed');
    console.log('3. Test the API endpoints with real question IDs');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();