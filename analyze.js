// netlify/functions/analyze.js
// 3-agent pipeline: Analysis -> News curation -> Watchlist
// Each stage is a separate Claude call with a narrow role, output of one feeds the next.
// Set ANTHROPIC_API_KEY in Netlify -> Site settings -> Environment variables.

const MODEL = "claude-sonnet-5";

async function callClaude(system, userContent, maxTokens = 500) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  const textBlock = (data.content || []).find((b) => b.type === "text");
  const clean = (textBlock?.text || "{}").replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    return { raw: textBlock?.text || "" };
  }
}

// ---- Agent 1: Analysis ----
async function analysisAgent(headlines, movers) {
  const system = `You are the Analysis agent in a market-monitoring pipeline.
Given headlines and today's price movers, determine overall market mood and rank which
2-6 headlines are actually market-moving vs noise. Respond ONLY with strict JSON:
{
  "pulse": "risk-on" | "risk-off" | "mixed" | "quiet",
  "keyHeadlines": ["headline text, exactly as given, most important first"],
  "factors": ["short factor phrase", "..."]
}`;
  const user = `HEADLINES:\n${headlines.slice(0, 25).map((h) => "- " + h).join("\n")}\n\nMOVERS:\n${movers
    .slice(0, 10)
    .map((m) => `- ${m.symbol}: ${m.change > 0 ? "+" : ""}${m.change}%`)
    .join("\n")}`;
  return callClaude(system, user, 500);
}

// ---- Agent 2: News ----
async function newsAgent(keyHeadlines, pulse) {
  const system = `You are the News agent in a market-monitoring pipeline. You receive headlines
already identified as market-moving. Rewrite each as one short, plain-English sentence a busy
person can read in 2 seconds, explaining WHY it matters. Respond ONLY with strict JSON:
{ "items": [{"headline": "original headline", "why": "one short sentence"}] }`;
  const user = `Overall mood: ${pulse}\n\nHEADLINES:\n${keyHeadlines.map((h) => "- " + h).join("\n")}`;
  return callClaude(system, user, 500);
}

// ---- Agent 3: Watchlist ----
async function watchlistAgent(factors, movers, pulse) {
  const system = `You are the Watchlist agent in a market-monitoring pipeline. You are NOT a
financial advisor. Given today's factors and price movers, list 2-5 tickers worth watching and
WHY, in strictly neutral language. Never say buy, sell, long, short, price target, or give any
instruction to act. Respond ONLY with strict JSON:
{ "watchlist": [{"ticker": "BTC", "why": "short neutral reason, not a recommendation"}] }`;
  const user = `Mood: ${pulse}\nFactors: ${factors.join(", ")}\nMovers:\n${movers
    .slice(0, 10)
    .map((m) => `- ${m.symbol}: ${m.change > 0 ? "+" : ""}${m.change}%`)
    .join("\n")}`;
  return callClaude(system, user, 400);
}

exports.handler = async function (event) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: "Method not allowed" };

  if (!process.env.ANTHROPIC_API_KEY) {
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

  try {
    const analysis = await analysisAgent(headlines, movers);
    const pulse = analysis.pulse || "mixed";
    const factors = analysis.factors || [];
    const keyHeadlines = analysis.keyHeadlines || headlines.slice(0, 5);

    const [news, watchlistRes] = await Promise.all([
      newsAgent(keyHeadlines, pulse),
      watchlistAgent(factors, movers, pulse),
    ]);

    const summary =
      news.items?.length ? news.items[0].why : "No major market-moving items identified this cycle.";

    const result = {
      pulse,
      summary,
      factors,
      watchlist: watchlistRes.watchlist || [],
      curatedSignals: news.items || [],
    };

    return { statusCode: 200, headers: cors, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: String(err) }) };
  }
};
