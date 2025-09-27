export default function handler(req, res) {
  res.send(process.env.VAPID_PUBLIC_KEY);
}