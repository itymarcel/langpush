import express from "express";
import bodyParser from "body-parser";
import pkg from 'pg'
import webpush from "web-push";
import apn from "node-apn";
import { randomPhraseNoRepeat } from "./phrases.js";
import { config } from 'dotenv';
import https from 'https';
import fs from 'fs';
import chokidar from 'chokidar';

config();

const { Pool } = pkg

const app = express();
app.use(bodyParser.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})
await pool.query(`CREATE TABLE IF NOT EXISTS subs (
  id BIGSERIAL PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_phrase_original TEXT,
  last_phrase_english TEXT,
  last_phrase_language VARCHAR(20),
  last_notification_sent_at TIMESTAMP
)`)

// Create notifications table for history
await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT REFERENCES subs(id) ON DELETE CASCADE,
  phrase_original TEXT NOT NULL,
  phrase_english TEXT NOT NULL,
  language VARCHAR(20) NOT NULL,
  difficulty VARCHAR(20) NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`)

// Add created_at column if it doesn't exist (for existing databases)
await pool.query(`
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subs' AND column_name='created_at') THEN
      ALTER TABLE subs ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
  END $$;
`)

// Add last notification columns if they don't exist (for existing databases)
try {
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subs' AND column_name='last_phrase_original') THEN
        ALTER TABLE subs ADD COLUMN last_phrase_original TEXT;
        RAISE NOTICE 'Added column: last_phrase_original';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subs' AND column_name='last_phrase_english') THEN
        ALTER TABLE subs ADD COLUMN last_phrase_english TEXT;
        RAISE NOTICE 'Added column: last_phrase_english';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subs' AND column_name='last_phrase_language') THEN
        ALTER TABLE subs ADD COLUMN last_phrase_language VARCHAR(20);
        RAISE NOTICE 'Added column: last_phrase_language';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subs' AND column_name='last_notification_sent_at') THEN
        ALTER TABLE subs ADD COLUMN last_notification_sent_at TIMESTAMP;
        RAISE NOTICE 'Added column: last_notification_sent_at';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subs' AND column_name='deactivated') THEN
        ALTER TABLE subs ADD COLUMN deactivated BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added column: deactivated';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subs' AND column_name='difficulty') THEN
        ALTER TABLE subs ADD COLUMN difficulty VARCHAR(20) DEFAULT 'easy';
        RAISE NOTICE 'Added column: difficulty';
      END IF;
      -- Add Capacitor/iOS app support columns
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subs' AND column_name='platform') THEN
        ALTER TABLE subs ADD COLUMN platform VARCHAR(20) DEFAULT 'web';
        RAISE NOTICE 'Added column: platform';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subs' AND column_name='ios_token') THEN
        ALTER TABLE subs ADD COLUMN ios_token TEXT;
        RAISE NOTICE 'Added column: ios_token';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subs' AND column_name='language') THEN
        ALTER TABLE subs ADD COLUMN language VARCHAR(20) DEFAULT 'italian';
        RAISE NOTICE 'Added column: language';
      END IF;
    END $$;
  `);

  // Create indexes for better performance
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subs_platform ON subs(platform);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subs_ios_token ON subs(ios_token);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subs_language ON subs(language);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subs_deactivated ON subs(deactivated);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_subscription_sent_at ON notifications(subscription_id, sent_at DESC);`);

  // Migrate iOS language data from JSON data column to dedicated language column
  console.log('🔄 Migrating iOS language data...');
  const { rows: iosRows } = await pool.query(`
    SELECT id, data
    FROM subs
    WHERE platform = 'ios'
    AND (language IS NULL OR language = 'italian')
    AND data IS NOT NULL
  `);

  for (const row of iosRows) {
    try {
      const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      if (data.language && data.language !== 'italian') {
        await pool.query(
          `UPDATE subs SET language = $1 WHERE id = $2`,
          [data.language, row.id]
        );
        console.log(`✅ Migrated language '${data.language}' for iOS subscription ${row.id}`);
      }
    } catch (error) {
      console.error(`❌ Failed to migrate language for iOS subscription ${row.id}:`, error);
    }
  }

  console.log('✅ Database migration completed successfully');
} catch (error) {
  console.error('❌ Database migration failed:', error);
  console.error('Migration error details:', error.message);
  process.exit(1);
}

// Web Push (PWA) setup
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CONTACT_EMAIL } = process.env;
webpush.setVapidDetails(`mailto:${CONTACT_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// APNs (iOS) setup
let apnProvider = null;
if (process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_KEY_PATH) {
  let keyData;

  // Check if APNS_KEY_PATH is base64/raw key content or a file path
  if (process.env.APNS_KEY_PATH.startsWith('-----BEGIN PRIVATE KEY-----') ||
      process.env.APNS_KEY_PATH.length > 200) {
    // It's raw key content (base64 decoded or direct)
    keyData = process.env.APNS_KEY_PATH;
  } else {
    // It's a file path - read from filesystem
    try {
      const fs = require('fs');
      keyData = fs.readFileSync(process.env.APNS_KEY_PATH, 'utf8');
    } catch (error) {
      console.error('❌ Failed to read APNs key file:', error);
      keyData = null;
    }
  }

  if (keyData) {
    const apnOptions = {
      token: {
        key: keyData,
        keyId: process.env.APNS_KEY_ID,
        teamId: process.env.APNS_TEAM_ID
      },
      production: process.env.APNS_PRODUCTION === 'true' // false = sandbox (dev builds), true = production (TestFlight/App Store)
    };

    try {
      apnProvider = new apn.Provider(apnOptions);
      const environment = process.env.APNS_PRODUCTION === 'true' ? 'production' : 'sandbox';
      console.log(`✅ APNs provider initialized successfully (${environment} environment)`);
    } catch (error) {
      console.error('❌ APNs provider initialization failed:', error);
    }
  } else {
    console.log('⚠️ APNs key could not be loaded. iOS push notifications will be disabled.');
  }
} else {
  console.log('⚠️ APNs credentials not configured. iOS push notifications will be disabled.');
}

app.get("/vapidPublicKey", (req, res) => {
  res.send(VAPID_PUBLIC_KEY);
});

app.get("/admin-key", (req, res) => {
  res.send(process.env.ADMIN_KEY);
});

// Get last notification for a subscription
app.get("/last-notification", async (req, res) => {
  const { endpoint, iosToken } = req.query;

  if (!endpoint && !iosToken) {
    return res.status(400).json({ ok: false, error: "Missing endpoint or iosToken" });
  }

  try {
    let query, params;

    if (iosToken) {
      // iOS token lookup
      console.log('📱 [Last Notification] Using iOS token lookup:', iosToken);
      query = "SELECT last_phrase_original, last_phrase_english, last_phrase_language, last_notification_sent_at FROM subs WHERE ios_token = $1 AND (deactivated = FALSE OR deactivated IS NULL)";
      params = [iosToken];
    } else {
      // Web endpoint lookup
      console.log('🌐 [Last Notification] Using web endpoint lookup:', endpoint);
      query = "SELECT last_phrase_original, last_phrase_english, last_phrase_language, last_notification_sent_at FROM subs WHERE data->>'endpoint' = $1 AND (deactivated = FALSE OR deactivated IS NULL)";
      params = [endpoint];
    }

    const { rows } = await pool.query(query, params);

    if (rows.length === 0) {
      console.log('❌ [Last Notification] Subscription not found');
      return res.status(404).json({ ok: false, error: "Subscription not found" });
    }

    const notification = rows[0];
    if (!notification.last_phrase_original) {
      console.log('ℹ️ [Last Notification] No notification found for subscription');
      return res.json({ ok: true, hasNotification: false });
    }

    console.log('✅ [Last Notification] Notification found and returned');
    res.json({
      ok: true,
      hasNotification: true,
      original: notification.last_phrase_original,
      english: notification.last_phrase_english,
      language: notification.last_phrase_language,
      sentAt: notification.last_notification_sent_at
    });
  } catch (error) {
    console.error("❌ [Last Notification] Database error:", error);
    res.status(500).json({ ok: false, error: "Database error" });
  }
});

// Get notification history for a subscription
app.get("/notifications", async (req, res) => {
  const { endpoint, iosToken, limit = 10 } = req.query;

  if (!endpoint && !iosToken) {
    return res.status(400).json({ ok: false, error: "Missing endpoint or iosToken" });
  }

  try {
    let query, params;

    if (iosToken) {
      // iOS token lookup
      query = `
        SELECT n.phrase_original, n.phrase_english, n.language, n.difficulty, n.sent_at
        FROM notifications n
        JOIN subs s ON n.subscription_id = s.id
        WHERE s.ios_token = $1
        AND (s.deactivated = FALSE OR s.deactivated IS NULL)
        ORDER BY n.sent_at DESC
        LIMIT $2
      `;
      params = [iosToken, parseInt(limit)];
    } else {
      // Web endpoint lookup
      query = `
        SELECT n.phrase_original, n.phrase_english, n.language, n.difficulty, n.sent_at
        FROM notifications n
        JOIN subs s ON n.subscription_id = s.id
        WHERE s.data->>'endpoint' = $1
        AND (s.deactivated = FALSE OR s.deactivated IS NULL)
        ORDER BY n.sent_at DESC
        LIMIT $2
      `;
      params = [endpoint, parseInt(limit)];
    }

    const { rows } = await pool.query(query, params);

    res.json({
      ok: true,
      notifications: rows
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ ok: false, error: "Database error" });
  }
});

function guard(req, res, next) {
  if (req.get("X-Admin-Key") !== process.env.ADMIN_KEY) return res.sendStatus(401);
  next();
}

// count + sample
app.get("/admin/subs", guard, async (req, res) => {
  const showDeactivated = req.query.show_deactivated === 'true';

  let query = "SELECT id, data, created_at, deactivated, difficulty FROM subs";
  let countQuery = "SELECT COUNT(*)::int AS c FROM subs";

  if (!showDeactivated) {
    query += " WHERE deactivated = FALSE OR deactivated IS NULL";
    countQuery += " WHERE deactivated = FALSE OR deactivated IS NULL";
  }

  query += " ORDER BY created_at DESC LIMIT 25";

  const { rows } = await pool.query(query);
  const { rows: c } = await pool.query(countQuery);
  const { rows: deactivatedCount } = await pool.query("SELECT COUNT(*)::int AS c FROM subs WHERE deactivated = TRUE");

  res.json({
    count: c[0].c,
    deactivated_count: deactivatedCount[0].c,
    rows
  });
});


app.post("/subscribe", async (req, res) => {
  const sub = req.body;
  const endpoint = sub?.endpoint;
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });

  try {
    // Extract difficulty from the request body, default to 'easy'
    const difficulty = sub.difficulty || 'easy';

    // Check if subscription already exists (active or deactivated)
    const { rows: existing } = await pool.query("SELECT id, deactivated FROM subs WHERE data->>'endpoint' = $1", [endpoint]);

    if (existing.length > 0) {
      // Reactivate existing subscription and update data and difficulty
      await pool.query(
        "UPDATE subs SET data = $1, difficulty = $2, platform = 'web', deactivated = FALSE WHERE data->>'endpoint' = $3",
        [JSON.stringify(sub), difficulty, endpoint]
      );
    } else {
      // Create new subscription
      await pool.query("INSERT INTO subs (data, difficulty, platform, deactivated) VALUES ($1, $2, 'web', FALSE)", [JSON.stringify(sub), difficulty]);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Subscribe error:", error);
    res.status(500).json({ ok: false, error: "Database error" });
  }
});

