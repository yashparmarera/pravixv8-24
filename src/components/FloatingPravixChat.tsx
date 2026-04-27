"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, MessageCircle, PhoneCall, Send, Sparkles, X } from "lucide-react";
import LoadingSpinner from "./LoadingSpinner";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AgentStructuredAdvice } from "@/lib/agent/types";

type FloatingPravixChatProps = {
  signedIn: boolean;
  refreshKey: number;
};

type BootstrapPayload = {
  greeting?: string;
  starterPrompts?: string[];
  error?: string;
};

type ChatPayload = {
  reply?: string;
  structured?: AgentStructuredAdvice;
  error?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sentAt: string;
  structured?: AgentStructuredAdvice;
  loading?: boolean;
};

const CONTACT_PHONE_NUMBER = "+91 89369 82996";
const CONTACT_PHONE_URI = "+918936982996";
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Hi Pravix, I want to connect regarding wealth planning, the AI dashboard, and a discovery call."
);
const WHATSAPP_URL = `https://wa.me/${CONTACT_PHONE_URI.replace(/^\+/, "")}?text=${WHATSAPP_MESSAGE}`;

function WhatsappIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        fill="currentColor"
        d="M12 2.2a9.8 9.8 0 0 0-8.46 14.77L2.3 22l5.15-1.21A9.8 9.8 0 1 0 12 2.2Zm0 17.78c-1.17 0-2.3-.23-3.34-.68l-.24-.1-3.06.72.74-2.98-.12-.25A7.63 7.63 0 1 1 12 19.98Zm4.42-5.8c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1-.36-1.9-1.14-.7-.63-1.17-1.4-1.31-1.64-.14-.24-.02-.38.1-.5.1-.1.24-.26.36-.4.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.42-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.34.98 2.5c.12.16 1.7 2.58 4.12 3.62.58.25 1.03.4 1.38.52.58.18 1.1.15 1.52.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"
      />
    </svg>
  );
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FloatingPravixChat({ signedIn, refreshKey }: FloatingPravixChatProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("Hi, I am Pravix AI. Ask me anything about your plan.");
  const [starterPrompts, setStarterPrompts] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const messageContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!signedIn) {
      setIsOpen(false);
      setIsQuickMenuOpen(false);
      setError(null);
      setMessages([]);
      setStarterPrompts([]);
      setHasBootstrapped(false);
    }
  }, [signedIn]);

  useEffect(() => {
    setError(null);
  }, [refreshKey]);

  useEffect(() => {
    const container = messageContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isOpen]);

  const getAccessToken = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error: authError } = await supabase.auth.getSession();

    if (authError) {
      throw authError;
    }

    const token = data.session?.access_token;
    if (!token) {
      throw new Error("Authentication session expired. Please sign in again.");
    }

    return token;
  }, []);

  const bootstrap = useCallback(async () => {
    if (!signedIn || hasBootstrapped || isBootstrapping) {
      return;
    }

    setIsBootstrapping(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/agent/bootstrap", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await response.json().catch(() => ({}))) as BootstrapPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not load Pravix AI context.");
      }

      setGreeting(payload.greeting ?? "Hi, I am Pravix AI. Ask me anything about your plan.");
      setStarterPrompts((payload.starterPrompts ?? []).slice(0, 3));
      setHasBootstrapped(true);
    } catch (bootstrapError) {
      setError(bootstrapError instanceof Error ? bootstrapError.message : "Could not initialize Pravix AI.");
    } finally {
      setIsBootstrapping(false);
    }
  }, [getAccessToken, hasBootstrapped, isBootstrapping, signedIn]);

  const quickSuggestions = useMemo(() => {
    if (starterPrompts.length > 0) {
      return starterPrompts;
    }

    return [
      "What should I prioritize this month?",
      "How do I reduce risk in my portfolio?",
      "How can I improve tax efficiency right now?",
    ];
  }, [starterPrompts]);

  async function openPanel() {
    if (!signedIn) {
      setIsOpen(false);
      setIsQuickMenuOpen(false);
      if (pathname !== "/create-account") {
        router.push("/create-account");
      }
      return;
    }

    setIsQuickMenuOpen(false);
    setIsOpen(true);
    if (signedIn) {
      await bootstrap();
    }
  }

  async function sendMessage(message: string) {
    const next = message.trim();
    if (!next || isSending) {
      return;
    }

    if (!signedIn) {
      setError("Sign in to chat with Pravix AI.");
      return;
    }

    setIsSending(true);
    setError(null);

    const userMessage: ChatMessage = {
      role: "user",
      content: next,
      sentAt: new Date().toISOString(),
    };

    setMessages((previous) => [...previous, userMessage]);
    setMessages((previous) => [...previous, { role: "assistant", content: "", sentAt: new Date().toISOString(), loading: true }]);
    setInput("");

    try {
      const token = await getAccessToken();
      const history = messages
        .slice(-10)
        .map((item) => ({ role: item.role, content: item.content }))
        .concat({ role: "user" as const, content: next });

      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: next,
          history,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as ChatPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not get a response from Pravix AI.");
      }

      setMessages((previous) => previous.slice(0, -1).concat({
        role: "assistant",
        content: payload.reply ?? "I could not generate a response right now.",
        sentAt: new Date().toISOString(),
        structured: payload.structured,
      }));
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Could not send message.");
      setMessages((previous) => previous.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      {isOpen ? (
        <div className="fixed inset-0 z-40 bg-[#142a4a]/18 backdrop-blur-[1px] sm:bg-transparent" onClick={() => setIsOpen(false)} />
      ) : null}

      {isOpen ? (
        <aside className="fixed bottom-24 left-4 right-4 z-50 rounded-2xl border border-finance-border bg-white/98 shadow-[0_16px_34px_rgba(31,42,36,0.14)] sm:left-auto sm:right-6 sm:w-[24rem]">
          <header className="flex items-center justify-between rounded-t-2xl border-b border-finance-border bg-[#1f3b35] px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold tracking-wide">Pravix AI</p>
              <p className="text-xs text-white/80">Wealth Copilot</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/30 text-white/90 transition-colors hover:bg-white/10"
              aria-label="Close Pravix AI chat"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="px-4 pb-4 pt-3">
            {!signedIn ? (
              <p className="rounded-xl border border-finance-border bg-finance-surface/70 px-3 py-2.5 text-sm text-finance-muted">
                Sign in to open your personalized Pravix AI chat.
              </p>
            ) : (
              <>
                <p className="rounded-xl border border-finance-accent/20 bg-finance-accent/10 px-3 py-2.5 text-sm text-finance-text">
                  {greeting}
                </p>

                <div ref={messageContainerRef} className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-1">
                  {messages.length === 0 ? (
                    <p className="text-xs text-finance-muted">Start with a quick prompt below.</p>
                  ) : (
                    messages.map((message, index) => (
                      <article
                        key={`${message.role}-${index}-${message.sentAt}`}
                        className={`rounded-xl px-3 py-2.5 text-sm ${
                          message.role === "assistant"
                            ? "bg-finance-surface/70 text-finance-text"
                            : "ml-auto max-w-[85%] bg-finance-accent text-white"
                        }`}
                      >
                        {message.loading ? (
                          <div className="flex items-center gap-2">
                            <LoadingSpinner className="h-3 w-3" />
                            <span>Thinking...</span>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        )}
                        {message.role === "assistant" && message.structured && !message.loading ? (
                          <div className="mt-2 rounded-lg border border-finance-border bg-white px-2.5 py-2 text-xs text-finance-text">
                            <p><span className="font-semibold">Next:</span> {message.structured.nextAction}</p>
                          </div>
                        ) : null}
                        <p className={`mt-1 text-[10px] ${message.role === "assistant" ? "text-finance-muted" : "text-white/80"}`}>
                          {formatTime(message.sentAt)}
                        </p>
                      </article>
                    ))
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {quickSuggestions.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={isSending || isBootstrapping}
                      onClick={() => void sendMessage(prompt)}
                      className="inline-flex min-h-8 items-center rounded-full border border-finance-border bg-white px-3 text-xs font-semibold text-finance-text transition-colors hover:bg-finance-surface disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                {error ? <p className="mt-2 text-xs text-finance-red">{error}</p> : null}

                <form
                  className="mt-3 flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendMessage(input);
                  }}
                >
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    disabled={isSending || isBootstrapping}
                    placeholder="Ask Pravix AI..."
                    className="h-10 flex-1 rounded-xl border border-finance-border bg-white px-3 text-sm text-finance-text focus:outline-none focus:ring-2 focus:ring-finance-accent/30 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                  <button
                    type="submit"
                    disabled={isSending || isBootstrapping || input.trim().length === 0}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-finance-accent text-white transition-all duration-150 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
                    aria-label="Send message to Pravix AI"
                  >
                    {isSending ? <LoadingSpinner /> : <Send className="h-4 w-4" />}
                  </button>
                </form>
              </>
            )}
          </div>
        </aside>
      ) : null}

      {isQuickMenuOpen ? (
        <div className="fixed inset-0 z-40" onClick={() => setIsQuickMenuOpen(false)} />
      ) : null}

      {isQuickMenuOpen ? (
        <aside className="fixed bottom-24 right-4 z-50 w-[18.5rem] rounded-2xl border border-[#d8e7ff] bg-white p-3 shadow-[0_16px_34px_rgba(31,42,36,0.16)] sm:right-6">
          <div className="mb-2 flex items-center justify-between px-1">
            <div>
              <p className="text-sm font-semibold tracking-wide text-[#0a1930]">Quick Connect</p>
              <p className="text-xs text-[#5f7396]">Call, WhatsApp, or book a call</p>
            </div>
            <button
              type="button"
              onClick={() => setIsQuickMenuOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d8e7ff] text-[#5f7396] transition-colors hover:bg-[#f5f8ff] hover:text-[#0a1930]"
              aria-label="Close quick connect menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <a
              href={`tel:${CONTACT_PHONE_URI}`}
              className="flex items-center gap-3 rounded-2xl border border-[#d8e7ff] bg-[#f8fbff] px-3 py-3 transition-all hover:-translate-y-0.5 hover:border-[#c1d4fb] hover:bg-white"
              onClick={() => setIsQuickMenuOpen(false)}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#2b5cff] text-white shadow-[0_8px_18px_rgba(43,92,255,0.22)]">
                <PhoneCall className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-[#0a1930]">Call Pravix</span>
            </a>

            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-[#d8e7ff] bg-[#f8fbff] px-3 py-3 transition-all hover:-translate-y-0.5 hover:border-[#c1d4fb] hover:bg-white"
              onClick={() => setIsQuickMenuOpen(false)}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#25d366] text-white shadow-[0_8px_18px_rgba(37,211,102,0.22)]">
                <WhatsappIcon />
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-[#0a1930]">WhatsApp Chat</span>
            </a>

            <a
              href="/#book-discovery-call"
              className="flex items-center gap-3 rounded-2xl border border-[#d8e7ff] bg-[#f8fbff] px-3 py-3 transition-all hover:-translate-y-0.5 hover:border-[#c1d4fb] hover:bg-white"
              onClick={() => setIsQuickMenuOpen(false)}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1f3b35] text-white shadow-[0_8px_18px_rgba(31,59,53,0.18)]">
                <CalendarDays className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-[#0a1930]">Book a Discovery Call</span>
            </a>
          </div>
        </aside>
      ) : null}

      <div className="fixed bottom-6 right-4 z-50 sm:right-6">
        <div className="flex flex-col items-end gap-3">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setIsQuickMenuOpen((current) => !current);
            }}
            className="group inline-flex h-12 w-12 items-center justify-center gap-0 rounded-full border border-[#1f3b35] bg-[#0a1930] px-0 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(10,25,48,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(10,25,48,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a1930]/40 sm:w-[12.5rem] sm:justify-between sm:gap-2 sm:px-4"
            aria-expanded={isQuickMenuOpen}
            aria-haspopup="menu"
            aria-label="Contact Pravix"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
              <PhoneCall className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">Contact Pravix</span>
            <Sparkles className="hidden h-4 w-4 text-white/85 transition-transform duration-200 group-hover:scale-110 sm:block" />
          </button>

          <button
            type="button"
            onClick={() => void openPanel()}
            className="group inline-flex h-12 w-12 items-center justify-center gap-0 rounded-full border border-[#1e44cd] bg-finance-accent px-0 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(43,92,255,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(43,92,255,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finance-accent/40 sm:w-[12.5rem] sm:justify-between sm:gap-2 sm:px-4"
            aria-label="Open Pravix AI"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
              {isBootstrapping ? (
                <LoadingSpinner />
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-[#7af5ff] sm:hidden" />
                  <MessageCircle className="hidden h-4 w-4 sm:block" />
                </>
              )}
            </span>
            <span className="hidden sm:inline">Pravix AI</span>
            <Sparkles className="hidden h-4 w-4 text-white/85 transition-transform duration-200 group-hover:scale-110 sm:block" />
          </button>
        </div>
      </div>
    </>
  );
}

