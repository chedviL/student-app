import { supabase } from "../lib/supabaseClient";

export type AIChatRole = "user" | "assistant";

export interface AIChatMessage {
  role: AIChatRole;
  content: string;
}

export interface AIChatResponse {
  answer: string;
}

export async function askInstitutionAI(
  messages: AIChatMessage[],
): Promise<AIChatResponse> {
  const trimmed = messages
    .filter((message) => message.content.trim())
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));

  if (trimmed.length === 0) {
    throw new Error("יש לכתוב שאלה לעוזר.");
  }

  const { data, error } = await supabase.functions.invoke("ai-assistant", {
    body: { messages: trimmed },
  });

  if (error) {
    throw new Error(error.message || "לא ניתן היה לפנות לעוזר ה-AI.");
  }

  if (!data || typeof data.answer !== "string") {
    throw new Error("התקבלה תשובה לא תקינה משירות ה-AI.");
  }

  return { answer: data.answer };
}