// 1) check if a subscription exists (by endpoint) - exclude deactivated
app.get("/subscribe/exists", async (req, res) => {
  const endpoint = req.query.endpoint;
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });
  const { rows } = await pool.query("SELECT 1 FROM subs WHERE data->>'endpoint' = $1 AND (deactivated = FALSE OR deactivated IS NULL) LIMIT 1", [endpoint]);
  res.json({ ok: true, exists: rows.length > 0 });
});

// 2) deactivate subscription (by endpoint) - soft delete
app.delete("/subscribe", async (req, res) => {
  const endpoint = req.body?.endpoint || req.query.endpoint;
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });
  const r = await pool.query("UPDATE subs SET deactivated = TRUE WHERE data->>'endpoint' = $1 AND (deactivated = FALSE OR deactivated IS NULL)", [endpoint]);
  res.json({ ok: true, deactivated: r.rowCount });
});

// 3) update difficulty for existing subscription
app.patch("/subscribe/difficulty", async (req, res) => {
  const { endpoint, iosToken, difficulty } = req.body;

  if (!endpoint && !iosToken) {
    return res.status(400).json({ ok: false, error: "Missing endpoint or iosToken" });
  }
  if (!difficulty || !['easy', 'medium'].includes(difficulty)) {
    return res.status(400).json({ ok: false, error: "Invalid difficulty. Must be 'easy' or 'medium'" });
  }

  try {
    let query, params;

    if (iosToken) {
      // iOS token lookup
      console.log('📱 [Difficulty Update] Using iOS token:', iosToken, 'difficulty:', difficulty);
      query = "UPDATE subs SET difficulty = $1 WHERE ios_token = $2 AND (deactivated = FALSE OR deactivated IS NULL)";
      params = [difficulty, iosToken];
    } else {
      // Web endpoint lookup
      console.log('🌐 [Difficulty Update] Using web endpoint:', endpoint, 'difficulty:', difficulty);
      query = "UPDATE subs SET difficulty = $1 WHERE data->>'endpoint' = $2 AND (deactivated = FALSE OR deactivated IS NULL)";
      params = [difficulty, endpoint];
    }

    const r = await pool.query(query, params);

    if (r.rowCount === 0) {
      console.log('❌ [Difficulty Update] Active subscription not found');
      return res.status(404).json({ ok: false, error: "Active subscription not found" });
    }

    console.log('✅ [Difficulty Update] Successfully updated difficulty for', r.rowCount, 'subscription(s)');
    res.json({ ok: true, updated: r.rowCount });
  } catch (error) {
    console.error("❌ [Difficulty Update] Database error:", error);
    res.status(500).json({ ok: false, error: "Database error" });
  }
});

