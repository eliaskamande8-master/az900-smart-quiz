// Fresh original questions for ONE topic, using Google Gemini (free tier).
const SYSTEM = `You write ORIGINAL AZ-900 practice questions based only on the public Microsoft Learn AZ-900 skills outline.
Never reproduce real exam questions. Return ONLY a JSON array. Each item:
{"domain":string (exactly the domain you were asked for),"topic":string (specific concept),"q":string,
"options":[{"t":string,"ok":boolean,"note":string}] (exactly 4, exactly one ok:true; for wrong options "note" names the topic/concept the option really belongs to; "" for the correct one),
"why":string (why the correct answer is correct)}`

const MODEL_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

export default async function handler(req, res) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) {
    return res.status(200).json({ questions: [] })
  }

  const count = Math.min(Number(req.body?.count) || 3, 6)
  const domain = req.body?.domain || 'Cloud Concepts'

  try {
    const response = await fetch(MODEL_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [
          {
            role: 'user',
            parts: [{ text: `Write ${count} new questions for the domain "${domain}". Variety seed: ${Math.random()}` }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 1,
          maxOutputTokens: 6000,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })

    const data = await response.json()
    if (data.error) {
      console.error('Gemini error:', data.error)
    }

    const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text || '[]')
      .replace(/```json|```/g, '')
      .trim()

    const questions = JSON.parse(raw)
      .map((q) => ({ ...q, domain }))
      .filter((q) => q.options?.length === 4 && q.options.filter((o) => o.ok).length === 1)

    return res.status(200).json({ questions })
  } catch (error) {
    console.error('generate failed:', error.message)
    // The app falls back to the built-in question bank.
    return res.status(200).json({ questions: [] })
  }
}