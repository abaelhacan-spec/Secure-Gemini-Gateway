/**
 * Local storage for the user's own Gemini API key.
 *
 * The key never leaves the device — it is stored in the OS-level secure
 * keychain (Keychain on iOS, Keystore-backed EncryptedSharedPreferences on
 * Android) via expo-secure-store, and is used only to call the Gemini API
 * directly from the app.
 */
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'nabih_gemini_api_key';

export async function getGeminiApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function setGeminiApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) {
    await clearGeminiApiKey();
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, trimmed);
}

export async function clearGeminiApiKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch {
    // no-op if it was never set
  }
}

export class MissingApiKeyError extends Error {
  constructor() {
    super('لم تقم بإضافة مفتاح Gemini API الخاص بك بعد. أضفه من صفحة الإعدادات.');
    this.name = 'MissingApiKeyError';
  }
}
