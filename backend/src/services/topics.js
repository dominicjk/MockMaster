// Topic normalization, aliasing, and bundle expansion utilities
// Centralizes logic so routes can remain simple.

// Aliases map to canonical topic names (all lowercase)
const TOPIC_ALIASES = {
  diff: 'differentiation',
  differentiation: 'differentiation',
  derivative: 'differentiation',
  derivatives: 'differentiation',
  int: 'integration',
  integ: 'integration',
  integration: 'integration',
  functions: 'functions',
  func: 'functions',
  fn: 'functions',
  alg: 'algebra',
  algebra: 'algebra',
  seq: 'sequences-and-series',
  'sequences-and-series': 'sequences-and-series',
  series: 'sequences-and-series'
};

// Bundles: composite identifiers (if they ever appear singly) expanded to underlying canonical topics
// The current multi-topic JSON already lists full arrays; this is for safety if a future question uses just a bundle key.
const BUNDLE_MAP = {
  'algebra-functions-differentiation-integration': ['algebra','functions','differentiation','integration'],
  'algebra-functions-differentiation': ['algebra','functions','differentiation'],
  'fun-dif-int': ['functions','differentiation','integration']
};

function canonicalize(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  return TOPIC_ALIASES[key] || key; // fall back to itself if not aliased
}

// Expand a single raw topic (may be bundle) to an array of canonical topics
function expandTopic(raw) {
  const canon = canonicalize(raw);
  if (!canon) return [];
  if (BUNDLE_MAP[canon]) {
    return BUNDLE_MAP[canon].map(canonicalize);
  }
  // If the canonical name itself matches a bundle entry key *after* aliasing, expand.
  if (BUNDLE_MAP[raw]) {
    return BUNDLE_MAP[raw].map(canonicalize);
  }
  return [canon];
}

// Normalize question topics into canonical topic array (expanding bundles or stray composite strings)
function questionTopics(q) {
  if (!q) return [];
  const rawList = Array.isArray(q.topic) ? q.topic : [q.topic];
  const expanded = rawList.flatMap(t => expandTopic(t));
  // Deduplicate while preserving order
  const seen = new Set();
  const ordered = [];
  for (const t of expanded) {
    if (t && !seen.has(t)) { seen.add(t); ordered.push(t); }
  }
  return ordered;
}

// Determine if a question matches requested topics (ANY or ALL)
function matchesQuestion(q, requestedCanonical, mode = 'any') {
  if (!requestedCanonical.length) return true;
  const qTopics = questionTopics(q);
  if (mode === 'all') {
    return requestedCanonical.every(t => qTopics.includes(t));
  }
  // default ANY
  return requestedCanonical.some(t => qTopics.includes(t));
}

// Parse query params topic / topics (& optional match=all) into canonical array + mode
function parseRequestedTopics({ topic, topics, match }) {
  const requested = [];
  if (topic) requested.push(...String(topic).split(',').map(s => s.trim()).filter(Boolean));
  if (topics) requested.push(...String(topics).split(',').map(s => s.trim()).filter(Boolean));
  const canonical = [...new Set(requested.map(canonicalize).filter(Boolean))];
  const mode = match === 'all' ? 'all' : 'any';
  return { topics: canonical, mode };
}

export {
  canonicalize,
  expandTopic,
  questionTopics,
  matchesQuestion,
  parseRequestedTopics
};