// 4) update language for existing subscription
app.patch("/subscribe/language", async (req, res) => {
  const { endpoint, iosToken, language } = req.body;

  if (!endpoint && !iosToken) {
    return res.status(400).json({ ok: false, error: "Missing endpoint or iosToken" });
  }
  if (!language || !['italian', 'spanish', 'french', 'japanese'].includes(language)) {
    return res.status(400).json({ ok: false, error: "Invalid language. Must be 'italian', 'spanish', 'french', or 'japanese'" });
  }

  try {
    if (iosToken) {
      // iOS token lookup - language is stored in dedicated column
      console.log('📱 [Language Update] Using iOS token:', iosToken, 'language:', language);
      const r = await pool.query(
        "UPDATE subs SET language = $1 WHERE ios_token = $2 AND (deactivated = FALSE OR deactivated IS NULL)",
        [language, iosToken]
      );

      if (r.rowCount === 0) {
        console.log('❌ [Language Update] Active iOS subscription not found');
        return res.status(404).json({ ok: false, error: "Active subscription not found" });
      }

      console.log('✅ [Language Update] Successfully updated iOS language for', r.rowCount, 'subscription(s)');
      res.json({ ok: true, updated: r.rowCount });
    } else {
      // Web endpoint lookup - language is stored in data JSON
      console.log('🌐 [Language Update] Using web endpoint:', endpoint, 'language:', language);

      // Get current subscription data
      const { rows: current } = await pool.query(
        "SELECT data FROM subs WHERE data->>'endpoint' = $1 AND (deactivated = FALSE OR deactivated IS NULL)",
        [endpoint]
      );

      if (current.length === 0) {
        console.log('❌ [Language Update] Active web subscription not found');
        return res.status(404).json({ ok: false, error: "Active subscription not found" });
      }

      // Update the language in the subscription data
      const subscriptionData = typeof current[0].data === "string" ? JSON.parse(current[0].data) : current[0].data;
      subscriptionData.language = language;

      const r = await pool.query(
        "UPDATE subs SET data = $1 WHERE data->>'endpoint' = $2 AND (deactivated = FALSE OR deactivated IS NULL)",
        [JSON.stringify(subscriptionData), endpoint]
      );

      console.log('✅ [Language Update] Successfully updated web language for', r.rowCount, 'subscription(s)');
      res.json({ ok: true, updated: r.rowCount });
    }
  } catch (error) {
    console.error("❌ [Language Update] Database error:", error);
    res.status(500).json({ ok: false, error: "Database error" });
  }
});

