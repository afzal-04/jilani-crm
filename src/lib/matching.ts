// src/lib/matching.ts
// Tutor-Parent matching engine — scores tutors against a parent's requirements.
// Think of this like a SQL Server scoring query done in-memory (dataset is small).

import { Parent, Tutor } from './firestore';

// ── Stopwords — common words that appear in almost every address, so they add
//    noise to location matching (like excluding "the", "a" from full-text search) ──
const STOPWORDS = new Set([
  'raipur', 'chhattisgarh', 'cg', 'near', 'road', 'nagar', 'colony',
  'the', 'and', 'in', 'of', 'at', 'behind', 'opposite', 'street',
  'india', 'district', 'city', 'area', 'front',
]);

// Tokenize an address/area string into normalized words
function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

// Jaccard-like overlap score between two token sets (0 to 1)
function tokenOverlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let common = 0;
  setA.forEach(w => { if (setB.has(w)) common++; });
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : common / union;
}

// ── Individual scoring functions (each returns 0–100) ────────────────────────

function locationScore(parent: Parent, tutor: Tutor): number {
  const parentTokens = [
    ...tokenize(parent.area || ''),
    ...tokenize((parent as any).address || ''),
  ];
  const tutorTokens = [
    ...tokenize(tutor.area || ''),
    ...tokenize((tutor as any).address || ''),
  ];
  const overlap = tokenOverlapScore(parentTokens, tutorTokens);
  return Math.round(overlap * 100);
}

function subjectScore(parent: Parent, tutor: Tutor): number {
  const parentSubject = (parent.subject || '').toLowerCase().trim();
  if (!parentSubject) return 0;
  const tutorSubjects = (tutor.subjects || '').toLowerCase();

  if (tutorSubjects.includes('all subjects')) return 100;
  if (tutorSubjects.includes(parentSubject)) return 100;

  // Partial match — e.g. parent wants "Physics", tutor lists "Science, Physics, Chemistry"
  const parentWords = parentSubject.split(/\s+/);
  const anyPartial = parentWords.some(w => w.length > 2 && tutorSubjects.includes(w));
  return anyPartial ? 60 : 0;
}

function classScore(parent: Parent, tutor: Tutor): number {
  const parentClass = (parent.class || '').toLowerCase().trim();
  if (!parentClass) return 0;
  const tutorClasses = (tutor.classes || '').toLowerCase();

  if (tutorClasses.includes(parentClass)) return 100;

  // Rough band matching — e.g. tutor says "Class 6-8" and parent wants "Class 7"
  const classNum = parseInt(parentClass.replace(/\D/g, ''), 10);
  if (!isNaN(classNum)) {
    const rangeMatch = tutorClasses.match(/(\d+)\s*[-–—to]+\s*(\d+)/);
    if (rangeMatch) {
      const lo = parseInt(rangeMatch[1], 10);
      const hi = parseInt(rangeMatch[2], 10);
      if (classNum >= lo && classNum <= hi) return 90;
    }
  }
  return 0;
}

function genderScore(parent: Parent, tutor: Tutor): number {
  const pref = ((parent as any).preferredTeacherGender || parent.preferredGender || '').toLowerCase();
  if (!pref || pref === 'no preference') return 100; // no preference = full score, doesn't penalize
  return pref === (tutor.gender || '').toLowerCase() ? 100 : 30; // not a hard blocker, just a lower score
}

// ── Composite match result ────────────────────────────────────────────────────

export interface MatchResult {
  tutor: Tutor;
  totalScore: number;       // 0–100 weighted composite
  breakdown: {
    location: number;
    subject: number;
    classLevel: number;
    gender: number;
  };
  reasons: string[];        // human-readable explanation chips
}

// Weights — tune these if you want location to matter more/less
const WEIGHTS = {
  location: 0.45,
  subject:  0.35,
  classLevel: 0.15,
  gender:   0.05,
};

export function matchTutorsForParent(parent: Parent, tutors: Tutor[]): MatchResult[] {
  const results: MatchResult[] = tutors
    .filter(t => t.status !== 'closed') // exclude rejected/closed tutor leads
    .map(tutor => {
      const location   = locationScore(parent, tutor);
      const subject     = subjectScore(parent, tutor);
      const classLevel  = classScore(parent, tutor);
      const gender      = genderScore(parent, tutor);

      const totalScore = Math.round(
        location   * WEIGHTS.location +
        subject     * WEIGHTS.subject +
        classLevel  * WEIGHTS.classLevel +
        gender      * WEIGHTS.gender
      );

      const reasons: string[] = [];
      if (location >= 50)  reasons.push(`📍 Location match (${location}%)`);
      if (location < 50 && location > 0) reasons.push(`📍 Partial location match`);
      if (location === 0)  reasons.push(`📍 No location overlap`);
      if (subject === 100)  reasons.push(`📚 Exact subject match`);
      else if (subject > 0) reasons.push(`📚 Related subject`);
      if (classLevel >= 90) reasons.push(`🎓 Class level match`);
      if (gender === 100 && ((parent as any).preferredTeacherGender)) reasons.push(`⚧ Gender preference met`);

      return { tutor, totalScore, breakdown: { location, subject, classLevel, gender }, reasons };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  return results;
}
