import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/org";
import { IonexAssistantPanel } from "@/components/assistant/ionex-assistant-panel";

export const metadata = {
  title: "Ionex Assistant",
  robots: { index: false, follow: false },
};

export default async function AssistantPage() {
  const session = await getSessionProfile();
  if (!session?.user) redirect("/login");

  const firstName =
    session.profile.full_name?.trim().split(/\s+/)[0] ||
    session.user.email?.split("@")[0] ||
    "amigo";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="font-display text-sm font-semibold uppercase tracking-[0.28em] text-signal">
          Copilot
        </p>
        <h1 className="font-display text-3xl font-bold glow-text">Ionex Assistant</h1>
        <p className="mt-2 text-muted-foreground">
          Hola {firstName}: conversa con Ionex como con un colega. Te conoce, te guía y te
          pregunta para ayudarte mejor.
        </p>
      </div>
      <IonexAssistantPanel
        variant="page"
        userFirstName={firstName}
        orgName={session.org?.name}
      />
    </div>
  );
}
