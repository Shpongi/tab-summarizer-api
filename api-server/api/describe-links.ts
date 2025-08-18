export const config = { runtime: "edge" };

export async function POST(req: Request) {
  console.log("OPENAI_KEY_LEN", process.env.OPENAI_API_KEY?.length);
  }

type InLink = { url: string; title?: string | null };
type OutLink = { url: string; title?: string | null; description: string };



const MODEL = "gpt-4o-mini"; // אפשר לשנות בהתאם לצורך

const INSTRUCTIONS = `
אתה מסכם לינקים בקצרה ובעברית. לכל פריט {url, title?} החזר description של 1–2 משפטים, ענייני וללא פרסום-יתר.
אל תמציא פרטים שלא ניתן להסיק מהכותרת/URL. אם הכותרת חסרה – נסה להסיק נושא מהדומיין/נתיב.
`;

const SCHEMA = {
  name: "LinkSummaries",
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            url: { type: "string", format: "uri" },
            title: { anyOf: [{ type: "string" }, { type: "null" }] },
            description: { type: "string", minLength: 1, maxLength: 240 }
          },
          required: ["url", "description"]
        }
      }
    },
    required: ["items"],
    additionalProperties: false
  },
  strict: true
};

async function callOpenAI(batch: InLink[]): Promise<OutLink[]> {
  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // אין שום מפתח בתוך הקוד — רק מה־ENV:
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: INSTRUCTIONS,
      temperature: 0.2,
      response_format: { type: "json_schema", json_schema: SCHEMA },
      input: [
        { role: "user", content: [{ type: "text", text: JSON.stringify({ items: batch }) }] }
      ]
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`OpenAI ${resp.status}: ${t}`);
  }

  // התשובה מגיעה כטקסט JSON תקני בזכות ה-Structured Outputs
  const data = await resp.json();
  const outputText =
    data.output_text ??
    data.choices?.[0]?.message?.content ?? // fallback אם השרת יחזיר בפורמט ישן
    "{}";

  const parsed = JSON.parse(outputText);
  return Array.isArray(parsed?.items) ? parsed.items : [];
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
        { status: 400 }
      );
    }

    // חלוקה לבאצ'ים (אם יש הרבה לינקים)
    const BATCH_SIZE = 20;
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
