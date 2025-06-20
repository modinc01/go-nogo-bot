export default async function handler(req, res) {
  const { model } = req.query;

  if (!model) {
    return res.status(400).json({ error: "型番が指定されていません" });
  }

  const avg = 63000;

  res.setHeader("Content-Type", "application/json");
  res.status(200).json({ avg });
}
