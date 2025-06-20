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
    console.log("✅ Received Body:", JSON.stringify(body, null, 2));

    const event = body.events?.[0];
    if (!event || event.type !== "message") {
      console.log("⛔ イベントが不正です");
      return res.status(200).send("Ignored");
    }

    const replyToken = event.replyToken;
    const [model, rawCost] = event.message.text.trim().split(" ");
    const cost = parseInt(rawCost);
    if (!model || isNaN(cost)) {
      console.log("⛔ フォーマット不正:", model, rawCost);
      return res.status(200).send("Invalid message format");
    }

    const totalCost = Math.round(cost * 1.15);
    const scrapeUrl = `https://go-nogo-bot.vercel.app/api/scrape?model=${encodeURIComponent(model)}`;
    console.log("🟡 相場取得URL:", scrapeUrl);

    let avgPrice = null;

    try {
      const scrapeRes = await fetch(scrapeUrl);
      console.log("📡 scrape status:", scrapeRes.status);
      const data = await scrapeRes.json();
      console.log("📡 scrape data:", data);
      avgPrice = data.avg;
    } catch (err) {
      console.error("💥 相場取得エラー:", err);
    }

    if (!avgPrice) {
      return await sendLineReply(replyToken, "❌ 相場取得に失敗しました");
    }

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
    console.error("💥 Webhook全体のエラー:", err);
    res.status(500).send("Internal Server Error");
  }
};

async function sendLineReply(replyToken, text) {
  const body = JSON.stringify({
    replyToken,
    messages: [{ type: "text", text }]
  });

  try {
    const lineRes = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CHANNEL_ACCESS_TOKEN}`
      },
      body
    });

    const responseText = await lineRes.text();
    console.log("📤 LINE返信ステータス:", lineRes.status);
    console.log("📤 LINEレスポンス:", responseText);
  } catch (err) {
    console.error("💥 LINEへの返信エラー:", err);
  }
}

module.exports.config = {
  api: {
    bodyParser: false,
  },
};


