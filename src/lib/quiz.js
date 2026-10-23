import { BANK, DOMAINS } from '../data/questions'
import { EXTRA } from '../data/moreQuestions'

export const STREAK_LIMIT = 3 // consecutive poor attempts before a pause
export const POOR = 60 // below this % counts as a poor attempt
export const HOUR = 60 * 60 * 1000
const KEY = 'az900_unofficial_v2'

export const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }

// One quiz per topic (domain). Fresh every time: random questions + shuffled options (+ AI extras).
export function buildTopicQuiz(domain, n = 10, extra = [], seen = []) {
  const bank = [...BANK, ...EXTRA].filter((q) => q.domain === domain)
  const texts = new Set(bank.map((q) => q.q))
  const ai = extra.filter((q) => q.domain === domain && !texts.has(q.q))
  const all = shuffle([...ai, ...bank])
  // prefer AI-new and not-yet-seen questions so repeat attempts feel fresh
  const pool = [...all.filter((q) => !seen.includes(q.q)), ...all.filter((q) => seen.includes(q.q))].slice(0, n)
  return shuffle(pool).map((q, i) => ({ ...q, id: i, options: shuffle(q.options) }))
}

const blankTopic = () => ({ poorStreak: 0, lockUntil: 0, answered: 0, correct: 0, last: null })

export function getState() {
  let s = { topics: {}, concepts: {}, quizzes: 0, seen: [] }
  try { s = { ...s, ...JSON.parse(localStorage.getItem(KEY)) } } catch {}
  DOMAINS.forEach((d) => {
    s.topics[d] = { ...blankTopic(), ...s.topics[d] }
    const t = s.topics[d]
    if (t.lockUntil && Date.now() >= t.lockUntil) { t.poorStreak = 0; t.lockUntil = 0 } // 1-hour pause is over
  })
  return s
}
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {} }

export function analyse(questions, answers) {
  const rows = questions.map((q, i) => ({ topic: q.topic, ok: q.options[answers[i]]?.ok === true }))
  const correct = rows.filter((r) => r.ok).length
  return {
    correct, total: questions.length, rows,
    pct: Math.round((correct / questions.length) * 100),
    strengths: [...new Set(rows.filter((r) => r.ok).map((r) => r.topic))],
    weaknesses: [...new Set(rows.filter((r) => !r.ok).map((r) => r.topic))],
  }
}

export function recordAttempt(domain, questions, answers) {
  const s = getState(), res = analyse(questions, answers), t = s.topics[domain]
  t.answered += res.total; t.correct += res.correct; t.last = res.pct
  t.poorStreak = res.pct < POOR ? t.poorStreak + 1 : 0 // a good attempt resets the streak
  if (t.poorStreak >= STREAK_LIMIT) t.lockUntil = Date.now() + HOUR
  s.seen = [...new Set([...(s.seen || []), ...questions.map((q) => q.q)])].slice(-200)
  res.rows.forEach((r) => { const c = (s.concepts[r.topic] ??= { c: 0, t: 0 }); c.t++; if (r.ok) c.c++ })
  s.quizzes += 1
  save(s)
  return { state: s, result: res }
}

export const topicPct = (s, d) => (s.topics[d].answered ? Math.round((s.topics[d].correct / s.topics[d].answered) * 100) : null)
export const statusOf = (pct) => (pct === null ? 'Not started' : pct >= 75 ? 'Strength' : pct >= 60 ? 'Getting there' : 'Needs work')
export const overallPct = (s) => { const a = DOMAINS.reduce((x, d) => x + s.topics[d].answered, 0), c = DOMAINS.reduce((x, d) => x + s.topics[d].correct, 0); return a ? Math.round((c / a) * 100) : null }
export const fullyPrepared = (s) => DOMAINS.every((d) => s.topics[d].last !== null && s.topics[d].last > 85)
