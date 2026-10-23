// Fresh original questions for ONE topic, using Google Gemini (free tier).
const SYSTEM = `You write ORIGINAL AZ-900 practice questions based only on the public Microsoft Learn AZ-900 skills outline.
Never reproduce real exam questions. Return ONLY a JSON array. Each item:
{"domain":string (exactly the domain you were asked for),"topic":string (specific concept),"q":string,
"options":[{"t":string,"ok":boolean,"note":string}] (exactly 4, exactly one ok:true; for wrong options "note" names the topic/concept the option really belongs to; "" for the correct one),
"why":string (why the correct answer is correct)}`

const URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

export default async function handler(req, res) {
  if (!process.env.GEMINI_API_KEY) return res.status(200).json({ questions: [] })
  const count = Math.min(Number(req.body?.count) || 3, 6)
  const domain = req.body?.domain || 'Cloud Concepts'
  try {
    const r = await fetch(URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: `Write ${count} new questions for the domain "${domain}". Variety seed: ${Math.random()}` }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 1, maxOutputTokens: 4000 },
      }),
    })
    const d = await r.json()
    const txt = (d.candidates?.[0]?.content?.parts?.[0]?.text || '[]').replace(/```json|```/g, '').trim()
    const list = JSON.parse(txt).map((q) => ({ ...q, domain })).filter((q) => q.options?.length === 4 && q.options.filter((o) => o.ok).length === 1)
    res.status(200).json({ questions: list })
  } catch (e) { res.status(200).json({ questions: [] }) } // app falls back to the built-in bank
}
