// api/describe-links.ts
export const config = { runtime: "edge" };

type InLink = { url: string; title?: string | null };
type OutLink = { url: string; title: string | null; description: string };

const MODEL = "gpt-4o-mini";

// הוראות מחודדות: שפה מקור + פרטים קונקרטיים בלי להמציא
const INSTRUCTIONS = `
אתה מסכם לינקים בקצרה בשפת המקור של הדף (או הכותרת).
החזר תיאור תמציתי (1–2 משפטים), אך בעל ערך: ציין את סוג התוכן (למשל: פודקאסט/כתבה/דף מוצר/עמוד בית),
למי זה מיועד או מה הערך המרכזי, ומה הרעיון/נושא המוביל. אם מופיעים בכותרת/slug פרטים כמו שם אדם/תאריך/מספר פרק – כלול זאת.
השתמש רק במידע שניתן להסיק מהכותרת, מהדומיין והמטא-דאטה (og/meta/כותרת הדף) שסופקו. אל תוסיף מידע שלא נמסר.
אם כמעט ואין מידע – כתוב תיאור כללי אך הוגן בהתאם לדומיין/נתיב. תמיד החזר בשפת המקור (ללא תרגום).
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
      if (c?.type === "output_json" && c?.json) {
        return c.json;
      }
    }
  }
  if (typeof data?.choices?.[0]?.message?.content === "string") {
    try { return JSON.parse(data.choices[0].message.content); } catch {}
  }
  return null;
}

// --- עזר: זיהוי RTL ---
const HEBREW_RE = /[\u0590-\u05FF]/;
const ARABIC_RE = /[\u0600-\u06FF]/;

function detectLangHint(s: string | null | undefined): "rtl" | "ltr" | "auto" {
  if (!s) return "auto";
  if (HEBREW_RE.test(s) || ARABIC_RE.test(s)) return "rtl";
  return "ltr";
}

// --- שליפת מטא-דאטה בסיסית מהעמוד ---
async function fetchMetadata(url: string): Promise<{ metaTitle?: string; metaDesc?: string; htmlLang?: string; }> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000); // 5s timeout
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TabSummarizerBot/1.0)"
      },
      signal: controller.signal
    }).catch(() => null);
    clearTimeout(t);
    if (!resp || !resp.ok) return {};

    const html = await resp.text();
    // חיפושים מינימליים שלא דורשים DOMParser (Edge runtime)
    const metaOgTitle = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1];
    const metaOgDesc  = /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1];
    const metaDesc    = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1];
    const htmlLang    = /<html[^>]+lang=["']([^"']+)["']/i.exec(html)?.[1];
    const titleTag    = /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1];

    return {
      metaTitle: metaOgTitle || titleTag,
      metaDesc: metaOgDesc || metaDesc,
      htmlLang
    };
  } catch {
    return {};
  }
}

async function callOpenAI(batch: InLink[]): Promise<OutLink[]> {
  // שלוף מטא-דאטה לכל לינק כדי להעשיר (במקביל)
  const enriched = await Promise.all(
    batch.map(async (item) => {
      const meta = await fetchMetadata(item.url);
      // רמז שפה: לפי metaTitle/metaDesc/title/slug
      const langHint = detectLangHint(meta.metaTitle || meta.metaDesc || item.title || item.url);
      return {
        url: item.url,
        title: item.title ?? null,
        metaTitle: meta.metaTitle,
        metaDesc: meta.metaDesc,
        htmlLang: meta.htmlLang,
        langHint
      };
    })
  );

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
            // נעביר למודל גם את המטא-דאטה כדי שיוכל לתת ערך אמיתי
            text: JSON.stringify({ items: enriched })
          }
        ]
      }
    ]
  };

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`
      ,
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
    // לוג עזר—אפשר למחוק בפרודקשן
    console.warn("No items parsed. Raw response preview:", JSON.stringify(data, null, 2).slice(0, 1500));
    return [];
  }
  return parsed.items as OutLink[];
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), { status: 405 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const items: InLink[] = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) {
      return new Response(
        JSON.stringify({ error: "Body must be { items: [{ url, title? }, ...] }" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // באצ'ינג לשמירה על קצבים
    const BATCH_SIZE = 12;
    const outputs: OutLink[] = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const got = await callOpenAI(batch);
      outputs.push(...got);
    }

    return new Response(JSON.stringify({ items: outputs }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
