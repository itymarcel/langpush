export default function handler(req, res) {
  res.send(process.env.ADMIN_KEY);
}