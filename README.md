# Unofficial AZ-900 Smart Quiz Builder

> Unofficial study tool. Not affiliated with or endorsed by Microsoft. All questions are original and based on the public AZ-900 skills outline on Microsoft Learn.

A colourful, animated revision app for Azure Fundamentals.

## Features
- New quiz every attempt (random questions, shuffled options, plus AI-generated questions)
- Strengths, weaknesses and improvement areas per domain and topic
- Explanations for correct answers; wrong options name the topic/concept they belong to
- AI tutor: explains any answer in depth with extra examples
- 3 attempts, then a 1-hour cooldown with live countdown
- Messages: >90% "Well congratulations, you nailed it!", otherwise "Wow, congratulations!"; all domains >85% shows "You are fully prepared for the exam."

## Run locally
```bash
npm install
npm run dev            # UI only (AI features fall back to the built-in question bank)
# or, for AI features:
npm i -g vercel && vercel dev
```
Copy `.env.example` to `.env.local` and add `ANTHROPIC_API_KEY`.

## Deploy
Push to GitHub, import the repo in Vercel, add `ANTHROPIC_API_KEY` under Environment Variables, deploy.

## Tech
React + Vite, Framer Motion, Vercel serverless functions (`/api`), Claude API.
Built with: Claude.ai (prompting/building), Cursor, Vercel.

© 2026
