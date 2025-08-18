// api/describe-and-send.ts
export const config = { runtime: "edge" };

type InLink = { url: string; title?: string | null; description?: string | null };
type OutLink = { url: string; title: string | null; description: string };

const MODEL = "gpt-4o-mini";

const INSTRUCTIONS = `
אתה מסכם לינקים בקצרה ובשפת המקור של הדף (או הכותרת).
החזר תיאור תמציתי (1–2 משפטים) אך בעל ערך: סוג התוכן (כתבה/פודקאסט/דף מוצר/עמוד בית),
למי זה מיועד או מה הערך המרכזי, ומה הנושא המוביל. אם מופיעים בכותרת/slug פרטים כמו שם/תאריך/מספר פרק – כלול זאת.
השתמש רק במידע שניתן להסיק מהכותרת/דומיין/נתיב/מטא שסופקו. אל תמציא. תמיד החזר בשפת המקור.
החזר תמיד אותו מספר פריטים ובאותו סדר.
`;

const JSON_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          url: { type: "string" },
          title: { anyOf: [{ type: "string" }, { type: "null" }] },
          description: { type: "string", minLength: 1, maxLength: 240 }
        },
        required: ["url", "title", "description"]
      }
    }
  },
  required: ["items"],
  additionalProperties: false
} as const;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function requireEnv(name: string): string {
  const v = (process.env as any)[name];
  if (!v || typeof v !== "string") {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

function extractStructuredJson(data: any): any {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    try { return JSON.parse(data.output_text); } catch {}
  }
  const content = data?.output?.[0]?.content;
  if (Array.isArray(content)) {
    for (const c of content) {
      if (c?.type === "output_text" && typeof c?.text === "string") {
        try { return JSON.parse(c.text); } catch {}
      }
      if (c?.type === "output_json" && c?.json) return c.json;
    }
  }
  if (typeof data?.choices?.[0]?.message?.content === "string") {
    try { return JSON.parse(data.choices[0].message.content); } catch {}
  }
  return null;
}

async function summarizeIfNeeded(items: InLink[], OPENAI_API_KEY: string): Promise<OutLink[]> {
  const needs = items.some(it => !it.description);
  if (!needs) {
    return items.map(it => ({
      url: it.url,
      title: it.title ?? null,
      description: String(it.description || "").slice(0, 240)
    }));
  }

  const payload = {
    model: MODEL,
    instructions: INSTRUCTIONS,
    temperature: 0.2,
    text: {
      format: {
        type: "json_schema",
        name: "LinkSummaries",
        schema: JSON_SCHEMA,
        strict: true
      }
    },
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              items: items.map(({ url, title }) => ({ url, title: title ?? null }))
            })
          }
        ]
      }
    ]
  };

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`OpenAI ${resp.status}: ${t}`);
  }

  const data = await resp.json();
  const parsed = extractStructuredJson(data);
  if (!parsed || !Array.isArray(parsed.items)) {
    // fallback אם ה-schema לא חזר — נשתמש בכותרת
    return items.map(it => ({
      url: it.url,
      title: it.title ?? null,
      description: it.description || (it.title ? String(it.title) : "קישור")
    }));
  }
  return parsed.items as OutLink[];
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function composeTelegramHtml(item: OutLink): string {
  const t = item.title ? `<b>${escapeHtml(item.title)}</b>\n` : "";
  return `${t}${escapeHtml(item.description)}`;
}

async function sendTelegram(item: OutLink, TELEGRAM_BOT_TOKEN: string, TELEGRAM_CHAT_ID: string) {
  const text = composeTelegramHtml(item);
  const chunks: string[] = [];

  if (text.length <= 4096) {
    chunks.push(text);
  } else {
    let i = 0;
    while (i < text.length) {
      chunks.push(text.slice(i, i + 4096));
      i += 4096;
    }
  }

  for (const chunk of chunks) {
    const body = {
      chat_id: TELEGRAM_CHAT_ID,
      text: chunk,
      parse_mode: "HTML",
      disable_web_page_preview: false,
      reply_markup: {
        inline_keyboard: [[{ text: "פתיחת קישור / Open", url: item.url }]]
      }
    };

    while (true) {
      const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (r.status === 429) {
        const j = await r.json().catch(() => ({}));
        const retry = Number(j?.parameters?.retry_after || 1);
        await new Promise(res => setTimeout(res, (retry + 1) * 1000));
        continue;
      }

      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`Telegram ${r.status}: ${t}`);
      }

      break;
    }
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), { status: 405, headers: corsHeaders() });
  }

  try {
    // 💡 משיכת ה־ENV בכל בקשה (לא ברמת המודול)
    const OPENAI_API_KEY = requireEnv("OPENAI_API_KEY");
    const TELEGRAM_BOT_TOKEN = requireEnv("TELEGRAM_BOT_TOKEN");
    const TELEGRAM_CHAT_ID = requireEnv("TELEGRAM_CHAT_ID");

    const body = await req.json().catch(() => ({}));
    const items: InLink[] = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) {
      return new Response(JSON.stringify({ error: "Body must be { items: [...] }" }), {
        status: 400, headers: corsHeaders()
      });
    }

    const summarized = await summarizeIfNeeded(items, OPENAI_API_KEY);
    for (const it of summarized) {
      await sendTelegram(it, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
      await new Promise(r => setTimeout(r, 200)); // anti-rate-limit קל
    }

    return new Response(JSON.stringify({ ok: true, sent: summarized.length }), {
      status: 200, headers: corsHeaders()
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500, headers: corsHeaders()
    });
  }
}
