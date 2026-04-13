// ──────────────────────────────────────────────────────────────
// Vercel Serverless Function — Brille & Vibre Studio
// Endpoint: POST /api/generate
// Mode supporté : "weekly_plan" (story | reel)
// ──────────────────────────────────────────────────────────────

// ─── 1. CONFIG (env vars + constantes) ─────────────────────────
// (à remplir)


// ─── 2. SYSTEM PROMPT (méthode Brille & Vibre) ─────────────────
const SYSTEM_PROMPT = ``;


// ─── 3. BUILD USER MESSAGE (weekly_plan story|reel) ────────────
function buildWeeklyPlanMessage(audience, focus, format) {
  // (à remplir)
}


// ─── 4. CORS ───────────────────────────────────────────────────
function corsOrigin(req) {
  // (à remplir)
}

function setCors(req, res) {
  // (à remplir)
}


// ─── 5. UTILS ──────────────────────────────────────────────────
function clamp(s, max) {
  // (à remplir)
}

function getClientIp(req) {
  // (à remplir)
}


// ─── 6. RATE LIMIT (Upstash Redis, fail-open) ──────────────────
async function checkRateLimit(ip) {
  // (à remplir)
}


// ─── 7. HANDLER ────────────────────────────────────────────────
export default async function handler(req, res) {
  // (à remplir)
}
