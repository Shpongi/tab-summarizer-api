export const config = { runtime: "edge" };
export default async function handler() {
  const val = process.env.OPENAI_API_KEY || "";
  return new Response(JSON.stringify({
    keyLen: val.length,
    prefix: val.slice(0,7),  // "sk-...."
    suffix: val.slice(-4)
  }), { headers: { "Content-Type": "application/json" }});
}
