// AI tutor using Google Gemini (free tier). Key stays on the server.
const SYSTEM = `You are a patient AZ-900 (Azure Fundamentals) tutor. The learner did not fully understand a practice question.
Explain in simple language: (1) why the correct answer is right, (2) why the other options are wrong and what concept each belongs to,
(3) give two everyday analogies or real-world examples, (4) end with one short check-yourself question. Keep under 250 words.
Base everything on the public AZ-900 skills outline. Never claim to be official Microsoft content.`

const URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ text: 'POST only' })
  if (!process.env.GEMINI_API_KEY) return res.status(200).json({ text: 'AI tutor is not configured yet. Add GEMINI_API_KEY.' })
  const { question, options, correct, explanation, topic } = req.body || {}
  try {
    const r = await fetch(URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: `Topic: ${topic}\nQuestion: ${question}\nOptions: ${options}\nCorrect answer: ${correct}\nBasic explanation: ${explanation}\n\nPlease teach me this in more depth.` }] }],
        generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
      }),
    })
    const d = await r.json()
    res.status(200).json({ text: d.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || 'The AI tutor had no response. Try again.' })
  } catch (e) { res.status(200).json({ text: 'AI tutor is unavailable right now.' }) }
}
