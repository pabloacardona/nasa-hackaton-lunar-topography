// Indica al cliente si hay un LLM configurado (sin exponer la clave).
export async function GET() {
  const key = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  return Response.json({ configured: key.length > 8 });
}
