import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Bot,
  MessageCircleMore,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards, RotateCcw } from "lucide-react";
import { askInstitutionAI, type AIChatMessage } from "../api/aiApi";
import "./AIAssistantPage.css";

type ChatEntry = AIChatMessage & { id: string };

const STARTER_ACTIONS = [
  {
    label: "חיפוש תלמיד",
    prompt: "מצא לי את התלמיד: ",
    icon: Search,
  },
  {
    label: "בדיקת יתרת חוב",
    prompt: "כמה כסף חייב התלמיד: ",
    icon: WalletCards,
  },
  {
    label: "הצגת פרטי תלמיד",
    prompt: "הצג לי פרטים על התלמיד: ",
    icon: UserRound,
  },
  {
    label: "פרטי הורים",
    prompt: "הצג לי את פרטי ההורים של התלמיד: ",
    icon: MessageCircleMore,
  },
];

const INITIAL_MESSAGE: ChatEntry = {
  id: "welcome",
  role: "assistant",
  content: "שלום! איך אפשר לעזור?\nשאלו אותי כל דבר שתרצו לדעת על תלמידים ונתוני המערכת.",
};

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<ChatEntry[]>([INITIAL_MESSAGE]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const conversationForApi = useMemo(
    () =>
      messages
        .filter((message) => message.id !== "welcome")
        .map(({ role, content }) => ({ role, content })),
    [messages],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const container = messagesRef.current;
      if (!container) return;

      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, loading]);

  async function submitQuestion(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;

    const userMessage: ChatEntry = {
      id: crypto.randomUUID(),
      role: "user",
      content: clean,
    };

    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setError("");
    setLoading(true);

    try {
      const response = await askInstitutionAI([
        ...conversationForApi,
        { role: "user", content: clean },
      ]);

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.answer,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה בפנייה לעוזר.");
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }
  function resetConversation() {
    setMessages([INITIAL_MESSAGE]);
    setQuestion("");
    setError("");

    window.setTimeout(() => {
      const chat = document.querySelector(".ai-messages");

      if (chat instanceof HTMLElement) {
        chat.scrollTop = 0;
      }

      inputRef.current?.focus();
    }, 0);
  }



  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitQuestion(question);
  }

  function chooseStarter(prompt: string) {
    setQuestion(prompt);

    window.setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;

      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }, 0);
  }

  return (
    <main className="ai-page with-navbar">
      <div className="ai-shell">
        <section className="ai-hero">
          <div className="ai-hero-copy">
            <span className="ai-kicker">
              <Sparkles size={16} />
              עוזר חכם המחובר לנתוני המערכת
            </span>

            <h1>עוזר AI למערכת התלמידים</h1>

            <p>
              שאלו בשפה חופשית על תלמידים, פרטים ותשלומים וקבלו תשובה המבוססת
              על המידע המעודכן במערכת.
            </p>
          </div>

          <div className="ai-capabilities" aria-label="יכולות העוזר">
            <div>
              <MessageCircleMore size={18} />
              <span>מבין שאלות חופשיות</span>
            </div>
            <div>
              <RefreshCw size={18} />
              <span>נתונים עדכניים</span>
            </div>
            <div>
              <ShieldCheck size={18} />
              <span>גישה בטוחה</span>
            </div>
          </div>
        </section>

        <section className="ai-workspace">
          <div className="ai-chat-card">
            <div className="ai-chat-header">
              <div className="ai-ready-status">
                <div className="ai-status-dot" />
                <span>מוכן לשאלות</span>
              </div>

              <button
                type="button"
                className="ai-new-chat-button"
                onClick={resetConversation}
                disabled={loading}
                title="פתיחת שיחה חדשה"
              >
                <RotateCcw size={16} />
                <span>שיחה חדשה</span>
              </button>

            </div>

            <div ref={messagesRef} className="ai-messages" aria-live="polite">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`ai-message-row ${
                    message.role === "user" ? "user" : "assistant"
                  }`}
                >
                  <div className="ai-avatar" aria-hidden="true">
                    {message.role === "user" ? (
                      <UserRound size={18} />
                    ) : (
                      <Bot size={18} />
                    )}
                  </div>

                  <div className="ai-message-bubble">{message.content}</div>
                </div>
              ))}

              {loading && (
                <div className="ai-message-row assistant">
                  <div className="ai-avatar">
                    <Bot size={18} />
                  </div>

                  <div className="ai-message-bubble ai-typing">
                    <span />
                    <span />
                    <span />
                    בודק את הנתונים...
                  </div>
                </div>
              )}
            </div>

            {error && <div className="ai-error">{error}</div>}

            <form className="ai-composer" onSubmit={handleSubmit}>
              <textarea
                ref={inputRef}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submitQuestion(question);
                  }
                }}
                rows={2}
                placeholder="כתבו כאן שאלה על תלמיד או על נתוני המערכת..."
                disabled={loading}
              />

              <button
                type="submit"
                disabled={loading || !question.trim()}
                aria-label="שליחת שאלה"
              >
                <Send size={19} />
                שליחה
              </button>
            </form>
          </div>

          <aside className="ai-side-card">
            <div className="ai-side-heading">
              <Sparkles size={18} />
              <div>
                <h2>אפשר לנסות</h2>
                <p>בחרו פעולה, השלימו את שם התלמיד ושלחו.</p>
              </div>
            </div>

            <div className="ai-starters">
              {STARTER_ACTIONS.map((starter) => {
                const Icon = starter.icon;

                return (
                  <button
                    key={starter.label}
                    type="button"
                    onClick={() => chooseStarter(starter.prompt)}
                    disabled={loading}
                  >
                    <Icon size={18} />
                    <span>{starter.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
