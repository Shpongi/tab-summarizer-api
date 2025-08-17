import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { tabs } = req.body;

    const summaries = [];
    for (let tab of tabs) {
      const completion = await client.chat.completions.create({
        model: "gpt-5-nano",
        messages: [
          { role: "system", content: "סכם בעברית את הטקסט הבא בצורה קצרה" },
          { role: "user", content: `כותרת: ${tab.title}\nURL: ${tab.url}` }
        ],
        max_tokens: 100
      });

      summaries.push({
        title: tab.title,
        url: tab.url,
        summary: completion.choices[0].message.content
      });
    }

    res.status(200).json({ summaries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}
