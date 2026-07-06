// src/lib/matching.ts
// Tutor-Parent matching engine.
//
// Class eligibility is now a HARD FILTER (like a WHERE clause) — a tutor who
// cannot teach the required class is excluded entirely, not just down-scored.
// Location + Subject remain WEIGHTED scoring factors (like ORDER BY columns)
// among the eligible tutors.

import { Parent, Tutor } from './firestore';

// ── Known area lookup list (acts like a reference/dimension table) ───────────
const KNOWN_AREAS = [
  'shankar nagar', 'civil lines', 'pandri', 'telibandha', 'tatibandh',
  'devendra nagar', 'raipur station road', 'pachpedi naka', 'avanti vihar',
  'byron bazar', 'mowa', 'khamardih', 'fafadih', 'rajendra nagar',
  'kabir nagar', 'gopal nagar', 'new rajendra nagar', 'shanti nagar',
  'daganiya', 'sundar nagar', 'ddu nagar', 'nit', 'gudhiyari', 'kota',
  'vidhan sabha road', 'ring road', 'jail road', 'gogaon', 'saddu',
  'katora talab', 'ganj para', 'moudhapara', 'lakhe nagar', 'amlidih',
  'urla', 'sarona', 'gondwara', 'khamtarai', 'bhatagaon', 'birgaon',
];

function findKnownAreas(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  return KNOWN_AREAS.filter(area => lower.includes(area));
}

const STOPWORDS = new Set([
  'raipur', 'chhattisgarh', 'cg', 'near', 'road', 'nagar', 'colony',
  'the', 'and', 'in', 'of', 'at', 'behind', 'opposite', 'street',
  'india', 'district', 'city', 'area', 'front',
]);

function tokenize(text: string): string[] {
  if (!text) return [];
  return text.toLowerCase().split(/[^a-z0-9]+/i).filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function tokenOverlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let common = 0;
  setA.forEach(w => { if (setB.has(w)) common++; });
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : common / union;
}

// ── Location scoring ───────────────────────────────────────────────────────────

function locationScore(parent: Parent, tutor: Tutor): { score: number; matchedArea?: string } {
  const parentText = `${parent.area || ''} ${(parent as any).address || ''}`;
  const tutorText  = `${(tutor as any).area || ''} ${(tutor as any).address || ''}`;

  const parentAreas = findKnownAreas(parentText);
  const tutorAreas   = findKnownAreas(tutorText);

  if (parentAreas.length > 0 && tutorAreas.length > 0) {
    const overlap = parentAreas.filter(a => tutorAreas.includes(a));
    if (overlap.length > 0) return { score: 100, matchedArea: overlap[0] };
    const fallback = tokenOverlapScore(tokenize(parentText), tokenize(tutorText));
    return { score: Math.round(fallback * 40) };
  }

  const fallback = tokenOverlapScore(tokenize(parentText), tokenize(tutorText));
  return { score: Math.round(fallback * 70) };
}

// ── Subject scoring ────────────────────────────────────────────────────────────

const SUBJECT_SYNONYMS: Record<string, string[]> = {
  'maths': ['mathematics', 'math'],
  'science': ['physics', 'chemistry', 'biology'],
  'social science': ['sst', 'social studies', 'history', 'geography', 'civics'],
  'computer science': ['computer', 'coding', 'programming'],
};

