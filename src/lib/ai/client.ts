import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env, features } from "@/lib/env";

let client: Anthropic | null = null;

/** Get the shared Anthropic client, or throw a clear setup error if no key. */
export function getAnthropic(): Anthropic {
  if (!features.aiEnabled) {
    throw new Error(
      "AI extraction is not configured. Add ANTHROPIC_API_KEY to .env.local to import recipes.",
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return client;
}
