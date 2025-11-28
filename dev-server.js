/**
 * Development Server - No Database Required
 * Serves static files and provides mock API endpoints for UI development
 */

import express from "express";
import { randomPhraseNoRepeat } from "./phrases.js";

const app = express();
app.use(express.json());

// Serve static files
app.use(express.static('public'));

// Mock API endpoints
app.get('/vapidPublicKey', (req, res) => {
  res.send('mock-vapid-public-key');
});

app.get('/admin-key', (req, res) => {
  res.send('mock-admin-key');
});

app.post('/subscribe', (req, res) => {
  console.log('📝 Mock subscribe request');
  res.json({ ok: true, message: 'Mock subscription created' });
});

app.get('/subscribe/exists', (req, res) => {
  console.log('📝 Mock subscription check');
  res.json({ exists: false });
});

app.delete('/subscribe', (req, res) => {
  console.log('📝 Mock unsubscribe request');
  res.json({ ok: true, message: 'Mock subscription deleted' });
});

app.patch('/subscribe/difficulty', (req, res) => {
  console.log('📝 Mock difficulty update:', req.body.difficulty);
  res.json({ ok: true });
});

app.patch('/subscribe/language', (req, res) => {
  console.log('📝 Mock language update:', req.body.language);
  res.json({ ok: true });
});

app.post('/subscribe/ios', (req, res) => {
  console.log('📝 Mock iOS subscribe request');
  res.json({ ok: true, message: 'Mock iOS subscription created' });
});

app.get('/subscribe/ios/exists', (req, res) => {
  console.log('📝 Mock iOS subscription check');
  res.json({ exists: false });
});

app.get('/last-notification', (req, res) => {
  console.log('📝 Mock last notification request');

  // Generate a random phrase based on query params
  const language = req.query.language || 'italian';
  const difficulty = req.query.difficulty || 'easy';

  const phrase = randomPhraseNoRepeat(language, difficulty);
  const langKey = language === 'italian' ? 'it' :
                  language === 'spanish' ? 'es' :
                  language === 'french' ? 'fr' : 'ja';

  res.json({
    ok: true,
    hasNotification: true,
    original: phrase[langKey],
    english: phrase.en,
    language: language,
    sentAt: new Date().toISOString()
  });
});

app.get('/notifications', (req, res) => {
  console.log('📝 Mock notifications history request');

  // Generate mock history
  const mockHistory = [
    {
      phrase_original: "Buongiorno!",
      phrase_english: "Good morning!",
      language: "italian",
      difficulty: "easy",
      sent_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
      phrase_original: "Come stai?",
      phrase_english: "How are you?",
      language: "italian",
      difficulty: "easy",
      sent_at: new Date(Date.now() - 172800000).toISOString()
    },
    {
      phrase_original: "Grazie mille!",
      phrase_english: "Thanks a lot!",
      language: "italian",
      difficulty: "easy",
      sent_at: new Date(Date.now() - 259200000).toISOString()
    }
  ];

  res.json({
    ok: true,
    notifications: mockHistory
  });
});

app.post('/admin/send-now', (req, res) => {
  console.log('📝 Mock send now request');
  res.json({ ok: true, message: 'Mock notification sent' });
});

app.get('/admin/subs', (req, res) => {
  console.log('📝 Mock admin subs request');
  res.json({ ok: true, count: 0, subs: [] });
});

app.post('/admin/broadcast', (req, res) => {
  console.log('📝 Mock broadcast request');
  res.json({ ok: true, sent: 0 });
});

// Live reload endpoint
app.get('/live-reload', (req, res) => {
  res.json({ reload: false });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('🎨 Development Server Running');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📱 Open in browser: http://localhost:${PORT}`);
  console.log('🛠️  Press Cmd+D (or Ctrl+D) in browser to open dev tools');
  console.log('⚠️  No database required - all endpoints are mocked');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});