function normalizeText(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function subjectScore(parent: Parent, tutor: Tutor): number {
  const parentSubject = normalizeText(parent.subject || '');
  if (!parentSubject) return 50; // no requirement specified — neutral, don't penalize

  const tutorSubjects = normalizeText(tutor.subjects || '');
  if (!tutorSubjects) return 0;

  if (tutorSubjects.includes('all subjects')) return 100;
  if (tutorSubjects.includes(parentSubject)) return 100;

  for (const [key, synonyms] of Object.entries(SUBJECT_SYNONYMS)) {
    const group = [key, ...synonyms];
    const parentInGroup = group.some(g => parentSubject.includes(g));
    const tutorInGroup   = group.some(g => tutorSubjects.includes(g));
    if (parentInGroup && tutorInGroup) return 90;
  }

  const parentWords = parentSubject.split(' ').filter(w => w.length > 2);
  const anyPartial = parentWords.some(w => tutorSubjects.includes(w));
  return anyPartial ? 65 : 0;
}

// ── Class eligibility — HARD FILTER, not a soft score ─────────────────────────
// Returns true/false: can this tutor actually teach the parent's required class?
// Fixed bug: now checks ALL ranges in tutor.classes (e.g. "Class 6-8, Class 9-10"),
// not just the first one — like changing a single WHERE clause into
// WHERE Range1Match=1 OR Range2Match=1 OR Range3Match=1 ...

export function isClassEligible(parent: Parent, tutor: Tutor): boolean {
  const parentClass = (parent.class || '').toLowerCase().trim();
  if (!parentClass) return true; // no requirement specified — don't block

  const tutorClasses = (tutor.classes || '').toLowerCase();
  if (!tutorClasses) return false; // tutor listed nothing — can't confirm eligibility

  if (tutorClasses.includes(parentClass)) return true;

  const classNum = parseInt(parentClass.replace(/\D/g, ''), 10);
  if (!isNaN(classNum)) {
    // Check EVERY range mentioned (not just the first) — e.g. "6-8, 9-10, 11-12"
    const rangeMatches = [...tutorClasses.matchAll(/(\d+)\s*[-–—to]+\s*(\d+)/g)];
    for (const m of rangeMatches) {
      const lo = parseInt(m[1], 10);
      const hi = parseInt(m[2], 10);
      if (classNum >= lo && classNum <= hi) return true;
    }
    // Pre-primary special case
    if (['nursery','lkg','ukg'].some(p => parentClass.includes(p)) &&
        ['nursery','lkg','ukg','pre-primary','pre primary'].some(p => tutorClasses.includes(p))) {
      return true;
    }
  }
  return false;
}

// Kept for the score breakdown display (100 if eligible, 0 if not — binary now)
function classScore(parent: Parent, tutor: Tutor): number {
  return isClassEligible(parent, tutor) ? 100 : 0;
}

// ── Gender preference (soft constraint) ────────────────────────────────────────

function genderScore(parent: Parent, tutor: Tutor): number {
  const pref = ((parent as any).preferredTeacherGender || parent.preferredGender || '').toLowerCase();
  if (!pref || pref.includes('no preference')) return 100;
  return pref === (tutor.gender || '').toLowerCase() ? 100 : 40;
}

// ── Composite match result ────────────────────────────────────────────────────

export interface MatchResult {
  tutor: Tutor;
  totalScore: number;
  breakdown: { location: number; subject: number; classLevel: number; gender: number; };
  reasons: string[];
}

// Class eligibility is now a filter, so remaining weights are re-distributed
// across location + subject + gender (like removing a column from ORDER BY
// and boosting the others proportionally).
const WEIGHTS = { location: 0.50, subject: 0.40, gender: 0.10 };

export function matchTutorsForParent(parent: Parent, tutors: Tutor[]): MatchResult[] {
  const eligibleTutors = tutors.filter(t => t.status !== 'closed' && isClassEligible(parent, t));

  // Fallback: if literally nobody is eligible for that exact class, show the
  // full pool anyway (better than an empty screen) but flag it clearly.
  const pool = eligibleTutors.length > 0 ? eligibleTutors : tutors.filter(t => t.status !== 'closed');
  const noEligibleTutorFound = eligibleTutors.length === 0;

  return pool
    .map(tutor => {
      const loc         = locationScore(parent, tutor);
      const subject      = subjectScore(parent, tutor);
      const classLevel   = classScore(parent, tutor);
      const gender       = genderScore(parent, tutor);

      const totalScore = Math.round(
        loc.score * WEIGHTS.location +
        subject    * WEIGHTS.subject +
        gender     * WEIGHTS.gender
      );

      const reasons: string[] = [];

      if (noEligibleTutorFound) reasons.push(`⚠️ No tutor confirmed for this class — showing closest`);

      if (loc.matchedArea)      reasons.push(`📍 Same area: ${loc.matchedArea}`);
      else if (loc.score >= 40) reasons.push(`📍 Nearby location`);
      else if (loc.score > 0)   reasons.push(`📍 Weak location match`);
      else                       reasons.push(`📍 No location match`);

      if (subject === 100)      reasons.push(`📚 Exact subject match`);
      else if (subject >= 90)   reasons.push(`📚 Related subject`);
      else if (subject >= 65)   reasons.push(`📚 Partial subject match`);
      else if (subject === 50)  reasons.push(`📚 No subject specified`);

      reasons.push(classLevel === 100 ? `🎓 Eligible for this class` : `🎓 Not confirmed for this class`);

      if (gender === 100 && (parent as any).preferredTeacherGender && !(parent as any).preferredTeacherGender.includes('preference'))
        reasons.push(`⚧ Gender preference met`);

      return { tutor, totalScore, breakdown: { location: loc.score, subject, classLevel, gender }, reasons };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}