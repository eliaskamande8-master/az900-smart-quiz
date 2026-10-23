import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DOMAINS } from './data/questions'
import { buildTopicQuiz, getState, recordAttempt, topicPct, statusOf, overallPct, fullyPrepared, STREAK_LIMIT, POOR } from './lib/quiz'

const LOCK_MSG = 'Kindly first understand the concept from the topic.'
const page = { initial: { opacity: 0, x: 60, scale: 0.98 }, animate: { opacity: 1, x: 0, scale: 1 }, exit: { opacity: 0, x: -60, scale: 0.98 }, transition: { duration: 0.35 } }
const META = {
  'Cloud Concepts': { color: '#ff5d8f', icon: '☁️', blurb: 'Cloud benefits, models and the shared responsibility model' },
  'Azure Architecture & Services': { color: '#2ec4b6', icon: '🏗️', blurb: 'Regions, compute, storage, networking and identity' },
  'Management & Governance': { color: '#ffb703', icon: '🛡️', blurb: 'Cost, policy, locks, monitoring and management tools' },
}
const L = ['A', 'B', 'C', 'D']

function useCountdown(until) {
  const [left, setLeft] = useState(Math.max(0, until - Date.now()))
  useEffect(() => { if (!until) return; const id = setInterval(() => setLeft(Math.max(0, until - Date.now())), 1000); return () => clearInterval(id) }, [until])
  const s = Math.floor(left / 1000)
  return { left, text: [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':') }
}
function LockBox({ until, onDone }) {
  const { left, text } = useCountdown(until)
  useEffect(() => { if (until && left === 0) onDone() }, [left])
  return <div className="lock"><p>{LOCK_MSG}</p><div className="timer">{text}</div><small>You can attempt this topic again when the timer reaches zero.</small></div>
}
function Ring({ pct, color }) {
  const r = 34, c = 2 * Math.PI * r, p = pct ?? 0
  return <svg width="84" height="84" viewBox="0 0 84 84">
    <circle cx="42" cy="42" r={r} stroke="#ffffff25" strokeWidth="9" fill="none" />
    <motion.circle cx="42" cy="42" r={r} stroke={color} strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={c}
      initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - p / 100) }} transform="rotate(-90 42 42)" />
    <text x="42" y="47" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">{pct === null ? '–' : p + '%'}</text>
  </svg>
}

function AiBox({ q }) {
  const [text, setText] = useState(''), [busy, setBusy] = useState(false)
  async function ask() {
    setBusy(true)
    try {
      const right = q.options.find((o) => o.ok)
      const r = await fetch('/api/explain', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q.q, options: q.options.map((o) => o.t).join(' | '), correct: right.t, explanation: q.why, topic: q.topic }) })
      setText((await r.json()).text)
    } catch { setText('AI tutor is unavailable here. It works on the deployed site once the API key is set.') }
    setBusy(false)
  }
  return <div className="aibox">
    <button className="ghost" onClick={ask} disabled={busy}>{busy ? 'Thinking…' : text ? '🤖 Explain again differently' : '🤖 Still unsure? Ask the AI tutor'}</button>
    {text && <div className="ai">{text}</div>}
  </div>
}

