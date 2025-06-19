export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const event = req.body.events?.[0];
  if (!event || event.type !== "message" || !event.message.text) {
    return res.status(200).send("No message to handle");
  }

  const replyToken = event.replyToken;
  const [model, priceStr] = event.message.text.trim().split(" ");
  const price = parseInt(priceStr);
  if (!model || isNaN(price)) {
    return res.status(200).send("Invalid input");
  }

  // 仮相場（テスト用固定値）
  const marketPrice = 63000;

  const sellingAfterFee = marketPrice * 0.9;
  const cost = price * 1.15;
  const profit = sellingAfterFee - cost;
  const profitRate = profit / cost;
  const goNoGo = (profitRate >= 0.35 || profit >= 10000) ? "⭕ Go" : "❌ NoGo";

  const message = 
    `📦 型番：${model}\n` +
    `💴 仕入価格：${Math.round(cost)}円（手数料込み）\n` +
    `📊 相場価格：${marketPrice}円\n` +
    `🧾 利益率：${(profitRate * 100).toFixed(2)}%\n` +
    `${goNoGo}`;

  await fetch("https://api.line.me/v2/bot/message/reply", {
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

  res.status(200).send("OK");
}

