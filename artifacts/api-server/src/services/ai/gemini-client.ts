/**
 * Gemini client — server-side ONLY.
 *
 * Security: The API key is read exclusively from process.env.GEMINI_API_KEY.
 * It is NEVER logged, never returned to clients, never exposed via any route.
 * The Expo mobile app must never call Gemini directly — all AI requests
 * must go through this backend service.
 */

import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";

let _client: GoogleGenerativeAI | null = null;
let _model: GenerativeModel | null = null;

function getClient(): GoogleGenerativeAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is not set. " +
        "Set it in Replit Secrets (never hardcode it)."
      );
    }
    // SECURITY: Never log the key or any part of it
    _client = new GoogleGenerativeAI(apiKey);
  }
  return _client;
}

export function getGeminiModel(modelName = "gemini-1.5-flash"): GenerativeModel {
  if (!_model) {
    _model = getClient().getGenerativeModel({ model: modelName });
  }
  return _model;
}

/**
 * Generate content and parse as JSON.
 * Returns null on timeout or parse failure — callers must provide a fallback.
 */
export async function generateJSON<T>(
  prompt: string,
  timeoutMs = 15_000
): Promise<T | null> {
  const model = getGeminiModel();

  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), timeoutMs)
  );

  const generatePromise = (async () => {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    return JSON.parse(cleaned) as T;
  })();

  try {
    const result = await Promise.race([generatePromise, timeoutPromise]);
    return result;
  } catch {
    return null;
  }
}

/**
 * Generate free-text content (for conversation and journal).
 * Returns null on timeout — callers must provide a fallback.
 */
export async function generateText(
  prompt: string,
  timeoutMs = 15_000
): Promise<string | null> {
  const model = getGeminiModel();

  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), timeoutMs)
  );

  const generatePromise = (async () => {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  })();

  try {
    return await Promise.race([generatePromise, timeoutPromise]);
  } catch {
    return null;
  }
}
