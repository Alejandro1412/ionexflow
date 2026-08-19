import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { generateAssistantReply } from "@/lib/ai/assistant";
import type { AssistantUserContext } from "@/lib/ai/assistant-knowledge";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      })
    )
    .min(1)
    .max(24),
});

function toUserContext(
  session: NonNullable<Awaited<ReturnType<typeof getSessionProfile>>>,
  email: string
): AssistantUserContext {
  const fullName = session.profile.full_name?.trim() || email.split("@")[0] || "Usuario";
  const firstName = fullName.split(/\s+/)[0] || "Usuario";
  return {
    firstName,
    fullName,
    email,
    orgName: session.org?.name ?? "tu organización",
    role: session.profile.role ?? "member",
    planStatus: session.org?.plan_status ?? "trial",
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await getSessionProfile();
  if (!session) {
    return NextResponse.json({ error: "Profile required" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
  }

  const userContext = toUserContext(session, user.email ?? "");

  try {
    const result = await generateAssistantReply(parsed.data.messages, userContext);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assistant failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
