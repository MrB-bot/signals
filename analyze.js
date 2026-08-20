// netlify/functions/analyze.js
// Server-side proxy to the Anthropic API. Keeps your API key secret.
// Set ANTHROPIC_API_KEY in Netlify → Site settings → Environment variables.

exports.handler = async function (event) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method not allowed" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY is not set in Netlify environment variables." }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { headlines = [], movers = [] } = payload;

  const systemPrompt = `You are a neutral market-analysis assistant embedded in a personal dashboard.
You are given a list of recent headlines and today's biggest price movers (stocks/crypto).
Your job: identify which 2-4 factors most plausibly explain today's market mood, and note which tickers
appear most relevant to watch. You are NOT a financial advisor and must never issue direct buy/sell
instructions or price targets. Frame everything as "factors to be aware of" and "worth watching", not
recommendations. Respond ONLY with strict JSON, no markdown fences, matching this shape:
{
  "pulse": "risk-on" | "risk-off" | "mixed" | "quiet",
  "summary": "one or two sentence plain-English summary of what's driving markets right now",
  "factors": ["short factor 1", "short factor 2", "short factor 3"],
  "watchlist": [{"ticker": "BTC", "why": "short reason, not a recommendation"}]
}`;

  const userContent = `HEADLINES:\n${headlines.slice(0, 25).map((h) => "- " + h).join("\n")}\n\nTOP MOVERS TODAY:\n${movers
    .slice(0, 10)
    .map((m) => `- ${m.symbol}: ${m.change > 0 ? "+" : ""}${m.change}%`)
    .join("\n")}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { statusCode: res.status, headers: cors, body: JSON.stringify({ error: data }) };
    }

    const textBlock = (data.content || []).find((b) => b.type === "text");
    let parsed;
    try {
      const clean = (textBlock?.text || "{}").replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      parsed = { pulse: "mixed", summary: textBlock?.text || "No analysis available.", factors: [], watchlist: [] };
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify(parsed) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: String(err) }) };
  }
};
