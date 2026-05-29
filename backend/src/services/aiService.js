/**
 * AI Service Layer
 *
 * Handles all LLM interactions. Abstracted here so we can swap
 * OpenAI for Azure OpenAI, Anthropic, or a mock without touching
 * WebSocket logic.
 *
 * SCALING NOTE: In production, this service would be extracted into
 * a dedicated microservice behind a queue (e.g., BullMQ + Redis),
 * allowing horizontal scaling independent of the WebSocket layer.
 */

import OpenAI from "openai";

// ─── Mock service for when no API key is provided ──────────────────────────

const MOCK_SUMMARIES = [
  "The conversation has just begun. Monitoring for key topics and action items.",
  "Early discussion underway. Participants are establishing context and background.",
  "Key themes emerging: the speaker is covering foundational concepts and requirements.",
  "Mid-session update: Several important points raised. Action items beginning to crystallize.",
  "Discussion deepening. Technical requirements and constraints are being explored in detail.",
  "Progress noted: Core decisions appear to be forming. Consensus building on main topics.",
  "Advanced session: Concrete next steps being discussed. Stakeholders aligned on priorities.",
  "Session nearing key conclusions. Deliverables and owners are being assigned.",
];

let mockIndex = 0;

class MockAIService {
  async generateSummary(transcript, previousSummary) {
    // Simulate LLM latency
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
    const summary = MOCK_SUMMARIES[mockIndex % MOCK_SUMMARIES.length];
    mockIndex++;
    return summary;
  }

  async *streamSummary(transcript, previousSummary) {
    const summary = await this.generateSummary(transcript, previousSummary);
    const words = summary.split(" ");
    for (const word of words) {
      yield word + " ";
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 30));
    }
  }

  isAvailable() {
    return true; // Mock is always available
  }
}

// ─── Real OpenAI service ───────────────────────────────────────────────────

class OpenAIService {
constructor(apiKey) {
  this.client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  });
  this.model = process.env.OPENAI_MODEL || "gpt-4o-mini";
}

  /**
   * Builds the summarization prompt.
   * Uses incremental approach: we pass the previous summary as context
   * so the LLM only needs to process *new* information, not re-read
   * the entire transcript. This dramatically reduces token usage and latency.
   */
  buildPrompt(newTranscriptChunk, previousSummary) {
    const systemPrompt = `You are an AI assistant embedded in an enterprise contact centre.
Your role is to maintain a concise, rolling summary of an ongoing conversation.

Guidelines:
- Keep summary to 2-4 sentences maximum
- Focus on: key topics, decisions made, action items, and open questions
- Write in present tense ("The caller is discussing...")
- Be factual and neutral
- Update smoothly from previous summary`;

    const userPrompt = previousSummary
      ? `Previous summary: "${previousSummary}"

New transcript segment: "${newTranscriptChunk}"

Update the summary to incorporate the new information. Keep it concise.`
      : `Transcript: "${newTranscriptChunk}"

Provide an initial summary of this conversation.`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Streaming summary generation.
   * We use SSE-style streaming from OpenAI so the first tokens
   * appear on the frontend within ~300ms rather than waiting
   * for the full completion (which could be 2-3 seconds).
   */
  async *streamSummary(transcript, previousSummary) {
    const { systemPrompt, userPrompt } = this.buildPrompt(
      transcript,
      previousSummary
    );

    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 200,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  isAvailable() {
    return !!this.client;
  }
}

// ─── Factory function ──────────────────────────────────────────────────────

export function createAIService() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && (apiKey.startsWith("sk-") || apiKey.startsWith("nvapi-"))) {
    console.log("✅ Using AI service:", process.env.OPENAI_BASE_URL || "OpenAI");
    return new OpenAIService(apiKey);
  }
  console.log("⚠️  No valid API key found — using mock AI service");
  return new MockAIService();
}