// 5) iOS token registration endpoint for Capacitor app
app.post("/subscribe/ios", async (req, res) => {
  console.log('📱 [iOS] Subscription request received');
  console.log('📱 [iOS] Request body:', JSON.stringify(req.body, null, 2));

  const { deviceToken, language = 'italian', difficulty = 'easy' } = req.body;

  if (!deviceToken) {
    return res.status(400).json({ ok: false, error: "Missing deviceToken" });
  }

  if (!['easy', 'medium'].includes(difficulty)) {
    return res.status(400).json({ ok: false, error: "Invalid difficulty. Must be 'easy' or 'medium'" });
  }

  if (!['italian', 'spanish', 'french', 'japanese'].includes(language)) {
    return res.status(400).json({ ok: false, error: "Invalid language" });
  }

  try {
    // Check if this device token already exists
    const existing = await pool.query(
      "SELECT id FROM subs WHERE ios_token = $1 AND (deactivated = FALSE OR deactivated IS NULL)",
      [deviceToken]
    );

    if (existing.rows.length > 0) {
      // Update existing iOS subscription
      const r = await pool.query(
        "UPDATE subs SET data = $1, difficulty = $2, language = $3 WHERE ios_token = $4 AND (deactivated = FALSE OR deactivated IS NULL)",
        [JSON.stringify({ platform: 'ios' }), difficulty, language, deviceToken]
      );

      res.json({
        ok: true,
        message: "iOS subscription updated",
        subscriptionId: existing.rows[0].id,
        updated: r.rowCount
      });
    } else {
      // Create new iOS subscription
      const r = await pool.query(
        "INSERT INTO subs (data, platform, ios_token, difficulty, language) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [JSON.stringify({ platform: 'ios' }), 'ios', deviceToken, difficulty, language]
      );

      res.json({
        ok: true,
        message: "iOS subscription created",
        subscriptionId: r.rows[0].id
      });
    }
  } catch (error) {
    console.error("iOS subscription error:", error);
    res.status(500).json({ ok: false, error: "Database error" });
  }
});

