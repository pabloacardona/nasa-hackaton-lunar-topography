// Endpoint del LLM para CopilotKit.
// Funciona con cualquier API compatible con OpenAI (OpenAI, Groq, OpenRouter, DeepSeek...)
// Configura en .env.local: LLM_API_KEY, LLM_BASE_URL (opcional), LLM_MODEL
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import OpenAI from "openai";
import { NextRequest } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "missing-key",
  baseURL: process.env.LLM_BASE_URL || undefined,
});

const serviceAdapter = new OpenAIAdapter({
  openai,
  model: process.env.LLM_MODEL ?? "gpt-4o-mini",
});

const runtime = new CopilotRuntime();

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
};
