// AI tutor using Google Gemini (free tier). The API key stays on the server.
const SYSTEM = `You are a patient AZ-900 (Azure Fundamentals) tutor. The learner did not fully understand a practice question.
Explain in simple language: (1) why the correct answer is right, (2) why the other options are wrong and what concept each belongs to,
(3) give two everyday analogies or real-world examples, (4) end with one short check-yourself question. Keep under 250 words.
Base everything on the public AZ-900 skills outline. Never claim to be official Microsoft content.`

const MODEL_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent'

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

  try {
    const response = await fetch(MODEL_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.7,
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
    })

    const data = await response.json()

    if (data.error) {
      console.error('Gemini error:', data.error)
      return res.status(200).json({ text: `AI error (${data.error.code}): ${data.error.message}` })
    }

    const text = (data.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || '')
      .join('')
      .trim()

    if (!text) {
      const reason = data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || 'unknown'
      return res.status(200).json({ text: `No answer returned. Reason: ${reason}` })
    }

    return res.status(200).json({ text })
  } catch (error) {
    console.error('explain failed:', error)
    return res.status(200).json({ text: 'AI tutor is unavailable right now: ' + error.message })
  }
}