// 6) Check if iOS subscription exists
app.get("/subscribe/ios/exists", async (req, res) => {
  const deviceToken = req.query.deviceToken;

  if (!deviceToken) {
    return res.status(400).json({ ok: false, error: "Missing deviceToken" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT id, difficulty, language FROM subs WHERE ios_token = $1 AND (deactivated = FALSE OR deactivated IS NULL)",
      [deviceToken]
    );

    if (rows.length > 0) {
      const sub = rows[0];

      res.json({
        ok: true,
        exists: true,
        subscriptionId: sub.id,
        language: sub.language || 'italian',
        difficulty: sub.difficulty || 'easy'
      });
    } else {
      res.json({ ok: true, exists: false });
    }
  } catch (error) {
    console.error("iOS subscription check error:", error);
    res.status(500).json({ ok: false, error: "Database error" });
  }
});

// 7) Delete iOS subscription
app.delete("/subscribe/ios", async (req, res) => {
  const deviceToken = req.body?.deviceToken || req.query.deviceToken;

  if (!deviceToken) {
    return res.status(400).json({ ok: false, error: "Missing deviceToken" });
  }

  try {
    const r = await pool.query(
      "UPDATE subs SET deactivated = TRUE WHERE ios_token = $1 AND (deactivated = FALSE OR deactivated IS NULL)",
      [deviceToken]
    );

    res.json({ ok: true, deactivated: r.rowCount });
  } catch (error) {
    console.error("iOS unsubscribe error:", error);
    res.status(500).json({ ok: false, error: "Database error" });
  }
});

// Helper function to create notification payload based on language and phrase
function createNotificationPayload(language, phrase, includeClickTracking = true) {
  const languageConfig = {
    spanish: {
      title: 'New Spanish Phrase',
      flag: '🇪🇸',
      phraseKey: 'es'
    },
    french: {
      title: 'New French Phrase',
      flag: '🇫🇷',
      phraseKey: 'fr'
    },
    japanese: {
      title: 'New Japanese Phrase',
      flag: '🇯🇵',
      phraseKey: 'ja'
    },
    italian: {
      title: 'New Italian Phrase',
      flag: '🇮🇹',
      phraseKey: 'it'
    }
  };

  const config = languageConfig[language] || languageConfig.italian;
  const payload = {
    title: `Translate to ${config.flag} ${language.charAt(0).toUpperCase() + language.slice(1)}`,
    body: `${phrase.en}`,
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  };

  // Add timestamp for click tracking (for new notifications)
  if (includeClickTracking) {
    payload.data = {
      sentAt: new Date().toISOString()
    };
  }

  return JSON.stringify(payload);
}

// Helper function to get the original phrase text for database storage
function getOriginalPhraseText(language, phrase) {
  const phraseKeys = {
    spanish: 'es',
    french: 'fr',
    japanese: 'ja',
    italian: 'it'
  };
  const key = phraseKeys[language] || phraseKeys.italian;
  return phrase[key];
}

// Helper function to send push notification to a single subscription (Web or iOS)
async function sendPushToSubscription(subscriptionRow, phrase, difficulty = 'easy') {
  const sub = typeof subscriptionRow.data === "string" ? JSON.parse(subscriptionRow.data) : subscriptionRow.data;
  const language = sub.language || 'italian';
  const platform = subscriptionRow.platform || 'web';

  const originalText = getOriginalPhraseText(language, phrase);

  try {
    if (platform === 'ios') {
      // Send iOS push notification via APNs
      await sendIOSPushNotification(subscriptionRow, sub, phrase, language, originalText);
    } else {
      // Send web push notification (default for PWA)
      await sendWebPushNotification(sub, phrase, language);
    }

    // Update last notification info
    await pool.query(
      "UPDATE subs SET last_phrase_original = $1, last_phrase_english = $2, last_phrase_language = $3, last_notification_sent_at = CURRENT_TIMESTAMP WHERE id = $4",
      [originalText, phrase.en, language, subscriptionRow.id]
    );

    // Save notification to history table
    await pool.query(
      "INSERT INTO notifications (subscription_id, phrase_original, phrase_english, language, difficulty) VALUES ($1, $2, $3, $4, $5)",
      [subscriptionRow.id, originalText, phrase.en, language, difficulty]
    );

    console.log(`✅ ${platform.toUpperCase()} push sent successfully to subscription ${subscriptionRow.id}`);

  } catch (error) {
    console.error(`❌ Failed to send ${platform} push to subscription ${subscriptionRow.id}:`, error);

    // If it's a 410 or 404 error (subscription no longer valid), deactivate it
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log(`🗑️ Deactivating invalid ${platform} subscription ${subscriptionRow.id}`);
      await pool.query("UPDATE subs SET deactivated = TRUE WHERE id = $1", [subscriptionRow.id]);
    }

    throw error; // Re-throw for caller to handle
  }
}