export default function App() {
  const [screen, setScreen] = useState('dash')
  const [st, setSt] = useState(getState())
  const [topic, setTopic] = useState(null)
  const [qs, setQs] = useState([])
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState([])
  const [result, setResult] = useState(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(null)
  const refresh = () => setSt(getState())

  async function start(d) {
    if (st.topics[d].lockUntil > Date.now()) return
    setLoading(d)
    let extra = []
    try { const r = await fetch('/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ count: 6, domain: d }) }); extra = (await r.json()).questions || [] } catch {}
    setTopic(d); setQs(buildTopicQuiz(d, 10, extra, st.seen)); setAnswers([]); setIdx(0); setDone(false); setResult(null); setLoading(null); setScreen('quiz')
  }
  const pick = (i) => { if (answers[idx] !== undefined) return; const a = [...answers]; a[idx] = i; setAnswers(a) }
  function next() {
    if (idx + 1 < qs.length) return setIdx(idx + 1)
    if (done) return setScreen('result')
    const { state, result } = recordAttempt(topic, qs, answers)
    setSt(state); setResult(result); setDone(true); setScreen('result')
  }

  const ready = fullyPrepared(st)
  const concepts = Object.entries(st.concepts).map(([name, v]) => ({ name, pct: Math.round((v.c / v.t) * 100), t: v.t }))
  const strong = concepts.filter((c) => c.pct >= 75), weak = concepts.filter((c) => c.pct < 75)
  const started = DOMAINS.filter((d) => topicPct(st, d) !== null)
  const weakest = started.filter((d) => topicPct(st, d) < 75).sort((a, b) => topicPct(st, a) - topicPct(st, b))[0]
  const unstarted = DOMAINS.find((d) => topicPct(st, d) === null)
  const focus = weakest ? ['Focus next on', weakest, `Your accuracy here is ${topicPct(st, weakest)}%. A short session will help most.`]
    : unstarted ? ['Up next', unstarted, 'You have not tried this topic yet. Start with a short quiz.']
    : ['You are on track', DOMAINS[0], 'Retake any topic to keep your knowledge fresh.']

  return (
    <div className="app">
      <header>
        <span className="logo">AZ-900 Smart Quiz <span className="badge">Unofficial</span></span>
        <button className={'nav ' + (screen === 'dash' ? 'on' : '')} onClick={() => { refresh(); setScreen('dash') }}>Dashboard</button>
      </header>
      <main>
        <AnimatePresence mode="wait">
          {screen === 'dash' && <motion.section key="dash" {...page}>
            <h1>Your progress</h1>
            <div className="stats">
              <div className="stat s1"><b>{st.quizzes}</b><span>Quizzes taken</span></div>
              <div className="stat s2"><b>{overallPct(st) === null ? '–' : overallPct(st) + '%'}</b><span>Overall accuracy</span></div>
              <div className="stat s3"><b>{DOMAINS.filter((d) => topicPct(st, d) >= 75).length}/{DOMAINS.length}</b><span>Topics mastered</span></div>
            </div>
            {ready && <div className="ready">You are fully prepared for the exam.</div>}
            <div className="focus"><div><h3>{focus[0]}: {focus[1]}</h3><p>{focus[2]}</p></div>
              <button className="cta" disabled={!!loading || st.topics[focus[1]].lockUntil > Date.now()} onClick={() => start(focus[1])}>Revise now</button></div>

            <h3 className="h">Choose a topic quiz</h3>
            <div className="topics">
              {DOMAINS.map((d) => { const m = META[d], t = st.topics[d], p = topicPct(st, d), locked = t.lockUntil > Date.now(); return (
                <motion.div key={d} className="tcard" style={{ '--c': m.color }} whileHover={{ y: -5 }}>
                  <div className="thead"><Ring pct={p} color={m.color} /><div><h3>{m.icon} {d}</h3><span className={'chip ' + statusOf(p).replace(/\s/g, '')}>{statusOf(p)}</span></div></div>
                  <p>{m.blurb}</p>
                  <small>{t.last !== null ? `Last score ${t.last}%` : 'No attempts yet'}{t.poorStreak > 0 ? ` · ${t.poorStreak} of ${STREAK_LIMIT} low scores in a row` : ''}</small>
                  {locked ? <LockBox until={t.lockUntil} onDone={refresh} /> :
                    <button className="cta" disabled={!!loading} onClick={() => start(d)}>{loading === d ? 'Building quiz…' : p === null ? 'Start quiz' : 'Revise'}</button>}
                </motion.div>) })}
            </div>

            <div className="two">
              <div className="good"><h3>Strengths</h3>{strong.length ? strong.map((c) => <p key={c.name}><span className="dot ok">✓</span> {c.name} ({c.pct}%)</p>) : <p>Take a quiz to discover your strengths.</p>}</div>
              <div className="bad"><h3>Areas to improve</h3>{weak.length ? weak.map((c) => <p key={c.name}><span className="dot no">!</span> {c.name} ({c.pct}%)</p>) : <p>{concepts.length ? 'No weak areas right now. Great work.' : 'Your weak spots will show here.'}</p>}</div>
            </div>
          </motion.section>}

          {screen === 'quiz' && qs[idx] && (() => {
            const q = qs[idx], picked = answers[idx], answered = picked !== undefined, right = q.options.findIndex((o) => o.ok)
            return <motion.section key={'q' + idx} {...page}>
              <div className="bar"><motion.div className="fill" animate={{ width: `${((idx + 1) / qs.length) * 100}%` }} /></div>
              <small>{topic} · Question {idx + 1} of {qs.length} · {q.topic}</small>
              <h2>{q.q}</h2>
              {q.options.map((o, i) => <div key={i}>
                <motion.button className={'opt ' + (!answered ? '' : o.ok ? 'ok' : i === picked ? 'no' : 'dim')} disabled={answered} whileHover={answered ? {} : { x: 8 }} onClick={() => pick(i)}>
                  <span className="letter">{answered && o.ok ? '✓' : answered && i === picked ? '✗' : L[i]}</span>{o.t}
                </motion.button>
                {answered && <motion.div className={'why ' + (o.ok ? 'ok' : i === picked ? 'no' : '')} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                  <b>{o.ok ? 'Why this is correct: ' : 'What this option is about: '}</b>{o.ok ? q.why : o.note || 'This belongs to a different concept than the one asked about.'}
                </motion.div>}
              </div>)}
              {answered && <p className={picked === right ? 'msg good-t' : 'msg bad-t'}>{picked === right ? '✓ Correct!' : `✗ Incorrect. The correct answer is ${L[right]}`}</p>}
              {answered && <AiBox key={q.q} q={q} />}
              <div className="navbtns">
                <button className="ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Previous</button>
                <button className="cta" disabled={!answered} onClick={next}>{idx + 1 === qs.length ? (done ? 'Back to results' : 'See results') : 'Next'}</button>
              </div>
            </motion.section>
          })()}

          {screen === 'result' && result && <motion.section key="result" {...page}>
            <small>{topic}</small>
            <motion.div className="score" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>{result.pct}%</motion.div>
            <h2>{result.pct > 90 ? 'Well congratulations, you nailed it! 🎉' : 'Wow, congratulations! 🎉'}</h2>
            <p className="sub">You answered {result.correct} of {result.total} correctly.</p>
            {result.pct < POOR && st.topics[topic].lockUntil <= Date.now() && <p className="sub warn">Below {POOR}%. That is {st.topics[topic].poorStreak} of {STREAK_LIMIT} low scores in a row. Review the explanations before trying again.</p>}
            {ready && <div className="ready">You are fully prepared for the exam.</div>}
            <div className="two">
              <div className="good"><h3>Strengths in this quiz</h3>{result.strengths.length ? result.strengths.map((t) => <p key={t}><span className="dot ok">✓</span> {t}</p>) : <p>No concept fully correct yet.</p>}</div>
              <div className="bad"><h3>Areas to improve</h3>{result.weaknesses.length ? result.weaknesses.map((t) => <p key={t}><span className="dot no">!</span> {t}</p>) : <p>Nothing missed. Great work.</p>}</div>
            </div>
            <div className="navbtns">
              <button className="cta" onClick={() => { setIdx(0); setScreen('quiz') }}>Review answers</button>
              {st.topics[topic].lockUntil > Date.now() ? null : <button className="ghost" onClick={() => start(topic)}>Retry this topic</button>}
              <button className="ghost" onClick={() => { refresh(); setScreen('dash') }}>Dashboard</button>
            </div>
            {st.topics[topic].lockUntil > Date.now() && <LockBox until={st.topics[topic].lockUntil} onDone={refresh} />}
          </motion.section>}
        </AnimatePresence>
      </main>
      <footer>© 2026 Unofficial AZ-900 Smart Quiz Builder. Not affiliated with or endorsed by Microsoft. Original practice questions based on the public AZ-900 skills outline.</footer>
    </div>
  )
}
