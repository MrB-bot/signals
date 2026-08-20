// netlify/functions/test-key.js
// Visit this URL directly in your browser (GET request, no body needed):
// https://YOUR-SITE.netlify.app/.netlify/functions/test-key
//
// It never reveals your full key — only whether it's present, what it starts/ends
// with (so you can confirm you pasted the right one), and whether Anthropic
// actually accepts it.

exports.handler = async function () {
  const cors = { "Access-Control-Allow-Origin": "*" };
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        keyPresent: false,
        message: "ANTHROPIC_API_KEY is not set in this deploy. Add it in Netlify > Site configuration > Environment variables, then trigger a new deploy.",
      }, null, 2),
    };
  }

  const preview = key.length > 12
    ? `${key.slice(0, 7)}...${key.slice(-4)}`
    : "(key is unusually short — check you copied the whole thing)";

  // Make the smallest possible real call to confirm Anthropic accepts the key
  let validation;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say OK" }],
      }),
    });
    const data = await res.json();

    if (res.status === 200) {
      validation = { status: "VALID", detail: "Anthropic accepted the key and returned a response." };
    } else if (res.status === 401) {
      validation = { status: "INVALID", detail: "Anthropic rejected the key (401 unauthorized). It's set, but it's the wrong value or has been revoked." };
    } else {
      validation = { status: "ERROR", httpStatus: res.status, detail: data };
    }
  } catch (err) {
    validation = { status: "ERROR", detail: String(err) };
  }

  return {
    statusCode: 200,
    headers: cors,
    body: JSON.stringify({ keyPresent: true, keyPreview: preview, validation }, null, 2),
  };
};
