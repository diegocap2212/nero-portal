import { NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { streamTurn, NERO_MODEL, type NeroMessage } from "@/lib/nero/core";
import { runNeroTool } from "@/lib/nero/tools";
import { costOfTurn } from "@/lib/nero/pricing";
import { prisma } from "@/lib/db";
import { loadPhase, buildPhaseContext } from "@/lib/state/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_TURNS = 6;

export async function POST(req: NextRequest) {
  let incoming: NeroMessage[];
  let faseSlug: string | undefined;

  try {
    const body = await req.json();
    incoming = body.messages;
    faseSlug = typeof body.faseSlug === "string" ? body.faseSlug : undefined;
    if (!Array.isArray(incoming) || incoming.length === 0) {
      return new Response("Corpo inválido: 'messages' é obrigatório.", { status: 400 });
    }
  } catch {
    return new Response("JSON inválido.", { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      "ANTHROPIC_API_KEY não configurada. Defina-a em .env.local para usar o Nero.",
      { status: 500 },
    );
  }

  // Carrega contexto da fase se o chat for escopado a um step do roadmap.
  let scopeContext: string | undefined;
  if (faseSlug) {
    try {
      const detail = await loadPhase(faseSlug);
      if (detail) scopeContext = buildPhaseContext(detail);
    } catch (e) {
      console.error("[Nero] falha ao carregar contexto da fase:", e);
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (t: string) => controller.enqueue(encoder.encode(t));

      const messages: Anthropic.MessageParam[] = incoming.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const turnStream = await streamTurn(messages, { scopeContext });

          for await (const event of turnStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              emit(event.delta.text);
            }
          }

          const final = await turnStream.finalMessage();
          const u = final.usage;
          const usage = {
            inputTokens: u.input_tokens,
            outputTokens: u.output_tokens,
            cacheReadTokens: u.cache_read_input_tokens ?? 0,
            cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
          };
          const costUsd = costOfTurn(NERO_MODEL, usage);
          try {
            await prisma.usageLog.create({ data: { model: NERO_MODEL, ...usage, costUsd } });
          } catch (e) {
            console.error("[Nero] falha ao registrar UsageLog:", e);
          }
          messages.push({ role: "assistant", content: final.content });

          if (final.stop_reason !== "tool_use") break;

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of final.content) {
            if (block.type === "tool_use") {
              const result = await runNeroTool(
                block.name,
                (block.input ?? {}) as Record<string, unknown>,
              );
              emit(`\n\n_↳ ${result}_\n`);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: result,
              });
            }
          }
          messages.push({ role: "user", content: toolResults });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        emit(`\n\n[Erro do Nero: ${message}]`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
