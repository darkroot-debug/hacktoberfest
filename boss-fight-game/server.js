require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Allowed moves specification
const ALLOWED_MOVES = ['melee_slash', 'fireball', 'charge', 'ground_slam', 'retreat'];

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate-limiting tracking (1 request per 1.2s per client IP)
const ipRequestTimestamps = new Map();
const RATE_LIMIT_WINDOW_MS = 1200;

// Rule-based fallback move generator
function getFallbackDecision(state, recentMoves = []) {
  const { bossHp = 300, playerHp = 100, stamina = 100, distance = 250, bossPhase = 1, lastPlayerActions = [] } = state;
  const lastAction = lastPlayerActions[lastPlayerActions.length - 1] || 'idle';
  const secondLastAction = lastPlayerActions[lastPlayerActions.length - 2] || 'idle';

  let moveCandidates = [];

  // Tactical logic based on distance and player behavior
  if (distance < 130) {
    // Close quarters
    if (lastAction === 'block') {
      moveCandidates = ['ground_slam', 'retreat'];
    } else if (lastAction === 'attack' || secondLastAction === 'attack') {
      moveCandidates = ['melee_slash', 'retreat', 'ground_slam'];
    } else {
      moveCandidates = ['melee_slash', 'ground_slam'];
    }
  } else if (distance < 300) {
    // Mid range
    if (bossPhase === 2 || stamina < 30) {
      moveCandidates = ['charge', 'melee_slash', 'fireball'];
    } else if (lastAction === 'jump') {
      moveCandidates = ['ground_slam', 'fireball'];
    } else {
      moveCandidates = ['fireball', 'charge', 'retreat'];
    }
  } else {
    // Long range
    if (bossPhase === 2) {
      moveCandidates = ['charge', 'fireball'];
    } else {
      moveCandidates = ['fireball', 'charge'];
    }
  }

  // Filter out moves that have been repeated twice in a row
  let chosenMove = moveCandidates[0] || 'melee_slash';
  if (recentMoves.length >= 2 && recentMoves[0] === recentMoves[1]) {
    const repeatedMove = recentMoves[0];
    const filtered = moveCandidates.filter(m => m !== repeatedMove);
    if (filtered.length > 0) {
      chosenMove = filtered[Math.floor(Math.random() * filtered.length)];
    } else {
      const allAllowed = ALLOWED_MOVES.filter(m => m !== repeatedMove);
      chosenMove = allAllowed[Math.floor(Math.random() * allAllowed.length)];
    }
  } else {
    chosenMove = moveCandidates[Math.floor(Math.random() * moveCandidates.length)];
  }

  if (!ALLOWED_MOVES.includes(chosenMove)) {
    chosenMove = 'melee_slash';
  }

  const fallbackTaunts = [
    'You cannot escape my wrath!',
    'Is that all you have, mortal?',
    'Feel the searing flame!',
    'Your defenses will crumble!',
    'Yield before absolute dominion!',
    'None survive my blade!',
    'Pathetic resistance!',
    'Bow before your master!'
  ];

  const taunt = fallbackTaunts[Math.floor(Math.random() * fallbackTaunts.length)];

  return { move: chosenMove, taunt, source: 'fallback' };
}

// POST /api/boss-move
app.post('/api/boss-move', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'local';
  const now = Date.now();
  const lastRequestTime = ipRequestTimestamps.get(clientIp) || 0;

  const state = req.body || {};
  const recentBossMoves = Array.isArray(state.lastBossMoves) ? state.lastBossMoves.slice(-2) : [];

  // Check rate limit: 1 request per 1.2s
  if (now - lastRequestTime < RATE_LIMIT_WINDOW_MS) {
    const fallback = getFallbackDecision(state, recentBossMoves);
    return res.json({ ...fallback, rateLimited: true });
  }

  ipRequestTimestamps.set(clientIp, now);

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  // If no API key configured, use fallback immediately
  if (!apiKey || apiKey.trim() === '' || apiKey.trim() === 'your_gemini_api_key_here') {
    const fallback = getFallbackDecision(state, recentBossMoves);
    return res.json(fallback);
  }

  const {
    bossHp = 300,
    playerHp = 100,
    stamina = 100,
    distance = 250,
    bossPhase = 1,
    lastPlayerActions = []
  } = state;

  const prompt = `You are a cunning, aggressive boss fighting a player in a 2D arena game.
Analyze the current fight situation and choose your next tactical move and a short taunt.

Current Fight State:
- Boss HP: ${Math.round(bossHp)} / 300
- Player HP: ${Math.round(playerHp)} / 100
- Player Stamina: ${Math.round(stamina)} / 100
- Distance between Boss and Player: ${Math.round(distance)} px
- Boss Phase: ${bossPhase} (Phase 2 is faster and highly aggressive)
- Player's last 3 actions: [${lastPlayerActions.join(', ')}]
- Boss's recent moves: [${recentBossMoves.join(', ')}]

Rules:
1. Choose exactly ONE move from this allowed list: melee_slash, fireball, charge, ground_slam, retreat
2. NEVER repeat the same move more than twice in a row.
3. Counter the player's recent tactics (e.g. if player attacks up close, slash or counter with ground_slam; if player is far, fireball or charge; if player blocks, ground_slam or retreat).
4. Provide a fierce taunt with AT MOST 8 words.
5. Return JSON ONLY with keys "move" and "taunt". No other markdown or explanation.`;

  // 1.5s timeout via AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 80,
          responseMimeType: 'application/json'
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Intentionally never log apiKey or full URL
      console.warn(`[BossAI] Gemini API responded with status ${response.status}. Using fallback.`);
      const fallback = getFallbackDecision(state, recentBossMoves);
      return res.json(fallback);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      console.warn('[BossAI] No text in Gemini response. Using fallback.');
      const fallback = getFallbackDecision(state, recentBossMoves);
      return res.json(fallback);
    }

    // Clean potential markdown fencing
    let cleanJson = candidateText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    const parsed = JSON.parse(cleanJson);
    let move = typeof parsed.move === 'string' ? parsed.move.trim().toLowerCase() : '';
    let taunt = typeof parsed.taunt === 'string' ? parsed.taunt.trim() : 'Prepare yourself!';

    // Validate move
    if (!ALLOWED_MOVES.includes(move)) {
      console.warn(`[BossAI] Gemini returned invalid move "${move}". Using fallback.`);
      const fallback = getFallbackDecision(state, recentBossMoves);
      return res.json(fallback);
    }

    // Ensure move does not repeat more than twice in a row
    if (recentBossMoves.length >= 2 && recentBossMoves[0] === move && recentBossMoves[1] === move) {
      const altMoves = ALLOWED_MOVES.filter(m => m !== move);
      move = altMoves[Math.floor(Math.random() * altMoves.length)];
    }

    // Enforce max 8 words for taunt
    const words = taunt.split(/\s+/).filter(Boolean);
    if (words.length > 8) {
      taunt = words.slice(0, 8).join(' ');
    }

    return res.json({
      move,
      taunt,
      source: 'gemini'
    });

  } catch (err) {
    clearTimeout(timeoutId);
    // Silent safe fallback without exposing key or error stacks
    const reason = err.name === 'AbortError' ? 'timeout (>1.5s)' : 'network/parse error';
    console.warn(`[BossAI] Gemini request failed due to ${reason}. Using fallback.`);
    const fallback = getFallbackDecision(state, recentBossMoves);
    return res.json(fallback);
  }
});

app.listen(PORT, () => {
  console.log(`Boss Fight server running at http://localhost:${PORT}`);
});
