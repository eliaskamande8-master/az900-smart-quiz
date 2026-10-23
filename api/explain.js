// AI tutor using Google Gemini (free tier). The API key stays on the server.
const SYSTEM = `You are a patient AZ-900 (Azure Fundamentals) tutor. The learner did not fully understand a practice question.
Explain in simple language: (1) why the correct answer is right, (2) why the other options are wrong and what concept each belongs to,
(3) give two everyday analogies or real-world examples, (4) end with one short check-yourself question. Keep under 250 words.
Base everything on the public AZ-900 skills outline. Never claim to be official Microsoft content.`

// Tried in order. If one is busy or unavailable, the next one is used.
const MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash']
const RETRY_CODES = [429, 500, 503, 404]

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ text: 'POST only' })
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) {
    return res.status(200).json({ text: 'AI tutor is not configured yet. Add GEMINI_API_KEY.' })
  }

  const { question, options, correct, explanation, topic } = req.body || {}
  const prompt =
    `Topic: ${topic}\n` +
    `Question: ${question}\n` +
    `Options: ${options}\n` +
    `Correct answer: ${correct}\n` +
    `Basic explanation: ${explanation}\n\n` +
    `Please teach me this in more depth.`

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 2000,
      temperature: 0.7,
      thinkingConfig: { thinkingLevel: 'low' },
    },
  })

  let lastError = null

  for (const model of MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body,
        }
      )
      const data = await response.json()

      if (data.error) {
        console.error(`Gemini error (${model}):`, data.error)
        lastError = data.error
        if (RETRY_CODES.includes(data.error.code)) continue // try the next model
        return res.status(200).json({ text: `AI error (${data.error.code}): ${data.error.message}` })
      }

      const text = (data.candidates?.[0]?.content?.parts || [])
        .map((part) => part.text || '')
        .join('')
        .trim()

      if (text) {
        return res.status(200).json({ text })
      }
      lastError = { message: `No answer returned. Reason: ${data.candidates?.[0]?.finishReason || 'unknown'}` }
    } catch (error) {
      console.error(`explain failed (${model}):`, error)
      lastError = { message: error.message }
    }
  }

  const busy = lastError?.code === 503 || lastError?.code === 429
  return res.status(200).json({
    text: busy
      ? 'The AI tutor is very busy right now. Please wait a minute and tap the button again.'
      : 'The AI tutor is unavailable right now: ' + (lastError?.message || 'unknown error'),
  })
}