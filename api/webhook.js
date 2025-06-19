import { Readable } from 'stream';

async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const bodyBuffer = await getRawBody(req);
    const body = JSON.parse(bodyBuffer.toString());
    const event = body.events?.[0];
    const replyToken = event?.replyToken;
    const [model, priceStr] = event.message.text.trim().split(" ");
    const price = parseInt(priceStr);
    const cost = price * 1.15;
    const marketPrice = 63000;
    const profit = marketPrice * 0.9 - cost;
    const profitRate = profit / cost;
    const goNoGo = (profit >= 10000 || profitRate >= 0.35) ? "⭕ Go" : "❌ NoGo";

    const message = `型番: ${model}\n仕入: ${Math.round(cost)}円\n相場: ${marketPrice}円\n利益率: ${(profitRate * 100).toFixed(2)}%\n${goNoGo}`;

    const response = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text: message }]
      })
    });

    const result = await response.text();
    console.log("LINE Reply API Result:", result);

    res.status(200).send("OK");
  } catch (err) {
    console.error("LINE Bot Error:", err);
    res.status(500).send("Internal Server Error");
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
