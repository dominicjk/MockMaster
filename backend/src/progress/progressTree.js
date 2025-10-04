// ProgressTree helper encapsulates hierarchical completion tracking
// Structure:
// root
//  ├─ paper1
//  │    └─ topics:{ algebra:{ items:{ 'alg-1001': {completedAt, timeTakenSeconds, notes} } } }
//  └─ paper2
//       └─ topics:{ ... }
// Totals cached for fast progress bar computation

const PAPER1_TOPICS = new Set([
  'algebra','algebraic','polynomial','quadratic',
  'complex','complex-numbers','imaginary',
  'differentiation','derivative','diff',
  'integration','integral','integrate',
  'sequences','sequence','series','arithmetic','geometric','sequences-and-series','sequences-series',
  'financial','financial-maths','compound-interest','annuity',
  'induction','mathematical-induction','proof-by-induction'
]);

function normalizeTopicFromQuestionId(questionId) {
  if (!questionId) return 'unknown';
  return questionId.split('-')[0];
}

function classifyPaper(topicSlug) {
  const key = (topicSlug||'').toLowerCase();
  return PAPER1_TOPICS.has(key) ? 'paper1' : 'paper2';
}

export class ProgressTree {
  constructor(data) {
    // If restoring from JSON keep structure, else initialize
    if (data && data.tree && data.totals) {
      this.tree = data.tree;
      this.totals = data.totals;
      this.version = data.version || 1;
    } else {
      this.version = 1;
      this.tree = { paper1: { topics: {} }, paper2: { topics: {} } };
      this.totals = { all: 0, paper1: 0, paper2: 0, topics: {} };
    }
  }

  static fromAttempts(attempts) {
    const pt = new ProgressTree();
    (attempts||[]).forEach(a => {
      pt.addAttempt(a.questionId, { timeTakenSeconds: a.timeTakenSeconds ?? a.timeTaken ?? null, notes: a.notes || '', completedAt: a.completedAt || a.timestamp || a.lastUpdatedAt });
    });
    return pt;
  }

  has(questionId) {
    const topic = normalizeTopicFromQuestionId(questionId);
    const paper = classifyPaper(topic);
    const node = this.tree[paper].topics[topic];
    return !!(node && node.items && node.items[questionId]);
  }

  addAttempt(questionId, meta={}) {
    if (!questionId) return false;
    const topic = normalizeTopicFromQuestionId(questionId);
    const paper = classifyPaper(topic);
    if (!this.tree[paper].topics[topic]) {
      this.tree[paper].topics[topic] = { items: {} };
    }
    const topicNode = this.tree[paper].topics[topic];
    if (!topicNode.items[questionId]) {
      // New completion
      topicNode.items[questionId] = {
        completedAt: meta.completedAt || new Date().toISOString(),
        timeTakenSeconds: meta.timeTakenSeconds ?? null,
        notes: meta.notes || ''
      };
      // Update totals
      this.totals.all += 1;
      this.totals[paper] += 1;
      this.totals.topics[topic] = (this.totals.topics[topic] || 0) + 1;
      return true;
    } else {
      // Update existing meta (non-destructive)
      const existing = topicNode.items[questionId];
      if (meta.timeTakenSeconds != null) existing.timeTakenSeconds = meta.timeTakenSeconds;
      if (meta.notes) existing.notes = meta.notes;
      if (meta.completedAt) existing.completedAt = meta.completedAt;
      return false;
    }
  }

  topicCount(topic) { return this.totals.topics[topic] || 0; }
  paperCount(paper) { return this.totals[paper] || 0; }
  totalCount() { return this.totals.all; }

  // Flatten leaves into attempt-like objects (for compatibility with existing UI)
  toAttemptsArray() {
    const out = [];
    ['paper1','paper2'].forEach(p => {
      Object.entries(this.tree[p].topics).forEach(([topic, node]) => {
        Object.entries(node.items).forEach(([qid, meta]) => {
          out.push({
            questionId: qid,
            completedAt: meta.completedAt,
            timeTakenSeconds: meta.timeTakenSeconds,
            notes: meta.notes,
            topic,
            paper: p
          });
        });
      });
    });
    // newest first
    out.sort((a,b)=> new Date(b.completedAt||0).getTime() - new Date(a.completedAt||0).getTime());
    return out;
  }

  toJSON() { return { version: this.version, tree: this.tree, totals: this.totals }; }
}

export function restoreProgressTree(raw) {
  try { if (raw && typeof raw === 'object') return new ProgressTree(raw); } catch { /* ignore */ }
  return new ProgressTree();
}