// Send web push notification (existing PWA logic)
async function sendWebPushNotification(sub, phrase, language) {
  const payload = createNotificationPayload(language, phrase);

  // Create clean subscription object without our custom language field
  const cleanSub = {
    endpoint: sub.endpoint,
    keys: sub.keys
  };

  await webpush.sendNotification(cleanSub, payload);
}

// Send iOS push notification via APNs
async function sendIOSPushNotification(subscriptionRow, sub, phrase, language, originalText) {
  if (!apnProvider) {
    throw new Error('APNs provider not configured. Cannot send iOS notifications.');
  }

  if (!subscriptionRow.ios_token) {
    throw new Error('iOS device token not found for subscription.');
  }

  // Create APNs notification
  const note = new apn.Notification();

  // Set notification content with language-specific title
  const languageFlags = {
    italian: '🇮🇹',
    spanish: '🇪🇸',
    french: '🇫🇷',
    japanese: '🇯🇵'
  };

  const flag = languageFlags[language] || '🌍';

  note.alert = {
    title: `Translate To ${flag}`,
    body: phrase.en
  };

  // Add custom data for click handling
  note.payload = {
    sentAt: new Date().toISOString(),
    language: language,
    phraseOriginal: originalText,
    phraseEnglish: phrase.en
  };

  // iOS notification settings
  note.badge = 1;
  note.sound = "default";
  note.topic = process.env.APNS_BUNDLE_ID || 'com.langpush.app'; // Your app bundle ID

  // Send notification
  const result = await apnProvider.send(note, subscriptionRow.ios_token);

  // Check for failed sends
  if (result.failed && result.failed.length > 0) {
    const failure = result.failed[0];
    const error = new Error(`APNs send failed: ${failure.response.reason}`);
    error.statusCode = failure.response.status;
    throw error;
  }
}

