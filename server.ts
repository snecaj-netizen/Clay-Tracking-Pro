import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

import webpush from 'web-push';
import cron from 'node-cron';

// import { createServer as createViteServer } from 'vite'; // Removed top-level import

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// 1. IMMEDIATE HEALTH CHECK (Must be first)
app.get('/ping', (req, res) => res.send('pong'));

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-clay-tracker';

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Initialize PostgreSQL Database (Supabase)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : undefined
});

// Helper to calculate qualification based on age
const getAutoQualification = (birthDate: string | null, currentQual: string | null): string | null => {
  if (!birthDate) return currentQual;
  const birthDateObj = new Date(birthDate);
  const birthYear = birthDateObj.getFullYear();
  if (isNaN(birthYear)) return currentQual;
  
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  
  if (age <= 20) return 'Junior';
  if (age >= 56 && age <= 65) return 'Senior';
  if (age >= 66 && age <= 72) return 'Veterani';
  if (age > 72) return 'Master';
  
  if (['Junior', 'Senior', 'Veterani', 'Master'].includes(currentQual || '')) {
    return null;
  }
  
  return currentQual;
};

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
        shooter_code TEXT,
        avatar TEXT,
        status TEXT DEFAULT 'active',
        login_count INTEGER DEFAULT 0,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add columns if they don't exist (for existing databases)
    try {
      await pool.query("ALTER TABLE users RENAME COLUMN fitav_card TO shooter_code").catch(() => {});
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS category TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS qualification TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS society TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS shooter_code TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP");
    } catch (_) {
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
        chokes TEXT,
        team_name TEXT,
        team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
        shoot_off INTEGER,
        category_at_time TEXT,
        qualification_at_time TEXT,
        society_at_time TEXT,
        ranking_preference TEXT DEFAULT 'categoria'
      );
    `);

    // Check if chokes column exists, if not add it
    try {
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS detailedscores TEXT");
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS chokes TEXT");
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS team_name TEXT");
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL");
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS event_id TEXT REFERENCES events(id) ON DELETE SET NULL");
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS shoot_off INTEGER");
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS category_at_time TEXT");
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS qualification_at_time TEXT");
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS society_at_time TEXT");
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS ranking_preference TEXT DEFAULT 'categoria'");
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS ranking_preference_override TEXT");
    } catch (e) {
      console.log("Some columns might already exist or ALTER TABLE failed:", e);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cartridges (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purchasedate TEXT NOT NULL,
        producer TEXT NOT NULL,
        model TEXT NOT NULL,
        leadnumber TEXT NOT NULL,
        grams INTEGER,
        quantity INTEGER NOT NULL,
        initialquantity INTEGER NOT NULL,
        cost REAL NOT NULL,
        armory TEXT,
        imageurl TEXT,
        type_id TEXT REFERENCES cartridge_types(id) ON DELETE SET NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cartridge_types (
        id TEXT PRIMARY KEY,
        producer TEXT NOT NULL,
        model TEXT NOT NULL,
        leadnumber TEXT NOT NULL,
        grams INTEGER,
        imageurl TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    // Ensure columns exist
    try {
      await pool.query("ALTER TABLE cartridge_types ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL");
      await pool.query("ALTER TABLE cartridge_types ADD COLUMN IF NOT EXISTS grams INTEGER");
      await pool.query("ALTER TABLE cartridges ADD COLUMN IF NOT EXISTS grams INTEGER");
      await pool.query("ALTER TABLE cartridges ADD COLUMN IF NOT EXISTS type_id TEXT REFERENCES cartridge_types(id) ON DELETE SET NULL");
      
      // Add indexes for performance
      await pool.query("CREATE INDEX IF NOT EXISTS idx_competitions_user_id ON competitions(user_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_competitions_date ON competitions(date)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_competitions_discipline ON competitions(discipline)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_competitions_location ON competitions(location)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_competitions_team_id ON competitions(team_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_competitions_event_id ON competitions(event_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_cartridges_user_id ON cartridges(user_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_cartridge_types_created_by ON cartridge_types(created_by)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_users_society ON users(society)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_users_name_surname ON users(name, surname)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_teams_society ON teams(society)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_challenges_society_id ON challenges(society_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON event_registrations(event_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_event_registrations_user_id ON event_registrations(user_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_event_squads_event_id ON event_squads(event_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_event_squad_members_registration_id ON event_squad_members(registration_id)");
    } catch (e) {
      console.log("Error adding columns or indexes to tables:", e);
    }

    // Cleanup duplicates in cartridge_types before adding constraint
    try {
      await pool.query(`
        DELETE FROM cartridge_types a USING cartridge_types b
        WHERE a.id > b.id 
          AND LOWER(TRIM(a.producer)) = LOWER(TRIM(b.producer))
          AND LOWER(TRIM(a.model)) = LOWER(TRIM(b.model))
          AND a.leadnumber = b.leadnumber
          AND (a.grams = b.grams OR (a.grams IS NULL AND b.grams IS NULL))
      `);
      
      // Add unique constraint if it doesn't exist
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_cartridge_type') THEN
            ALTER TABLE cartridge_types ADD CONSTRAINT unique_cartridge_type UNIQUE (producer, model, leadnumber, grams);
          END IF;
        END $$;
      `);
    } catch (e) {
      console.log("Error cleaning up or adding constraint to cartridge_types:", e);
    }

    // Migrate existing cartridges to cartridge_types ONLY if table is empty
    try {
      const { rows: typeCount } = await pool.query("SELECT count(*) FROM cartridge_types");
      if (parseInt(typeCount[0].count) === 0) {
        await pool.query(`
          INSERT INTO cartridge_types (id, producer, model, leadnumber, grams, imageurl, created_by)
          SELECT DISTINCT ON (LOWER(TRIM(producer)), LOWER(TRIM(model)), leadnumber, grams)
            id, TRIM(producer), TRIM(model), leadnumber, grams, imageurl, user_id
          FROM cartridges
          ON CONFLICT (producer, model, leadnumber, grams) DO NOTHING;
        `);
      }

      // Link existing cartridges to their types (always safe to run)
      await pool.query(`
        UPDATE cartridges c
        SET type_id = t.id
        FROM cartridge_types t
        WHERE c.type_id IS NULL
          AND LOWER(TRIM(c.producer)) = LOWER(TRIM(t.producer))
          AND LOWER(TRIM(c.model)) = LOWER(TRIM(t.model))
          AND c.leadnumber = t.leadnumber
          AND (c.grams = t.grams OR (c.grams IS NULL AND t.grams IS NULL))
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
      await pool.query("ALTER TABLE teams ADD COLUMN IF NOT EXISTS targets INTEGER DEFAULT 100");
      await pool.query("ALTER TABLE teams ADD COLUMN IF NOT EXISTS event_id TEXT");
      try {
        await pool.query("ALTER TABLE teams ALTER COLUMN event_id TYPE TEXT");
      } catch (e) {
        console.log("Error altering teams.event_id type:", e);
      }
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS team_name TEXT");
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL");
    } catch (e) {
      console.log("Columns might already exist or error adding them:", e);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS societies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        code TEXT UNIQUE,
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
      
      -- Add code column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='societies' AND column_name='code') THEN 
          ALTER TABLE societies ADD COLUMN code TEXT UNIQUE; 
        END IF; 
      END $$;
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
    } catch (_) {
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
      await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS prize_settings TEXT`);
      await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open'`);
      await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS ranking_logic TEXT DEFAULT 'individual'`);
      await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS ranking_preference_override TEXT`);
      await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS has_society_ranking BOOLEAN DEFAULT FALSE`);
      await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS has_team_ranking BOOLEAN DEFAULT FALSE`);
      await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS is_management_enabled BOOLEAN DEFAULT FALSE`);
    } catch (e) {
      console.log("Error adding columns to events:", e);
    }

    // Add status to competitions
    try {
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open'");
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS hidden_from_user BOOLEAN DEFAULT FALSE");
    } catch (e) {
      console.log("Error adding columns to competitions:", e);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Initialize default settings
    await pool.query(`
      INSERT INTO app_settings (key, value)
      VALUES ('event_results_access', '{"tiratori": false, "societa": false}'::jsonb)
      ON CONFLICT (key) DO NOTHING;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (team_id, user_id)
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_teams (
        id SERIAL PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        society TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add event_team_id to competitions
    try {
      await pool.query("ALTER TABLE competitions ADD COLUMN IF NOT EXISTS event_team_id INTEGER REFERENCES event_teams(id) ON DELETE SET NULL");
    } catch (e) {
      console.log("Failed to add event_team_id column:", e);
    }

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
        templates JSONB DEFAULT '{"new_competition": "Nuova gara pubblicata: {competition_name} presso {society_name}!", "score_update": "Risultati aggiornati per {competition_name}. Controlla la tua posizione!", "new_challenge": "{shooter_name} ti ha sfidato! Accetta la sfida nel tuo profilo.", "challenge_completed": "Sfida completata! {winner_name} ha vinto contro {loser_name}!", "competition_reminder": "Com''è andata oggi a {competition_name}? Inserisci il risultato per vedere come cambia la tua media!", "registrations_opened": "Le iscrizioni per la gara {competition_name} presso {society_name} sono ora aperte! Iscriviti subito!"}'::jsonb,
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_registrations (
        id SERIAL PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        registration_day TEXT NOT NULL,
        registration_type TEXT NOT NULL,
        shotgun_brand TEXT NOT NULL,
        shotgun_model TEXT,
        cartridge_brand TEXT NOT NULL,
        cartridge_model TEXT,
        shooting_session TEXT NOT NULL,
        notes TEXT,
        phone TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, user_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_squads (
        id SERIAL PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        squad_number INTEGER NOT NULL,
        field_number INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        is_locked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add is_locked column if it doesn't exist
    await pool.query("ALTER TABLE event_squads ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE").catch(() => {});

    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_squad_members (
        squad_id INTEGER REFERENCES event_squads(id) ON DELETE CASCADE,
        registration_id INTEGER REFERENCES event_registrations(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        PRIMARY KEY (squad_id, registration_id)
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
      // Force admin password reset to 'admin' to ensure access
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('admin', salt);
      await pool.query("UPDATE users SET password = $1 WHERE email = $2", [hash, 'snecaj@gmail.com']);
      console.log("✅ Admin password reset to 'admin' for snecaj@gmail.com");
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

    // Migration: Update qualifications for existing users based on birth_date
    try {
      const { rows: existingUsers } = await pool.query("SELECT id, birth_date, qualification FROM users WHERE birth_date IS NOT NULL AND birth_date != ''");
      for (const u of existingUsers) {
        const newQual = getAutoQualification(u.birth_date, u.qualification);
        if (newQual !== u.qualification) {
          await pool.query("UPDATE users SET qualification = $1 WHERE id = $2", [newQual, u.id]);
        }
      }
      console.log("✅ Qualifications migration completed.");
    } catch (err) {
      console.error("❌ Error in qualifications migration:", err);
    }

    console.log('Connected to PostgreSQL database and initialized tables.');

    // Ensure admin has the registrations_opened template
    try {
      const { rows: adminRows } = await pool.query("SELECT id FROM users WHERE email = 'snecaj@gmail.com'");
      if (adminRows.length > 0) {
        const adminId = adminRows[0].id;
        const { rows: settingsRows } = await pool.query("SELECT templates FROM notification_settings WHERE user_id = $1", [adminId]);
        if (settingsRows.length > 0) {
          let currentTemplates = settingsRows[0].templates || {};
          if (!currentTemplates.registrations_opened) {
            currentTemplates.registrations_opened = "Le iscrizioni per la gara {competition_name} presso {society_name} sono ora aperte! Iscriviti subito!";
            await pool.query("UPDATE notification_settings SET templates = $1 WHERE user_id = $2", [JSON.stringify(currentTemplates), adminId]);
            console.log("Added registrations_opened template to admin settings.");
          }
        }
      }
    } catch (e) {
      console.log("Error ensuring admin template:", e);
    }
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
          const { rows: users } = await pool.query("SELECT id FROM users WHERE role != 'society'");
          userIds = users.map(u => u.id);
        } else {
          const { rows: creators } = await pool.query("SELECT society FROM users WHERE id = $1", [event.created_by]);
          if (creators.length > 0 && creators[0].society) {
            const { rows: users } = await pool.query("SELECT id FROM users WHERE role != 'society' AND society = $1", [creators[0].society]);
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

  // Setup cron job for competition reminders (at 8 PM)
  cron.schedule('0 20 * * *', async () => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Find competitions scheduled for today that have no score (totalscore = 0)
      // We check if today is the last day of the competition (enddate if exists, otherwise date)
      // AND we ensure the competition is actually linked to the user in their history (user_id matches)
      const { rows: pendingCompetitions } = await pool.query(
        "SELECT user_id, name FROM competitions WHERE COALESCE(NULLIF(enddate, ''), date) = $1 AND totalscore = 0 AND hidden_from_user = FALSE",
        [todayStr]
      );

      if (pendingCompetitions.length === 0) return;

      // Group by user to avoid multiple notifications if they have multiple empty competitions today
      const userNotifications = new Map<number, string[]>();
      for (const comp of pendingCompetitions) {
        if (!userNotifications.has(comp.user_id)) {
          userNotifications.set(comp.user_id, []);
        }
        userNotifications.get(comp.user_id)!.push(comp.name);
      }

      for (const [userId, compNames] of userNotifications.entries()) {
        const names = compNames.join(', ');
        await sendPushNotification(
          [userId], 
          "Com'è andata oggi?", 
          `Com'è andata oggi a ${names}? Inserisci il risultato per vedere come cambia la tua media!`, 
          `/history`,
          'all'
        );
      }
    } catch (err) {
      console.error("Error in cron job for competition reminders:", err);
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
    // BUT: The user now wants a "compact" message for the admin.
    // So we'll handle the admin separately if it's a system event.
    if (settings.admin_notifications_enabled) {
      if (numericUserIds.length === 0 || recipientType === 'all') {
        if (!numericUserIds.includes(numericAdminId)) {
          numericUserIds.push(numericAdminId);
        }
      }
    }

    // 1. Filter users by rate limit
    const usersToNotify = [];
    for (const userId of numericUserIds) {
      // Get user's specific rate limit or fallback to global admin setting
      let userRateLimit = settings.rate_limit;
      const { rows: userSettingsRows } = await pool.query("SELECT rate_limit FROM notification_settings WHERE user_id = $1", [userId]);
      if (userSettingsRows.length > 0 && userSettingsRows[0].rate_limit !== undefined) {
        userRateLimit = userSettingsRows[0].rate_limit;
      }

      // Count notifications sent today
      const today = new Date().toISOString().split('T')[0];
      const { rows: countRows } = await pool.query(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND DATE(created_at) = $2",
        [userId, today]
      );
      const notificationsSentToday = parseInt(countRows[0].count);

      if (notificationsSentToday < userRateLimit) {
        usersToNotify.push(userId);
      } else {
        console.log(`Rate limit reached for user ${userId}. Skipping notification.`);
      }
    }

    // 2. Save notifications for each user in the filtered list
    for (const userId of usersToNotify) {
      await pool.query(
        "INSERT INTO notifications (user_id, title, body, url) VALUES ($1, $2, $3, $4)",
        [userId, title, body, url]
      );
    }

    // 3. Send Push Notifications
    if (usersToNotify.length === 0) return;

    const { rows: subscriptions } = await pool.query(
      "SELECT * FROM push_subscriptions WHERE user_id = ANY($1)",
      [usersToNotify]
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
    userQuery = "SELECT id FROM users WHERE role IN ('user', 'admin')";
  } else if (targetType === 'shooters_of_society') {
    userQuery = "SELECT id FROM users WHERE (role = 'user' OR role = 'admin') AND society = $1";
    queryParams = [targetId];
  }

  if (!userQuery) return [];

  const { rows: targetUsers } = await pool.query(userQuery, queryParams);
  return targetUsers.map(u => u.id);
};

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(`Login attempt for: ${email} on database: ${process.env.DATABASE_URL?.substring(0, 30)}...`);
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [email]);
    const user = rows[0];
    if (!user) {
      console.log(`Login failed: User not found (${email})`);
      return res.status(400).json({ error: 'User not found' });
    }

    if (user.status === 'suspended') {
      console.log(`Login failed: User suspended (${email})`);
      return res.status(403).json({ 
        error: 'Account sospeso', 
        message: 'Il tuo account è stato sospeso. Contatta l\'amministratore per maggiori informazioni.' 
      });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      console.log(`Login failed: Invalid password (${email})`);
      return res.status(400).json({ error: 'Invalid password' });
    }

    console.log(`Login successful: ${email}`);
    // Update login count and last login
    await pool.query("UPDATE users SET login_count = login_count + 1, last_login = CURRENT_TIMESTAMP WHERE id = $1", [user.id]);
    await pool.query("INSERT INTO login_logs (user_id) VALUES ($1)", [user.id]);

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, society: user.society }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, surname: user.surname, email: user.email, role: user.role, category: user.category, qualification: user.qualification, society: user.society, shooter_code: user.shooter_code, avatar: user.avatar, birth_date: user.birth_date, phone: user.phone } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// User Profile Routes
app.put('/api/user/profile', authenticateToken, async (req: any, res) => {
  const { name, surname, email, password, category, qualification, society, shooter_code, avatar, birth_date, phone } = req.body;
  
  const finalQualification = getAutoQualification(birth_date, qualification);

  if (req.user.role === 'society' && !shooter_code) {
    return res.status(400).json({ error: 'Il Codice Società è obbligatorio' });
  }

  try {
    if (password) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      await pool.query(
        "UPDATE users SET name = $1, surname = $2, email = $3, password = $4, category = $5, qualification = $6, society = $7, shooter_code = $8, avatar = $9, birth_date = $10, phone = $11 WHERE id = $12",
        [name, surname, email, hash, category, finalQualification, society, shooter_code, avatar, birth_date || null, phone || null, req.user.id]
      );
    } else {
      await pool.query(
        "UPDATE users SET name = $1, surname = $2, email = $3, category = $4, qualification = $5, society = $6, shooter_code = $7, avatar = $8, birth_date = $9, phone = $10 WHERE id = $11",
        [name, surname, email, category, finalQualification, society, shooter_code, avatar, birth_date || null, phone || null, req.user.id]
      );
    }
    res.json({ success: true });
  } catch (_) {
    res.status(400).json({ error: 'Email already in use or other error' });
  }
});

app.put('/api/admin/events/:id/toggle-management', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    const result = await pool.query(
      'UPDATE events SET is_management_enabled = $1 WHERE id = $2 RETURNING *',
      [enabled, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }

    const event = result.rows[0];

    // Send notifications if management (registrations) is enabled
    if (enabled) {
      try {
        // 1. Get all shooters (role 'user' and 'admin')
        const { rows: shooters } = await pool.query("SELECT id FROM users WHERE role IN ('user', 'admin')");
        const shooterIds = shooters.map(u => u.id);

        // 2. Get the society user for this event
        // We match by the event's location (which is the society name) or the creator if it's a society
        const { rows: societyUsers } = await pool.query(
          "SELECT id FROM users WHERE role = 'society' AND (id = $1 OR society = $2)",
          [event.created_by, event.location]
        );
        const societyIds = societyUsers.map(u => u.id);

        // Combine and deduplicate recipient IDs
        const recipientIds = [...new Set([...shooterIds, ...societyIds])];

        if (recipientIds.length > 0) {
          // Get template from admin settings if available
          const { rows: adminRows } = await pool.query("SELECT id FROM users WHERE email = 'snecaj@gmail.com'");
          const adminId = adminRows[0]?.id;
          
          let body = `Le iscrizioni per la gara "${event.name}" presso ${event.location} sono ora aperte! Iscriviti subito!`;
          
          if (adminId) {
            const { rows: settingsRows } = await pool.query("SELECT templates FROM notification_settings WHERE user_id = $1", [adminId]);
            if (settingsRows.length > 0 && settingsRows[0].templates?.registrations_opened) {
              body = settingsRows[0].templates.registrations_opened
                .replace(/{competition_name}/g, event.name)
                .replace(/{society_name}/g, event.location);
            }
          }

          await sendPushNotification(
            recipientIds,
            "Iscrizioni Aperte!",
            body,
            `/gare?id=${event.id}`,
            'all'
          );
        }
      } catch (notifyErr) {
        console.error("Error sending notifications for opened registrations:", notifyErr);
        // We don't fail the main request if notifications fail
      }
    }

    res.json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

    // The user wants to see only their own notifications (Stefano Necaj / Admin)
    // by default. We filter by user_id unless they explicitly want to monitor everything.
    if (!adminNotificationsEnabled) {
      query += ` WHERE n.user_id = $1`;
      params.push(req.user.id);
    } else {
      // Even if enabled, the user complained about seeing "Danilo Grassi" etc.
      // So we'll show only notifications for the admin OR notifications that were sent to "all"
      // But actually, the simplest fix for the user's request is to always filter by user_id
      // and let the "Compact" notifications (which are sent TO the admin) be the way they monitor.
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

// Society Stats API
app.get('/api/society/stats', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  try {
    const isSociety = req.user.role === 'society';
    const societyName = req.user.society;

    let userQuery = 'SELECT COUNT(*) FROM users WHERE role IN (\'user\', \'admin\')';
    let teamQuery = 'SELECT COUNT(*) FROM teams';
    const params: any[] = [];

    if (isSociety && societyName) {
      userQuery += ' AND society = $1';
      teamQuery += ' WHERE society = $1';
      params.push(societyName);
    }

    const [userCount, teamCount] = await Promise.all([
      pool.query(userQuery, params),
      pool.query(teamQuery, params)
    ]);

    res.json({
      users: parseInt(userCount.rows[0].count),
      teams: parseInt(teamCount.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching society stats:', error);
    res.status(500).json({ error: 'Internal server error' });
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
    const usersRes = await pool.query("SELECT id, society, role FROM users");
    usersRes.rows.forEach(u => {
      const isOnline = activeUsers.has(u.id) && (now - activeUsers.get(u.id)!) < 5 * 60 * 1000;
      if (isOnline) {
        if (u.role !== 'society') onlineUsersCount++;
        if (u.role === 'society' && u.society) onlineSocieties.add(u.society);
      }
    });
    
    let topUserQuery = `
      SELECT u.name, u.surname, COUNT(l.id) as login_count
      FROM users u
      JOIN login_logs l ON u.id = l.user_id
      WHERE u.role != 'society'
      ${timeFilter}
      GROUP BY u.id, u.name, u.surname
      ORDER BY login_count DESC
      LIMIT 1
    `;
    
    let topSocQuery = `
      SELECT u.society, COUNT(l.id) as login_count
      FROM users u
      JOIN login_logs l ON u.id = l.user_id
      WHERE u.role = 'society' AND u.society IS NOT NULL
      ${timeFilter}
      GROUP BY u.society
      ORDER BY login_count DESC
      LIMIT 1
    `;

    // New Activity KPIs
    let compTimeFilter = '';
    const todayStr = new Date().toISOString().split('T')[0];
    if (filter === 'day') {
      compTimeFilter = `AND c.date >= '${todayStr}'`;
    } else if (filter === 'week') {
      compTimeFilter = "AND c.date >= TO_CHAR(CURRENT_DATE - INTERVAL '7 days', 'YYYY-MM-DD')";
    } else if (filter === 'month') {
      compTimeFilter = "AND c.date >= TO_CHAR(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD')";
    } else if (filter === 'year') {
      compTimeFilter = "AND c.date >= TO_CHAR(CURRENT_DATE - INTERVAL '365 days', 'YYYY-MM-DD')";
    }

    let topUserByResultsQuery = `
      SELECT u.name, u.surname, COUNT(c.id) as count
      FROM users u
      JOIN competitions c ON u.id = c.user_id
      WHERE u.role != 'society'
      ${compTimeFilter}
      GROUP BY u.id, u.name, u.surname
      ORDER BY count DESC
      LIMIT 1
    `;

    let topSocByResultsQuery = `
      SELECT u.society, COUNT(c.id) as count
      FROM users u
      JOIN competitions c ON u.id = c.user_id
      WHERE u.society IS NOT NULL
      ${compTimeFilter}
      GROUP BY u.society
      ORDER BY count DESC
      LIMIT 1
    `;

    let topUserByTargetsQuery = `
      SELECT u.name, u.surname, SUM(c.totaltargets) as total
      FROM users u
      JOIN competitions c ON u.id = c.user_id
      WHERE u.role != 'society'
      ${compTimeFilter}
      GROUP BY u.id, u.name, u.surname
      ORDER BY total DESC
      LIMIT 1
    `;

    const topUserRes = await pool.query(topUserQuery);
    const topSocRes = await pool.query(topSocQuery);
    const topUserByResultsRes = await pool.query(topUserByResultsQuery);
    const topSocByResultsRes = await pool.query(topSocByResultsQuery);
    const topUserByTargetsRes = await pool.query(topUserByTargetsQuery);

    res.json({
      onlineUsersCount,
      onlineSocietiesCount: onlineSocieties.size,
      topUserName: topUserRes.rows[0] ? `${topUserRes.rows[0].name} ${topUserRes.rows[0].surname}` : '-',
      topUserLogins: topUserRes.rows[0] ? parseInt(topUserRes.rows[0].login_count) : 0,
      topSocName: topSocRes.rows[0] ? topSocRes.rows[0].society : '-',
      topSocLogins: topSocRes.rows[0] ? parseInt(topSocRes.rows[0].login_count) : 0,
      // New fields
      topUserByResultsName: topUserByResultsRes.rows[0] ? `${topUserByResultsRes.rows[0].name} ${topUserByResultsRes.rows[0].surname}` : '-',
      topUserResultsCount: topUserByResultsRes.rows[0] ? parseInt(topUserByResultsRes.rows[0].count) : 0,
      topSocByResultsName: topSocByResultsRes.rows[0] ? topSocByResultsRes.rows[0].society : '-',
      topSocResultsCount: topSocByResultsRes.rows[0] ? parseInt(topSocByResultsRes.rows[0].count) : 0,
      topUserByTargetsName: topUserByTargetsRes.rows[0] ? `${topUserByTargetsRes.rows[0].name} ${topUserByTargetsRes.rows[0].surname}` : '-',
      topUserTargetsTotal: topUserByTargetsRes.rows[0] ? parseInt(topUserByTargetsRes.rows[0].total) : 0
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Routes (Manage Users)
app.get('/api/admin/users', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string);
    const search = req.query.search as string;
    const role = req.query.role as string;
    const excludeRole = req.query.excludeRole as string;
    
    let query = "SELECT id, name, surname, email, role, category, qualification, society, shooter_code, avatar, birth_date, phone, status, login_count, last_login, created_at FROM users";
    let countQuery = "SELECT COUNT(*) FROM users";
    let params: any[] = [];
    let whereClauses: string[] = [];
    
    if (req.user.role === 'society') {
      if (req.query.all === 'true') {
        whereClauses.push("role IN ('user', 'admin')");
      } else {
        whereClauses.push("role IN ('user', 'admin') AND (society = $" + (params.length + 1) + " OR role = 'admin')");
        params.push(req.user.society);
      }
    }

    if (role) {
      whereClauses.push("role = $" + (params.length + 1));
      params.push(role);
    }

    if (excludeRole) {
      whereClauses.push("role != $" + (params.length + 1));
      params.push(excludeRole);
    }
    
    if (search) {
      const searchParam = "%" + search.toLowerCase() + "%";
      whereClauses.push("(LOWER(name) LIKE $" + (params.length + 1) + 
                        " OR LOWER(surname) LIKE $" + (params.length + 1) + 
                        " OR LOWER(name || ' ' || surname) LIKE $" + (params.length + 1) + 
                        " OR LOWER(surname || ' ' || name) LIKE $" + (params.length + 1) + 
                        " OR LOWER(email) LIKE $" + (params.length + 1) + 
                        " OR LOWER(society) LIKE $" + (params.length + 1) + 
                        " OR LOWER(shooter_code) LIKE $" + (params.length + 1) + ")");
      params.push(searchParam);
    }
    
    if (whereClauses.length > 0) {
      const wherePart = " WHERE " + whereClauses.join(" AND ");
      query += wherePart;
      countQuery += wherePart;
    }
    
    // Get total count
    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0].count);
    
    const now = Date.now();
    const activeUserIds = Array.from(activeUsers.entries())
      .filter(([_, lastSeen]) => (now - lastSeen) < 5 * 60 * 1000)
      .map(([id, _]) => id);

    if (activeUserIds.length > 0) {
      query += ` ORDER BY CASE WHEN id = ANY($${params.length + 1}) THEN 0 ELSE 1 END, created_at DESC`;
      params.push(activeUserIds);
    } else {
      query += " ORDER BY created_at DESC";
    }
    
    if (limit) {
      const offset = (page - 1) * limit;
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
    }
    
    const { rows } = await pool.query(query, params);
    const usersWithStatus = rows.map(user => ({
      ...user,
      is_logged_in: activeUsers.has(user.id) && (now - activeUsers.get(user.id)!) < 5 * 60 * 1000
    }));
    
    if (limit) {
      res.json({ users: usersWithStatus, total });
    } else {
      res.json(usersWithStatus);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  const { name, surname, email, password, role, category, qualification, society, shooter_code, avatar, birth_date, phone } = req.body;
  
  const finalQualification = getAutoQualification(birth_date, qualification);

  if (role === 'society' && !shooter_code) {
    return res.status(400).json({ error: 'Il Codice Società (Codice Tiratore) è obbligatorio per gli utenti società' });
  }

  if (req.user.role === 'society') {
    if (role && role !== 'user') {
      return res.status(403).json({ error: 'Le società possono creare solo tiratori' });
    }
  }

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  try {
    const { rows } = await pool.query(
      "INSERT INTO users (name, surname, email, password, role, category, qualification, society, shooter_code, avatar, birth_date, phone, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id",
      [name, surname, email, hash, role || 'user', category, finalQualification, society, shooter_code, avatar || null, birth_date || null, phone || null, 'active']
    );
    
    // Notify Admin about new user
    const newUserId = rows[0].id;
    const creatorName = req.user.role === 'society' ? `la società ${req.user.society}` : 'l\'amministratore';
    sendPushNotification([], "Nuovo Utente Registrato", `È stato aggiunto un nuovo tiratore: ${name} ${surname} da parte di ${creatorName}.`, `/admin?tab=users`);

    res.json({ id: newUserId, name, surname, email, role: role || 'user', category, qualification: finalQualification, society, shooter_code, avatar, birth_date, phone, status: 'active' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/users/import', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  const { users } = req.body;
  if (!Array.isArray(users)) return res.status(400).json({ error: 'Invalid data format' });

  const results = { created: 0, updated: 0, errors: 0 };
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    // Cache societies for faster lookup
    const { rows: societies } = await client.query("SELECT name, code FROM societies");
    const societyMap = new Map(societies.map(s => [s.code?.toLowerCase(), s.name]));

    for (const u of users) {
      if (!u.email) {
        results.errors++;
        continue;
      }

      try {
        let societyName = u.society;
        if (u.society_code) {
          const foundName = societyMap.get(u.society_code.toString().toLowerCase());
          if (foundName) societyName = foundName;
        }

        // If society is importing, force their own society
        if (req.user.role === 'society') {
          societyName = req.user.society;
        }

        const { rows: existing } = await client.query("SELECT id FROM users WHERE email = $1", [u.email]);
        
        if (existing.length > 0) {
          // Update profile
          const finalQual = getAutoQualification(u.birth_date, u.qualification);
          await client.query(
            "UPDATE users SET name = $1, surname = $2, category = $3, qualification = $4, society = $5, shooter_code = $6, birth_date = $7, phone = $8 WHERE id = $9",
            [u.name, u.surname, u.category, finalQual, societyName, u.shooter_code, u.birth_date || null, u.phone || null, existing[0].id]
          );
          results.updated++;
        } else {
          // Create new
          const finalQual = getAutoQualification(u.birth_date, u.qualification);
          const salt = bcrypt.genSaltSync(10);
          const hash = bcrypt.hashSync(u.password || u.shooter_code || 'Password123!', salt);
          await client.query(
            "INSERT INTO users (name, surname, email, password, role, category, qualification, society, shooter_code, birth_date, phone, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')",
            [u.name, u.surname, u.email, hash, u.role || 'user', u.category, finalQual, societyName, u.shooter_code, u.birth_date || null, u.phone || null]
          );
          results.created++;
        }
      } catch (err) {
        console.error('Error importing user:', u.email, err);
        results.errors++;
      }
    }
    
    await client.query('COMMIT');
    res.json(results);
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.put('/api/admin/users/:id', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  const { name, surname, email, role, password, category, qualification, society, shooter_code, avatar, birth_date, phone, status } = req.body;
  
  const finalQualification = getAutoQualification(birth_date, qualification);

  if (role === 'society' && !shooter_code) {
    return res.status(400).json({ error: 'Il Codice Società (Codice Tiratore) è obbligatorio per gli utenti società' });
  }

  try {
    const userCheck = await pool.query("SELECT role, society FROM users WHERE id = $1", [req.params.id]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    if (req.user.role === 'society') {
      if (userCheck.rows[0].role === 'admin') {
        return res.status(403).json({ error: 'Le società non possono modificare gli amministratori' });
      }
      if (userCheck.rows[0].society !== req.user.society) {
        return res.status(403).json({ error: 'Le società possono modificare solo i propri tiratori o la propria utenza' });
      }
      if (role && role !== 'user' && role !== 'society') {
        return res.status(403).json({ error: 'Le società possono gestire solo tiratori' });
      }
      if (status && status !== userCheck.rows[0].status) {
        return res.status(403).json({ error: 'Le società non possono cambiare lo stato degli utenti' });
      }
    }

    if (password) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      await pool.query(
        "UPDATE users SET name = $1, surname = $2, email = $3, role = $4, password = $5, category = $6, qualification = $7, society = $8, shooter_code = $9, avatar = $10, birth_date = $11, phone = $12, status = $13 WHERE id = $14",
        [name, surname, email, role, hash, category, finalQualification, society, shooter_code, avatar || null, birth_date || null, phone || null, status || 'active', req.params.id]
      );
    } else {
      await pool.query(
        "UPDATE users SET name = $1, surname = $2, email = $3, role = $4, category = $5, qualification = $6, society = $7, shooter_code = $8, avatar = $9, birth_date = $10, phone = $11, status = $12 WHERE id = $13",
        [name, surname, email, role, category, finalQualification, society, shooter_code, avatar || null, birth_date || null, phone || null, status || 'active', req.params.id]
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
    const search = req.query.search as string;
    const society = req.query.society as string;
    const discipline = req.query.discipline as string;
    const location = req.query.location as string;
    const year = req.query.year as string;

    let whereClauses: string[] = ["c.totalscore > 0"];
    let params: any[] = [];

    if (req.user.role === 'society') {
      whereClauses.push("u.society = $" + (params.length + 1));
      params.push(req.user.society);
    }

    if (search) {
      const searchParam = "%" + search.toLowerCase() + "%";
      whereClauses.push("(LOWER(u.name) LIKE $" + (params.length + 1) + 
                        " OR LOWER(u.surname) LIKE $" + (params.length + 1) + 
                        " OR LOWER(u.name || ' ' || u.surname) LIKE $" + (params.length + 1) + 
                        " OR LOWER(u.surname || ' ' || u.name) LIKE $" + (params.length + 1) + 
                        " OR LOWER(c.name) LIKE $" + (params.length + 1) + 
                        " OR LOWER(c.location) LIKE $" + (params.length + 1) + ")");
      params.push(searchParam);
    }

    if (society) {
      whereClauses.push("u.society = $" + (params.length + 1));
      params.push(society);
    }

    if (discipline) {
      whereClauses.push("c.discipline = $" + (params.length + 1));
      params.push(discipline);
    }

    if (location) {
      whereClauses.push("c.location = $" + (params.length + 1));
      params.push(location);
    }

    if (year) {
      whereClauses.push("EXTRACT(YEAR FROM c.date::TIMESTAMP) = $" + (params.length + 1));
      params.push(parseInt(year));
    }

    const whereString = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

    let query = `
      WITH RankedScores AS (
        SELECT 
          u.id as user_id, 
          u.name, 
          u.surname, 
          u.category, 
          u.qualification,
          u.society,
          u.shooter_code,
          c.discipline,
          c.averageperseries,
          ROW_NUMBER() OVER (
            PARTITION BY u.id, c.discipline 
            ORDER BY c.averageperseries DESC
          ) as rank,
          COUNT(*) OVER (
            PARTITION BY u.id, c.discipline
          ) as total_recent_competitions
        FROM users u
        JOIN competitions c ON u.id = c.user_id
        ${whereString}
        AND c.date >= TO_CHAR(CURRENT_DATE - INTERVAL '12 months', 'YYYY-MM-DD')
      )
      SELECT 
        user_id, 
        name, 
        surname, 
        category, 
        qualification,
        society,
        shooter_code,
        discipline,
        MAX(total_recent_competitions) as total_competitions,
        AVG(averageperseries) as avg_score
      FROM RankedScores
      WHERE rank <= 5
      GROUP BY user_id, name, surname, category, qualification, society, shooter_code, discipline
      ORDER BY surname, name, discipline
    `;

    const { rows } = await pool.query(query, params);
    const now = Date.now();
    const rowsWithStatus = rows.map(row => ({
      ...row,
      is_logged_in: activeUsers.has(row.user_id) && (now - activeUsers.get(row.user_id)!) < 5 * 60 * 1000
    }));
    res.json(rowsWithStatus);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/filter-options', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  try {
    let whereClause = "WHERE c.totalscore > 0";
    let params: any[] = [];
    if (req.user.role === 'society') {
      whereClause = "JOIN users u ON c.user_id = u.id WHERE u.society = $1 AND c.totalscore > 0";
      params.push(req.user.society);
    }

    const disciplinesQuery = `SELECT DISTINCT discipline FROM competitions c ${whereClause} ORDER BY discipline`;
    const locationsQuery = `SELECT DISTINCT location FROM competitions c ${whereClause} ORDER BY location`;
    const yearsQuery = `SELECT DISTINCT EXTRACT(YEAR FROM date::TIMESTAMP) as year FROM competitions c ${whereClause} ORDER BY year DESC`;

    const [disciplinesRes, locationsRes, yearsRes] = await Promise.all([
      pool.query(disciplinesQuery, params),
      pool.query(locationsQuery, params),
      pool.query(yearsQuery, params)
    ]);

    res.json({
      disciplines: disciplinesRes.rows.map(r => r.discipline).filter(Boolean),
      locations: locationsRes.rows.map(r => r.location).filter(Boolean),
      years: yearsRes.rows.map(r => r.year.toString()).filter(Boolean)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/all-results', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const society = req.query.society as string;
    const discipline = req.query.discipline as string;
    const location = req.query.location as string;
    const year = req.query.year as string;

    let whereClauses: string[] = ["c.totalscore > 0"];
    let params: any[] = [];

    if (req.user.role === 'society') {
      whereClauses.push("u.society = $" + (params.length + 1));
      params.push(req.user.society);
    }

    if (search) {
      const searchParam = "%" + search.toLowerCase() + "%";
      whereClauses.push("(LOWER(u.name) LIKE $" + (params.length + 1) + 
                        " OR LOWER(u.surname) LIKE $" + (params.length + 1) + 
                        " OR LOWER(u.name || ' ' || u.surname) LIKE $" + (params.length + 1) + 
                        " OR LOWER(u.surname || ' ' || u.name) LIKE $" + (params.length + 1) + 
                        " OR LOWER(c.name) LIKE $" + (params.length + 1) + 
                        " OR LOWER(c.location) LIKE $" + (params.length + 1) + ")");
      params.push(searchParam);
    }

    if (society) {
      whereClauses.push("u.society = $" + (params.length + 1));
      params.push(society);
    }

    if (discipline) {
      whereClauses.push("c.discipline = $" + (params.length + 1));
      params.push(discipline);
    }

    if (location) {
      whereClauses.push("c.location = $" + (params.length + 1));
      params.push(location);
    }

    if (year) {
      whereClauses.push("EXTRACT(YEAR FROM c.date::TIMESTAMP) = $" + (params.length + 1));
      params.push(parseInt(year));
    }

    const whereString = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

    // Get total count of distinct shooters
    const countQuery = `
      SELECT COUNT(DISTINCT u.id) 
      FROM competitions c
      JOIN users u ON c.user_id = u.id
      ${whereString}
    `;
    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0].count);

    // Get paginated results grouped by shooter
    const offset = (page - 1) * limit;
    const resultsQuery = `
      WITH recent_scores AS (
        SELECT 
          user_id,
          discipline,
          averageperseries,
          ROW_NUMBER() OVER(PARTITION BY user_id, discipline ORDER BY averageperseries DESC) as rank
        FROM competitions
        WHERE level != 'Allenamento / Pratica' AND discipline != 'Allenamento' AND totalscore > 0
          AND date::TIMESTAMP >= NOW() - INTERVAL '12 months'
      ),
      rte_stats AS (
        SELECT 
          user_id,
          MAX(rte) as rte,
          (ARRAY_AGG(count ORDER BY rte DESC))[1] as count
        FROM (
          SELECT 
            user_id,
            discipline,
            AVG(averageperseries) as rte,
            COUNT(*) as count
          FROM recent_scores
          WHERE rank <= 5
          GROUP BY user_id, discipline
        ) sub
        ${discipline ? "WHERE discipline = $" + (params.indexOf(discipline) + 1) : ""}
        GROUP BY user_id
      )
      SELECT 
        u.id as user_id,
        u.name as user_name, 
        u.surname as user_surname,
        u.society,
        u.category,
        u.qualification,
        u.shooter_code,
        u.avatar,
        COUNT(c.id) as total_competitions,
        SUM(c.totalscore) as total_score,
        SUM(c.totaltargets) as total_targets,
        COALESCE(r.rte, 0) as rte,
        COALESCE(r.count, 0) as rte_count
      FROM users u
      JOIN competitions c ON c.user_id = u.id
      LEFT JOIN rte_stats r ON r.user_id = u.id
      ${whereString}
      GROUP BY u.id, u.name, u.surname, u.society, u.category, u.qualification, u.shooter_code, u.avatar, r.rte, r.count
      ORDER BY 
        (CASE WHEN COALESCE(r.count, 0) >= 3 THEN 1 ELSE 0 END) DESC,
        rte DESC NULLS LAST, 
        (SUM(c.totalscore)::float / NULLIF(SUM(c.totaltargets), 0)) DESC NULLS LAST, 
        user_surname ASC, user_name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const { rows } = await pool.query(resultsQuery, [...params, limit, offset]);
    
    const comps = rows.map((row: any) => ({
      userId: row.user_id,
      userName: row.user_name,
      userSurname: row.user_surname,
      society: row.society,
      category: row.category,
      qualification: row.qualification,
      shooter_code: row.shooter_code,
      avatar: row.avatar,
      totalCompetitions: parseInt(row.total_competitions),
      totalScore: parseInt(row.total_score),
      totalTargets: parseInt(row.total_targets),
      rte: parseFloat(row.rte),
      rteCount: parseInt(row.rte_count)
    }));

    res.json({ results: comps, total });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/shooter-results/:userId', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  try {
    const userId = req.params.userId;
    const search = req.query.search as string;
    const society = req.query.society as string;
    const discipline = req.query.discipline as string;
    const location = req.query.location as string;
    const year = req.query.year as string;

    let whereClauses: string[] = ["c.user_id = $1", "c.totalscore > 0"];
    let params: any[] = [userId];

    if (req.user.role === 'society') {
      whereClauses.push("(u.society = $" + (params.length + 1) + " OR c.location = $" + (params.length + 1) + ")");
      params.push(req.user.society);
    }

    if (search) {
      const searchParam = "%" + search.toLowerCase() + "%";
      whereClauses.push("(LOWER(u.name) LIKE $" + (params.length + 1) + 
                        " OR LOWER(u.surname) LIKE $" + (params.length + 1) + 
                        " OR LOWER(u.name || ' ' || u.surname) LIKE $" + (params.length + 1) + 
                        " OR LOWER(u.surname || ' ' || u.name) LIKE $" + (params.length + 1) + 
                        " OR LOWER(c.name) LIKE $" + (params.length + 1) + 
                        " OR LOWER(c.location) LIKE $" + (params.length + 1) + ")");
      params.push(searchParam);
    }

    if (society) {
      whereClauses.push("u.society = $" + (params.length + 1));
      params.push(society);
    }

    if (discipline) {
      whereClauses.push("c.discipline = $" + (params.length + 1));
      params.push(discipline);
    }

    if (location) {
      whereClauses.push("c.location = $" + (params.length + 1));
      params.push(location);
    }

    if (year) {
      whereClauses.push("EXTRACT(YEAR FROM c.date::TIMESTAMP) = $" + (params.length + 1));
      params.push(parseInt(year));
    }

    const whereString = "WHERE " + whereClauses.join(" AND ");

    const resultsQuery = `
      SELECT 
        c.*, 
        u.name as user_name, 
        u.surname as user_surname,
        u.society,
        u.category,
        u.qualification,
        u.shooter_code,
        u.avatar
      FROM competitions c
      JOIN users u ON c.user_id = u.id
      ${whereString}
      ORDER BY c.date DESC
    `;
    const { rows } = await pool.query(resultsQuery, params);
    
    const comps = rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userSurname: row.user_surname,
      society: row.society,
      category: row.category,
      qualification: row.qualification,
      avatar: row.avatar,
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
      ranking_preference: row.ranking_preference
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
    const { rows } = await pool.query(`
      SELECT s.*, 
             EXISTS(SELECT 1 FROM users u WHERE u.role = 'society' AND u.society = s.name) as has_account
      FROM societies s 
      ORDER BY s.name ASC
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/societies', authenticateToken, requireAdmin, async (req, res) => {
  const { name, code, email, address, city, region, zip_code, phone, mobile, website, contact_name, logo, opening_hours, disciplines, lat, lng, google_maps_link } = req.body;
  
  if (!name || !code) {
    return res.status(400).json({ error: 'Nome e Codice Società sono obbligatori' });
  }

  try {
    const { rows } = await pool.query(
      "INSERT INTO societies (name, code, email, address, city, region, zip_code, phone, mobile, website, contact_name, logo, opening_hours, disciplines, lat, lng, google_maps_link) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id",
      [name, code, email || null, address, city, region, zip_code, phone, mobile, website, contact_name, logo || null, opening_hours || null, disciplines || null, lat || null, lng || null, google_maps_link || null]
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/societies/:id', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  const { name, code, email, address, city, region, zip_code, phone, mobile, website, contact_name, logo, opening_hours, disciplines, lat, lng, google_maps_link } = req.body;
  
  if (!name || !code) {
    return res.status(400).json({ error: 'Nome e Codice Società sono obbligatori' });
  }

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
      "UPDATE societies SET name = $1, code = $2, email = $3, address = $4, city = $5, region = $6, zip_code = $7, phone = $8, mobile = $9, website = $10, contact_name = $11, logo = $12, opening_hours = $13, disciplines = $14, lat = $15, lng = $16, google_maps_link = $17 WHERE id = $18",
      [name, code, email || null, address, city, region, zip_code, phone, mobile, website, contact_name, logo || null, opening_hours || null, disciplines || null, lat || null, lng || null, google_maps_link || null, req.params.id]
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
        "SELECT id FROM users WHERE role != 'society' AND LOWER(TRIM(society)) = LOWER(TRIM($1))", 
        [societyName]
      );
      const userIds = users.map(u => u.id);
      if (userIds.length > 0) {
        sendPushNotification(userIds, "Nuova Sfida!", `${name} - ${prize}`, `/challenges`, 'society');
      }
    }

    // Admin compact notification
    const from = req.user.role === 'admin' ? 'Admin' : req.user.society;
    await sendAdminCompactNotification('sfida', name, 'inserita', 'Gara di Società', societyName, from);

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

    // Admin compact notification
    const { rows: socRows } = await pool.query("SELECT name FROM societies WHERE id = $1", [societyId]);
    const societyName = socRows[0]?.name;
    const from = req.user.role === 'admin' ? 'Admin' : req.user.society;
    await sendAdminCompactNotification('sfida', name, 'aggiornata', 'Gara di Società', societyName, from);

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/challenges/:id', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  try {
    const { rows: challengeRows } = await pool.query("SELECT name, society_id FROM challenges WHERE id = $1", [req.params.id]);
    if (challengeRows.length === 0) return res.status(404).json({ error: 'Sfida non trovata' });
    const challenge = challengeRows[0];

    if (req.user.role === 'society') {
      const { rows: socRows } = await pool.query("SELECT name FROM societies WHERE id = $1", [challenge.society_id]);
      if (socRows.length === 0 || socRows[0].name !== req.user.society) {
        return res.status(403).json({ error: 'Accesso negato' });
      }
    }

    await pool.query("DELETE FROM challenges WHERE id = $1", [req.params.id]);

    // Admin compact notification
    const { rows: socRows } = await pool.query("SELECT name FROM societies WHERE id = $1", [challenge.society_id]);
    const societyName = socRows[0]?.name;
    const from = req.user.role === 'admin' ? 'Admin' : req.user.society;
    await sendAdminCompactNotification('sfida', challenge.name, 'eliminata', 'Gara di Società', societyName, from);

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
      AND (u.society = $2 OR (u.role = 'admin' AND u.society = $2))
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
          perfectSeriesCount: 0,
          positions: []
        };
      }
      
      const stats = shooterStats[c.user_id];
      stats.scores.push(c.totalscore);
      if (c.position) stats.positions.push(c.position);
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
      } catch (_) {}
    });

    const ranking = Object.values(shooterStats)
      .filter(stats => {
        if (challenge.mode === 'Numero Serie Perfette (25/25)') {
          return stats.perfectSeriesCount > 0;
        }
        return true;
      })
      .map(stats => {
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
        case 'Ranking a Punti (Stile F1)':
          // Calculate points based on positions in competitions
          // Points: 1:25, 2:18, 3:15, 4:12, 5:10, 6:8, 7:6, 8:4, 9:2, 10:1
          const pointMap: Record<number, number> = { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 };
          value = stats.positions.reduce((acc: number, pos: number) => acc + (pointMap[pos] || 0), 0);
          break;
        case 'Sfida Handicap (Bonus Categoria)':
          // Best score + bonus based on category
          // Ecc: +0, 1: +1, 2: +2, 3: +3
          const bonusMap: Record<string, number> = { 'Eccellenza': 0, 'Prima': 1, 'Seconda': 2, 'Terza': 3 };
          const bonus = bonusMap[stats.category] || 0;
          value = stats.bestScore + bonus;
          break;
        case 'Somma Migliori 3':
          const sortedSum3 = [...stats.scores].sort((a, b) => b - a);
          value = sortedSum3.slice(0, 3).reduce((a, b) => a + b, 0);
          break;
        case 'Somma Migliori 5':
          const sortedSum5 = [...stats.scores].sort((a, b) => b - a);
          value = sortedSum5.slice(0, 5).reduce((a, b) => a + b, 0);
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
               'category', u.category,
               'qualification', u.qualification,
               'rte_score', (
                 SELECT AVG(averageperseries)
                 FROM (
                   SELECT averageperseries
                   FROM competitions
                   WHERE user_id = u.id AND discipline = t.discipline AND totalscore > 0
                     AND date::TIMESTAMP >= NOW() - INTERVAL '12 months'
                   ORDER BY averageperseries DESC
                   LIMIT 5
                 ) as top_scores
               ),
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
  const { name, size, memberIds, competition_name, event_id, discipline, society: bodySociety, date, targets } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const society = req.user.role === 'society' ? req.user.society : bodySociety;
    const { rows } = await client.query(
      "INSERT INTO teams (name, size, society, competition_name, event_id, discipline, date, location, targets, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id",
      [name, size, society, competition_name, event_id, discipline, date, req.body.location, targets || 100, req.user.id]
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
  const { name, size, memberIds, competition_name, event_id, discipline, society: bodySociety, date, targets } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check authorization
    if (req.user.role === 'society') {
      const { rows } = await client.query("SELECT society FROM teams WHERE id = $1", [id]);
      const teamSociety = rows[0]?.society?.toString().trim().toLowerCase();
      const userSociety = req.user.society?.toString().trim().toLowerCase();
      if (rows.length === 0 || teamSociety !== userSociety) {
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
      "UPDATE teams SET name = $1, size = $2, competition_name = $3, event_id = $4, discipline = $5, society = $6, date = $7, location = $8, targets = $9 WHERE id = $10",
      [name, size, competition_name, event_id, discipline, society, date, req.body.location, targets || 100, teamId]
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

    // Find if there is an event matching the competition_name
    const { rows: eventRows } = await client.query(
      "SELECT id FROM events WHERE name = $1 LIMIT 1",
      [competition_name]
    );
    const eventId = eventRows.length > 0 ? eventRows[0].id : null;

    // 1. Delete competitions for removed members
    if (removedMemberIds.length > 0) {
      const delResult = await client.query("DELETE FROM competitions WHERE team_id = $1 AND user_id = ANY($2)", [teamId, removedMemberIds]);
      console.log(`Deleted ${delResult.rowCount} competitions for removed members`);
    }

    // 2. Update competitions for kept members
    if (keptMemberIds.length > 0) {
      await client.query(
        `UPDATE competitions SET name = $1, date = $2, location = $3, discipline = $4, team_name = $5, event_id = $6 
         WHERE team_id = $7 AND user_id = ANY($8)`,
        [competition_name || name, date, req.body.location || society || '', discipline, name, eventId, teamId, keptMemberIds]
      );
    }

    // 3. Create competitions for added members if team was already "sent"
    const { rows: sentCompRows } = await client.query("SELECT id FROM competitions WHERE team_id = $1 LIMIT 1", [teamId]);
    if (sentCompRows.length > 0 && addedMemberIds.length > 0) {
      for (const userId of addedMemberIds) {
        const compId = `team_comp_${Date.now()}_${userId}`;
        await client.query(
          `INSERT INTO competitions (id, user_id, name, date, location, discipline, level, totalscore, totaltargets, averageperseries, scores, team_name, team_id, chokes, event_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO UPDATE SET 
           name = EXCLUDED.name, date = EXCLUDED.date, location = EXCLUDED.location, discipline = EXCLUDED.discipline, team_name = EXCLUDED.team_name, event_id = EXCLUDED.event_id`,
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
            teamId,
            null, // chokes
            eventId
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
      const teamSociety = (team.society || '').toString().trim().toLowerCase();
      const userSociety = (req.user.society || '').toString().trim().toLowerCase();
      if (teamSociety !== userSociety) {
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

    // Find if there is an event matching the competition_name
    const { rows: eventRows } = await client.query(
      "SELECT id FROM events WHERE name = $1 LIMIT 1",
      [team.competition_name]
    );
    const eventId = eventRows.length > 0 ? eventRows[0].id : null;

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
          `UPDATE competitions SET name = $1, date = $2, location = $3, discipline = $4, team_name = $5, event_id = $6 
           WHERE id = $7`,
          [
            team.competition_name || team.name, 
            team.date || new Date().toISOString().split('T')[0], 
            team.location || team.society || '', 
            team.discipline || '', 
            team.name,
            eventId,
            existingComp[0].id
          ]
        );
      } else {
        // Create new
        const compId = `team_comp_${Date.now()}_${userId}`;
        const teamTargets = team.targets || 100;
        const numSeries = Math.ceil(teamTargets / 25);
        const initialScores = Array(numSeries).fill(0);

        await client.query(
          `INSERT INTO competitions (id, user_id, name, date, location, discipline, level, totalscore, totaltargets, averageperseries, scores, team_name, team_id, chokes, event_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO UPDATE SET 
           name = EXCLUDED.name, date = EXCLUDED.date, location = EXCLUDED.location, discipline = EXCLUDED.discipline, team_name = EXCLUDED.team_name, event_id = EXCLUDED.event_id`,
          [
            compId, 
            userId, 
            team.competition_name || team.name, 
            team.date || new Date().toISOString().split('T')[0], 
            team.location || team.society || '', 
            team.discipline || '', 
            'Nazionale', // Default level
            0, // Initial score
            teamTargets, 
            0, // Initial average
            JSON.stringify(initialScores), 
            team.name,
            teamId,
            null, // chokes
            eventId
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
    // 1. Fetch regular events with result count
    let eventQuery = `
      SELECT e.*, 
      (SELECT COUNT(*)::INTEGER FROM competitions c WHERE c.event_id = e.id) as result_count,
      (SELECT COUNT(*)::INTEGER FROM event_registrations r WHERE r.event_id = e.id) as registration_count,
      (SELECT COUNT(*)::INTEGER FROM event_registrations r WHERE r.event_id = e.id AND r.user_id = '${req.user.id}') > 0 as is_registered
      FROM events e
    `;
    let eventParams: any[] = [];

    if (req.user.role === 'admin') {
      // Admin sees all
    } else if (req.user.role === 'society') {
      // Society sees their own, public, and those they created
      eventQuery += " WHERE location = $1 OR visibility = 'Pubblica' OR created_by = $2";
      eventParams.push(req.user.society, req.user.id);
    } else {
      // User sees their society's, public, and those they created
      eventQuery += " WHERE location = $1 OR visibility = 'Pubblica' OR created_by = $2";
      eventParams.push(req.user.society || '', req.user.id);
    }

    const { rows: events } = await pool.query(eventQuery, eventParams);
    console.log('API: /api/events fetched events count:', events.length, 'for user:', req.user.email, 'role:', req.user.role);

    // 4. Combine and sort
    const allEvents = [...events].sort((a, b) => {
      return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
    });

    res.json(allEvents);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/events/:id/teams', authenticateToken, async (req: any, res) => {
  try {
    const eventId = req.params.id;
    // Get event name
    const eventRes = await pool.query('SELECT name FROM events WHERE id = $1', [eventId]);
    if (eventRes.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const eventName = eventRes.rows[0].name;

    // Fetch teams from `teams` table where competition_name matches eventName
    const teams = await pool.query(`
      SELECT t.*, 
             COALESCE(json_agg(tm.user_id) FILTER (WHERE tm.user_id IS NOT NULL), '[]') as member_ids
      FROM teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      WHERE t.competition_name = $1
      GROUP BY t.id
      ORDER BY t.created_at ASC
    `, [eventName]);
    res.json(teams.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nel recupero delle squadre' });
  }
});

app.post('/api/events/:id/teams', authenticateToken, async (req: any, res) => {
  const client = await pool.connect();
  try {
    const eventId = req.params.id;
    const { name, society, type, memberIds } = req.body; // memberIds are user IDs
    
    // Check if event exists and user has permission
    const eventCheck = await client.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (eventCheck.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Evento non trovato' });
    }
    
    const event = eventCheck.rows[0];
    if (!event.is_management_enabled && req.user.role !== 'admin') {
      client.release();
      return res.status(403).json({ error: 'La gestione squadre per questa gara non è attiva.' });
    }
    
    if (event.status === 'validated' && req.user.role !== 'admin') {
      client.release();
      return res.status(403).json({ error: 'Questa gara è stata convalidata e le squadre non possono più essere modificate.' });
    }
    
    if (req.user.role !== 'admin' && event.created_by !== req.user.id && event.location !== req.user.society) {
      client.release();
      return res.status(403).json({ error: 'Non hai i permessi per gestire le squadre di questo evento' });
    }

    await client.query('BEGIN');

    // Determine size from type (e.g., "3_shooters" -> 3)
    let size = 3;
    if (type && type.includes('6')) size = 6;

    // Create team in `teams` table
    const newTeam = await client.query(`
      INSERT INTO teams (name, size, society, competition_name, discipline, date, location, targets, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [name, size, society, event.name, event.discipline, event.start_date, event.location, event.targets, req.user.id]);

    const teamId = newTeam.rows[0].id;

    // Assign members to `team_members`
    if (memberIds && memberIds.length > 0) {
      for (const userId of memberIds) {
        await client.query(
          "INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)",
          [teamId, userId]
        );
      }

      // Update existing competitions for these users in this event to have team_id and team_name
      await client.query(`
        UPDATE competitions SET team_id = $1, team_name = $2 
        WHERE event_id = $3 AND user_id = ANY($4)
      `, [teamId, name, eventId, memberIds]);
      
      // Send push notification to team members
      await sendPushNotification(
        memberIds,
        "Nuova Squadra!",
        `Sei stato inserito nella squadra "${name}" per la gara "${event.name}".`,
        `/history`,
        'team'
      );
    }

    await client.query('COMMIT');
    res.json(newTeam.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Errore nella creazione della squadra' });
  } finally {
    client.release();
  }
});

app.put('/api/events/:id/teams/:teamId', authenticateToken, async (req: any, res) => {
  const client = await pool.connect();
  try {
    const { id: eventId, teamId } = req.params;
    const { name, society, type, memberIds } = req.body;
    
    const eventCheck = await client.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (eventCheck.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Evento non trovato' });
    }
    
    const event = eventCheck.rows[0];
    if (event.status === 'validated' && req.user.role !== 'admin') {
      client.release();
      return res.status(403).json({ error: 'Questa gara è stata convalidata e le squadre non possono più essere modificate.' });
    }
    
    if (req.user.role !== 'admin' && event.created_by !== req.user.id && event.location !== req.user.society) {
      client.release();
      return res.status(403).json({ error: 'Non hai i permessi per gestire le squadre di questo evento' });
    }

    await client.query('BEGIN');

    let size = 3;
    if (type && type.includes('6')) size = 6;

    const updatedTeam = await client.query(`
      UPDATE teams SET name = $1, society = $2, size = $3
      WHERE id = $4 AND competition_name = $5
      RETURNING *
    `, [name, society, size, teamId, event.name]);

    if (updatedTeam.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Squadra non trovata' });
    }

    // Update members
    if (memberIds) {
      // Remove all members from this team
      await client.query(`DELETE FROM team_members WHERE team_id = $1`, [teamId]);
      
      // Remove team_id from competitions for this event
      await client.query(`
        UPDATE competitions SET team_id = NULL, team_name = NULL 
        WHERE team_id = $1 AND event_id = $2
      `, [teamId, eventId]);

      if (memberIds.length > 0) {
        // Assign new members
        for (const userId of memberIds) {
          await client.query(
            "INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)",
            [teamId, userId]
          );
        }
        
        // Update competitions
        await client.query(`
          UPDATE competitions SET team_id = $1, team_name = $2 
          WHERE event_id = $3 AND user_id = ANY($4)
        `, [teamId, name, eventId, memberIds]);
        
        // Send push notification to team members
        await sendPushNotification(
          memberIds,
          "Squadra Aggiornata",
          `La squadra "${name}" per la gara "${event.name}" è stata modificata.`,
          `/history`,
          'team'
        );
      }
    }

    await client.query('COMMIT');
    res.json(updatedTeam.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento della squadra' });
  } finally {
    client.release();
  }
});

app.delete('/api/events/:id/teams/:teamId', authenticateToken, async (req: any, res) => {
  const client = await pool.connect();
  try {
    const { id: eventId, teamId } = req.params;
    
    const eventCheck = await client.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (eventCheck.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Evento non trovato' });
    }
    
    const event = eventCheck.rows[0];
    if (event.status === 'validated' && req.user.role !== 'admin') {
      client.release();
      return res.status(403).json({ error: 'Questa gara è stata convalidata e le squadre non possono più essere modificate.' });
    }
    
    if (req.user.role !== 'admin' && event.created_by !== req.user.id && event.location !== req.user.society) {
      client.release();
      return res.status(403).json({ error: 'Non hai i permessi per gestire le squadre di questo evento' });
    }

    await client.query('BEGIN');

    // Remove team_id from competitions
    await client.query(`
      UPDATE competitions SET team_id = NULL, team_name = NULL 
      WHERE team_id = $1 AND event_id = $2
    `, [teamId, eventId]);

    // Delete team (cascade will handle team_members)
    const deleted = await client.query(`DELETE FROM teams WHERE id = $1 AND competition_name = $2 RETURNING *`, [teamId, event.name]);

    if (deleted.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Squadra non trovata' });
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Errore nell\'eliminazione della squadra' });
  } finally {
    client.release();
  }
});

app.get('/api/events/:id/results', authenticateToken, async (req: any, res) => {
  try {
    const eventId = req.params.id;
    // Include all registered shooters, even if they don't have a result yet
    const results = await pool.query(`
      SELECT 
        c.*, 
        u.id as user_id,
        u.name as user_name, 
        u.surname as user_surname, 
        u.category, 
        u.qualification, 
        u.society, 
        u.shooter_code,
        r.id as registration_id,
        r.registration_day,
        r.registration_type,
        r.shotgun_brand,
        r.shotgun_model,
        r.cartridge_brand,
        r.cartridge_model,
        r.shooting_session,
        r.notes as registration_notes,
        r.phone as registration_phone
      FROM users u
      LEFT JOIN event_registrations r ON r.user_id = u.id AND r.event_id = $1
      LEFT JOIN competitions c ON c.user_id = u.id AND c.event_id = $1
      WHERE r.id IS NOT NULL OR c.id IS NOT NULL
      ORDER BY c.totalscore DESC NULLS LAST, c.shoot_off DESC NULLS LAST
    `, [eventId]);
    
    // Parse JSON fields
    const parsedResults = results.rows.map(r => ({
      ...r,
      scores: r.scores ? (typeof r.scores === 'string' ? JSON.parse(r.scores) : r.scores) : [],
      detailedScores: r.detailedscores ? (typeof r.detailedscores === 'string' ? JSON.parse(r.detailedscores) : r.detailedscores) : null,
      weather: r.weather ? (typeof r.weather === 'string' ? JSON.parse(r.weather) : r.weather) : null,
      seriesImages: r.seriesimages ? (typeof r.seriesimages === 'string' ? JSON.parse(r.seriesimages) : r.seriesimages) : null,
      usedCartridges: r.usedcartridges ? (typeof r.usedcartridges === 'string' ? JSON.parse(r.usedcartridges) : r.usedcartridges) : null,
      chokes: r.chokes ? (typeof r.chokes === 'string' ? JSON.parse(r.chokes) : r.chokes) : null,
      is_registered_only: !r.id // if c.id is null, it's just a registration
    }));

    res.json(parsedResults);
  } catch (err: any) {
    console.error('Error fetching event results:', err);
    res.status(500).json({ error: err.message });
  }
});

// Register for an event
app.post('/api/events/:id/register', authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  const {
    user_id,
    registration_day,
    registration_type,
    shotgun_brand,
    shotgun_model,
    cartridge_brand,
    cartridge_model,
    shooting_session,
    notes,
    phone
  } = req.body;

  try {
    // Check if event exists and management is enabled
    const eventResult = await pool.query('SELECT is_management_enabled FROM events WHERE id = $1', [id]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }
    if (!eventResult.rows[0].is_management_enabled && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Le iscrizioni per questa gara non sono ancora attive.' });
    }

    // Determine the target user ID
    let targetUserId = req.user.id;
    if (user_id && (req.user.role === 'admin' || req.user.role === 'society')) {
      targetUserId = user_id;
    }

    // Check if user is already registered
    const existingReg = await pool.query(
      'SELECT id FROM event_registrations WHERE event_id = $1 AND user_id = $2',
      [id, targetUserId]
    );
    
    if (existingReg.rows.length > 0) {
      return res.status(400).json({ error: 'Il tiratore è già iscritto a questa gara.' });
    }

    const result = await pool.query(
      `INSERT INTO event_registrations (
        event_id, user_id, registration_day, registration_type,
        shotgun_brand, shotgun_model, cartridge_brand, cartridge_model,
        shooting_session, notes, phone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [id, targetUserId, registration_day, registration_type, shotgun_brand, shotgun_model, cartridge_brand, cartridge_model, shooting_session, notes, phone]
    );

    // Also update user phone if provided and not already set
    if (phone) {
      await pool.query('UPDATE users SET phone = $1 WHERE id = $2 AND (phone IS NULL OR phone = \'\')', [phone, targetUserId]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error registering for event:', {
      eventId: id,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ 
      error: 'Errore durante la registrazione. Riprova più tardi.',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get registrations for an event
app.get('/api/events/:id/registrations', authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT r.*, u.name as first_name, u.surname as last_name, u.shooter_code, u.society, u.category, u.qualification, u.email
       FROM event_registrations r
       JOIN users u ON r.user_id = u.id
       WHERE r.event_id = $1`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Update a registration
app.put('/api/events/:eventId/registrations/:registrationId', authenticateToken, async (req: any, res) => {
  const { eventId, registrationId } = req.params;
  const {
    registration_day,
    registration_type,
    shotgun_brand,
    shotgun_model,
    cartridge_brand,
    cartridge_model,
    shooting_session,
    notes,
    phone
  } = req.body;

  try {
    // Check authorization: only admin, society of the event, or the user themselves
    const regCheck = await pool.query('SELECT user_id FROM event_registrations WHERE id = $1 AND event_id = $2', [registrationId, eventId]);
    if (regCheck.rows.length === 0) return res.status(404).json({ error: 'Registrazione non trovata' });

    const eventCheck = await pool.query('SELECT location FROM events WHERE id = $1', [eventId]);
    const isOwner = regCheck.rows[0].user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isSociety = req.user.role === 'society' && req.user.society === eventCheck.rows[0]?.location;

    if (!isOwner && !isAdmin && !isSociety) {
      return res.status(403).json({ error: 'Non hai i permessi per modificare questa iscrizione' });
    }

    const result = await pool.query(
      `UPDATE event_registrations SET 
        registration_day = $1, registration_type = $2, shotgun_brand = $3, 
        shotgun_model = $4, cartridge_brand = $5, cartridge_model = $6, 
        shooting_session = $7, notes = $8, phone = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10 AND event_id = $11
      RETURNING *`,
      [registration_day, registration_type, shotgun_brand, shotgun_model, cartridge_brand, cartridge_model, shooting_session, notes, phone, registrationId, eventId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating registration:', error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento dell\'iscrizione' });
  }
});

// Delete a registration
app.delete('/api/events/:eventId/registrations/:registrationId', authenticateToken, async (req: any, res) => {
  const { eventId, registrationId } = req.params;

  try {
    // Check authorization
    const regCheck = await pool.query('SELECT user_id FROM event_registrations WHERE id = $1 AND event_id = $2', [registrationId, eventId]);
    if (regCheck.rows.length === 0) return res.status(404).json({ error: 'Registrazione non trovata' });

    const eventCheck = await pool.query('SELECT location FROM events WHERE id = $1', [eventId]);
    const isOwner = regCheck.rows[0].user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isSociety = req.user.role === 'society' && req.user.society === eventCheck.rows[0]?.location;

    if (!isOwner && !isAdmin && !isSociety) {
      return res.status(403).json({ error: 'Non hai i permessi per eliminare questa iscrizione' });
    }

    // Check if user is in any squad
    const squadCheck = await pool.query(
      'SELECT squad_id FROM event_squad_members WHERE registration_id = $1',
      [registrationId]
    );
    if (squadCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Impossibile eliminare l\'iscrizione: il tiratore è già assegnato a una batteria. Rimuovilo prima dalla batteria.' });
    }

    await pool.query('DELETE FROM event_registrations WHERE id = $1 AND event_id = $2', [registrationId, eventId]);
    res.json({ message: 'Iscrizione eliminata con successo' });
  } catch (error) {
    console.error('Error deleting registration:', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione dell\'iscrizione' });
  }
});

// Generate squads for an event
app.post('/api/events/:id/squads/generate', authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  const { fieldsCount, startTime } = req.body;

  try {
    // Check authorization
    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    if (eventResult.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const event = eventResult.rows[0];

    if (!event.is_management_enabled && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'La gestione batterie per questa gara non è attiva.' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'society') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get all registrations
    const regResult = await pool.query('SELECT id FROM event_registrations WHERE event_id = $1', [id]);
    let registrations = regResult.rows.map(r => r.id);

    // Shuffle registrations
    for (let i = registrations.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [registrations[i], registrations[j]] = [registrations[j], registrations[i]];
    }

    // Clear existing squads
    await pool.query('DELETE FROM event_squads WHERE event_id = $1', [id]);

    let currentRegIndex = 0;
    let squadNumber = 1;

    const startHour = parseInt(startTime.split(':')[0]);
    const startMinute = parseInt(startTime.split(':')[1]);

    while (currentRegIndex < registrations.length) {
      const fieldNumber = ((squadNumber - 1) % fieldsCount) + 1;
      const roundNumber = Math.floor((squadNumber - 1) / fieldsCount);
      
      const totalMinutes = startHour * 60 + startMinute + roundNumber * 20;
      const squadHour = Math.floor(totalMinutes / 60);
      const squadMinute = totalMinutes % 60;
      const squadStartTime = `${squadHour.toString().padStart(2, '0')}:${squadMinute.toString().padStart(2, '0')}`;

      const squadInsert = await pool.query(
        'INSERT INTO event_squads (event_id, squad_number, field_number, start_time) VALUES ($1, $2, $3, $4) RETURNING id',
        [id, squadNumber, fieldNumber, squadStartTime]
      );
      const squadId = squadInsert.rows[0].id;

      for (let pos = 1; pos <= 6 && currentRegIndex < registrations.length; pos++) {
        await pool.query(
          'INSERT INTO event_squad_members (squad_id, registration_id, position) VALUES ($1, $2, $3)',
          [squadId, registrations[currentRegIndex], pos]
        );
        currentRegIndex++;
      }
      squadNumber++;
    }

    res.json({ message: 'Squads generated successfully' });
  } catch (error) {
    console.error('Error generating squads:', error);
    res.status(500).json({ error: 'Failed to generate squads' });
  }
});

// Get squads for an event
app.get('/api/events/:id/squads', authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  try {
    const squadsResult = await pool.query(
      'SELECT * FROM event_squads WHERE event_id = $1 ORDER BY squad_number',
      [id]
    );
    const squads = squadsResult.rows;

    for (const squad of squads) {
      const membersResult = await pool.query(
        `SELECT m.position, r.id as registration_id, u.name as first_name, u.surname as last_name, u.shooter_code, u.society, u.category, u.qualification
         FROM event_squad_members m
         JOIN event_registrations r ON m.registration_id = r.id
         JOIN users u ON r.user_id = u.id
         WHERE m.squad_id = $1
         ORDER BY m.position`,
        [squad.id]
      );
      squad.members = membersResult.rows;
    }

    res.json(squads);
  } catch (error) {
    console.error('Error fetching squads:', error);
    res.status(500).json({ error: 'Failed to fetch squads' });
  }
});

app.put('/api/events/:id/squads/:squadId/lock', authenticateToken, async (req: any, res) => {
  try {
    const { id, squadId } = req.params;
    const { is_locked } = req.body;

    // Check if user is admin or society hosting the event
    const { rows: eventRows } = await pool.query("SELECT * FROM events WHERE id = $1", [id]);
    if (eventRows.length === 0) return res.status(404).json({ error: 'Gara non trovata' });
    const event = eventRows[0];

    if (req.user.role !== 'admin') {
      if (req.user.role !== 'society' || (event.location !== req.user.society && event.created_by !== req.user.id)) {
        return res.status(403).json({ error: 'Non autorizzato' });
      }
    }

    await pool.query("UPDATE event_squads SET is_locked = $1 WHERE id = $2 AND event_id = $3", [is_locked, squadId, id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update squad members
app.put('/api/events/:id/squads/update-members', authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  const { squads } = req.body;

  try {
    // Check if management is enabled
    const eventResult = await pool.query('SELECT is_management_enabled FROM events WHERE id = $1', [id]);
    if (eventResult.rows.length === 0) return res.status(404).json({ error: 'Evento non trovato' });
    if (!eventResult.rows[0].is_management_enabled && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'La gestione batterie per questa gara non è attiva.' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'society') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.query('BEGIN');

    await pool.query('DELETE FROM event_squads WHERE event_id = $1', [id]);

    for (const squad of squads) {
      const squadInsert = await pool.query(
        'INSERT INTO event_squads (event_id, squad_number, field_number, start_time) VALUES ($1, $2, $3, $4) RETURNING id',
        [id, squad.squad_number, squad.field_number, squad.start_time]
      );
      const newSquadId = squadInsert.rows[0].id;

      for (let i = 0; i < squad.members.length; i++) {
        const member = squad.members[i];
        await pool.query(
          'INSERT INTO event_squad_members (squad_id, registration_id, position) VALUES ($1, $2, $3)',
          [newSquadId, member.registration_id, i + 1]
        );
      }
    }

    await pool.query('COMMIT');
    res.json({ message: 'Squads updated successfully' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating squads:', error);
    res.status(500).json({ error: 'Failed to update squads' });
  }
});

app.post('/api/events', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'society') {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const { id, name, type, visibility, discipline, location, targets, start_date, end_date, cost, notes, poster_url, registration_link, prize_settings, ranking_logic, ranking_preference_override, has_society_ranking, has_team_ranking } = req.body;
  
  try {
    await pool.query(
      `INSERT INTO events (id, name, type, visibility, discipline, location, targets, start_date, end_date, cost, notes, poster_url, registration_link, created_by, prize_settings, ranking_logic, ranking_preference_override, has_society_ranking, has_team_ranking)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       ON CONFLICT (id) DO UPDATE SET 
       name = EXCLUDED.name, type = EXCLUDED.type, visibility = EXCLUDED.visibility, 
       discipline = EXCLUDED.discipline, location = EXCLUDED.location, targets = EXCLUDED.targets, 
       start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, cost = EXCLUDED.cost, 
       notes = EXCLUDED.notes, poster_url = EXCLUDED.poster_url, registration_link = EXCLUDED.registration_link,
       prize_settings = EXCLUDED.prize_settings, ranking_logic = EXCLUDED.ranking_logic,
       ranking_preference_override = EXCLUDED.ranking_preference_override,
       has_society_ranking = EXCLUDED.has_society_ranking,
       has_team_ranking = EXCLUDED.has_team_ranking`,
      [id, name, type, visibility, discipline, location, targets, start_date, end_date, cost, notes, poster_url, registration_link, req.user.id, prize_settings, ranking_logic || 'individual', ranking_preference_override, has_society_ranking || false, has_team_ranking || false]
    );

    // Send push notification
    let userIds: number[] = [];
    if (visibility === 'Pubblica') {
      const { rows: users } = await pool.query("SELECT id FROM users WHERE role != 'society'");
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
          "SELECT id FROM users WHERE role != 'society' AND LOWER(TRIM(society)) = LOWER(TRIM($1))", 
          [targetSociety]
        );
        userIds = users.map(u => u.id);
      }
    }
    
    if (userIds.length > 0) {
      sendPushNotification(userIds, "Nuovo Evento!", `${name} presso ${location}`, `/events?id=${id}`, visibility === 'Pubblica' ? 'all' : 'society');
    }

    // Admin compact notification
    const from = req.user.role === 'admin' ? 'Admin' : req.user.society;
    const targetSociety = visibility === 'Pubblica' ? null : (req.user.society || location);
    await sendAdminCompactNotification('gara', name, 'inserita', visibility, targetSociety, from);

    res.status(201).json({ message: 'Evento creato' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'society') {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const { name, type, visibility, discipline, location, targets, start_date, end_date, cost, notes, poster_url, registration_link, prize_settings, ranking_logic, ranking_preference_override, has_society_ranking, has_team_ranking } = req.body;
  
  try {
    // Check if event is validated
    const { rows: currentEvent } = await pool.query("SELECT status, location, created_by FROM events WHERE id = $1", [req.params.id]);
    if (currentEvent.length === 0) return res.status(404).json({ error: 'Evento non trovato' });
    
    if (currentEvent[0].status === 'validated' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Questa gara è stata convalidata e non può più essere modificata.' });
    }

    // Check ownership if not admin
    if (req.user.role === 'society') {
      if (currentEvent[0].location !== req.user.society && currentEvent[0].created_by !== req.user.id) {
        return res.status(403).json({ error: 'Non autorizzato a modificare questo evento' });
      }
    }

    // Use COALESCE to keep existing values if not provided in body (for partial updates like prize_settings)
    await pool.query(
      `UPDATE events SET 
        name = COALESCE($1, name), 
        type = COALESCE($2, type), 
        visibility = COALESCE($3, visibility), 
        discipline = COALESCE($4, discipline), 
        location = COALESCE($5, location), 
        targets = COALESCE($6, targets), 
        start_date = COALESCE($7, start_date), 
        end_date = COALESCE($8, end_date), 
        cost = COALESCE($9, cost), 
        notes = COALESCE($10, notes), 
        poster_url = COALESCE($11, poster_url), 
        registration_link = COALESCE($12, registration_link),
        prize_settings = COALESCE($13, prize_settings),
        ranking_logic = COALESCE($14, ranking_logic),
        ranking_preference_override = COALESCE($15, ranking_preference_override),
        has_society_ranking = COALESCE($16, has_society_ranking),
        has_team_ranking = COALESCE($17, has_team_ranking)
       WHERE id = $18`,
      [name, type, visibility, discipline, location, targets, start_date, end_date, cost, notes, poster_url, registration_link, prize_settings, ranking_logic, ranking_preference_override, has_society_ranking, has_team_ranking, req.params.id]
    );

    // Send push notification for update
    let userIds: number[] = [];
    if (visibility === 'Pubblica') {
      const { rows: users } = await pool.query("SELECT id FROM users WHERE role != 'society'");
      userIds = users.map(u => u.id);
    } else {
      let targetSociety = req.user.society;
      if (!targetSociety && req.user.role === 'admin') {
        targetSociety = location;
      }
      if (targetSociety) {
        const { rows: users } = await pool.query(
          "SELECT id FROM users WHERE role != 'society' AND LOWER(TRIM(society)) = LOWER(TRIM($1))", 
          [targetSociety]
        );
        userIds = users.map(u => u.id);
      }
    }
    if (userIds.length > 0) {
      sendPushNotification(userIds, "Evento Aggiornato", `L'evento "${name}" ha subito delle modifiche.`, `/events?id=${req.params.id}`, visibility === 'Pubblica' ? 'all' : 'society');
    }

    // Admin compact notification
    const from = req.user.role === 'admin' ? 'Admin' : req.user.society;
    const targetSociety = visibility === 'Pubblica' ? null : (req.user.society || location);
    await sendAdminCompactNotification('gara', name, 'aggiornata', visibility, targetSociety, from);

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
    const { rows: eventRows } = await pool.query("SELECT name, visibility, location, created_by, status FROM events WHERE id = $1", [req.params.id]);
    if (eventRows.length === 0) return res.status(404).json({ error: 'Evento non trovato' });
    const event = eventRows[0];

    // Check if event is validated
    if (event.status === 'validated' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Questa gara è stata convalidata e non può più essere eliminata.' });
    }

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
      const { rows: users } = await pool.query("SELECT id FROM users WHERE role != 'society'");
      userIds = users.map(u => u.id);
    } else {
      let targetSociety = event.location;
      if (targetSociety) {
        const { rows: users } = await pool.query(
          "SELECT id FROM users WHERE role != 'society' AND LOWER(TRIM(society)) = LOWER(TRIM($1))", 
          [targetSociety]
        );
        userIds = users.map(u => u.id);
      }
    }
    if (userIds.length > 0) {
      sendPushNotification(userIds, "Evento Annullato", `L'evento "${event.name}" è stato annullato.`, `/events`, event.visibility === 'Pubblica' ? 'all' : 'society');
    }

    // Admin compact notification
    const from = req.user.role === 'admin' ? 'Admin' : req.user.society;
    const targetSociety = event.visibility === 'Pubblica' ? null : event.location;
    await sendAdminCompactNotification('gara', event.name, 'eliminata', event.visibility, targetSociety, from);

    res.json({ message: 'Evento eliminato' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events/:id/validate', authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  const { role, id: userId } = req.user;

  try {
    const { rows: events } = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    if (events.length === 0) return res.status(404).json({ error: 'Gara non trovata' });

    const event = events[0];
    if (!event.is_management_enabled && role !== 'admin') {
      return res.status(403).json({ error: 'La gestione classifiche per questa gara non è attiva.' });
    }
    if (role !== 'admin') {
      if (role === 'society' && event.location === req.user.society) {
        // Society can validate events at their location
      } else if (event.created_by !== userId) {
        return res.status(403).json({ error: 'Non hai i permessi per convalidare questa gara' });
      }
    }

    await pool.query('UPDATE events SET status = $1 WHERE id = $2', ['validated', id]);

    // Sync positions for all participants
    const { rows: comps } = await pool.query('SELECT * FROM competitions WHERE event_id = $1', [id]);
    
    if (comps.length > 0) {
      const sortResults = (a: any, b: any) => {
        if (b.totalscore !== a.totalscore) return (b.totalscore || 0) - (a.totalscore || 0);
        const aShootOff = a.shoot_off ?? -1;
        const bShootOff = b.shoot_off ?? -1;
        if (bShootOff !== aShootOff) return bShootOff - aShootOff;
        
        let aDetailed = a.detailedscores;
        let bDetailed = b.detailedscores;
        
        try {
          if (typeof aDetailed === 'string') aDetailed = JSON.parse(aDetailed);
          if (typeof bDetailed === 'string') bDetailed = JSON.parse(bDetailed);
        } catch (e) {
          // Ignore parse errors
        }
        
        if (Array.isArray(aDetailed) && Array.isArray(bDetailed)) {
          const maxSeries = Math.max(aDetailed.length, bDetailed.length);
          for (let sIdx = maxSeries - 1; sIdx >= 0; sIdx--) {
            const aSeries = aDetailed[sIdx] || [];
            const bSeries = bDetailed[sIdx] || [];
            // Assuming 25 targets per series
            for (let tIdx = 24; tIdx >= 0; tIdx--) {
              const aHit = aSeries[tIdx] === true;
              const bHit = bSeries[tIdx] === true;
              if (aHit !== bHit) return aHit ? -1 : 1;
            }
          }
        }
        return 0;
      };

      // Group by category and qualification
      const byCategory: Record<string, any[]> = {};
      const byQualification: Record<string, any[]> = {};
      const absolute = [...comps].sort(sortResults);

      comps.forEach(c => {
        const cat = c.category_at_time || '';
        const qual = c.qualification_at_time || '';
        if (cat) {
          if (!byCategory[cat]) byCategory[cat] = [];
          byCategory[cat].push(c);
        }
        if (qual) {
          if (!byQualification[qual]) byQualification[qual] = [];
          byQualification[qual].push(c);
        }
      });

      // Sort each group
      Object.keys(byCategory).forEach(cat => byCategory[cat].sort(sortResults));
      Object.keys(byQualification).forEach(qual => byQualification[qual].sort(sortResults));

      // Update positions
      for (const c of comps) {
        const effectivePref = event.ranking_preference_override || c.ranking_preference_override || c.ranking_preference || 'categoria';
        let position = 0;

        if (effectivePref === 'categoria' && c.category_at_time && byCategory[c.category_at_time]) {
          position = byCategory[c.category_at_time].findIndex(r => r.id === c.id) + 1;
        } else if (effectivePref === 'qualifica' && c.qualification_at_time && byQualification[c.qualification_at_time]) {
          position = byQualification[c.qualification_at_time].findIndex(r => r.id === c.id) + 1;
        } else {
          position = absolute.findIndex(r => r.id === c.id) + 1;
        }

        if (position > 0) {
          await pool.query('UPDATE competitions SET position = $1 WHERE id = $2', [position, c.id]);
        }
      }
    }

    res.json({ message: 'Gara convalidata con successo e posizioni sincronizzate' });
  } catch (error) {
    console.error('Error validating event:', error);
    res.status(500).json({ error: 'Errore durante la convalida della gara' });
  }
});

app.post('/api/events/:id/reopen', authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  const { role } = req.user;

  if (role !== 'admin') {
    return res.status(403).json({ error: 'Solo l\'amministratore può riaprire una gara' });
  }

  try {
    await pool.query('UPDATE events SET status = $1 WHERE id = $2', ['open', id]);

    res.json({ message: 'Gara riaperta con successo' });
  } catch (error) {
    console.error('Error reopening event:', error);
    res.status(500).json({ error: 'Errore durante la riapertura della gara' });
  }
});

// Helper for admin compact notifications
const sendAdminCompactNotification = async (entityType: 'gara' | 'sfida', name: string, action: 'inserita' | 'aggiornata' | 'eliminata', visibility: string, targetSociety: string | null, from: string) => {
  try {
    const { rows: adminRows } = await pool.query("SELECT id FROM users WHERE email = 'snecaj@gmail.com'");
    const adminId = adminRows[0]?.id;
    if (!adminId) return;

    const { rows: settingsRows } = await pool.query("SELECT admin_notifications_enabled FROM notification_settings WHERE user_id = $1", [adminId]);
    if (settingsRows.length > 0 && !settingsRows[0].admin_notifications_enabled) return;

    const targetDesc = visibility === 'Pubblica' ? 'tutti i tiratori' : `i tiratori della "${targetSociety || 'Società'}"`;
    const body = `La ${entityType} "${name}" è stata ${action} ed inviata a ${targetDesc} da ${from}.`;
    
    await sendPushNotification([adminId], "Notifica Admin", body, entityType === 'gara' ? '/events' : '/challenges');
  } catch (err) {
    console.error("Error in sendAdminCompactNotification:", err);
  }
};
app.get('/api/competitions', authenticateToken, async (req: any, res) => {
  try {
    let query = "SELECT * FROM competitions WHERE user_id = $1 AND hidden_from_user = FALSE";
    let params = [req.user.id];

    if (req.user.role === 'society') {
      // If society, get all competitions of users in the same society
      query = `
        SELECT c.*, u.name as "userName", u.surname as "userSurname"
        FROM competitions c
        JOIN users u ON c.user_id = u.id
        WHERE u.society = $1 AND c.totalscore > 0
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
      chokes: row.chokes ? JSON.parse(row.chokes) : undefined,
      userId: row.user_id,
      teamName: row.team_name,
      userName: row.userName,
      userSurname: row.userSurname,
      ranking_preference: row.ranking_preference
    }));
    res.json(comps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/competitions', authenticateToken, async (req: any, res) => {
  const c = req.body;
  let targetUserId = req.user.id;
  
  if (c.eventId) {
    // If it's an event result, ONLY Admin or the hosting Society can insert it
    if (req.user.role === 'admin') {
      if (c.userId) targetUserId = c.userId;
    } else if (req.user.role === 'society') {
      if (!c.userId) {
        return res.status(400).json({ error: 'Devi specificare un tiratore.' });
      }
      const eventCheck = await pool.query('SELECT location, created_by, status, is_management_enabled FROM events WHERE id = $1', [c.eventId]);
      if (eventCheck.rows.length > 0) {
        const ev = eventCheck.rows[0];
        if (!ev.is_management_enabled && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'La gestione classifiche per questa gara non è attiva.' });
        }
        if (ev.status === 'validated') {
          return res.status(403).json({ error: 'Questa gara è stata convalidata e non può più essere modificata.' });
        }
        if (ev.location === req.user.society || ev.created_by === req.user.id) {
          targetUserId = c.userId;
        } else {
          return res.status(403).json({ error: 'I risultati di una gara possono essere inseriti solo dalla società ospitante o da un Admin.' });
        }
      } else {
        return res.status(404).json({ error: 'Evento non trovato.' });
      }
    } else {
      // Users cannot insert event results
      return res.status(403).json({ error: 'I risultati di una gara possono essere inseriti solo dalla società ospitante o da un Admin.' });
    }
  } else {
    // Non-event competition (personal or society-added)
    if (req.user.role === 'admin' && c.userId) {
      targetUserId = c.userId;
    } else if (req.user.role === 'society') {
      if (!c.userId) {
        return res.status(400).json({ error: 'Devi specificare un tiratore.' });
      }
      const userCheck = await pool.query('SELECT society FROM users WHERE id = $1', [c.userId]);
      const isTheirShooter = userCheck.rows.length > 0 && userCheck.rows[0].society === req.user.society;
      const isTheirLocation = c.location === req.user.society;
      
      if (isTheirShooter || isTheirLocation) {
        targetUserId = c.userId;
      } else {
        return res.status(403).json({ error: 'Puoi inserire gare solo per i tuoi tiratori o per gare svolte presso la tua società.' });
      }
    }
  }

  try {
    // Fetch user details for snapshot
    const userDetails = await pool.query('SELECT category, qualification, society FROM users WHERE id = $1', [targetUserId]);
    const cat = userDetails.rows[0]?.category || null;
    const qual = userDetails.rows[0]?.qualification || null;
    const soc = userDetails.rows[0]?.society || null;

    let finalId = c.id;
    let teamId = null;
    let teamName = null;

    if (c.eventId) {
      // Check if user already has a competition for this event or matching date/location/discipline
      const existingComp = await pool.query(`
        SELECT id FROM competitions 
        WHERE user_id = $1 
          AND date = $2 
          AND location = $3 
          AND discipline = $4
          AND (event_id IS NULL OR event_id = $5)
        LIMIT 1
      `, [targetUserId, c.date, c.location, c.discipline, c.eventId]);
      
      if (existingComp.rows.length > 0) {
        finalId = existingComp.rows[0].id;
      }

      // Check if user is in a team for this event
      const teamCheck = await pool.query(`
        SELECT t.id, t.name 
        FROM teams t
        JOIN team_members tm ON t.id = tm.team_id
        WHERE tm.user_id = $1 AND t.competition_name = $2
        LIMIT 1
      `, [targetUserId, c.name]);

      if (teamCheck.rows.length > 0) {
        teamId = teamCheck.rows[0].id;
        teamName = teamCheck.rows[0].name;
      }
    }

    await pool.query(
      `INSERT INTO competitions (id, user_id, name, date, enddate, location, discipline, level, totalscore, totaltargets, averageperseries, position, cost, win, notes, weather, scores, detailedscores, seriesimages, usedcartridges, chokes, event_id, shoot_off, category_at_time, qualification_at_time, society_at_time, ranking_preference, ranking_preference_override, hidden_from_user, team_id, team_name) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, FALSE, $29, $30)
       ON CONFLICT (id) DO UPDATE SET 
       user_id = EXCLUDED.user_id, name = EXCLUDED.name, date = EXCLUDED.date, enddate = EXCLUDED.enddate, location = EXCLUDED.location, 
       discipline = EXCLUDED.discipline, level = EXCLUDED.level, totalscore = EXCLUDED.totalscore, totaltargets = EXCLUDED.totaltargets, 
       averageperseries = EXCLUDED.averageperseries, position = EXCLUDED.position, cost = EXCLUDED.cost, win = EXCLUDED.win, 
       notes = EXCLUDED.notes, weather = EXCLUDED.weather, scores = EXCLUDED.scores, detailedscores = EXCLUDED.detailedscores, 
       seriesimages = EXCLUDED.seriesimages, usedcartridges = EXCLUDED.usedcartridges, chokes = EXCLUDED.chokes,
       event_id = EXCLUDED.event_id, shoot_off = EXCLUDED.shoot_off, category_at_time = EXCLUDED.category_at_time, 
       qualification_at_time = EXCLUDED.qualification_at_time, society_at_time = EXCLUDED.society_at_time,
       ranking_preference = EXCLUDED.ranking_preference,
       ranking_preference_override = EXCLUDED.ranking_preference_override,
       hidden_from_user = FALSE, team_id = EXCLUDED.team_id, team_name = EXCLUDED.team_name`,
      [
        finalId, targetUserId, c.name, c.date, c.endDate || null, c.location, c.discipline, c.level, 
        c.totalScore, c.totalTargets, c.averagePerSeries, c.position || null, c.cost || 0, c.win || 0, c.notes || null,
        c.weather ? JSON.stringify(c.weather) : null,
        JSON.stringify(c.scores),
        c.detailedScores ? JSON.stringify(c.detailedScores) : null,
        c.seriesImages ? JSON.stringify(c.seriesImages) : null,
        c.usedCartridges ? JSON.stringify(c.usedCartridges) : null,
        c.chokes ? JSON.stringify(c.chokes) : null,
        (req.user.role === 'admin' || req.user.role === 'society') ? (c.eventId || null) : null,
        c.shootOff !== undefined ? c.shootOff : null,
        cat, qual, soc,
        c.ranking_preference || 'categoria',
        c.ranking_preference_override || null,
        teamId, teamName
      ]
    );

    // Send push notification to user if result was entered by someone else
    if (targetUserId !== req.user.id) {
      await sendPushNotification(
        [targetUserId],
        "Nuovo Risultato!",
        `È stato inserito un nuovo risultato per te nella gara "${c.name}".`,
        `/history`,
        'all'
      );
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/competitions/:id', authenticateToken, async (req: any, res) => {
  const c = req.body;
  
  try {
    // Fetch existing competition to check permissions and get targetUserId
    const existingComp = await pool.query('SELECT user_id, name, event_id FROM competitions WHERE id = $1', [req.params.id]);
    if (existingComp.rows.length === 0) return res.status(404).json({ error: 'Gara non trovata.' });
    
    const targetUserId = existingComp.rows[0].user_id;
    const compName = existingComp.rows[0].name;
    const compEventId = existingComp.rows[0].event_id;

    // Check if competition is linked to a validated event
    if (compEventId) {
      const eventCheck = await pool.query('SELECT status, is_management_enabled FROM events WHERE id = $1', [compEventId]);
      if (eventCheck.rows.length > 0) {
        if (!eventCheck.rows[0].is_management_enabled && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'La gestione classifiche per questa gara non è attiva.' });
        }
        if (eventCheck.rows[0].status === 'validated' && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Questa gara è stata convalidata e non può più essere modificata.' });
        }
      }
    }

    let result;
    let teamId = c.teamId || null;
    let teamName = c.teamName || null;

    if (c.eventId && !teamId) {
      const teamCheck = await pool.query(`
        SELECT t.id, t.name 
        FROM teams t
        JOIN team_members tm ON t.id = tm.team_id
        WHERE tm.user_id = $1 AND t.competition_name = $2
        LIMIT 1
      `, [c.userId || req.user.id, c.name]);

      if (teamCheck.rows.length > 0) {
        teamId = teamCheck.rows[0].id;
        teamName = teamCheck.rows[0].name;
      }
    }

    if (req.user.role === 'admin') {
      const finalUserId = c.userId || targetUserId;
      result = await pool.query(
        `UPDATE competitions SET user_id=$1, name=$2, date=$3, enddate=$4, location=$5, discipline=$6, level=$7, totalscore=$8, totaltargets=$9, averageperseries=$10, position=$11, cost=$12, win=$13, notes=$14, weather=$15, scores=$16, detailedscores=$17, seriesimages=$18, usedcartridges=$19, chokes=$20, event_id=$21, shoot_off=$22, ranking_preference=$23, ranking_preference_override=$24, team_id=$25, team_name=$26 WHERE id=$27`,
        [
          finalUserId, c.name, c.date, c.endDate || null, c.location, c.discipline, c.level, 
          c.totalScore, c.totalTargets, c.averagePerSeries, c.position || null, c.cost || 0, c.win || 0, c.notes || null,
          c.weather ? JSON.stringify(c.weather) : null,
          JSON.stringify(c.scores),
          c.detailedScores ? JSON.stringify(c.detailedScores) : null,
          c.seriesImages ? JSON.stringify(c.seriesImages) : null,
          c.usedCartridges ? JSON.stringify(c.usedCartridges) : null,
          c.chokes ? JSON.stringify(c.chokes) : null,
          compEventId,
          c.shootOff !== undefined ? c.shootOff : null,
          c.ranking_preference || 'categoria',
          c.ranking_preference_override || null,
          teamId, teamName,
          req.params.id
        ]
      );
    } else if (req.user.role === 'society') {
      // Società can update competitions for their own shooters OR for events they own OR results at their location
      const existingComp = await pool.query('SELECT user_id, event_id, location FROM competitions WHERE id = $1', [req.params.id]);
      if (existingComp.rows.length === 0) return res.status(404).json({ error: 'Gara non trovata.' });
      
      const compUserId = existingComp.rows[0].user_id;
      const compEventId = existingComp.rows[0].event_id;
      const compLocation = existingComp.rows[0].location;
      
      let canManage = false;
      
      if (compEventId) {
        // If it's an event result, ONLY the hosting Society can update it
        const eventCheck = await pool.query('SELECT location, created_by FROM events WHERE id = $1', [compEventId]);
        if (eventCheck.rows.length > 0) {
          const ev = eventCheck.rows[0];
          if (ev.location === req.user.society || ev.created_by === req.user.id) {
            canManage = true;
          } else {
            return res.status(403).json({ error: 'I risultati di una gara possono essere modificati solo dalla società ospitante o da un Admin.' });
          }
        } else {
          return res.status(404).json({ error: 'Evento non trovato.' });
        }
      } else {
        // Non-event competition
        const userCheck = await pool.query('SELECT society FROM users WHERE id = $1', [compUserId]);
        const isTheirShooter = userCheck.rows.length > 0 && userCheck.rows[0].society === req.user.society;
        const isTheirLocation = compLocation === req.user.society;
        
        if (isTheirShooter || isTheirLocation) {
          canManage = true;
        }
      }

      if (!canManage) {
        return res.status(403).json({ error: 'Puoi modificare gare solo per i tuoi tiratori o per gare svolte presso la tua società.' });
      }

      result = await pool.query(
        `UPDATE competitions SET name=$1, date=$2, enddate=$3, location=$4, discipline=$5, level=$6, totalscore=$7, totaltargets=$8, averageperseries=$9, position=$10, cost=$11, win=$12, notes=$13, weather=$14, scores=$15, detailedscores=$16, seriesimages=$17, usedcartridges=$18, chokes=$19, event_id=$20, shoot_off=$21, ranking_preference=$22, ranking_preference_override=$23, team_id=$24, team_name=$25 WHERE id=$26`,
        [
          c.name, c.date, c.endDate || null, c.location, c.discipline, c.level, 
          c.totalScore, c.totalTargets, c.averagePerSeries, c.position || null, c.cost || 0, c.win || 0, c.notes || null,
          c.weather ? JSON.stringify(c.weather) : null,
          JSON.stringify(c.scores),
          c.detailedScores ? JSON.stringify(c.detailedScores) : null,
          c.seriesImages ? JSON.stringify(c.seriesImages) : null,
          c.usedCartridges ? JSON.stringify(c.usedCartridges) : null,
          c.chokes ? JSON.stringify(c.chokes) : null,
          compEventId,
          c.shootOff !== undefined ? c.shootOff : null,
          c.ranking_preference || 'categoria',
          c.ranking_preference_override || null,
          teamId, teamName,
          req.params.id
        ]
      );
    } else {
      result = await pool.query(
        `UPDATE competitions SET name=$1, date=$2, enddate=$3, location=$4, discipline=$5, level=$6, totalscore=$7, totaltargets=$8, averageperseries=$9, position=$10, cost=$11, win=$12, notes=$13, weather=$14, scores=$15, detailedscores=$16, seriesimages=$17, usedcartridges=$18, chokes=$19, event_id=$20, shoot_off=$21, ranking_preference=$22, ranking_preference_override=$23, team_id=$24, team_name=$25 WHERE id=$26 AND user_id=$27`,
        [
          c.name, c.date, c.endDate || null, c.location, c.discipline, c.level, 
          c.totalScore, c.totalTargets, c.averagePerSeries, c.position || null, c.cost || 0, c.win || 0, c.notes || null,
          c.weather ? JSON.stringify(c.weather) : null,
          JSON.stringify(c.scores),
          c.detailedScores ? JSON.stringify(c.detailedScores) : null,
          c.seriesImages ? JSON.stringify(c.seriesImages) : null,
          c.usedCartridges ? JSON.stringify(c.usedCartridges) : null,
          c.chokes ? JSON.stringify(c.chokes) : null,
          compEventId,
          c.shootOff !== undefined ? c.shootOff : null,
          c.ranking_preference || 'categoria',
          c.ranking_preference_override || null,
          teamId, teamName,
          req.params.id, req.user.id
        ]
      );
    }
    
    if (result.rowCount === 0) {
      console.log(`Competition update failed: ID ${req.params.id} not found or unauthorized for user ${req.user.id} (role: ${req.user.role})`);
      return res.status(404).json({ error: 'Gara non trovata o non autorizzato.' });
    }

    // Send push notification to user if result was updated by someone else
    if (targetUserId !== req.user.id) {
      await sendPushNotification(
        [targetUserId],
        "Risultato Aggiornato!",
        `Il tuo risultato nella gara "${c.name || compName}" è stato aggiornato.`,
        `/history`,
        'all'
      );
    }
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/competitions/:id', authenticateToken, async (req: any, res) => {
  console.log(`DELETE competition request: id=${req.params.id}, user_id=${req.user.id}, role=${req.user.role}`);
  try {
    // Check if competition is linked to a validated event
    const compCheck = await pool.query('SELECT event_id FROM competitions WHERE id = $1', [req.params.id]);
    if (compCheck.rows.length > 0 && compCheck.rows[0].event_id) {
      const eventCheck = await pool.query('SELECT status FROM events WHERE id = $1', [compCheck.rows[0].event_id]);
      if (eventCheck.rows.length > 0 && eventCheck.rows[0].status === 'validated' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Questa gara è stata convalidata e non può più essere modificata.' });
      }
    }

    let result;
    if (req.user.role === 'admin') {
      result = await pool.query("DELETE FROM competitions WHERE id=$1", [req.params.id]);
    } else if (req.user.role === 'society') {
      // Società can delete competitions for their own shooters OR for events they own OR results at their location
      const existingComp = await pool.query('SELECT user_id, event_id, location FROM competitions WHERE id = $1', [req.params.id]);
      if (existingComp.rows.length === 0) return res.status(404).json({ error: 'Gara non trovata.' });
      
      const compUserId = existingComp.rows[0].user_id;
      const compEventId = existingComp.rows[0].event_id;
      const compLocation = existingComp.rows[0].location;
      
      let canManage = false;
      
      if (compEventId) {
        // If it's an event result, ONLY the hosting Society can delete it
        const eventCheck = await pool.query('SELECT location, created_by FROM events WHERE id = $1', [compEventId]);
        if (eventCheck.rows.length > 0) {
          const ev = eventCheck.rows[0];
          if (ev.location === req.user.society || ev.created_by === req.user.id) {
            canManage = true;
          } else {
            return res.status(403).json({ error: 'I risultati di una gara possono essere eliminati solo dalla società ospitante o da un Admin.' });
          }
        } else {
          return res.status(404).json({ error: 'Evento non trovato.' });
        }
      } else {
        // Non-event competition
        const userCheck = await pool.query('SELECT society FROM users WHERE id = $1', [compUserId]);
        const isTheirShooter = userCheck.rows.length > 0 && userCheck.rows[0].society === req.user.society;
        const isTheirLocation = compLocation === req.user.society;
        
        if (isTheirShooter || isTheirLocation) {
          canManage = true;
        }
      }

      if (!canManage) {
        return res.status(403).json({ error: 'Puoi eliminare gare solo per i tuoi tiratori o per gare svolte presso la tua società.' });
      }
      result = await pool.query("DELETE FROM competitions WHERE id=$1", [req.params.id]);
    } else {
      // If it's a user deleting their own competition, check if it's linked to an event
      const compCheck = await pool.query('SELECT event_id FROM competitions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
      if (compCheck.rows.length > 0) {
        if (compCheck.rows[0].event_id) {
          // It's linked to a society event, so just hide it from the user's view
          result = await pool.query("UPDATE competitions SET hidden_from_user = TRUE WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
        } else {
          // Not linked, safe to delete
          result = await pool.query("DELETE FROM competitions WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
        }
      } else {
        result = { rowCount: 0 };
      }
    }
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
    const { rows } = await pool.query(`
      SELECT ct.*, u.name as creator_name, u.surname as creator_surname 
      FROM cartridge_types ct
      LEFT JOIN users u ON ct.created_by = u.id
      ORDER BY ct.producer, ct.model
    `);
    const types = rows.map((row: any) => ({
      id: row.id,
      producer: row.producer,
      model: row.model,
      leadNumber: row.leadnumber,
      grams: row.grams,
      imageUrl: row.imageurl,
      createdBy: row.created_by,
      createdByName: row.creator_name,
      createdBySurname: row.creator_surname
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
         grams = $4,
         imageurl = $5
         WHERE id = $6`,
        [t.producer, t.model, t.leadNumber, t.grams, t.imageUrl || null, t.id]
      );
    } else {
      // Create - check for existing by fields first to avoid constraint violation
      const { rows: duplicate } = await pool.query(
        "SELECT id FROM cartridge_types WHERE LOWER(TRIM(producer)) = LOWER(TRIM($1)) AND LOWER(TRIM(model)) = LOWER(TRIM($2)) AND leadnumber = $3 AND (grams = $4 OR (grams IS NULL AND $4 IS NULL))",
        [t.producer, t.model, t.leadNumber, t.grams]
      );

      if (duplicate.length > 0) {
        return res.json({ success: true, id: duplicate[0].id, message: 'Tipo già esistente' });
      }

      await pool.query(
        `INSERT INTO cartridge_types (id, producer, model, leadnumber, grams, imageurl, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET 
         producer = EXCLUDED.producer, model = EXCLUDED.model, leadnumber = EXCLUDED.leadnumber, 
         grams = EXCLUDED.grams, imageurl = EXCLUDED.imageurl`,
        [t.id, t.producer, t.model, t.leadNumber, t.grams, t.imageUrl || null, req.user.id]
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
      grams: row.grams,
      quantity: row.quantity,
      initialQuantity: row.initialquantity,
      cost: row.cost,
      armory: row.armory,
      imageUrl: row.imageurl,
      typeId: row.type_id
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
      `INSERT INTO cartridges (id, user_id, purchasedate, producer, model, leadnumber, grams, quantity, initialquantity, cost, armory, imageurl, type_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET 
       purchasedate = EXCLUDED.purchasedate, producer = EXCLUDED.producer, model = EXCLUDED.model, 
       leadnumber = EXCLUDED.leadnumber, grams = EXCLUDED.grams, quantity = EXCLUDED.quantity, 
       initialquantity = EXCLUDED.initialquantity, cost = EXCLUDED.cost, armory = EXCLUDED.armory, 
       imageurl = EXCLUDED.imageurl, type_id = EXCLUDED.type_id`,
      [c.id, req.user.id, c.purchaseDate, c.producer, c.model, c.leadNumber, c.grams, c.quantity, c.initialQuantity, c.cost, c.armory || null, c.imageUrl || null, c.typeId || null]
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
        `INSERT INTO cartridges (id, user_id, purchasedate, producer, model, leadnumber, grams, quantity, initialquantity, cost, armory, imageurl, type_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET 
         purchasedate = EXCLUDED.purchasedate,
         producer = EXCLUDED.producer,
         model = EXCLUDED.model,
         leadnumber = EXCLUDED.leadnumber,
         grams = EXCLUDED.grams,
         quantity = EXCLUDED.quantity,
         initialquantity = EXCLUDED.initialquantity,
         cost = EXCLUDED.cost,
         armory = EXCLUDED.armory,
         imageurl = EXCLUDED.imageurl,
         type_id = EXCLUDED.type_id`,
        [c.id, req.user.id, c.purchaseDate, c.producer, c.model, c.leadNumber, c.grams, c.quantity, c.initialQuantity, c.cost, c.armory || null, c.imageUrl || null, c.typeId || null]
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
      `UPDATE cartridges SET purchasedate=$1, producer=$2, model=$3, leadnumber=$4, grams=$5, quantity=$6, initialquantity=$7, cost=$8, armory=$9, imageurl=$10, type_id=$11 WHERE id=$12 AND user_id=$13`,
      [c.purchaseDate, c.producer, c.model, c.leadNumber, c.grams, c.quantity, c.initialQuantity, c.cost, c.armory || null, c.imageUrl || null, c.typeId || null, req.params.id, req.user.id]
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
  const { competitions, cartridges, cartridgeTypes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    if (cartridgeTypes && Array.isArray(cartridgeTypes)) {
      for (const t of cartridgeTypes) {
        await client.query(
          `INSERT INTO cartridge_types (id, producer, model, leadnumber, grams, imageurl, created_by) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET 
           producer=$2, model=$3, leadnumber=$4, grams=$5, imageurl=$6, created_by=$7`,
          [t.id, t.producer, t.model, t.leadNumber, t.grams, t.imageUrl || null, t.createdBy || req.user.id]
        );
      }
    }

    if (competitions && Array.isArray(competitions)) {
      for (const c of competitions) {
        const userId = (req.user.role === 'admin' && c.userId) ? c.userId : req.user.id;
        await client.query(
          `INSERT INTO competitions (id, user_id, name, date, enddate, location, discipline, level, totalscore, totaltargets, averageperseries, position, cost, win, notes, weather, scores, detailedscores, seriesimages, usedcartridges, chokes, team_name, team_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
           ON CONFLICT (id) DO UPDATE SET 
           name=$3, date=$4, enddate=$5, location=$6, discipline=$7, level=$8, totalscore=$9, totaltargets=$10, averageperseries=$11, position=$12, cost=$13, win=$14, notes=$15, weather=$16, scores=$17, detailedscores=$18, seriesimages=$19, usedcartridges=$20, chokes=$21, team_name=$22, team_id=$23`,
          [
            c.id, userId, c.name, c.date, c.endDate || null, c.location, c.discipline, c.level, 
            c.totalScore, c.totalTargets, c.averagePerSeries, c.position || null, c.cost || 0, c.win || 0, c.notes || null,
            c.weather ? JSON.stringify(c.weather) : null,
            JSON.stringify(c.scores),
            c.detailedScores ? JSON.stringify(c.detailedScores) : null,
            c.seriesImages ? JSON.stringify(c.seriesImages) : null,
            c.usedCartridges ? JSON.stringify(c.usedCartridges) : null,
            c.chokes ? JSON.stringify(c.chokes) : null,
            c.teamName || null,
            c.teamId || null
          ]
        );
      }
    }
    
    if (cartridges && Array.isArray(cartridges)) {
      for (const c of cartridges) {
        const userId = (req.user.role === 'admin' && c.userId) ? c.userId : req.user.id;
        await client.query(
          `INSERT INTO cartridges (id, user_id, purchasedate, producer, model, leadnumber, grams, quantity, initialquantity, cost, armory, imageurl, type_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO UPDATE SET 
           purchasedate=$3, producer=$4, model=$5, leadnumber=$6, grams=$7, quantity=$8, initialquantity=$9, cost=$10, armory=$11, imageurl=$12, type_id=$13
           WHERE cartridges.user_id = $2`,
          [c.id, userId, c.purchaseDate, c.producer, c.model, c.leadNumber, c.grams, c.quantity, c.initialQuantity, c.cost, c.armory || null, c.imageUrl || null, c.typeId || null]
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

// Settings endpoints
app.get('/api/settings', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT key, value FROM app_settings");
    const settings = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {} as any);
    res.json(settings);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) {
    return res.status(400).json({ error: 'Key and value are required' });
  }
  try {
    await pool.query(
      "INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP",
      [key, JSON.stringify(value)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function setupVite(app: any) {
  const isProd = process.env.NODE_ENV === "production";
  const buildPath = path.resolve(process.cwd(), 'build');

  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log('Vite middleware initialized');
    } catch (e) {
      console.error('Vite initialization failed, falling back to static serving', e);
      if (fs.existsSync(buildPath)) {
        serveStatic(app);
      } else {
        app.get('*', (req: any, res: any) => {
          res.status(500).send('Vite failed to start and no build found. Please check server logs.');
        });
      }
    }
  } else {
    if (fs.existsSync(buildPath)) {
      console.log('Serving static files from build directory');
      serveStatic(app);
    } else {
      console.error('Production mode enabled but build directory not found');
      app.get('*', (req: any, res: any) => {
        res.status(500).send('Production build not found. Run npm run build.');
      });
    }
  }
}

function serveStatic(app: any) {
  const buildPath = path.resolve(process.cwd(), 'build');
  app.use(express.static(buildPath));
  app.use((req: any, res: any) => {
    res.sendFile(path.resolve(buildPath, 'index.html'));
  });
}

async function startApp() {
  // API routes are already defined above
  
  // Setup Vite or Static serving
  await setupVite(app);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startApp();

