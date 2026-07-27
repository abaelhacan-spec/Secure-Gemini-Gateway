/**
 * AI Routes — all AI requests go through here to Gemini.
 *
 * Security: The GEMINI_API_KEY is never exposed to clients.
 * The Expo app calls these routes; this backend calls Gemini.
 *
 * Architecture: Expo App → these routes → AITeacherGateway → Gemini API
 */

import { Router } from "express";
import {
  correctSentence,
  explainWord,
  conversationTurn,
  generateDailyReport,
  detectGrammarPattern,
  generateExercises,
  evaluateExam,
} from "../services/ai/gateway.js";

const aiRouter = Router();

// POST /api/ai/sentence-correct
aiRouter.post("/sentence-correct", async (req, res) => {
  const { sentence, userMemory } = req.body as {
    sentence?: string;
    userMemory?: unknown;
  };

  if (!sentence || typeof sentence !== "string" || sentence.trim().length === 0) {
    res.status(400).json({ error: "sentence is required" });
    return;
  }
  if (!userMemory) {
    res.status(400).json({ error: "userMemory is required" });
    return;
  }

  const { result, fallback } = await correctSentence(sentence, userMemory as never);

  if (!result) {
    res.status(503).json({
      error: "AI service temporarily unavailable",
      fallback: fallback,
    });
    return;
  }

  res.json(result);
});

// POST /api/ai/word-explain
aiRouter.post("/word-explain", async (req, res) => {
  const { word, userMemory } = req.body as {
    word?: string;
    userMemory?: unknown;
  };

  if (!word || typeof word !== "string" || word.trim().length === 0) {
    res.status(400).json({ error: "word is required" });
    return;
  }
  if (!userMemory) {
    res.status(400).json({ error: "userMemory is required" });
    return;
  }

  const { result, fallback } = await explainWord(word, userMemory as never);

  if (!result) {
    res.status(503).json({
      error: "AI service temporarily unavailable",
      fallback: fallback,
    });
    return;
  }

  res.json(result);
});

// POST /api/ai/conversation-turn
aiRouter.post("/conversation-turn", async (req, res) => {
  const { userMessage, conversationHistory, userMemory } = req.body as {
    userMessage?: string;
    conversationHistory?: unknown[];
    userMemory?: unknown;
  };

  if (!userMessage || typeof userMessage !== "string" || userMessage.trim().length === 0) {
    res.status(400).json({ error: "userMessage is required" });
    return;
  }
  if (!userMemory) {
    res.status(400).json({ error: "userMemory is required" });
    return;
  }

  const history = Array.isArray(conversationHistory) ? (conversationHistory as never) : [];
  const { result, fallback } = await conversationTurn(userMessage, history, userMemory as never);

  if (!result) {
    res.status(503).json({
      error: "AI service temporarily unavailable",
      fallback: fallback,
    });
    return;
  }

  res.json(result);
});

// POST /api/ai/journal-daily-report
aiRouter.post("/journal-daily-report", async (req, res) => {
  const {
    wordsLearnedToday,
    mistakesMadeToday,
    sentencesWritten,
    streakDays,
    userMemory,
  } = req.body as {
    wordsLearnedToday?: string[];
    mistakesMadeToday?: string[];
    sentencesWritten?: number;
    streakDays?: number;
    userMemory?: unknown;
  };

  if (!userMemory) {
    res.status(400).json({ error: "userMemory is required" });
    return;
  }

  const { result, fallback } = await generateDailyReport(
    Array.isArray(wordsLearnedToday) ? wordsLearnedToday : [],
    Array.isArray(mistakesMadeToday) ? mistakesMadeToday : [],
    typeof sentencesWritten === "number" ? sentencesWritten : 0,
    typeof streakDays === "number" ? streakDays : 0,
    userMemory as never
  );

  if (!result) {
    res.status(503).json({
      error: "AI service temporarily unavailable",
      fallback: fallback,
    });
    return;
  }

  res.json(result);
});

// POST /api/ai/grammar-detect
aiRouter.post("/grammar-detect", async (req, res) => {
  const { sentence, knownPatterns } = req.body as {
    sentence?: string;
    knownPatterns?: string[];
  };

  if (!sentence || typeof sentence !== "string" || sentence.trim().length === 0) {
    res.status(400).json({ error: "sentence is required" });
    return;
  }

  const patterns = Array.isArray(knownPatterns) ? knownPatterns : [];
  const { result } = await detectGrammarPattern(sentence, patterns);

  // Grammar detect always returns something (null pattern is valid)
  res.json(result ?? { matchedPattern: null, description: null });
});

// POST /api/ai/exercise-generate
aiRouter.post("/exercise-generate", async (req, res) => {
  const { moduleTitle, targetWords, grammarFocus, userMemory } = req.body as {
    moduleTitle?: string;
    targetWords?: string[];
    grammarFocus?: string | null;
    userMemory?: unknown;
  };

  if (!moduleTitle || typeof moduleTitle !== "string") {
    res.status(400).json({ error: "moduleTitle is required" });
    return;
  }
  if (!userMemory) {
    res.status(400).json({ error: "userMemory is required" });
    return;
  }

  const { result, fallback } = await generateExercises(
    moduleTitle,
    Array.isArray(targetWords) ? targetWords : [],
    grammarFocus ?? null,
    userMemory as never
  );

  if (!result) {
    res.status(503).json({
      error: "AI service temporarily unavailable",
      fallback: fallback,
    });
    return;
  }

  res.json(result);
});

// POST /api/ai/exam-evaluate
aiRouter.post("/exam-evaluate", async (req, res) => {
  const { evaluationType, content, criteria, userMemory } = req.body as {
    evaluationType?: string;
    content?: string;
    criteria?: string;
    userMemory?: unknown;
  };

  if (!evaluationType || !["writing", "conversation"].includes(evaluationType)) {
    res.status(400).json({ error: "evaluationType must be 'writing' or 'conversation'" });
    return;
  }
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "content is required" });
    return;
  }
  if (!userMemory) {
    res.status(400).json({ error: "userMemory is required" });
    return;
  }

  const { result, fallback } = await evaluateExam(
    evaluationType as "writing" | "conversation",
    content,
    criteria ?? "",
    userMemory as never
  );

  if (!result) {
    res.status(503).json({
      error: "AI service temporarily unavailable",
      fallback: fallback,
    });
    return;
  }

  res.json(result);
});

export default aiRouter;