app.post("/admin/broadcast", guard, async (_req, res) => {
  const { rows } = await pool.query("SELECT id, data, created_at, difficulty, platform, language, ios_token FROM subs WHERE deactivated = FALSE OR deactivated IS NULL");

  let sent = 0;
  let failed = 0;
  let phrases = {};

  for (const row of rows) {
    const platform = row.platform || 'web';
    let language, sub;

    if (platform === 'ios') {
      // For iOS, language is stored directly in the language column
      language = row.language || 'italian';
      sub = null; // iOS doesn't use the data column for subscription info
    } else {
      // For web, language is stored in the data JSON
      sub = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      language = sub.language || 'italian';
    }

    const difficulty = row.difficulty || 'easy';

    // Generate phrase for this language+difficulty combination if we haven't already
    const phraseKey = `${language}_${difficulty}`;
    if (!phrases[phraseKey]) {
      phrases[phraseKey] = randomPhraseNoRepeat(language, difficulty);
    }

    const phrase = phrases[phraseKey];

    try {
      await sendPushToSubscription(row, phrase, difficulty);
      sent++;
    } catch (e) {
      failed++;
      console.error("Push failed:", e.statusCode, e.body?.toString() || e.message);
      if (e.statusCode === 410 || e.statusCode === 404) {
        await pool.query("DELETE FROM subs WHERE id = $1", [row.id]);
      }
    }
  }
  res.json({ ok: true, sent, failed, phrases });
});

