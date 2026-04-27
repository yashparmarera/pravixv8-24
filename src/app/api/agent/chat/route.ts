import { NextResponse } from "next/server";
import { createAuthedSupabaseClient, getBearerToken, resolveAuthedUser } from "@/lib/agent/server";
import { loadAgentContext } from "@/lib/agent/context";
import { generateAdvisorChatReply } from "@/lib/agent/nim";
import type { AgentChatHistoryItem } from "@/lib/agent/types";

type FinancialContext = {
  goal_amount_inr?: number;
  horizon_years?: number;
  risk_level?: string;
  monthly_income?: number;
  monthly_surplus?: number;
  current_savings?: number;
  emergency_months?: number;
  loss_tolerance?: number | null;
  plan_intro?: string;
  sip_range?: string;
  next_action?: string;
};

type ChatBody = {
  message?: unknown;
  history?: unknown;
  system?: unknown;
  context?: FinancialContext;
};

function isHistoryItem(value: unknown): value is AgentChatHistoryItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const maybe = value as Partial<AgentChatHistoryItem>;
  const roleOk = maybe.role === "user" || maybe.role === "assistant";
  return roleOk && typeof maybe.content === "string";
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
    }

    const body = (await request.json()) as ChatBody;
    if (typeof body.message !== "string" || body.message.trim().length === 0) {
      return NextResponse.json({ error: "message is required." }, { status: 400 });
    }

    const history: AgentChatHistoryItem[] = Array.isArray(body.history)
      ? body.history.filter(isHistoryItem).map((item) => ({ role: item.role, content: item.content.trim() }))
      : [];
    
    // Extract optional system prompt and context
    const systemPrompt = typeof body.system === "string" ? body.system.trim() : undefined;
    const financialContext = body.context as FinancialContext | undefined;

    const supabase = createAuthedSupabaseClient(accessToken);
    const user = await resolveAuthedUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    }

    const context = await loadAgentContext(supabase, user.id);
    const advisorReply = await generateAdvisorChatReply({
      message: body.message.trim(),
      history,
      context,
      systemPrompt,
      financialContext,
    });

    return NextResponse.json(
      {
        ok: true,
        reply: advisorReply.reply,
        raw: advisorReply.raw,
        structured: advisorReply.structured,
        disclaimer:
          "Educational guidance only. This is not guaranteed return advice. Validate suitability before investing.",
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected chat error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
