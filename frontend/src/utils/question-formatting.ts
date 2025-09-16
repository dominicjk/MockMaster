// Shared utility functions for question formatting across the application

export interface DifficultyConfig {
  label: string;
  color: string;
}

export interface DifficultyMapping {
  [key: number]: DifficultyConfig;
}

// Difficulty mapping configuration
export const difficultyConfig: DifficultyMapping = {
  1: { label: 'Easy', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  2: { label: 'Medium', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  3: { label: 'Hard', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' }
};

/**
 * Formats a difficulty value (number or string) into a normalized difficulty object
 * @param difficulty - Raw difficulty value from API (can be number, string, or undefined)
 * @returns DifficultyConfig object with label and color classes
 */
export function formatDifficulty(difficulty: number | string | undefined): DifficultyConfig {
  // Normalize the difficulty to a valid number (1, 2, or 3)
  const difficultyValue = difficulty || 1;
  const difficultyNum = typeof difficultyValue === 'string' ? parseInt(difficultyValue) || 1 : difficultyValue;
  const normalizedDifficulty = Math.min(Math.max(difficultyNum, 1), 3) as 1 | 2 | 3;
  
  return difficultyConfig[normalizedDifficulty];
}

/**
 * Formats a topic name into a properly capitalized and formatted string
 * @param topic - Raw topic name from API
 * @returns Formatted topic name
 */
export function formatTopicName(topic: string | number | undefined | null): string {
  if (!topic) return '';
  
  const topicStr = String(topic).toLowerCase();
  
  // Special case mappings
  const specialMappings: { [key: string]: string } = {
    'sequences-and-series': 'Sequences & Series',
    'sequences-series': 'Sequences & Series',
    'sequences and series': 'Sequences & Series',
    'prob-stat': 'Probability-Statistics',
    'probability-statistics': 'Probability-Statistics',
    'prob stat': 'Probability-Statistics',
    'the-line': 'The Line',
    'complex-numbers': 'Complex Numbers',
    'complex numbers': 'Complex Numbers',
    'financial-maths': 'Financial Maths',
    'financial maths': 'Financial Maths',
    'compound-interest': 'Compound Interest',
    'compound interest': 'Compound Interest',
    'mathematical-induction': 'Mathematical Induction',
    'mathematical induction': 'Mathematical Induction',
    'proof-by-induction': 'Proof by Induction',
    'proof by induction': 'Proof by Induction',
    'differentiation': 'Differentiation',
    'integration': 'Integration',
    'algebra': 'Algebra',
    'geometry': 'Geometry',
    'trigonometry': 'Trigonometry',
    'statistics': 'Statistics',
    'probability': 'Probability',
    'the-circle': 'The Circle',
    'functions': 'Functions',
    'induction': 'Induction',
    'number': 'Number'
  };
  
  // Check for exact matches first
  if (specialMappings[topicStr]) {
    return specialMappings[topicStr];
  }
  
  // Check for partial matches
  for (const [key, value] of Object.entries(specialMappings)) {
    if (topicStr.includes(key) || key.includes(topicStr)) {
      return value;
    }
  }
  
  // Default formatting: capitalize each word and replace dashes/underscores with spaces
  return topicStr
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
