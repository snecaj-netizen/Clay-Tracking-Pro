import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import nodemailer from 'nodemailer';
import webpush from 'web-push';
import cron from 'node-cron';

import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = process.env.PORT || 3000;

// 1. IMMEDIATE HEALTH CHECK (Must be first)
app.get('/ping', (req, res) => res.send('pong'));

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-clay-tracker';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Initialize PostgreSQL Database (Supabase)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : undefined
});

const initDB = async () => {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️ DATABASE_URL environment variable is missing. Database will not be initialized.');
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        surname TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        category TEXT,
        qualification TEXT,
        society TEXT,
        fitav_card TEXT,
        avatar TEXT,
        status TEXT DEFAULT 'active',
        login_count INTEGER DEFAULT 0,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add columns if they don't exist (for existing databases)
    try {
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS category TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS qualification TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS society TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS fitav_card TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP");
    } catch (e) {
      console.log("Columns already exist or error adding them");
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS login_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS competitions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        enddate TEXT,
        location TEXT NOT NULL,
        discipline TEXT NOT NULL,
        level TEXT NOT NULL,
        totalscore INTEGER NOT NULL,
        totaltargets INTEGER NOT NULL,
        averageperseries REAL NOT NULL,
        position INTEGER,
        cost REAL DEFAULT 0,
        win REAL DEFAULT 0,
        notes TEXT,
        weather TEXT,
        scores TEXT NOT NULL,
        detailedscores TEXT,
        seriesimages TEXT,
        usedcartridges TEXT,
        team_name TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cartridges (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purchasedate TEXT NOT NULL,
        producer TEXT NOT NULL,
        model TEXT NOT NULL,
        leadnumber TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        initialquantity INTEGER NOT NULL,
        cost REAL NOT NULL,
        armory TEXT,
        imageurl TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cartridge_types (
        id TEXT PRIMARY KEY,
        producer TEXT NOT NULL,
        model TEXT NOT NULL,
        leadnumber TEXT NOT NULL,
        imageurl TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    // Ensure created_by column exists
    try {
      await pool.query("ALTER TABLE cartridge_types ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL");
    } catch (e) {
      console.log("Column created_by might already exist or error adding it:", e);
    }

    // Migrate existing cartridges to cartridge_types
    try {
      await pool.query(`
        INSERT INTO cartridge_types (id, producer, model, leadnumber, imageurl, created_by)
        SELECT DISTINCT ON (LOWER(TRIM(producer)), LOWER(TRIM(model)), leadnumber)
          id, producer, model, leadnumber, imageurl, user_id
        FROM cartridges
        ON CONFLICT DO NOTHING;
      `);
    } catch (e) {
      console.log("Error migrating cartridge types:", e);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        size INTEGER NOT NULL,
        society TEXT,
        competition_name TEXT,
        discipline TEXT,
        date TEXT,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add columns if they don't exist (for existing databases)
    try {
      await pool.query("ALTER TABLE teams ADD COLUMN IF NOT EXISTS competition_name TEXT");
      await pool.query("ALTER TABLE teams ADD COLUMN IF NOT EXISTS discipline TEXT");
      await pool.query("ALTER TABLE teams ADD COLUMN IF NOT EXISTS date TEXT");
      await pool.query("ALTER TABLE teams ADD COLUMN IF NOT EXISTS location TEXT");
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS team_name TEXT");
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL");
    } catch (e) {
      console.log("Columns might already exist or error adding them:", e);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS societies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        email TEXT,
        address TEXT,
        city TEXT,
        region TEXT,
        zip_code TEXT,
        phone TEXT,
        mobile TEXT,
        website TEXT,
        contact_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add columns if they don't exist (for existing databases)
    try {
      await pool.query("ALTER TABLE societies ADD COLUMN IF NOT EXISTS contact_name TEXT");
      await pool.query("ALTER TABLE societies ADD COLUMN IF NOT EXISTS logo TEXT");
      await pool.query("ALTER TABLE societies ADD COLUMN IF NOT EXISTS opening_hours TEXT");
      await pool.query("ALTER TABLE societies ADD COLUMN IF NOT EXISTS disciplines TEXT");
      await pool.query("ALTER TABLE societies ADD COLUMN IF NOT EXISTS lat NUMERIC");
      await pool.query("ALTER TABLE societies ADD COLUMN IF NOT EXISTS lng NUMERIC");
      await pool.query("ALTER TABLE societies ADD COLUMN IF NOT EXISTS google_maps_link TEXT");
    } catch (e) {
      console.log("Column contact_name, logo, opening_hours or disciplines might already exist or error adding it:", e);
    }

    try {
      await pool.query("ALTER TABLE societies ALTER COLUMN email DROP NOT NULL");
      await pool.query("ALTER TABLE societies ADD CONSTRAINT societies_name_key UNIQUE (name)");
    } catch (e) {
      // Ignore if constraint already exists
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        visibility TEXT NOT NULL,
        discipline TEXT NOT NULL,
        location TEXT NOT NULL,
        targets INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        cost TEXT,
        notes TEXT,
        poster_url TEXT,
        registration_link TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    try {
      await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_link TEXT`);
    } catch (e) {
      console.log("Error adding registration_link to events:", e);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (team_id, user_id)
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS challenges (
        id TEXT PRIMARY KEY,
        society_id INTEGER NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        discipline TEXT NOT NULL,
        mode TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        prize TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vapid_keys (
        id INTEGER PRIMARY KEY DEFAULT 1,
        public_key TEXT NOT NULL,
        private_key TEXT NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        subscription JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, subscription)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        global_enabled BOOLEAN DEFAULT TRUE,
        rate_limit INTEGER DEFAULT 5,
        templates JSONB DEFAULT '{"new_competition": "Nuova gara pubblicata: {competition_name} presso {society_name}!", "score_update": "Risultati aggiornati per {competition_name}. Controlla la tua posizione!", "new_challenge": "{shooter_name} ti ha sfidato! Accetta la sfida nel tuo profilo.", "challenge_completed": "Sfida completata! {winner_name} ha vinto contro {loser_name}."}'::jsonb,
        muted_entities JSONB DEFAULT '[]'::jsonb,
        admin_notifications_enabled BOOLEAN DEFAULT TRUE,
        admin_compact_mode BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        url TEXT,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS scheduled_broadcasts (
        id SERIAL PRIMARY KEY,
        target_type TEXT NOT NULL,
        target_id TEXT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        scheduled_at TIMESTAMP NOT NULL,
        sent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Initialize VAPID keys
    try {
      const { rows: vapidRows } = await pool.query("SELECT * FROM vapid_keys WHERE id = 1");
      if (vapidRows.length === 0) {
        const vapidKeys = webpush.generateVAPIDKeys();
        await pool.query(
          "INSERT INTO vapid_keys (id, public_key, private_key) VALUES (1, $1, $2)",
          [vapidKeys.publicKey, vapidKeys.privateKey]
        );
        webpush.setVapidDetails(
          'mailto:snecaj@gmail.com',
          vapidKeys.publicKey,
          vapidKeys.privateKey
        );
      } else {
        webpush.setVapidDetails(
          'mailto:snecaj@gmail.com',
          vapidRows[0].public_key,
          vapidRows[0].private_key
        );
      }
    } catch (e) {
      console.log("Error initializing VAPID keys:", e);
    }

    // Create default admin user if not exists
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", ['snecaj@gmail.com']);
    if (rows.length === 0) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('admin', salt);
      await pool.query(
        "INSERT INTO users (name, surname, email, password, role) VALUES ($1, $2, $3, $4, $5)",
        ['Admin', 'User', 'snecaj@gmail.com', hash, 'admin']
      );
    } else {
      // Admin already exists, do not reset password every time
      // const salt = bcrypt.genSaltSync(10);
      // const hash = bcrypt.hashSync('admin', salt);
      // await pool.query("UPDATE users SET password = $1 WHERE email = $2", [hash, 'snecaj@gmail.com']);
    }

    // Reset admin notifications and settings as requested (one-time)
    if (!fs.existsSync('.admin_reset_done')) {
      try {
        const adminEmail = 'snecaj@gmail.com';
        const { rows: adminRows } = await pool.query("SELECT id FROM users WHERE email = $1", [adminEmail]);
        if (adminRows.length > 0) {
          const adminId = adminRows[0].id;
          // Delete all notifications for admin
          await pool.query("DELETE FROM notifications WHERE user_id = $1", [adminId]);
          // Reset settings: disable admin_notifications_enabled to stop getting others' notifications
          await pool.query(`
            INSERT INTO notification_settings (user_id, global_enabled, admin_notifications_enabled, muted_entities)
            VALUES ($1, true, false, '[]'::jsonb)
            ON CONFLICT (user_id) DO UPDATE SET 
              global_enabled = true, 
              admin_notifications_enabled = false, 
              muted_entities = '[]'::jsonb
          `, [adminId]);
          fs.writeFileSync('.admin_reset_done', 'true');
          console.log("Admin notifications and settings reset successfully for Stefano Necaj.");
        }
      } catch (e) {
        console.log("Error resetting admin notifications:", e);
      }
    }

    // Migrate existing societies from users, teams, events and competitions
    try {
      await pool.query(`
        INSERT INTO societies (name, email)
        SELECT DISTINCT TRIM(society), ''
        FROM users
        WHERE society IS NOT NULL AND TRIM(society) != ''
        ON CONFLICT (name) DO NOTHING;
      `);
      await pool.query(`
        INSERT INTO societies (name, email)
        SELECT DISTINCT TRIM(society), ''
        FROM teams
        WHERE society IS NOT NULL AND TRIM(society) != ''
        ON CONFLICT (name) DO NOTHING;
      `);
      await pool.query(`
        INSERT INTO societies (name, email)
        SELECT DISTINCT TRIM(location), ''
        FROM events
        WHERE location IS NOT NULL AND TRIM(location) != ''
        ON CONFLICT (name) DO NOTHING;
      `);
      await pool.query(`
        INSERT INTO societies (name, email)
        SELECT DISTINCT TRIM(location), ''
        FROM competitions
        WHERE location IS NOT NULL AND TRIM(location) != ''
        ON CONFLICT (name) DO NOTHING;
      `);
    } catch (e) {
      console.log("Error migrating societies:", e);
    }

    console.log('Connected to PostgreSQL database and initialized tables.');
  } catch (err) {
    console.error('Error initializing database', err);
  }
};

initDB().then(() => {
  // Setup cron job for upcoming events (2 days before)
  cron.schedule('0 10 * * *', async () => {
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 2);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      const { rows: events } = await pool.query(
        "SELECT * FROM events WHERE start_date = $1",
        [targetDateStr]
      );

      for (const event of events) {
        let userIds: number[] = [];
        
        if (event.visibility === 'Pubblica') {
          const { rows: users } = await pool.query("SELECT id FROM users WHERE role = 'user'");
          userIds = users.map(u => u.id);
        } else {
          const { rows: creators } = await pool.query("SELECT society FROM users WHERE id = $1", [event.created_by]);
          if (creators.length > 0 && creators[0].society) {
            const { rows: users } = await pool.query("SELECT id FROM users WHERE role = 'user' AND society = $1", [creators[0].society]);
            userIds = users.map(u => u.id);
          }
        }

        if (userIds.length > 0) {
          await sendPushNotification(
            userIds, 
            "Gara in arrivo!", 
            `La gara "${event.name}" inizierà tra 2 giorni presso ${event.location}.`, 
            `/events?id=${event.id}`,
            event.visibility === 'Pubblica' ? 'all' : 'society'
          );
        }
      }
    } catch (err) {
      console.error("Error in cron job for upcoming events:", err);
    }
  });

  // Setup cron job for scheduled broadcasts
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const { rows: pendingBroadcasts } = await pool.query(
        "SELECT * FROM scheduled_broadcasts WHERE sent = FALSE AND scheduled_at <= $1",
        [now]
      );

      for (const broadcast of pendingBroadcasts) {
        try {
          const userIds = await getTargetUserIds(broadcast.target_type, broadcast.target_id);
          if (userIds.length > 0) {
            const recipientType = broadcast.target_type === 'all_shooters' ? 'all' : (broadcast.target_type === 'shooters_of_society' ? 'society' : undefined);
            await sendPushNotification(userIds, `Broadcast: ${broadcast.title}`, broadcast.body, '/dashboard', recipientType);
          }
          await pool.query("UPDATE scheduled_broadcasts SET sent = TRUE WHERE id = $1", [broadcast.id]);
        } catch (err) {
          console.error('Error processing scheduled broadcast:', err);
        }
      }
    } catch (err) {
      console.error("Error in cron job for scheduled broadcasts:", err);
    }
  });
});

const activeUsers = new Map<number, number>();

// Authentication Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    activeUsers.set(user.id, Date.now());
    next();
  });
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  next();
};

const requireAdminOrSociety = (req: any, res: any, next: any) => {
  if (req.user.role !== 'admin' && req.user.role !== 'society') return res.sendStatus(403);
  next();
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

app.get('/api/gemini-key', authenticateToken, (req, res) => {
  res.json({ key: process.env.GEMINI_API_KEY || '' });
});

// Push Notifications Routes
app.get('/api/vapidPublicKey', (req, res) => {
  pool.query("SELECT public_key FROM vapid_keys WHERE id = 1")
    .then(({ rows }) => {
      if (rows.length > 0) {
        res.json({ publicKey: rows[0].public_key });
      } else {
        res.status(404).json({ error: 'VAPID keys not initialized' });
      }
    })
    .catch(err => res.status(500).json({ error: err.message }));
});

app.post('/api/subscribe', authenticateToken, async (req: any, res) => {
  const subscription = req.body;
  try {
    await pool.query(
      "INSERT INTO push_subscriptions (user_id, subscription) VALUES ($1, $2) ON CONFLICT (user_id, subscription) DO NOTHING",
      [req.user.id, subscription]
    );
    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/unsubscribe', authenticateToken, async (req: any, res) => {
  const subscription = req.body;
  try {
    await pool.query(
      "DELETE FROM push_subscriptions WHERE user_id = $1 AND subscription::text = $2::text",
      [req.user.id, JSON.stringify(subscription)]
    );
    res.json({ message: 'Unsubscribed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/notifications', authenticateToken, async (req: any, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
      [req.user.id]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req: any, res) => {
  try {
    await pool.query(
      "UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notifications/:id', authenticateToken, async (req: any, res) => {
  try {
    await pool.query(
      "DELETE FROM notifications WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/bulk-delete', authenticateToken, async (req: any, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids' });
    }
    await pool.query(
      "DELETE FROM notifications WHERE id = ANY($1) AND user_id = $2",
      [ids, req.user.id]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to send push notifications
const sendPushNotification = async (userIds: (number | string)[], title: string, body: string, url: string, recipientType?: 'all' | 'society' | 'team') => {
  try {
    // Get Admin ID and settings
    const { rows: adminRows } = await pool.query("SELECT id FROM users WHERE email = 'snecaj@gmail.com'");
    const adminId = adminRows[0]?.id;

    if (!adminId) return;

    const { rows: settingsRows } = await pool.query("SELECT * FROM notification_settings WHERE user_id = $1", [adminId]);
    const settings = settingsRows[0] || { global_enabled: true, admin_notifications_enabled: false, muted_entities: [] };

    if (!settings.global_enabled) return;

    // Ensure all IDs are numbers and deduplicated
    const numericAdminId = Number(adminId);
    let numericUserIds = [...new Set(userIds.map(id => Number(id)).filter(id => !isNaN(id)))];

    // If admin notifications are enabled, and this is a system-wide or empty-target notification, add admin
    if (settings.admin_notifications_enabled) {
      if (numericUserIds.length === 0 || recipientType === 'all') {
        if (!numericUserIds.includes(numericAdminId)) {
          numericUserIds.push(numericAdminId);
        }
      }
    }

    // If admin notifications are DISABLED, and the admin is in the list but it's not "his" notification 
    // (e.g. it's a broadcast or system event), we should technically filter him out unless it's explicitly for him.
    // However, the current logic is: if he's in userIds, he gets it. 
    // The "system" events now pass [] as userIds, so he won't get them if admin_notifications_enabled is false.

    // Filter out muted entities (for regular users)
    const { rows: allSettings } = await pool.query("SELECT user_id, muted_entities FROM notification_settings WHERE user_id = ANY($1)", [numericUserIds]);
    
    // 1. Save notifications for each user in the list
    for (const userId of numericUserIds) {
      const userSetting = allSettings.find(s => s.user_id === userId);
      const mutedIds = (userSetting?.muted_entities || []).map((e: any) => Number(e.id));
      
      // Basic muted check (if we had senderId we'd check it here)

      await pool.query(
        "INSERT INTO notifications (user_id, title, body, url) VALUES ($1, $2, $3, $4)",
        [userId, title, body, url]
      );
    }

    // 2. Send Push Notifications
    const { rows: subscriptions } = await pool.query(
      "SELECT * FROM push_subscriptions WHERE user_id = ANY($1)",
      [numericUserIds]
    );

    // Deduplicate subscriptions by endpoint
    const uniqueSubscriptions = [];
    const seenEndpoints = new Set();
    for (const sub of subscriptions) {
      const endpoint = sub.subscription.endpoint;
      if (!seenEndpoints.has(endpoint)) {
        seenEndpoints.add(endpoint);
        uniqueSubscriptions.push(sub);
      }
    }

    for (const sub of uniqueSubscriptions) {
      try {
        const payload = JSON.stringify({ title, body, url });
        await webpush.sendNotification(sub.subscription, payload);
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pool.query("DELETE FROM push_subscriptions WHERE id = $1", [sub.id]);
        } else {
          console.error("Error sending push notification:", err);
        }
      }
    }
  } catch (err) {
    console.error("Error in sendPushNotification:", err);
  }
};

const getTargetUserIds = async (targetType: string, targetId: string | null) => {
  let userQuery = "";
  let queryParams: any[] = [];

  if (targetType === 'all_societies') {
    userQuery = "SELECT id FROM users WHERE role = 'society'";
  } else if (targetType === 'specific_society') {
    userQuery = "SELECT id FROM users WHERE role = 'society' AND society = $1";
    queryParams = [targetId];
  } else if (targetType === 'all_shooters') {
    userQuery = "SELECT id FROM users WHERE role = 'user'";
  } else if (targetType === 'shooters_of_society') {
    userQuery = "SELECT id FROM users WHERE role = 'user' AND society = $1";
    queryParams = [targetId];
  }

  if (!userQuery) return [];

  const { rows: targetUsers } = await pool.query(userQuery, queryParams);
  return targetUsers.map(u => u.id);
};

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = rows[0];
    if (!user) return res.status(400).json({ error: 'User not found' });

    if (user.status === 'suspended') {
      return res.status(403).json({ 
        error: 'Account sospeso', 
        message: 'Il tuo account è stato sospeso. Contatta l\'amministratore per maggiori informazioni.' 
      });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

    // Update login count and last login
    await pool.query("UPDATE users SET login_count = login_count + 1, last_login = CURRENT_TIMESTAMP WHERE id = $1", [user.id]);
    await pool.query("INSERT INTO login_logs (user_id) VALUES ($1)", [user.id]);

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, society: user.society }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, surname: user.surname, email: user.email, role: user.role, category: user.category, qualification: user.qualification, society: user.society, fitav_card: user.fitav_card, avatar: user.avatar, birth_date: user.birth_date } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// User Profile Routes
app.put('/api/user/profile', authenticateToken, async (req: any, res) => {
  const { name, surname, email, password, category, qualification, society, fitav_card, avatar, birth_date } = req.body;
  try {
    if (password) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      await pool.query(
        "UPDATE users SET name = $1, surname = $2, email = $3, password = $4, category = $5, qualification = $6, society = $7, fitav_card = $8, avatar = $9, birth_date = $10 WHERE id = $11",
        [name, surname, email, hash, category, qualification, society, fitav_card, avatar, birth_date || null, req.user.id]
      );
    } else {
      await pool.query(
        "UPDATE users SET name = $1, surname = $2, email = $3, category = $4, qualification = $5, society = $6, fitav_card = $7, avatar = $8, birth_date = $9 WHERE id = $10",
        [name, surname, email, category, qualification, society, fitav_card, avatar, birth_date || null, req.user.id]
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: 'Email already in use or other error' });
  }
});

app.get('/api/admin/notifications', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    // Check admin settings
    const { rows: settingsRows } = await pool.query(
      "SELECT admin_notifications_enabled FROM notification_settings WHERE user_id = $1",
      [req.user.id]
    );
    const adminNotificationsEnabled = settingsRows[0]?.admin_notifications_enabled ?? true;

    let query = `SELECT n.*, u.name as user_name, u.surname as user_surname 
                 FROM notifications n 
                 LEFT JOIN users u ON n.user_id = u.id`;
    let params: any[] = [];

    if (!adminNotificationsEnabled) {
      query += ` WHERE n.user_id = $1`;
      params.push(req.user.id);
    }

    query += ` ORDER BY n.created_at DESC LIMIT 200`;
    
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/notifications/:id', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    await pool.query("DELETE FROM notifications WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/notifications/bulk-delete', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids' });
    }
    await pool.query("DELETE FROM notifications WHERE id = ANY($1)", [ids]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/notifications/:id/read', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    await pool.query("UPDATE notifications SET read = TRUE WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/notifications/send', authenticateToken, requireAdmin, async (req: any, res) => {
  const { targetType, targetId, title, body, scheduledAt } = req.body;
  
  if (!title || !body || !targetType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const sendTime = scheduledAt ? new Date(scheduledAt) : new Date();
    const now = new Date();

    if (sendTime > now) {
      // Schedule for later
      await pool.query(
        "INSERT INTO scheduled_broadcasts (target_type, target_id, title, body, scheduled_at) VALUES ($1, $2, $3, $4, $5)",
        [targetType, targetId, title, body, sendTime]
      );
      res.json({ message: 'Notification scheduled successfully' });
    } else {
      // Send immediately
      const userIds = await getTargetUserIds(targetType, targetId);
      if (userIds.length > 0) {
        const recipientType = targetType === 'all_shooters' ? 'all' : (targetType === 'shooters_of_society' ? 'society' : undefined);
        await sendPushNotification(userIds, `Broadcast: ${title}`, body, '/dashboard', recipientType);
      }
      res.json({ message: 'Notification sent successfully' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/notification-settings', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM notification_settings WHERE user_id = $1", [req.user.id]);
    if (rows.length === 0) {
      // Create default settings if not exist
      const { rows: newRows } = await pool.query(
        "INSERT INTO notification_settings (user_id) VALUES ($1) RETURNING *",
        [req.user.id]
      );
      return res.json(newRows[0]);
    }
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/notification-settings', authenticateToken, requireAdmin, async (req: any, res) => {
  const { 
    global_enabled, 
    rate_limit, 
    templates, 
    muted_entities, 
    admin_notifications_enabled, 
    admin_compact_mode 
  } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO notification_settings 
        (user_id, global_enabled, rate_limit, templates, muted_entities, admin_notifications_enabled, admin_compact_mode, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
        global_enabled = EXCLUDED.global_enabled,
        rate_limit = EXCLUDED.rate_limit,
        templates = EXCLUDED.templates,
        muted_entities = EXCLUDED.muted_entities,
        admin_notifications_enabled = EXCLUDED.admin_notifications_enabled,
        admin_compact_mode = EXCLUDED.admin_compact_mode,
        updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        req.user.id, 
        global_enabled, 
        rate_limit, 
        JSON.stringify(templates), 
        JSON.stringify(muted_entities), 
        admin_notifications_enabled, 
        admin_compact_mode
      ]
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard Stats API
app.get('/api/admin/dashboard-stats', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const { filter } = req.query;
    let timeFilter = '';
    
    if (filter === 'day') {
      timeFilter = "AND login_at >= CURRENT_DATE";
    } else if (filter === 'week') {
      timeFilter = "AND login_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (filter === 'month') {
      timeFilter = "AND login_at >= CURRENT_DATE - INTERVAL '30 days'";
    } else if (filter === 'year') {
      timeFilter = "AND login_at >= CURRENT_DATE - INTERVAL '365 days'";
    }

    const now = Date.now();
    let onlineUsersCount = 0;
    const onlineSocieties = new Set<string>();

    // Get all users to check online status and society
    const usersRes = await pool.query("SELECT id, society FROM users");
    usersRes.rows.forEach(u => {
      const isOnline = activeUsers.has(u.id) && (now - activeUsers.get(u.id)!) < 5 * 60 * 1000;
      if (isOnline) {
        onlineUsersCount++;
        if (u.society) onlineSocieties.add(u.society);
      }
    });
    
    let topUserQuery = `
      SELECT u.name, u.surname, COUNT(l.id) as login_count
      FROM users u
      JOIN login_logs l ON u.id = l.user_id
      WHERE u.role = 'user'
      ${timeFilter}
      GROUP BY u.id, u.name, u.surname
      ORDER BY login_count DESC
      LIMIT 1
    `;
    
    let topSocQuery = `
      SELECT u.society, COUNT(l.id) as login_count
      FROM users u
      JOIN login_logs l ON u.id = l.user_id
      WHERE u.society IS NOT NULL
      ${timeFilter}
      GROUP BY u.society
      ORDER BY login_count DESC
      LIMIT 1
    `;

    const topUserRes = await pool.query(topUserQuery);
    const topSocRes = await pool.query(topSocQuery);

    res.json({
      onlineUsersCount,
      onlineSocietiesCount: onlineSocieties.size,
      topUserName: topUserRes.rows[0] ? `${topUserRes.rows[0].name} ${topUserRes.rows[0].surname}` : '-',
      topUserLogins: topUserRes.rows[0] ? parseInt(topUserRes.rows[0].login_count) : 0,
      topSocName: topSocRes.rows[0] ? topSocRes.rows[0].society : '-',
      topSocLogins: topSocRes.rows[0] ? parseInt(topSocRes.rows[0].login_count) : 0
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Routes (Manage Users)
app.get('/api/admin/users', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  try {
    let query = "SELECT id, name, surname, email, role, category, qualification, society, fitav_card, avatar, birth_date, status, login_count, last_login, created_at FROM users";
    let params: any[] = [];
    
    if (req.user.role === 'society') {
      query += " WHERE LOWER(TRIM(society)) = LOWER(TRIM($1))";
      params.push(req.user.society);
    }
    
    const { rows } = await pool.query(query, params);
    const now = Date.now();
    const usersWithStatus = rows.map(user => ({
      ...user,
      is_logged_in: activeUsers.has(user.id) && (now - activeUsers.get(user.id)!) < 5 * 60 * 1000
    }));
    res.json(usersWithStatus);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  const { name, surname, email, password, role, category, qualification, society, fitav_card, avatar, birth_date } = req.body;
  
  if (req.user.role === 'society') {
    if (role && role !== 'user') {
      return res.status(403).json({ error: 'Societies can only create shooters' });
    }
    if (society !== req.user.society) {
      return res.status(403).json({ error: 'Societies can only create shooters for their own society' });
    }
  }

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  try {
    const { rows } = await pool.query(
      "INSERT INTO users (name, surname, email, password, role, category, qualification, society, fitav_card, avatar, birth_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id",
      [name, surname, email, hash, role || 'user', category, qualification, society, fitav_card, avatar || null, birth_date || null, 'active']
    );
    
    // Notify Admin about new user
    const newUserId = rows[0].id;
    const creatorName = req.user.role === 'society' ? `la società ${req.user.society}` : 'l\'amministratore';
    sendPushNotification([], "Nuovo Utente Registrato", `È stato aggiunto un nuovo tiratore: ${name} ${surname} da parte di ${creatorName}.`, `/admin?tab=users`);

    res.json({ id: newUserId, name, surname, email, role: role || 'user', category, qualification, society, fitav_card, avatar, birth_date, status: 'active' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  const { name, surname, email, role, password, category, qualification, society, fitav_card, avatar, birth_date, status } = req.body;
  
  try {
    const userCheck = await pool.query("SELECT role, society FROM users WHERE id = $1", [req.params.id]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    if (req.user.role === 'society') {
      if (userCheck.rows[0].role === 'admin') {
        return res.status(403).json({ error: 'Societies cannot modify administrators' });
      }
      if (userCheck.rows[0].society !== req.user.society) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (role && role !== 'user') {
        return res.status(403).json({ error: 'Societies can only manage shooters' });
      }
      if (society && society !== req.user.society) {
        return res.status(403).json({ error: 'Societies can only manage shooters for their own society' });
      }
      if (status && status !== userCheck.rows[0].status) {
        return res.status(403).json({ error: 'Societies cannot change user status' });
      }
    }

    if (password) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      await pool.query(
        "UPDATE users SET name = $1, surname = $2, email = $3, role = $4, password = $5, category = $6, qualification = $7, society = $8, fitav_card = $9, avatar = $10, birth_date = $11, status = $12 WHERE id = $13",
        [name, surname, email, role, hash, category, qualification, society, fitav_card, avatar || null, birth_date || null, status || 'active', req.params.id]
      );
    } else {
      await pool.query(
        "UPDATE users SET name = $1, surname = $2, email = $3, role = $4, category = $5, qualification = $6, society = $7, fitav_card = $8, avatar = $9, birth_date = $10, status = $11 WHERE id = $12",
        [name, surname, email, role, category, qualification, society, fitav_card, avatar || null, birth_date || null, status || 'active', req.params.id]
      );
    }
    
    // Notify Admin if a society modifies a user
    if (req.user.role === 'society') {
      sendPushNotification([], "Utente Modificato", `La società ${req.user.society} ha modificato i dati dell'utente: ${name} ${surname}.`, `/admin?tab=users`);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/team-stats', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  try {
    let query = `
      SELECT 
        u.id as user_id, 
        u.name, 
        u.surname, 
        u.category, 
        u.qualification,
        u.society,
        c.discipline,
        COUNT(c.id) as total_competitions,
        AVG(c.averageperseries) as avg_score
      FROM users u
      JOIN competitions c ON u.id = c.user_id
      WHERE c.totalscore > 0
    `;
    let params: any[] = [];

    if (req.user.role === 'society') {
      query += " AND u.society = $1 AND c.level != 'Allenamento / Pratica' AND c.discipline != 'Allenamento' ";
      params.push(req.user.society);
    }

    query += `
      GROUP BY u.id, u.name, u.surname, u.category, u.qualification, u.society, c.discipline
      ORDER BY u.surname, u.name, c.discipline
    `;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/all-results', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  try {
    let query = `
      SELECT 
        c.*, 
        u.name as user_name, 
        u.surname as user_surname,
        u.society,
        u.category,
        u.qualification
      FROM competitions c
      JOIN users u ON c.user_id = u.id
    `;
    let params: any[] = [];

    if (req.user.role === 'society') {
      query += " WHERE u.society = $1 AND c.level != 'Allenamento / Pratica' AND c.discipline != 'Allenamento' ";
      params.push(req.user.society);
    }

    query += " ORDER BY c.date DESC ";

    const { rows } = await pool.query(query, params);
    
    const comps = rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userSurname: row.user_surname,
      society: row.society,
      category: row.category,
      qualification: row.qualification,
      name: row.name,
      date: row.date,
      endDate: row.enddate,
      location: row.location,
      discipline: row.discipline,
      level: row.level,
      totalScore: row.totalscore,
      totalTargets: row.totaltargets,
      averagePerSeries: row.averageperseries,
      position: row.position,
      cost: row.cost,
      win: row.win,
      notes: row.notes,
      weather: row.weather ? JSON.parse(row.weather) : undefined,
      scores: JSON.parse(row.scores),
      detailedScores: row.detailedscores ? JSON.parse(row.detailedscores) : undefined,
      seriesImages: row.seriesimages ? JSON.parse(row.seriesimages) : undefined,
      usedCartridges: row.usedcartridges ? JSON.parse(row.usedcartridges) : undefined,
      teamName: row.team_name
    }));
    res.json(comps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  try {
    if (req.user.role === 'society') {
      return res.status(403).json({ error: 'Solo l\'amministratore può eliminare gli utenti' });
    }
    
    const userCheck = await pool.query("SELECT role, email FROM users WHERE id = $1", [req.params.id]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    if (userCheck.rows[0].email === 'snecaj@gmail.com') {
      return res.status(403).json({ error: 'Cannot delete main admin' });
    }

    await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/users/:id/status', authenticateToken, requireAdmin, async (req: any, res) => {
  const { status } = req.body;
  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const userCheck = await pool.query("SELECT email FROM users WHERE id = $1", [req.params.id]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    if (userCheck.rows[0].email === 'snecaj@gmail.com') {
      return res.status(403).json({ error: 'Cannot suspend main admin' });
    }

    await pool.query("UPDATE users SET status = $1 WHERE id = $2", [status, req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/export-all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const compsRes = await pool.query("SELECT * FROM competitions");
    const cartsRes = await pool.query("SELECT * FROM cartridges");
    
    const competitions = compsRes.rows.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      date: row.date,
      endDate: row.enddate,
      location: row.location,
      discipline: row.discipline,
      level: row.level,
      totalScore: row.totalscore,
      totalTargets: row.totaltargets,
      averagePerSeries: row.averageperseries,
      position: row.position,
      cost: row.cost,
      win: row.win,
      notes: row.notes,
      weather: row.weather ? JSON.parse(row.weather) : undefined,
      scores: JSON.parse(row.scores),
      detailedScores: row.detailedscores ? JSON.parse(row.detailedscores) : undefined,
      seriesImages: row.seriesimages ? JSON.parse(row.seriesimages) : undefined,
      usedCartridges: row.usedcartridges ? JSON.parse(row.usedcartridges) : undefined,
      teamName: row.team_name
    }));

    const cartridges = cartsRes.rows.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      purchaseDate: row.purchasedate,
      producer: row.producer,
      model: row.model,
      leadNumber: row.leadnumber,
      quantity: row.quantity,
      initialQuantity: row.initialquantity,
      cost: row.cost,
      armory: row.armory,
      imageUrl: row.imageurl
    }));

    res.json({ competitions, cartridges });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Societies Routes
app.get('/api/societies', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM societies ORDER BY name ASC");
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/societies', authenticateToken, requireAdmin, async (req, res) => {
  const { name, email, address, city, region, zip_code, phone, mobile, website, contact_name, logo, opening_hours, disciplines, lat, lng, google_maps_link } = req.body;
  try {
    const { rows } = await pool.query(
      "INSERT INTO societies (name, email, address, city, region, zip_code, phone, mobile, website, contact_name, logo, opening_hours, disciplines, lat, lng, google_maps_link) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id",
      [name, email || null, address, city, region, zip_code, phone, mobile, website, contact_name, logo || null, opening_hours || null, disciplines || null, lat || null, lng || null, google_maps_link || null]
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/societies/:id', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  const { name, email, address, city, region, zip_code, phone, mobile, website, contact_name, logo, opening_hours, disciplines, lat, lng, google_maps_link } = req.body;
  try {
    if (req.user.role === 'society') {
      const { rows } = await pool.query("SELECT name FROM societies WHERE id = $1", [req.params.id]);
      if (rows.length === 0 || rows[0].name !== req.user.society) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (name !== req.user.society) {
        return res.status(403).json({ error: 'Cannot change society name' });
      }
    }

    await pool.query(
      "UPDATE societies SET name = $1, email = $2, address = $3, city = $4, region = $5, zip_code = $6, phone = $7, mobile = $8, website = $9, contact_name = $10, logo = $11, opening_hours = $12, disciplines = $13, lat = $14, lng = $15, google_maps_link = $16 WHERE id = $17",
      [name, email || null, address, city, region, zip_code, phone, mobile, website, contact_name, logo || null, opening_hours || null, disciplines || null, lat || null, lng || null, google_maps_link || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/societies/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM societies WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Challenges Routes
app.get('/api/challenges', authenticateToken, async (req: any, res) => {
  try {
    let query = `
      SELECT c.*, s.name as society_name 
      FROM challenges c 
      JOIN societies s ON c.society_id = s.id 
    `;
    let params: any[] = [];

    if (req.user.role === 'society') {
      query += ` WHERE s.name = $1 `;
      params = [req.user.society];
    } else if (req.user.role === 'user') {
      query += ` WHERE s.name = $1 `;
      params = [req.user.society];
    }
    // Admin sees all

    query += ` ORDER BY c.created_at DESC `;

    const { rows } = await pool.query(query, params);
    res.json(rows.map(r => ({
      id: r.id,
      societyId: r.society_id,
      societyName: r.society_name,
      name: r.name,
      discipline: r.discipline,
      mode: r.mode,
      startDate: r.start_date,
      endDate: r.end_date,
      prize: r.prize,
      createdAt: r.created_at
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/challenges', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  const { societyId, name, discipline, mode, startDate, endDate, prize } = req.body;
  
  if (req.user.role === 'society') {
    const { rows: socRows } = await pool.query("SELECT name FROM societies WHERE id = $1", [societyId]);
    if (socRows.length === 0 || socRows[0].name !== req.user.society) {
      return res.status(403).json({ error: 'Le società possono creare sfide solo per la propria TAV.' });
    }
  }

  const id = Math.random().toString(36).substr(2, 9);
  try {
    await pool.query(
      "INSERT INTO challenges (id, society_id, name, discipline, mode, start_date, end_date, prize) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [id, societyId, name, discipline, mode, startDate, endDate, prize]
    );

    // Send push notification
    const { rows: socRows } = await pool.query("SELECT name FROM societies WHERE id = $1", [societyId]);
    const societyName = socRows[0]?.name;
    
    if (societyName) {
      const { rows: users } = await pool.query(
        "SELECT id FROM users WHERE role = 'user' AND LOWER(TRIM(society)) = LOWER(TRIM($1))", 
        [societyName]
      );
      const userIds = users.map(u => u.id);
      if (userIds.length > 0) {
        sendPushNotification(userIds, "Nuova Sfida!", `${name} - ${prize}`, `/challenges`, 'society');
      }
    }

    res.json({ id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/challenges/:id', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  const { societyId, name, discipline, mode, startDate, endDate, prize } = req.body;
  try {
    const { rows: challengeRows } = await pool.query("SELECT society_id FROM challenges WHERE id = $1", [req.params.id]);
    if (challengeRows.length === 0) return res.status(404).json({ error: 'Sfida non trovata' });

    if (req.user.role === 'society') {
      const { rows: socRows } = await pool.query("SELECT name FROM societies WHERE id = $1", [challengeRows[0].society_id]);
      if (socRows.length === 0 || socRows[0].name !== req.user.society) {
        return res.status(403).json({ error: 'Accesso negato' });
      }
      // Ensure they don't try to move it to another society
      const { rows: newSocRows } = await pool.query("SELECT name FROM societies WHERE id = $1", [societyId]);
      if (newSocRows.length === 0 || newSocRows[0].name !== req.user.society) {
        return res.status(403).json({ error: 'Non puoi spostare la sfida a un\'altra società.' });
      }
    }

    await pool.query(
      "UPDATE challenges SET society_id = $1, name = $2, discipline = $3, mode = $4, start_date = $5, end_date = $6, prize = $7 WHERE id = $8",
      [societyId, name, discipline, mode, startDate, endDate, prize, req.params.id]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/challenges/:id', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  try {
    const { rows: challengeRows } = await pool.query("SELECT society_id FROM challenges WHERE id = $1", [req.params.id]);
    if (challengeRows.length === 0) return res.status(404).json({ error: 'Sfida non trovata' });

    if (req.user.role === 'society') {
      const { rows: socRows } = await pool.query("SELECT name FROM societies WHERE id = $1", [challengeRows[0].society_id]);
      if (socRows.length === 0 || socRows[0].name !== req.user.society) {
        return res.status(403).json({ error: 'Accesso negato' });
      }
    }

    await pool.query("DELETE FROM challenges WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/challenges/:id/ranking', authenticateToken, async (req, res) => {
  try {
    const { rows: challengeRows } = await pool.query(`
      SELECT c.*, s.name as society_name 
      FROM challenges c 
      JOIN societies s ON c.society_id = s.id 
      WHERE c.id = $1
    `, [req.params.id]);
    
    if (challengeRows.length === 0) return res.status(404).json({ error: 'Challenge not found' });
    const challenge = challengeRows[0];

    const { rows: compRows } = await pool.query(`
      SELECT c.*, u.name as user_name, u.surname as user_surname, u.category, u.qualification
      FROM competitions c
      JOIN users u ON c.user_id = u.id
      WHERE c.discipline = $1 
      AND c.location = $2
      AND u.society = $2
      AND c.date >= $3
      AND c.date <= $4
    `, [challenge.discipline, challenge.society_name, challenge.start_date, challenge.end_date]);

    const shooterStats: Record<number, any> = {};

    compRows.forEach(c => {
      if (!shooterStats[c.user_id]) {
        shooterStats[c.user_id] = {
          userId: c.user_id,
          userName: c.user_name,
          userSurname: c.user_surname,
          category: c.category || 'N/D',
          qualification: c.qualification || 'N/D',
          scores: [], // total scores per competition
          allSeriesScores: [], // individual series scores
          totalHits: 0,
          totalTargets: 0,
          competitionCount: 0,
          bestScore: 0,
          bestSeries: 0,
          lastSeriesScores: [],
          perfectSeriesCount: 0
        };
      }
      
      const stats = shooterStats[c.user_id];
      stats.scores.push(c.totalscore);
      stats.totalHits += c.totalscore;
      stats.totalTargets += c.totaltargets;
      stats.competitionCount += 1;
      if (c.totalscore > stats.bestScore) stats.bestScore = c.totalscore;

      // Parse series scores
      try {
        const series = JSON.parse(c.scores);
        if (Array.isArray(series) && series.length > 0) {
          // Last series for clutch performance
          const lastVal = parseInt(series[series.length - 1]);
          if (!isNaN(lastVal)) stats.lastSeriesScores.push(lastVal);

          series.forEach(s => {
            const val = parseInt(s);
            if (!isNaN(val)) {
              stats.allSeriesScores.push(val);
              if (val > stats.bestSeries) stats.bestSeries = val;
              if (val === 25) stats.perfectSeriesCount += 1;
            }
          });
        }
      } catch (e) {}
    });

    const ranking = Object.values(shooterStats).map(stats => {
      let value = 0;
      let sortAsc = false;

      switch (challenge.mode) {
        case 'Miglior Risultato':
          value = stats.bestScore;
          break;
        case 'Media Totale':
          value = stats.totalHits / stats.competitionCount;
          break;
        case 'Media Migliori 3':
          const sorted = [...stats.scores].sort((a, b) => b - a);
          const top3 = sorted.slice(0, 3);
          value = top3.reduce((a, b) => a + b, 0) / (top3.length || 1);
          break;
        case 'Totale Piattelli Rotti':
          value = stats.totalHits;
          break;
        case 'Precisione (%)':
          value = (stats.totalHits / (stats.totalTargets || 1)) * 100;
          break;
        case 'Miglior Serie Singola':
          value = stats.bestSeries;
          break;
        case 'Numero di Gare':
          value = stats.competitionCount;
          break;
        case 'Media Migliori 5':
          const sorted5 = [...stats.scores].sort((a, b) => b - a);
          const top5 = sorted5.slice(0, 5);
          value = top5.reduce((a, b) => a + b, 0) / (top5.length || 1);
          break;
        case 'Performance Finale (Ultima Serie)':
          value = stats.lastSeriesScores.reduce((a: number, b: number) => a + b, 0) / (stats.lastSeriesScores.length || 1);
          break;
        case 'Numero Serie Perfette (25/25)':
          value = stats.perfectSeriesCount;
          break;
        case 'Costanza (Serie)':
          // Calculate standard deviation of series scores
          if (stats.allSeriesScores.length > 1) {
            const mean = stats.allSeriesScores.reduce((a: number, b: number) => a + b, 0) / stats.allSeriesScores.length;
            const variance = stats.allSeriesScores.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / stats.allSeriesScores.length;
            value = Math.sqrt(variance);
            sortAsc = true; // Lower deviation is better
          } else {
            value = 999; // High value for those with only 1 series
            sortAsc = true;
          }
          break;
      }
      return {
        ...stats,
        value: parseFloat(value.toFixed(2)),
        sortAsc
      };
    }).sort((a, b) => {
      if (a.sortAsc) return a.value - b.value;
      return b.value - a.value;
    });

    res.json(ranking);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Teams Routes
app.get('/api/teams', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  try {
    let query = `
      SELECT t.*, 
             json_agg(json_build_object(
               'id', u.id, 
               'name', u.name, 
               'surname', u.surname,
               'score', c.totalscore,
               'competition_id', c.id
             )) as members
      FROM teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      LEFT JOIN users u ON tm.user_id = u.id
      LEFT JOIN competitions c ON c.team_id = t.id AND c.user_id = u.id
    `;
    let params: any[] = [];

    if (req.user.role === 'society') {
      query += " WHERE t.society = $1 ";
      params.push(req.user.society);
    }

    query += " GROUP BY t.id ORDER BY t.created_at DESC ";

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/teams', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  const { name, size, memberIds, competition_name, discipline, society: bodySociety, date } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const society = req.user.role === 'society' ? req.user.society : bodySociety;
    const { rows } = await client.query(
      "INSERT INTO teams (name, size, society, competition_name, discipline, date, location, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
      [name, size, society, competition_name, discipline, date, req.body.location, req.user.id]
    );
    const teamId = rows[0].id;

    for (const userId of memberIds) {
      await client.query(
        "INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)",
        [teamId, userId]
      );
    }

    await client.query('COMMIT');

    // Send push notification to team members
    if (memberIds && memberIds.length > 0) {
      await sendPushNotification(
        memberIds,
        "Nuova Squadra!",
        `Sei stato inserito nella squadra "${name}" per la gara "${competition_name}".`,
        `/history`,
        'team'
      );
    }

    res.json({ success: true, id: teamId });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.put('/api/teams/:id', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  const { id } = req.params;
  const { name, size, memberIds, competition_name, discipline, society: bodySociety, date } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check authorization
    if (req.user.role === 'society') {
      const { rows } = await client.query("SELECT society FROM teams WHERE id = $1", [id]);
      if (rows.length === 0 || rows[0].society !== req.user.society) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: "Unauthorized" });
      }
    }

    const teamId = parseInt(id);
    const society = req.user.role === 'society' ? req.user.society : bodySociety;
    const numericMemberIds = memberIds.map((mid: any) => parseInt(mid));

    // Get old members to identify changes
    const { rows: oldMemberRows } = await client.query("SELECT user_id FROM team_members WHERE team_id = $1", [teamId]);
    const oldMemberIds = oldMemberRows.map(r => r.user_id);

    console.log(`Syncing team ${teamId}: oldMembers=${oldMemberIds}, newMembers=${numericMemberIds}`);

    await client.query(
      "UPDATE teams SET name = $1, size = $2, competition_name = $3, discipline = $4, society = $5, date = $6, location = $7 WHERE id = $8",
      [name, size, competition_name, discipline, society, date, req.body.location, teamId]
    );

    // Update members
    await client.query("DELETE FROM team_members WHERE team_id = $1", [teamId]);
    for (const userId of numericMemberIds) {
      await client.query(
        "INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)",
        [teamId, userId]
      );
    }

    // Sync competitions
    const addedMemberIds = numericMemberIds.filter((mid: number) => !oldMemberIds.includes(mid));
    const removedMemberIds = oldMemberIds.filter(mid => !numericMemberIds.includes(mid));
    const keptMemberIds = numericMemberIds.filter((mid: number) => oldMemberIds.includes(mid));

    console.log(`Changes: added=${addedMemberIds}, removed=${removedMemberIds}, kept=${keptMemberIds}`);

    // 1. Delete competitions for removed members
    if (removedMemberIds.length > 0) {
      const delResult = await client.query("DELETE FROM competitions WHERE team_id = $1 AND user_id = ANY($2)", [teamId, removedMemberIds]);
      console.log(`Deleted ${delResult.rowCount} competitions for removed members`);
    }

    // 2. Update competitions for kept members
    if (keptMemberIds.length > 0) {
      await client.query(
        `UPDATE competitions SET name = $1, date = $2, location = $3, discipline = $4, team_name = $5 
         WHERE team_id = $6 AND user_id = ANY($7)`,
        [competition_name || name, date, req.body.location || society || '', discipline, name, teamId, keptMemberIds]
      );
    }

    // 3. Create competitions for added members if team was already "sent"
    const { rows: sentCompRows } = await client.query("SELECT id FROM competitions WHERE team_id = $1 LIMIT 1", [teamId]);
    if (sentCompRows.length > 0 && addedMemberIds.length > 0) {
      for (const userId of addedMemberIds) {
        const compId = `team_comp_${Date.now()}_${userId}`;
        await client.query(
          `INSERT INTO competitions (id, user_id, name, date, location, discipline, level, totalscore, totaltargets, averageperseries, scores, team_name, team_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            compId, 
            userId, 
            competition_name || name, 
            date || new Date().toISOString().split('T')[0], 
            req.body.location || society || '', 
            discipline || '', 
            'Nazionale', 
            0, 100, 0, 
            JSON.stringify([0, 0, 0, 0]), 
            name,
            teamId
          ]
        );
      }
    }

    await client.query('COMMIT');

    // Send push notification to all involved members (old and new)
    const allInvolvedIds = [...new Set([...oldMemberIds, ...numericMemberIds])];
    if (allInvolvedIds.length > 0) {
      sendPushNotification(
        allInvolvedIds,
        "Squadra Aggiornata",
        `La squadra "${name}" è stata modificata. Controlla i dettagli.`,
        `/history`,
        'team'
      );
    }

    res.json({ success: true });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/teams/:id', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  try {
    const teamId = parseInt(req.params.id);
    // Get team info for notification
    const { rows: teamRows } = await pool.query("SELECT name, society FROM teams WHERE id = $1", [teamId]);
    if (teamRows.length === 0) return res.status(404).json({ error: 'Team not found' });
    const team = teamRows[0];

    // If society, check if team belongs to society
    if (req.user.role === 'society') {
      if (team.society !== req.user.society) {
        return res.status(403).json({ error: "Unauthorized" });
      }
    }

    // Get members for notification
    const { rows: memberRows } = await pool.query("SELECT user_id FROM team_members WHERE team_id = $1", [teamId]);
    const memberIds = memberRows.map(r => r.user_id);

    // Delete associated competitions first
    await pool.query("DELETE FROM competitions WHERE team_id = $1", [teamId]);
    await pool.query("DELETE FROM teams WHERE id = $1", [teamId]);

    // Send notification to members
    if (memberIds.length > 0) {
      sendPushNotification(
        memberIds,
        "Squadra Sciolta",
        `La squadra "${team.name}" è stata eliminata dall'amministratore o dalla società.`,
        `/history`,
        'team'
      );
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/teams/:id/send-competition', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  const teamId = parseInt(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Get team info
    const { rows: teamRows } = await client.query(`
      SELECT t.*, 
             json_agg(u.id) as member_ids
      FROM teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      LEFT JOIN users u ON tm.user_id = u.id
      WHERE t.id = $1
      GROUP BY t.id
    `, [teamId]);

    if (teamRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Team not found" });
    }

    const team = teamRows[0];

    // 2. Create or update competition for each member
    for (const userId of team.member_ids) {
      if (!userId) continue;

      // Check if competition already exists for this team and user
      const { rows: existingComp } = await client.query(
        "SELECT id FROM competitions WHERE team_id = $1 AND user_id = $2",
        [teamId, userId]
      );

      if (existingComp.length > 0) {
        // Update existing
        await client.query(
          `UPDATE competitions SET name = $1, date = $2, location = $3, discipline = $4, team_name = $5 
           WHERE id = $6`,
          [
            team.competition_name || team.name, 
            team.date || new Date().toISOString().split('T')[0], 
            team.location || team.society || '', 
            team.discipline || '', 
            team.name,
            existingComp[0].id
          ]
        );
      } else {
        // Create new
        const compId = `team_comp_${Date.now()}_${userId}`;
        await client.query(
          `INSERT INTO competitions (id, user_id, name, date, location, discipline, level, totalscore, totaltargets, averageperseries, scores, team_name, team_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            compId, 
            userId, 
            team.competition_name || team.name, 
            team.date || new Date().toISOString().split('T')[0], 
            team.location || team.society || '', 
            team.discipline || '', 
            'Nazionale', // Default level
            0, // Initial score
            100, // Default targets
            0, // Initial average
            JSON.stringify([0, 0, 0, 0]), // Default 4 series of 25
            team.name,
            teamId
          ]
        );
      }
    }

    await client.query('COMMIT');

    // Send push notification to team members
    if (team.member_ids && team.member_ids.length > 0) {
      sendPushNotification(
        team.member_ids.filter((id: any) => id !== null),
        "Gara Assegnata!",
        `La gara "${team.competition_name || team.name}" è stata assegnata alla tua squadra "${team.name}".`,
        `/history`,
        'team'
      );
    }

    res.json({ success: true, message: `Gara inviata a ${team.member_ids.length} tiratori` });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.put('/api/teams/:teamId/members/:userId/score', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  const { teamId, userId } = req.params;
  const { score } = req.body;
  
  try {
    // 1. Check if competition exists
    const { rows: compRows } = await pool.query(
      "SELECT id FROM competitions WHERE team_id = $1 AND user_id = $2",
      [teamId, userId]
    );
    
    if (compRows.length === 0) {
      return res.status(400).json({ error: "La gara deve essere prima inviata ai tiratori per poter inserire un risultato." });
    }
    
    const compId = compRows[0].id;
    
    // 2. Update the score
    await pool.query(
      "UPDATE competitions SET totalscore = $1 WHERE id = $2",
      [score, compId]
    );
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Events Routes
app.get('/api/events', authenticateToken, async (req: any, res) => {
  try {
    // 1. Fetch regular events
    let eventQuery = "SELECT * FROM events";
    let eventParams: any[] = [];

    if (req.user.role === 'admin') {
      // Admin sees all
    } else if (req.user.role === 'society') {
      // Society sees their own and public
      eventQuery += " WHERE location = $1 OR visibility = 'Pubblica'";
      eventParams.push(req.user.society);
    } else {
      // User sees their society's and public
      eventQuery += " WHERE location = $1 OR visibility = 'Pubblica'";
      eventParams.push(req.user.society || '');
    }

    const { rows: events } = await pool.query(eventQuery, eventParams);

    // 4. Combine and sort
    const allEvents = [...events].sort((a, b) => {
      return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
    });

    res.json(allEvents);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'society') {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const { id, name, type, visibility, discipline, location, targets, start_date, end_date, cost, notes, poster_url, registration_link } = req.body;
  
  try {
    await pool.query(
      `INSERT INTO events (id, name, type, visibility, discipline, location, targets, start_date, end_date, cost, notes, poster_url, registration_link, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [id, name, type, visibility, discipline, location, targets, start_date, end_date, cost, notes, poster_url, registration_link, req.user.id]
    );

    // Send push notification
    let userIds: number[] = [];
    if (visibility === 'Pubblica') {
      const { rows: users } = await pool.query("SELECT id FROM users WHERE role = 'user'");
      userIds = users.map(u => u.id);
    } else {
      // For society events, notify users of the society that created the event
      // If admin creates it, we might need to check the location
      let targetSociety = req.user.society;
      if (!targetSociety && req.user.role === 'admin') {
        targetSociety = location; // Assume location is the society name if admin creates it
      }

      if (targetSociety) {
        const { rows: users } = await pool.query(
          "SELECT id FROM users WHERE role = 'user' AND LOWER(TRIM(society)) = LOWER(TRIM($1))", 
          [targetSociety]
        );
        userIds = users.map(u => u.id);
      }
    }
    
    if (userIds.length > 0) {
      sendPushNotification(userIds, "Nuovo Evento!", `${name} presso ${location}`, `/events?id=${id}`, visibility === 'Pubblica' ? 'all' : 'society');
    }

    res.status(201).json({ message: 'Evento creato' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'society') {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const { name, type, visibility, discipline, location, targets, start_date, end_date, cost, notes, poster_url, registration_link } = req.body;
  
  try {
    // Check ownership if not admin
    if (req.user.role === 'society') {
      const { rows } = await pool.query("SELECT location, created_by FROM events WHERE id = $1", [req.params.id]);
      if (rows.length === 0 || (rows[0].location !== req.user.society && rows[0].created_by !== req.user.id)) {
        return res.status(403).json({ error: 'Non autorizzato a modificare questo evento' });
      }
    }

    await pool.query(
      `UPDATE events SET name = $1, type = $2, visibility = $3, discipline = $4, location = $5, targets = $6, start_date = $7, end_date = $8, cost = $9, notes = $10, poster_url = $11, registration_link = $12
       WHERE id = $13`,
      [name, type, visibility, discipline, location, targets, start_date, end_date, cost, notes, poster_url, registration_link, req.params.id]
    );

    // Send push notification for update
    let userIds: number[] = [];
    if (visibility === 'Pubblica') {
      const { rows: users } = await pool.query("SELECT id FROM users WHERE role = 'user'");
      userIds = users.map(u => u.id);
    } else {
      let targetSociety = req.user.society;
      if (!targetSociety && req.user.role === 'admin') {
        targetSociety = location;
      }
      if (targetSociety) {
        const { rows: users } = await pool.query(
          "SELECT id FROM users WHERE role = 'user' AND LOWER(TRIM(society)) = LOWER(TRIM($1))", 
          [targetSociety]
        );
        userIds = users.map(u => u.id);
      }
    }
    if (userIds.length > 0) {
      sendPushNotification(userIds, "Evento Aggiornato", `L'evento "${name}" ha subito delle modifiche.`, `/events?id=${req.params.id}`, visibility === 'Pubblica' ? 'all' : 'society');
    }

    res.json({ message: 'Evento aggiornato' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/events/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'society') {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  try {
    // Get event details for notification before deletion
    const { rows: eventRows } = await pool.query("SELECT name, visibility, location, created_by FROM events WHERE id = $1", [req.params.id]);
    if (eventRows.length === 0) return res.status(404).json({ error: 'Evento non trovato' });
    const event = eventRows[0];

    // Check ownership if not admin
    if (req.user.role === 'society') {
      if (event.location !== req.user.society && event.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Non autorizzato a eliminare questo evento' });
      }
    }

    await pool.query("DELETE FROM events WHERE id = $1", [req.params.id]);

    // Send push notification for deletion
    let userIds: number[] = [];
    if (event.visibility === 'Pubblica') {
      const { rows: users } = await pool.query("SELECT id FROM users WHERE role = 'user'");
      userIds = users.map(u => u.id);
    } else {
      let targetSociety = event.location;
      if (targetSociety) {
        const { rows: users } = await pool.query(
          "SELECT id FROM users WHERE role = 'user' AND LOWER(TRIM(society)) = LOWER(TRIM($1))", 
          [targetSociety]
        );
        userIds = users.map(u => u.id);
      }
    }
    if (userIds.length > 0) {
      sendPushNotification(userIds, "Evento Annullato", `L'evento "${event.name}" è stato annullato.`, `/events`, event.visibility === 'Pubblica' ? 'all' : 'society');
    }

    res.json({ message: 'Evento eliminato' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Competitions Routes
app.get('/api/competitions', authenticateToken, async (req: any, res) => {
  try {
    let query = "SELECT * FROM competitions WHERE user_id = $1";
    let params = [req.user.id];

    if (req.user.role === 'society') {
      // If society, get all competitions of users in the same society
      query = `
        SELECT c.*, u.name as "userName", u.surname as "userSurname"
        FROM competitions c
        JOIN users u ON c.user_id = u.id
        WHERE u.society = $1 AND c.level != 'Allenamento / Pratica' AND c.discipline != 'Allenamento'
      `;
      params = [req.user.society];
    } else if (req.user.role === 'admin') {
      // Admin can see everything if they want, but usually they use the admin routes.
      // However, for the main dashboard, maybe they just see their own?
      // The user said: "Admin, oltre i suoi risultati... può vedere... i risultati di tutti i tiratori."
      // So let's make it so admin sees everything here too, or keep it separate.
      // Actually, the user said "Nell'area riservata può vedere... i risultati di tutti i tiratori."
      // So maybe /api/competitions should still return only their own for admin, 
      // and they use /api/admin/all-results for the rest.
    }

    const { rows } = await pool.query(query, params);
    const comps = rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      date: row.date,
      endDate: row.enddate,
      location: row.location,
      discipline: row.discipline,
      level: row.level,
      totalScore: row.totalscore,
      totalTargets: row.totaltargets,
      averagePerSeries: row.averageperseries,
      position: row.position,
      cost: row.cost,
      win: row.win,
      notes: row.notes,
      weather: row.weather ? JSON.parse(row.weather) : undefined,
      scores: JSON.parse(row.scores),
      detailedScores: row.detailedscores ? JSON.parse(row.detailedscores) : undefined,
      seriesImages: row.seriesimages ? JSON.parse(row.seriesimages) : undefined,
      usedCartridges: row.usedcartridges ? JSON.parse(row.usedcartridges) : undefined,
      teamName: row.team_name,
      userName: row.userName,
      userSurname: row.userSurname
    }));
    res.json(comps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/competitions', authenticateToken, async (req: any, res) => {
  if (req.user.role === 'society') return res.status(403).json({ error: 'Le società non possono inserire gare.' });
  const c = req.body;
  const targetUserId = (req.user.role === 'admin' && c.userId) ? c.userId : req.user.id;
  try {
    await pool.query(
      `INSERT INTO competitions (id, user_id, name, date, enddate, location, discipline, level, totalscore, totaltargets, averageperseries, position, cost, win, notes, weather, scores, detailedscores, seriesimages, usedcartridges) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        c.id, targetUserId, c.name, c.date, c.endDate || null, c.location, c.discipline, c.level, 
        c.totalScore, c.totalTargets, c.averagePerSeries, c.position || null, c.cost || 0, c.win || 0, c.notes || null,
        c.weather ? JSON.stringify(c.weather) : null,
        JSON.stringify(c.scores),
        c.detailedScores ? JSON.stringify(c.detailedScores) : null,
        c.seriesImages ? JSON.stringify(c.seriesImages) : null,
        c.usedCartridges ? JSON.stringify(c.usedCartridges) : null
      ]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/competitions/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role === 'society') return res.status(403).json({ error: 'Le società non possono modificare gare.' });
  const c = req.body;
  
  try {
    if (req.user.role === 'admin') {
      const targetUserId = c.userId || req.user.id;
      await pool.query(
        `UPDATE competitions SET user_id=$1, name=$2, date=$3, enddate=$4, location=$5, discipline=$6, level=$7, totalscore=$8, totaltargets=$9, averageperseries=$10, position=$11, cost=$12, win=$13, notes=$14, weather=$15, scores=$16, detailedscores=$17, seriesimages=$18, usedcartridges=$19 WHERE id=$20`,
        [
          targetUserId, c.name, c.date, c.endDate || null, c.location, c.discipline, c.level, 
          c.totalScore, c.totalTargets, c.averagePerSeries, c.position || null, c.cost || 0, c.win || 0, c.notes || null,
          c.weather ? JSON.stringify(c.weather) : null,
          JSON.stringify(c.scores),
          c.detailedScores ? JSON.stringify(c.detailedScores) : null,
          c.seriesImages ? JSON.stringify(c.seriesImages) : null,
          c.usedCartridges ? JSON.stringify(c.usedCartridges) : null,
          req.params.id
        ]
      );
    } else {
      await pool.query(
        `UPDATE competitions SET name=$1, date=$2, enddate=$3, location=$4, discipline=$5, level=$6, totalscore=$7, totaltargets=$8, averageperseries=$9, position=$10, cost=$11, win=$12, notes=$13, weather=$14, scores=$15, detailedscores=$16, seriesimages=$17, usedcartridges=$18 WHERE id=$19 AND user_id=$20`,
        [
          c.name, c.date, c.endDate || null, c.location, c.discipline, c.level, 
          c.totalScore, c.totalTargets, c.averagePerSeries, c.position || null, c.cost || 0, c.win || 0, c.notes || null,
          c.weather ? JSON.stringify(c.weather) : null,
          JSON.stringify(c.scores),
          c.detailedScores ? JSON.stringify(c.detailedScores) : null,
          c.seriesImages ? JSON.stringify(c.seriesImages) : null,
          c.usedCartridges ? JSON.stringify(c.usedCartridges) : null,
          req.params.id, req.user.id
        ]
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/competitions/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role === 'society') return res.status(403).json({ error: 'Le società non possono eliminare gare.' });
  console.log(`DELETE competition request: id=${req.params.id}, user_id=${req.user.id}`);
  try {
    const result = await pool.query("DELETE FROM competitions WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
    console.log(`DELETE competition result: rowCount=${result.rowCount}`);
    res.json({ success: true, rowCount: result.rowCount });
  } catch (err: any) {
    console.error('DELETE competition error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Cartridge Types Routes
app.get('/api/cartridge-types', authenticateToken, async (req: any, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM cartridge_types ORDER BY producer, model");
    const types = rows.map((row: any) => ({
      id: row.id,
      producer: row.producer,
      model: row.model,
      leadNumber: row.leadnumber,
      imageUrl: row.imageurl,
      createdBy: row.created_by
    }));
    res.json(types);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cartridge-types', authenticateToken, async (req: any, res) => {
  const t = req.body;
  try {
    // Check if it's an update
    const { rows: existing } = await pool.query("SELECT created_by FROM cartridge_types WHERE id = $1", [t.id]);
    
    if (existing.length > 0) {
      // Update: Admin or Creator only
      if (req.user.role !== 'admin' && existing[0].created_by !== req.user.id) {
        return res.status(403).json({ error: 'Non autorizzato a modificare questo tipo di cartuccia' });
      }
      
      await pool.query(
        `UPDATE cartridge_types SET 
         producer = $1,
         model = $2,
         leadnumber = $3,
         imageurl = $4
         WHERE id = $5`,
        [t.producer, t.model, t.leadNumber, t.imageUrl || null, t.id]
      );
    } else {
      // Create
      await pool.query(
        `INSERT INTO cartridge_types (id, producer, model, leadnumber, imageurl, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [t.id, t.producer, t.model, t.leadNumber, t.imageUrl || null, req.user.id]
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/cartridge-types/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo l\'amministratore può eliminare i tipi di cartucce' });
  }
  try {
    await pool.query("DELETE FROM cartridge_types WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cartridges Routes
app.get('/api/cartridges', authenticateToken, async (req: any, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM cartridges WHERE user_id = $1", [req.user.id]);
    const carts = rows.map((row: any) => ({
      id: row.id,
      purchaseDate: row.purchasedate,
      producer: row.producer,
      model: row.model,
      leadNumber: row.leadnumber,
      quantity: row.quantity,
      initialQuantity: row.initialquantity,
      cost: row.cost,
      armory: row.armory,
      imageUrl: row.imageurl
    }));
    res.json(carts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cartridges', authenticateToken, async (req: any, res) => {
  const c = req.body;
  try {
    await pool.query(
      `INSERT INTO cartridges (id, user_id, purchasedate, producer, model, leadnumber, quantity, initialquantity, cost, armory, imageurl) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [c.id, req.user.id, c.purchaseDate, c.producer, c.model, c.leadNumber, c.quantity, c.initialQuantity, c.cost, c.armory || null, c.imageUrl || null]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cartridges/bulk', authenticateToken, async (req: any, res) => {
  const cartridges = req.body;
  if (!Array.isArray(cartridges)) {
    return res.status(400).json({ error: 'Body must be an array of cartridges' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const c of cartridges) {
      await client.query(
        `INSERT INTO cartridges (id, user_id, purchasedate, producer, model, leadnumber, quantity, initialquantity, cost, armory, imageurl) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET 
         purchasedate = EXCLUDED.purchasedate,
         producer = EXCLUDED.producer,
         model = EXCLUDED.model,
         leadnumber = EXCLUDED.leadnumber,
         quantity = EXCLUDED.quantity,
         initialquantity = EXCLUDED.initialquantity,
         cost = EXCLUDED.cost,
         armory = EXCLUDED.armory,
         imageurl = EXCLUDED.imageurl`,
        [c.id, req.user.id, c.purchaseDate, c.producer, c.model, c.leadNumber, c.quantity, c.initialQuantity, c.cost, c.armory || null, c.imageUrl || null]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.put('/api/cartridges/:id', authenticateToken, async (req: any, res) => {
  const c = req.body;
  try {
    await pool.query(
      `UPDATE cartridges SET purchasedate=$1, producer=$2, model=$3, leadnumber=$4, quantity=$5, initialquantity=$6, cost=$7, armory=$8, imageurl=$9 WHERE id=$10 AND user_id=$11`,
      [c.purchaseDate, c.producer, c.model, c.leadNumber, c.quantity, c.initialQuantity, c.cost, c.armory || null, c.imageUrl || null, req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/cartridges/:id', authenticateToken, async (req: any, res) => {
  console.log(`DELETE cartridge request: id=${req.params.id}, user_id=${req.user.id}`);
  try {
    const result = await pool.query("DELETE FROM cartridges WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
    console.log(`DELETE cartridge result: rowCount=${result.rowCount}`);
    res.json({ success: true, rowCount: result.rowCount });
  } catch (err: any) {
    console.error('DELETE cartridge error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/import', authenticateToken, async (req: any, res) => {
  const { competitions, cartridges } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    if (competitions && Array.isArray(competitions)) {
      for (const c of competitions) {
        const userId = (req.user.role === 'admin' && c.user_id) ? c.user_id : req.user.id;
        await client.query(
          `INSERT INTO competitions (id, user_id, name, date, enddate, location, discipline, level, totalscore, totaltargets, averageperseries, position, cost, win, notes, weather, scores, detailedscores, seriesimages, usedcartridges) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
           ON CONFLICT (id) DO UPDATE SET 
           name=$3, date=$4, enddate=$5, location=$6, discipline=$7, level=$8, totalscore=$9, totaltargets=$10, averageperseries=$11, position=$12, cost=$13, win=$14, notes=$15, weather=$16, scores=$17, detailedscores=$18, seriesimages=$19, usedcartridges=$20
           WHERE competitions.user_id = $2`,
          [
            c.id, userId, c.name, c.date, c.endDate || null, c.location, c.discipline, c.level, 
            c.totalScore, c.totalTargets, c.averagePerSeries, c.position || null, c.cost || 0, c.win || 0, c.notes || null,
            c.weather ? JSON.stringify(c.weather) : null,
            JSON.stringify(c.scores),
            c.detailedScores ? JSON.stringify(c.detailedScores) : null,
            c.seriesImages ? JSON.stringify(c.seriesImages) : null,
            c.usedCartridges ? JSON.stringify(c.usedCartridges) : null
          ]
        );
      }
    }
    
    if (cartridges && Array.isArray(cartridges)) {
      for (const c of cartridges) {
        const userId = (req.user.role === 'admin' && c.user_id) ? c.user_id : req.user.id;
        await client.query(
          `INSERT INTO cartridges (id, user_id, purchasedate, producer, model, leadnumber, quantity, initialquantity, cost, armory, imageurl) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE SET 
           purchasedate=$3, producer=$4, model=$5, leadnumber=$6, quantity=$7, initialquantity=$8, cost=$9, armory=$10, imageurl=$11
           WHERE cartridges.user_id = $2`,
          [c.id, userId, c.purchaseDate, c.producer, c.model, c.leadNumber, c.quantity, c.initialQuantity, c.cost, c.armory || null, c.imageUrl || null]
        );
      }
    }
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

async function setupVite(app: any) {
  const isProd = process.env.NODE_ENV === "production";
  const distPath = path.resolve(process.cwd(), 'dist');

  if (!isProd) {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log('Vite middleware initialized');
    } catch (e) {
      console.error('Vite initialization failed, falling back to static serving', e);
      if (fs.existsSync(distPath)) {
        serveStatic(app);
      } else {
        app.get('*', (req: any, res: any) => {
          res.status(500).send('Vite failed to start and no build found. Please check server logs.');
        });
      }
    }
  } else {
    if (fs.existsSync(distPath)) {
      console.log('Serving static files from dist directory');
      serveStatic(app);
    } else {
      console.error('Production mode enabled but dist directory not found');
      app.get('*', (req: any, res: any) => {
        res.status(500).send('Production build not found. Run npm run build.');
      });
    }
  }
}

function serveStatic(app: any) {
  const distPath = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.use((req: any, res: any) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

async function startApp() {
  // API routes are already defined above
  
  // Setup Vite or Static serving
  await setupVite(app);

  app.listen(PORT as number, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startApp();