app.post("/admin/send-now", guard, async (req, res) => {
  const { endpoint, iosToken, appIsOpen } = req.body;

  if (!endpoint && !iosToken) {
    return res.status(400).json({ ok: false, error: "Missing endpoint or iosToken" });
  }

  try {
    let query, params;

    if (iosToken) {
      // iOS token lookup
      console.log('📱 [Send Now] Using iOS token:', iosToken, 'appIsOpen:', appIsOpen);
      query = "SELECT id, data, created_at, difficulty, platform, language, ios_token FROM subs WHERE ios_token = $1 AND (deactivated = FALSE OR deactivated IS NULL)";
      params = [iosToken];
    } else {
      // Web endpoint lookup
      console.log('🌐 [Send Now] Using web endpoint:', endpoint, 'appIsOpen:', appIsOpen);
      query = "SELECT id, data, created_at, difficulty, platform, language, ios_token FROM subs WHERE data->>'endpoint' = $1 AND (deactivated = FALSE OR deactivated IS NULL)";
      params = [endpoint];
    }

    // Find the subscription - exclude deactivated
    const { rows } = await pool.query(query, params);
    if (rows.length === 0) {
      console.log('❌ [Send Now] Subscription not found or deactivated');
      return res.status(404).json({ ok: false, error: "Subscription not found or deactivated" });
    }

    const row = rows[0];
    const platform = row.platform || 'web';
    let language, sub;

    if (platform === 'ios') {
      // For iOS, language is stored directly in the language column
      language = row.language || 'italian';
      sub = null; // iOS doesn't use the data column for subscription info
      console.log('📱 [Send Now] iOS subscription found, language:', language);
    } else {
      // For web, language is stored in the data JSON
      sub = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      language = sub.language || 'italian';
      console.log('🌐 [Send Now] Web subscription found, language:', language);
    }

    const difficulty = row.difficulty || 'easy';

    // Generate a phrase for this user's language and difficulty
    console.log('🎲 [Send Now] Generating phrase for language:', language, 'difficulty:', difficulty);
    const phrase = randomPhraseNoRepeat(language, difficulty);

    if (appIsOpen) {
      // App is open - skip push notification but still create database entries
      console.log('📱 [Send Now] App is open, skipping push notification but updating database...');

      const originalText = getOriginalPhraseText(language, phrase);

      // Update last notification info
      await pool.query(
        "UPDATE subs SET last_phrase_original = $1, last_phrase_english = $2, last_phrase_language = $3, last_notification_sent_at = CURRENT_TIMESTAMP WHERE id = $4",
        [originalText, phrase.en, language, row.id]
      );

      // Save notification to history table
      await pool.query(
        "INSERT INTO notifications (subscription_id, phrase_original, phrase_english, language, difficulty) VALUES ($1, $2, $3, $4, $5)",
        [row.id, originalText, phrase.en, language, difficulty]
      );

      console.log('✅ [Send Now] Database updated successfully (no push sent due to app being open)');
    } else {
      // App is not open - send push notification normally
      console.log('📤 [Send Now] Sending push notification...');
      await sendPushToSubscription(row, phrase, difficulty);
      console.log('✅ [Send Now] Notification sent successfully');
    }

    res.json({ ok: true, sent: 1 });
  } catch (error) {
    console.error("❌ [Send Now] Failed:", error);

    // Clean up invalid subscriptions
    if (error.statusCode === 410 || error.statusCode === 404) {
      if (endpoint) {
        await pool.query("DELETE FROM subs WHERE data->>'endpoint' = $1", [endpoint]);
      } else if (iosToken) {
        await pool.query("DELETE FROM subs WHERE ios_token = $1", [iosToken]);
      }
    }

    res.status(500).json({ ok: false, error: "Failed to send notification" });
  }
});

// Live reload for development
let clients = [];
if (process.env.NODE_ENV !== 'production') {
  app.get('/live-reload', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    clients.push(res);

    req.on('close', () => {
      clients = clients.filter(client => client !== res);
    });
  });

  // Watch for file changes in public directory
  const watcher = chokidar.watch('./public', {ignored: /^\./, persistent: true});
  watcher.on('change', () => {
    clients.forEach(client => {
      client.write('data: reload\n\n');
    });
  });
}

// serve static site with proper cache headers
app.use(express.static("public", {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    else if (path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 minutes
    }

    else if (path.endsWith('.webmanifest') || path.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 1 week
    }
  }
}))

const port = process.env.PORT || 3000;
const isProduction = process.env.ENVIRONMENT === 'production';
const host = isProduction ? '0.0.0.0' : 'localhost';

// In production, when HTTPS is disabled, or when no certs exist, use HTTP only
if (isProduction || process.env.DISABLE_HTTPS === 'true') {
  app.listen(port, host, () => console.log(`Server running on http://${host}:${port}`));
} else {
  // Try to use HTTPS in development if certificates exist
  try {
    const options = {
      key: fs.readFileSync('./localhost+2-key.pem'),
      cert: fs.readFileSync('./localhost+2.pem')
    };
    https.createServer(options, app).listen(port, host, () => {
      console.log(`Server running on https://${host}:${port}`);
    });
  } catch (err) {
    // Fallback to HTTP if certificates don't exist
    app.listen(port, host, () => {
      console.log(`Server running on http://${host}:${port} (no HTTPS certificates found)`);
    });
  }
}
