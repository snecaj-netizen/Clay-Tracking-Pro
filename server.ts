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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add columns if they don't exist (for existing databases)
    try {
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS category TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS qualification TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS society TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS fitav_card TEXT");
    } catch (e) {
      console.log("Columns already exist or error adding them");
    }

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
        usedcartridges TEXT
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
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        size INTEGER NOT NULL,
        society TEXT,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (team_id, user_id)
      );
    `);

    // Create default admin user if not exists
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", ['snecaj@gmail.com']);
    if (rows.length === 0) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('admin', salt);
      await pool.query(
        "INSERT INTO users (name, surname, email, password, role) VALUES ($1, $2, $3, $4, $5)",
        ['Admin', 'User', 'snecaj@gmail.com', hash, 'admin']
      );
    }
    console.log('Connected to PostgreSQL database and initialized tables.');
  } catch (err) {
    console.error('Error initializing database', err);
  }
};

initDB();

// Authentication Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
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

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = rows[0];
    if (!user) return res.status(400).json({ error: 'User not found' });

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, society: user.society }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, surname: user.surname, email: user.email, role: user.role, category: user.category, qualification: user.qualification, society: user.society, fitav_card: user.fitav_card } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/recover', async (req, res) => {
  const { email } = req.body;
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = rows[0];
    
    if (user) {
      // Generate a new random password
      const newPassword = Math.random().toString(36).slice(-8);
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(newPassword, salt);
      
      // Update password in DB
      await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hash, user.id]);

      // Send email (using a dummy configuration or logging for now)
      // In a real scenario, configure SMTP settings here
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.SMTP_PORT || '587'),
        auth: {
          user: process.env.SMTP_USER || 'dummy',
          pass: process.env.SMTP_PASS || 'dummy'
        }
      });

      const mailOptions = {
        from: '"Clay Tracker Pro" <noreply@claytracker.pro>',
        to: email,
        subject: 'Recupero Password - Clay Tracker Pro',
        text: `Ciao ${user.name},\n\nLa tua nuova password temporanea è: ${newPassword}\n\nTi consigliamo di cambiarla al primo accesso.\n\nSaluti,\nIl team di Clay Tracker Pro`
      };

      try {
        // Attempt to send email, but don't fail if SMTP is not configured
        await transporter.sendMail(mailOptions);
        console.log(`Password recovery email sent to ${email} with password: ${newPassword}`);
      } catch (emailErr) {
        console.log(`Failed to send email to ${email}. SMTP might not be configured. New password is: ${newPassword}`);
      }
    }

    // Always return success to prevent email enumeration
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/societies', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT DISTINCT society FROM users WHERE society IS NOT NULL AND society != ''");
    res.json(rows.map(r => r.society));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// User Profile Routes
app.put('/api/user/profile', authenticateToken, async (req: any, res) => {
  const { name, surname, email, password, category, qualification, society, fitav_card } = req.body;
  try {
    if (password) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      await pool.query(
        "UPDATE users SET name = $1, surname = $2, email = $3, password = $4, category = $5, qualification = $6, society = $7, fitav_card = $8 WHERE id = $9",
        [name, surname, email, hash, category, qualification, society, fitav_card, req.user.id]
      );
    } else {
      await pool.query(
        "UPDATE users SET name = $1, surname = $2, email = $3, category = $4, qualification = $5, society = $6, fitav_card = $7 WHERE id = $8",
        [name, surname, email, category, qualification, society, fitav_card, req.user.id]
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: 'Email already in use or other error' });
  }
});

// Admin Routes (Manage Users)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name, surname, email, role, category, qualification, society, fitav_card, created_at FROM users");
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const { name, surname, email, password, role, category, qualification, society, fitav_card } = req.body;
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  try {
    const { rows } = await pool.query(
      "INSERT INTO users (name, surname, email, password, role, category, qualification, society, fitav_card) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
      [name, surname, email, hash, role || 'user', category, qualification, society, fitav_card]
    );
    res.json({ id: rows[0].id, name, surname, email, role: role || 'user', category, qualification, society, fitav_card });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { name, surname, email, role, password, category, qualification, society, fitav_card } = req.body;
  
  try {
    if (password) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      await pool.query(
        "UPDATE users SET name = $1, surname = $2, email = $3, role = $4, password = $5, category = $6, qualification = $7, society = $8, fitav_card = $9 WHERE id = $10",
        [name, surname, email, role, hash, category, qualification, society, fitav_card, req.params.id]
      );
    } else {
      await pool.query(
        "UPDATE users SET name = $1, surname = $2, email = $3, role = $4, category = $5, qualification = $6, society = $7, fitav_card = $8 WHERE id = $9",
        [name, surname, email, role, category, qualification, society, fitav_card, req.params.id]
      );
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
        u.society
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
      usedCartridges: row.usedcartridges ? JSON.parse(row.usedcartridges) : undefined
    }));
    res.json(comps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
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
      usedCartridges: row.usedcartridges ? JSON.parse(row.usedcartridges) : undefined
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

// Teams Routes
app.get('/api/teams', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  try {
    let query = `
      SELECT t.*, 
             json_agg(json_build_object('id', u.id, 'name', u.name, 'surname', u.surname)) as members
      FROM teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      LEFT JOIN users u ON tm.user_id = u.id
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
  const { name, size, memberIds } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const society = req.user.role === 'society' ? req.user.society : null;
    const { rows } = await client.query(
      "INSERT INTO teams (name, size, society, created_by) VALUES ($1, $2, $3, $4) RETURNING id",
      [name, size, society, req.user.id]
    );
    const teamId = rows[0].id;

    for (const userId of memberIds) {
      await client.query(
        "INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)",
        [teamId, userId]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, id: teamId });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/teams/:id', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  try {
    const { id } = req.params;
    // If society, check if team belongs to society
    if (req.user.role === 'society') {
      const { rows } = await pool.query("SELECT society FROM teams WHERE id = $1", [id]);
      if (rows.length === 0 || rows[0].society !== req.user.society) {
        return res.status(403).json({ error: "Unauthorized" });
      }
    }
    await pool.query("DELETE FROM teams WHERE id = $1", [id]);
    res.json({ success: true });
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
      usedCartridges: row.usedcartridges ? JSON.parse(row.usedcartridges) : undefined
    }));
    res.json(comps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/competitions', authenticateToken, async (req: any, res) => {
  if (req.user.role === 'society') return res.status(403).json({ error: 'Le società non possono inserire gare.' });
  const c = req.body;
  try {
    await pool.query(
      `INSERT INTO competitions (id, user_id, name, date, enddate, location, discipline, level, totalscore, totaltargets, averageperseries, position, cost, win, notes, weather, scores, detailedscores, seriesimages, usedcartridges) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        c.id, req.user.id, c.name, c.date, c.endDate || null, c.location, c.discipline, c.level, 
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
  const distPath = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === "production" || fs.existsSync(distPath);

  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error('Vite initialization failed, falling back to static serving', e);
      serveStatic(app);
    }
  } else {
    console.log('Serving static files from dist directory');
    serveStatic(app);
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

