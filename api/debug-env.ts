// רץ ב־Node.js, כדי שלוגים יופיעו בטרמינל של vercel dev
export const config = { runtime: "nodejs" };

export default function handler(req: any, res: any) {
  console.log("[debug-env] got request", req.method, new Date().toISOString());
  console.log("OPENAI KEY LENGTH:", process.env.OPENAI_API_KEY?.length);
  console.log("TELEGRAM BOT TOKEN LENGTH:", process.env.TELEGRAM_BOT_TOKEN?.length);
  console.log("TELEGRAM CHAT ID LENGTH:", process.env.TELEGRAM_CHAT_ID?.length);

  res.status(200).json({
    ok: true,
    lengths: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY?.length ?? null,
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN?.length ?? null,
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID?.length ?? null,
    },
  });
}
