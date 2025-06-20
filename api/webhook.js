const { Readable } = require('stream');

async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const bodyBuffer = await getRawBody(req);
    const body = JSON.parse(bodyBuffer.toString());
    console.log("✅ Received Body:", body);

    const event = body.events?.[0];
    if (!event || event.type !== "message") {
      return res.status(200).send("Ignored");
    }

    const replyToken = event.replyToken;
    const [model, rawCost] = event.message.text.trim().split(" ");
    const cost = parseInt(rawCost);
    if (!model || isNaN(cost)) {
      return res.status(200).send("Invalid message format");
    }

    // オークファンのスクレイピングAPIを呼び出す
    const scrapeUrl = `https://go-nogo-bot.vercel.app/api/scrape?model=${encodeURIComponent(model)}`;
    const scrapeRes = await fetch(scrapeUrl);
    const data = await scrapeRes.json();

    if (!data.avg) {
      return await sendLineReply(replyToken, "❌ 相場取得に失敗しました");
    }

    const avgPrice = data.avg;
    const totalCost = Math.round(cost * 1.15);
    const profit = avgPrice - totalCost;
    const profitRate = Math.round((profit / totalCost) * 100);
    const result = (profit >= 10000 || profitRate >= 35) ? "✅ Go" : "❌ NoGo";

    const message =
      `📦 型番: ${model}\n` +
      `💴 仕入（手数料込）: ${totalCost}円\n` +
      `📊 相場: ${avgPrice}円\n` +
      `📈 利益率: ${profitRate}%\n` +
      `💰 利益: ${profit}円\n\n` +
      `${result}`;

    await sendLineReply(replyToken, message);
    res.status(200).send("OK");

  } catch (err) {
    console.error("💥 Webhook Error:", err);
    res.status(500).send("Internal Server Error");
  }
};

async function sendLineReply(replyToken, text) {
  const body = JSON.stringify({
    replyToken,
    messages: [{ type: "text", text }]
  });

  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CHANNEL_ACCESS_TOKEN}`
    },
    body
  });
}

module.exports.config = {
  api: {
    bodyParser: false,
  },
};

