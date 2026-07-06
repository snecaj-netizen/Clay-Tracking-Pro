import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';

import nodemailer from 'nodemailer';
import crypto from 'crypto';
import webpush from 'web-push';
import cron from 'node-cron';
import { GoogleGenAI, Type } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required but missing. Please configure it in your Settings.');
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

async function callGeminiWithRetry(
  apiCall: (ai: GoogleGenAI) => Promise<any>,
  maxRetries = 5,
  initialDelay = 2000
) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const ai = getGeminiClient();
      return await apiCall(ai);
    } catch (err: any) {
      lastError = err;
      const errorMessage = typeof err === 'string' ? err : (err.message || '');
      const errorCode = err.status || (err.error && err.error.code);
      
      const isRetryable = 
        errorMessage.includes('503') || 
        errorMessage.includes('429') || 
        errorMessage.includes('UNAVAILABLE') ||
        errorCode === 503 || 
        errorCode === 429;
      
      if (isRetryable && i < maxRetries - 1) {
        // Calculate exponential backoff
        let waitTime = initialDelay * Math.pow(2, i);
        
        // Try to extract recommended retry delay from error message (e.g. "retry in 7.7s")
        const retryMatch = errorMessage.match(/retry in ([\d\.]+)s/);
        if (retryMatch) {
          const seconds = parseFloat(retryMatch[1]);
          waitTime = Math.max(waitTime, Math.ceil(seconds * 1000) + 1000);
        }

        // Check for structured RetryInfo in error details
        if (err.error?.details) {
          const retryInfo = err.error.details.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
          if (retryInfo?.retryDelay) {
            const seconds = parseFloat(retryInfo.retryDelay.replace('s', ''));
            waitTime = Math.max(waitTime, Math.ceil(seconds * 1000) + 1000);
          }
        }

        console.warn(`Gemini API error (retryable): ${errorMessage}. Waiting ${waitTime}ms before retry ${i + 2}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// import { createServer as createViteServer } from 'vite'; // Removed top-level import

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

const SERVER_BOOT_ID = crypto.randomBytes(16).toString('hex');
let CLIENT_BUILD_HASH = 'dev';
try {
  const indexPath = path.resolve(process.cwd(), 'dist/index.html');
  if (fs.existsSync(indexPath)) {
    const contents = fs.readFileSync(indexPath, 'utf8');
    CLIENT_BUILD_HASH = crypto.createHash('md5').update(contents).digest('hex');
  } else {
    const rootIndexPath = path.resolve(process.cwd(), 'index.html');
    if (fs.existsSync(rootIndexPath)) {
      const contents = fs.readFileSync(rootIndexPath, 'utf8');
      CLIENT_BUILD_HASH = crypto.createHash('md5').update(contents).digest('hex');
    }
  }
} catch (err) {
  console.error('Error computing build hash on start:', err);
}

// 1. IMMEDIATE HEALTH CHECK (Must be first)
app.get('/ping', (req, res) => res.send('pong'));

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-clay-tracker';

const normalizeCategoryBackend = (catStr: any): string => {
  if (!catStr) return '2*';
  const upper = catStr.toString().toUpperCase().trim();
  if (upper === 'CACCIATORE' || upper === 'CACC' || upper === 'CA' || upper.startsWith('CACC')) return 'Cacciatore';
  if (upper === 'ECCELLENZA' || upper === 'E') return 'E';
  if (upper.includes('PRIMA') || upper === '1' || upper === '1^' || upper === '1*' || upper === '1ª' || upper === '1°') return '1*';
  if (upper.includes('SECONDA') || upper === '2' || upper === '2^' || upper === '2*' || upper === '2ª' || upper === '2°') return '2*';
  if (upper.includes('TERZA') || upper === '3' || upper === '3^' || upper === '3*' || upper === '3ª' || upper === '3°') return '3*';
  return '2*';
};

function getCategoryForDisciplineBackend(disciplineCategories: string | null | undefined, disciplineStr: string | null | undefined): string | null {
  if (!disciplineCategories || !disciplineStr) return null;
  const upperDisc = disciplineStr.toUpperCase();
  
  let acronyms: string[] = [];
  if (
    upperDisc.includes('DOPPIETTO') || 
    upperDisc.includes('DCK')
  ) {
    acronyms = ['CK', 'CS', 'PC'];
  } else if (
    (upperDisc.includes('SPORTING') && upperDisc.includes('COMPAK')) || 
    upperDisc.includes('CK') || 
    upperDisc.includes('CS') || 
    upperDisc === 'COMPAK SPORTING' ||
    upperDisc.includes('CLUB CUP') ||
    upperDisc.includes('PC')
  ) {
    acronyms = ['CK', 'CS', 'PC'];
  } else if (upperDisc.includes('SPORTING') || upperDisc.includes('SP') || upperDisc.includes('PV')) {
    acronyms = ['SP', 'PV'];
  } else if (upperDisc.includes('DOUBLE TRAP') || upperDisc.includes('DT')) {
    acronyms = ['DT'];
  } else if (upperDisc.includes('ELICA') || upperDisc.includes('EL')) {
    acronyms = ['EL'];
  } else if (upperDisc.includes('FOSSA OLIMPICA') || upperDisc.includes('FO')) {
    acronyms = ['FO'];
  } else if (upperDisc.includes('FOSSA UNIVERSALE') || upperDisc.includes('FU')) {
    acronyms = ['FU'];
  } else if (upperDisc.includes('SKEET') || upperDisc.includes('SK')) {
    acronyms = ['SK', 'SK_ISSF'];
  } else if (upperDisc.includes('TRAP 1') || upperDisc.includes('TR1') || upperDisc.includes('TA')) {
    acronyms = ['TR1', 'TA'];
  } else if (upperDisc.includes('COMBINATO') || upperDisc.includes('TC')) {
    acronyms = ['TC'];
  } else {
    acronyms = [upperDisc];
  }

  const parts = disciplineCategories.split(' ');
  for (const part of parts) {
    const [d, cat] = part.split(':');
    if (d && cat) {
      if (acronyms.includes(d.toUpperCase())) {
        return cat;
      }
    }
  }
  return null;
}


// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify SMTP connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Connection Error:', error);
  } else {
    console.log('✅ SMTP Server is ready to take our messages');
  }
});

const getMailFrom = () => {
  const fromEnv = process.env.SMTP_FROM;
  if (!fromEnv) return 'Clay Performance <no-reply@clay-performance.it>';
  
  // If it's something like "Name (email)", let's format it to "Name <email>"
  const parenMatch = fromEnv.match(/^([^(]+)\(([^)]+)\)$/);
  if (parenMatch) {
    const name = parenMatch[1].trim();
    const email = parenMatch[2].trim();
    return `"${name}" <${email}>`;
  }
  
  // If it doesn't have '<' or '(' but has an '@', we can use it as-is or wrap it.
  if (!fromEnv.includes('<') && fromEnv.includes('@')) {
    const emailMatch = fromEnv.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      const email = emailMatch[1];
      const name = fromEnv.replace(email, '').trim();
      if (name) {
        return `"${name}" <${email}>`;
      }
      return email;
    }
  }
  
  return fromEnv;
};

const sendVerificationEmail = async (email: string, name: string, token: string, host?: string, lang: string = 'it') => {
  if (!process.env.SMTP_HOST) {
    console.warn('⚠️ SMTP configuration missing. Verification email not sent.');
    return;
  }

  const isEn = lang === 'en';
  const appUrl = process.env.APP_URL || (host ? `https://${host}` : 'https://clay-tracking-pro-production-3fe8.up.railway.app');
  const verificationUrl = `${appUrl}/verify-email?token=${token}`;

  const subject = isEn ? 'Verify your account - Clay Performance' : 'Verifica il tuo account - Clay Performance';
  const greeting = isEn ? `Hello ${name},` : `Ciao ${name},`;
  const welcomeMsg = isEn 
    ? 'Welcome to Clay Performance! To activate your account and start tracking your results, confirm your email by clicking the button below.' 
    : 'Benvenuto in Clay Performance! Per attivare il tuo account e iniziare a tracciare i tuoi risultati, conferma la tua email cliccando sul tasto qui sotto.';
  
  const btnText = isEn ? 'VERIFY EMAIL' : 'VERIFICA EMAIL';
  const fallbackMsg = isEn 
    ? 'If the button doesn\'t work, copy and paste this link into your browser:' 
    : 'Se il tasto non funziona, copia e incolla questo link nel tuo browser:';
  const ignoreMsg = isEn 
    ? 'If you did not request this registration, you can ignore this email.' 
    : 'Se non hai richiesto tu questa iscrizione, puoi ignorare questa email.';

  const mailOptions = {
    from: getMailFrom(),
    to: email,
    subject: subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #ffffff; padding: 40px; border-radius: 24px;">
        <h1 style="color: #ea580c; text-transform: uppercase; font-weight: 900;">Clay Performance</h1>
        <p>${greeting}</p>
        <p>${welcomeMsg}</p>
        <div style="text-align: center;">
          <a href="${verificationUrl}" style="display: inline-block; background-color: #ea580c; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 20px 0;">${btnText}</a>
        </div>
        <p style="font-size: 12px; color: #64748b;">${fallbackMsg}<br>${verificationUrl}</p>
        <hr style="border: none; border-top: 1px solid #1e293b; margin: 20px 0;">
        <p style="font-size: 12px; color: #64748b;">${ignoreMsg}</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent successfully to: ${email}`);
  } catch (error: any) {
    console.error('❌ CRITICAL: SMTP Error sending verification email:');
    console.error(error.message);
  }
};

const sendRegistrationEmail = async (email: string, name: string, eventName: string, eventDate: string, societyName: string, phone: string, day: string, session: string, lang: string = 'it', isSocietyAction: boolean = false) => {
  if (!process.env.SMTP_HOST) {
    console.warn('⚠️ SMTP configuration missing. Registration email not sent.');
    return;
  }

  const isEn = lang === 'en';
  
  // Translate session
  let translatedSession = session;
  if (session.toLowerCase() === 'morning') {
    translatedSession = isEn ? 'Morning' : 'Mattina';
  } else if (session.toLowerCase() === 'afternoon') {
    translatedSession = isEn ? 'Afternoon' : 'Pomeriggio';
  }

  const subject = isEn 
    ? `Registration Confirmation: ${eventName} - Clay Performance` 
    : `Conferma Iscrizione: ${eventName} - Clay Performance`;
  
  const title = isEn ? 'Registration Confirmation' : 'Conferma Iscrizione';
  const greeting = isEn ? `Hello ${name},` : `Ciao ${name},`;
  
  let successMsg = isEn 
    ? 'Your registration for the event has been successfully recorded. Here are the details:' 
    : 'La tua iscrizione alla gara è stata registrata con successo. Ecco i dettagli:';

  if (isSocietyAction) {
    successMsg = isEn
      ? 'Your Club has registered you for the event as part of a team. Here are the details:'
      : 'La tua Società ha effettuato l\'iscrizione per te come parte di una squadra. Ecco i dettagli:';
  }
  
  const labelEvent = isEn ? 'Event' : 'Gara';
  const labelLocation = isEn ? 'Shooting Range' : 'Campo di Tiro';
  const labelDates = isEn ? 'Dates' : 'Date';
  const labelDay = isEn ? 'Chosen Day' : 'Giorno Scelto';
  const labelSession = isEn ? 'Session' : 'Sessione';
  const labelContact = isEn ? 'Contact' : 'Recapito';
  const manageMsg = isEn 
    ? 'You can view and manage your registrations directly from the app in the "Registrations" section.' 
    : 'Puoi visualizzare e gestire le tue iscrizioni direttamente dall\'app nella sezione "Iscrizioni".';
  const footerMsg = isEn 
    ? 'This is an automated communication, please do not reply to this email.' 
    : 'Questa è una comunicazione automatica, si prega di non rispondere a questa email.';

  const mailOptions = {
    from: getMailFrom(),
    to: email,
    subject: subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #ffffff; padding: 40px; border-radius: 24px;">
        <h1 style="color: #ea580c; text-transform: uppercase; font-weight: 900;">Clay Performance</h1>
        <h2 style="color: #ffffff;">${title}</h2>
        <p>${greeting}</p>
        <p>${successMsg}</p>
        
        <div style="background-color: #1e293b; padding: 20px; border-radius: 16px; margin: 20px 0; border: 1px solid #334155;">
          <p style="margin: 5px 0;"><strong style="color: #ea580c; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; display: block;">${labelEvent}</strong> <span style="font-size: 16px;">${eventName}</span></p>
          <p style="margin: 15px 0 5px 0;"><strong style="color: #ea580c; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; display: block;">${labelLocation}</strong> ${societyName}</p>
          <p style="margin: 15px 0 5px 0;"><strong style="color: #ea580c; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; display: block;">${labelDates}</strong> ${eventDate}</p>
          
          <table style="width: 100%; margin-top: 20px;" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 50%; vertical-align: top; padding-right: 15px;">
                <strong style="color: #ea580c; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; display: block;">${labelDay}</strong>
                <div style="margin-top: 5px; font-size: 14px;">${day}</div>
              </td>
              <td style="width: 50%; vertical-align: top; padding-left: 15px;">
                <strong style="color: #ea580c; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; display: block;">${labelSession}</strong>
                <div style="margin-top: 5px; font-size: 14px;">${translatedSession}</div>
              </td>
            </tr>
          </table>
          
          <p style="margin: 15px 0 5px 0;"><strong style="color: #ea580c; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; display: block;">${labelContact}</strong> ${phone}</p>
        </div>
        
        <p style="font-size: 14px; text-align: center; color: #94a3b8; margin-top: 30px;">
          ${manageMsg}
        </p>
        
        <hr style="border: none; border-top: 1px solid #1e293b; margin: 30px 0;">
        <p style="font-size: 11px; color: #64748b; text-align: center;">${footerMsg}</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Registration confirmation email sent to: ${email}`);
  } catch (error: any) {
    console.error('❌ Error sending registration email:', error.message);
  }
};

const sendRegistrationModifiedEmail = async (email: string, name: string, eventName: string, eventDate: string, societyName: string, phone: string, day: string, session: string, lang: string = 'it', isSocietyAction: boolean = false) => {
  if (!process.env.SMTP_HOST) {
    console.warn('⚠️ SMTP configuration missing. Modification email not sent.');
    return;
  }

  const isEn = lang === 'en';

  // Translate session
  let translatedSession = session;
  if (session.toLowerCase() === 'morning') {
    translatedSession = isEn ? 'Morning' : 'Mattina';
  } else if (session.toLowerCase() === 'afternoon') {
    translatedSession = isEn ? 'Afternoon' : 'Pomeriggio';
  }

  const subject = isEn 
    ? `Registration Modified: ${eventName} - Clay Performance` 
    : `Modifica Iscrizione: ${eventName} - Clay Performance`;
  
  const title = isEn ? 'Registration Modified' : 'Iscrizione Modificata';
  const greeting = isEn ? `Hello ${name},` : `Ciao ${name},`;
  
  let successMsg = isEn 
    ? 'Your registration for the event has been successfully modified. Here are the new details:' 
    : 'La tua iscrizione alla gara è stata modificata con successo. Ecco i nuovi dettagli:';

  if (isSocietyAction) {
    successMsg = isEn
      ? 'Your Club has modified your registration for the event. Here are the new details:'
      : 'La tua Società ha modificato la tua iscrizione alla gara. Ecco i nuovi dettagli:';
  }
  
  const labelEvent = isEn ? 'Event' : 'Gara';
  const labelLocation = isEn ? 'Shooting Range' : 'Campo di Tiro';
  const labelDates = isEn ? 'Dates' : 'Date';
  const labelDay = isEn ? 'Chosen Day' : 'Giorno Scelto';
  const labelSession = isEn ? 'Session' : 'Sessione';
  const labelContact = isEn ? 'Contact' : 'Recapito';
  const manageMsg = isEn 
    ? 'You can view and manage your registrations directly from the app in the "Registrations" section.' 
    : 'Puoi visualizzare e gestire le tue iscrizioni direttamente dall\'app nella sezione "Iscrizioni".';
  const footerMsg = isEn 
    ? 'This is an automated communication, please do not reply to this email.' 
    : 'Questa è una comunicazione automatica, si prega di non rispondere a questa email.';

  const mailOptions = {
    from: getMailFrom(),
    to: email,
    subject: subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #ffffff; padding: 40px; border-radius: 24px;">
        <h1 style="color: #ea580c; text-transform: uppercase; font-weight: 900;">Clay Performance</h1>
        <h2 style="color: #ffffff;">${title}</h2>
        <p>${greeting}</p>
        <p>${successMsg}</p>
        
        <div style="background-color: #1e293b; padding: 20px; border-radius: 16px; margin: 20px 0; border: 1px solid #334155;">
          <p style="margin: 5px 0;"><strong style="color: #ea580c; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; display: block;">${labelEvent}</strong> <span style="font-size: 16px;">${eventName}</span></p>
          <p style="margin: 15px 0 5px 0;"><strong style="color: #ea580c; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; display: block;">${labelLocation}</strong> ${societyName}</p>
          <p style="margin: 15px 0 5px 0;"><strong style="color: #ea580c; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; display: block;">${labelDates}</strong> ${eventDate}</p>
          
          <table style="width: 100%; margin-top: 20px;" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 50%; vertical-align: top; padding-right: 15px;">
                <strong style="color: #ea580c; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; display: block;">${labelDay}</strong>
                <div style="margin-top: 5px; font-size: 14px;">${day}</div>
              </td>
              <td style="width: 50%; vertical-align: top; padding-left: 15px;">
                <strong style="color: #ea580c; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; display: block;">${labelSession}</strong>
                <div style="margin-top: 5px; font-size: 14px;">${translatedSession}</div>
              </td>
            </tr>
          </table>
          
          <p style="margin: 15px 0 5px 0;"><strong style="color: #ea580c; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; display: block;">${labelContact}</strong> ${phone}</p>
        </div>
        
        <p style="font-size: 14px; text-align: center; color: #94a3b8; margin-top: 30px;">
          ${manageMsg}
        </p>
        
        <hr style="border: none; border-top: 1px solid #1e293b; margin: 30px 0;">
        <p style="font-size: 11px; color: #64748b; text-align: center;">${footerMsg}</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Registration modification email sent to: ${email}`);
  } catch (error: any) {
    console.error('❌ Error sending registration modification email:', error.message);
  }
};

const sendUnregistrationEmail = async (email: string, name: string, eventName: string, societyName: string, lang: string = 'it', isSocietyAction: boolean = false) => {
  if (!process.env.SMTP_HOST) {
    console.warn('⚠️ SMTP configuration missing. Unregistration email not sent.');
    return;
  }

  const isEn = lang === 'en';
  const subject = isEn 
    ? `Registration Canceled: ${eventName} - Clay Performance` 
    : `Iscrizione Cancellata: ${eventName} - Clay Performance`;
  
  const title = isEn ? 'Registration Canceled' : 'Iscrizione Cancellata';
  const greeting = isEn ? `Hello ${name},` : `Ciao ${name},`;
  
  let confirmMsg = isEn 
    ? 'We confirm that your registration for the following event has been canceled:' 
    : 'Ti confermiamo che la tua iscrizione alla seguente gara è stata cancellata:';

  if (isSocietyAction) {
    confirmMsg = isEn
      ? 'Your Club has withdrawn your team and canceled your registration for the following event:'
      : 'La tua Società ha ritirato la tua squadra e cancellato la tua iscrizione alla seguente gara:';
  }
  
  const labelEvent = isEn ? 'Event' : 'Gara';
  const labelLocation = isEn ? 'Shooting Range' : 'Campo di Tiro';
  const errorMsg = isEn 
    ? 'If this was an error, you can register again via the app.' 
    : 'Se si è trattato di un errore, puoi iscriverti nuovamente tramite l\'app.';
  const footerMsg = isEn 
    ? 'This is an automated communication, please do not reply to this email.' 
    : 'Questa è una comunicazione automatica, si prega di non rispondere a questa email.';

  const mailOptions = {
    from: getMailFrom(),
    to: email,
    subject: subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #ffffff; padding: 40px; border-radius: 24px;">
        <h1 style="color: #ea580c; text-transform: uppercase; font-weight: 900;">Clay Performance</h1>
        <h2 style="color: #ffffff;">${title}</h2>
        <p>${greeting}</p>
        <p>${confirmMsg}</p>
        
        <div style="background-color: #1e293b; padding: 20px; border-radius: 16px; margin: 20px 0; border: 1px solid #334155;">
          <p style="margin: 5px 0;"><strong style="color: #ea580c; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; display: block;">${labelEvent}</strong> <span style="font-size: 16px;">${eventName}</span></p>
          <p style="margin: 15px 0 5px 0;"><strong style="color: #ea580c; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; display: block;">${labelLocation}</strong> ${societyName}</p>
        </div>
        
        <p style="font-size: 14px; text-align: center; color: #94a3b8; margin-top: 30px;">
          ${errorMsg}
        </p>
        
        <hr style="border: none; border-top: 1px solid #1e293b; margin: 30px 0;">
        <p style="font-size: 11px; color: #64748b; text-align: center;">${footerMsg}</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Unregistration email sent to: ${email}`);
  } catch (error: any) {
    console.error('❌ Error sending unregistration email:', error.message);
  }
};

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
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

pool.on('connect', (client) => {
  client.on('error', (err) => {
    console.error('Database client error', err);
  });
});

// Global process error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
  // Optional: process.exit(1) if you want it to restart, 
  // but in this env it might be better to keep it alive if possible
});

// Elite Italian female names list for automatic Lady qualification detection
const ITA_FEMALE_NAMES = new Set([
  'gloria', 'giulia', 'maria', 'fiammetta', 'francesca', 'anna', 'sara', 'laura', 'chiara', 'elena', 
  'silvia', 'silvana', 'federica', 'valentina', 'alice', 'beatrice', 'monica', 'giorgia', 'marta', 'elisa', 'alessia', 
  'sofia', 'gaia', 'aurora', 'emma', 'martina', 'camilla', 'lucrezia', 'ludovica', 'greta', 'noemi', 
  'eleonora', 'rossella', 'claudia', 'lucia', 'rita', 'teresa', 'angela', 'antonella', 'donatella', 
  'patrizia', 'stefania', 'paola', 'barbara', 'simona', 'daniela', 'roberta', 'cristina', 'sabrina', 
  'alessandra', 'valeria', 'letizia', 'caterina', 'giovanna', 'irene', 'lisa', 'michela', 'nadia', 
  'rachele', 'sonia', 'tamara', 'tatiana', 'veronica', 'viviana', 'adele', 'agnese', 'alba', 'amalia', 
  'ambra', 'anita', 'arianna', 'asia', 'carla', 'carlotta', 'carmen', 'carolina', 'cecilia', 'celeste', 
  'cinzia', 'clara', 'clelia', 'clotilde', 'costanza', 'dahlia', 'debora', 'deborah', 'dely', 'delys', 
  'diana', 'diletta', 'elisabetta', 'elvira', 'emilia', 'emily', 'enrica', 'ester', 'evelina', 'fabiana', 
  'filomena', 'flavia', 'flora', 'gabriella', 'graziella', 'gemma', 'gessica', 'gianna', 'gilda', 'ginevra', 'gioia', 
  'giuseppina', 'ilenia', 'ilaria', 'imma', 'immacolata', 'iris', 'isabella', 'jessica', 'lara', 
  'lavinia', 'leda', 'lia', 'lidia', 'liliana', 'linda', 'loredana', 'lorena', 'lorella', 'luana', 
  'luciana', 'luisa', 'maddalena', 'manuela', 'mara', 'marcella', 'margherita', 'marianna', 'marica', 
  'marina', 'marinella', 'marisa', 'marzia', 'maura', 'melania', 'melissa', 'michela', 'milena', 'olga', 'pamela', 
  'raffaella', 'rebecca', 'rosa', 'rosanna', 'rosaria', 'rosemary', 'rossana', 'sabina', 'sandra', 
  'sarah', 'selene', 'serena', 'stella', 'susanna', 'tania', 'tiziana', 'vanessa', 'viola', 'violante', 
  'virginia', 'asya', 'cloe', 'sole', 'nives', 'matilde', 'matilda', 'carola', 'loretta', 'fiorella', 'assunta', 'vanna'
]);

const isFemaleName = (name: string | null | undefined): boolean => {
  if (!name) return false;
  const parts = name.toLowerCase().split(/[\s'-]+/);
  return parts.some(part => ITA_FEMALE_NAMES.has(part));
};

// Helper to calculate qualification based on age and name
const getAutoQualification = (birthDate: string | null, currentQual: string | null, name?: string | null): string | null => {
  if (currentQual === 'LAD' || isFemaleName(name)) return 'LAD';
  if (!birthDate) return currentQual;
  const birthDateObj = new Date(birthDate);
  const birthYear = birthDateObj.getFullYear();
  if (isNaN(birthYear)) return currentQual;
  
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  
  if (age <= 20) return 'JUN';
  if (age >= 21 && age <= 55) return 'MAN';
  if (age >= 56 && age <= 65) return 'SEN';
  if (age >= 66 && age <= 72) return 'VET';
  if (age > 72) return 'MAS';
  
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
        email TEXT NOT NULL,
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

    // Ensure email unique constraint/index is dropped so duplicate email is supported
    try {
      await pool.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key").catch(() => {});
      await pool.query("DROP INDEX IF EXISTS users_email_idx").catch(() => {});
    } catch (dbErr) {
      console.log("Ignored drop constraint error:", dbErr);
    }

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
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS shotgun_brand TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS shotgun_model TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS cartridge_brand TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS cartridge_model TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS nationality TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS international_id TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS original_club TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_international BOOLEAN DEFAULT false");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_cacciatore BOOLEAN DEFAULT false");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'it'");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS discipline_categories TEXT");
    } catch (_) {
      console.log("Columns already exist or error adding them");
    }

    try {
      await pool.query("UPDATE users SET name = UPPER(TRIM(name)), surname = UPPER(TRIM(surname)) WHERE name != UPPER(TRIM(name)) OR surname != UPPER(TRIM(surname))");
      await pool.query("UPDATE users SET society = UPPER(TRIM(society)) WHERE society IS NOT NULL AND society != UPPER(TRIM(society))");
      await pool.query("UPDATE societies SET name = UPPER(TRIM(name)) WHERE name != UPPER(TRIM(name))");
    } catch (e) {
      console.log("Error during name uppercase normalization:", e);
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
      await pool.query("ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_sent BOOLEAN DEFAULT FALSE");
      await pool.query("ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_type TEXT");
      await pool.query("ALTER TABLE teams ADD COLUMN IF NOT EXISTS type TEXT");
      await pool.query("UPDATE teams SET type = 'A' WHERE type IS NULL AND size = 6");
      await pool.query("UPDATE teams SET type = 'B' WHERE type IS NULL AND size = 3");
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
      
      // Create virtual society for international shooters
      await pool.query(`
        INSERT INTO societies (name, code, city, region) 
        VALUES ('International Shooters', 'INT00', 'Virtual', 'International')
        ON CONFLICT (name) DO NOTHING
      `);
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
      await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE`);
      await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS region TEXT`);
      await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS total_fields INTEGER DEFAULT 1`);
      await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS total_rounds INTEGER DEFAULT 1`);
      await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS use_fields_capacity BOOLEAN DEFAULT FALSE`);
      await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time TEXT DEFAULT '08:00'`);
      await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TEXT DEFAULT '18:00'`);
      await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS show_time_slot_to_shooters BOOLEAN DEFAULT TRUE`);
      await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS is_odt_public BOOLEAN DEFAULT FALSE`);
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, user_id)
      );
    `);

    // Add updated_at if it's missing (for existing tables)
    try {
      await pool.query("ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    } catch (e) {
      // column might already exist
    }

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
    await pool.query("ALTER TABLE event_squads ADD COLUMN IF NOT EXISTS squad_day TEXT").catch(() => {});
    await pool.query("ALTER TABLE event_squads ADD COLUMN IF NOT EXISTS round_number INTEGER DEFAULT 1").catch(() => {});

    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_squad_members (
        squad_id INTEGER REFERENCES event_squads(id) ON DELETE CASCADE,
        registration_id INTEGER REFERENCES event_registrations(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        bib_number INTEGER,
        PRIMARY KEY (squad_id, registration_id)
      );
    `);

    // Add bib_number column if it doesn't exist
    await pool.query("ALTER TABLE event_squad_members ADD COLUMN IF NOT EXISTS bib_number INTEGER").catch(() => {});
    
    // Add columns for original registration tracking
    await pool.query("ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS original_registration_day TEXT").catch(() => {});
    await pool.query("ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS original_shooting_session TEXT").catch(() => {});

    // Create regional championships table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS regional_championships (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        year INTEGER NOT NULL,
        season TEXT NOT NULL,
        region TEXT NOT NULL,
        discipline TEXT NOT NULL,
        trial1_name TEXT,
        trial1_event_id TEXT,
        trial2_name TEXT,
        trial2_event_id TEXT,
        trial3_name TEXT,
        trial3_event_id TEXT,
        trial4_name TEXT,
        trial4_event_id TEXT,
        is_visible BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `).catch((err) => {
      console.error("Error creating regional_championships table:", err);
    });
    await pool.query("ALTER TABLE regional_championships ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true").catch(() => {});

    // Create friendly challenges table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS friendly_challenges (
        id TEXT PRIMARY KEY,
        creator_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        discipline TEXT NOT NULL,
        location TEXT NOT NULL,
        group_by_category BOOLEAN DEFAULT false,
        shooters TEXT NOT NULL,
        status TEXT DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `).catch((err) => {
      console.error("Error creating friendly_challenges table:", err);
    });

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
        "INSERT INTO users (name, surname, email, password, role, email_verified) VALUES ($1, $2, $3, $4, $5, $6)",
        ['Admin', 'User', 'snecaj@gmail.com', hash, 'admin', true]
      );
      console.log("✅ Default admin user created: snecaj@gmail.com / admin (verified)");
    } else {
      // Admin exists, ensure it is verified if it's the master admin
      if (rows[0].email === 'snecaj@gmail.com' && !rows[0].email_verified) {
        await pool.query("UPDATE users SET email_verified = true WHERE email = $1", ['snecaj@gmail.com']);
        console.log("✅ Master admin email verified automatically.");
      }
      console.log("✅ Admin user verified in database.");
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
      const { rows: existingUsers } = await pool.query("SELECT id, birth_date, qualification, name FROM users WHERE (birth_date IS NOT NULL AND birth_date != '') OR (name IS NOT NULL AND name != '')");
      for (const u of existingUsers) {
        const newQual = getAutoQualification(u.birth_date, u.qualification, u.name);
        if (newQual !== u.qualification) {
          await pool.query("UPDATE users SET qualification = $1 WHERE id = $2", [newQual, u.id]);
        }
      }
      console.log("✅ Qualifications migration completed.");
    } catch (err) {
      console.error("❌ Error in qualifications migration:", err);
    }

    // Backfill past competitions' category_at_time based on users' discipline_categories
    try {
      const { rows: competitionsToBackfill } = await pool.query(`
        SELECT c.id, c.user_id, c.discipline, c.category_at_time, u.discipline_categories, u.is_cacciatore
        FROM competitions c
        JOIN users u ON c.user_id = u.id
        WHERE u.discipline_categories IS NOT NULL 
          AND u.discipline_categories != ''
          AND (u.is_cacciatore IS NULL OR u.is_cacciatore = FALSE)
      `);
      
      let updatedCount = 0;
      for (const comp of competitionsToBackfill) {
        const discCat = getCategoryForDisciplineBackend(comp.discipline_categories, comp.discipline);
        if (discCat) {
          const expectedCat = normalizeCategoryBackend(discCat);
          if (comp.category_at_time !== expectedCat) {
            await pool.query(
              "UPDATE competitions SET category_at_time = $1 WHERE id = $2",
              [expectedCat, comp.id]
            );
            updatedCount++;
          }
        }
      }
      if (updatedCount > 0) {
        console.log(`✅ Automated categories backfill completed: updated ${updatedCount} competition categories.`);
      }
    } catch (backfillErr) {
      console.error("❌ Exception during automated categories backfill:", backfillErr);
    }

    // Normalize existing users.category to use standard E, 1*, 2*, 3*
    try {
      const { rows: usersToNormalize } = await pool.query("SELECT id, category FROM users WHERE category IS NOT NULL AND category != '' AND (is_cacciatore IS NULL OR is_cacciatore = FALSE)");
      let normalizedUsersCount = 0;
      for (const u of usersToNormalize) {
        const expected = normalizeCategoryBackend(u.category);
        if (expected !== u.category) {
          await pool.query("UPDATE users SET category = $1 WHERE id = $2", [expected, u.id]);
          normalizedUsersCount++;
        }
      }
      if (normalizedUsersCount > 0) {
        console.log(`✅ Normalized ${normalizedUsersCount} users' categories to standard E, 1*, 2*, 3*.`);
      }
    } catch (err) {
      console.error("❌ Error normalizing users' categories:", err);
    }

    // Normalize existing competitions.category_at_time to use standard E, 1*, 2*, 3*
    try {
      const { rows: compsToNormalize } = await pool.query("SELECT id, category_at_time FROM competitions WHERE category_at_time IS NOT NULL AND category_at_time != ''");
      let normalizedCompsCount = 0;
      for (const c of compsToNormalize) {
        const expected = normalizeCategoryBackend(c.category_at_time);
        if (expected !== c.category_at_time) {
          await pool.query("UPDATE competitions SET category_at_time = $1 WHERE id = $2", [expected, c.id]);
          normalizedCompsCount++;
        }
      }
      if (normalizedCompsCount > 0) {
        console.log(`✅ Normalized ${normalizedCompsCount} competitions' category_at_time to standard E, 1*, 2*, 3*.`);
      }
    } catch (err) {
      console.error("❌ Error normalizing competitions' categories:", err);
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
            { it: "Gara in arrivo!", en: "Upcoming Event!" }, 
            { 
              it: `La gara "${event.name}" inizierà tra 2 giorni presso ${event.location}.`,
              en: `The event "${event.name}" will start in 2 days at ${event.location}.`
            }, 
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
          { it: "Com'è andata oggi?", en: "How did it go today?" }, 
          { 
            it: `Com'è andata oggi a ${names}? Inserisci il risultato per vedere come cambia la tua media!`,
            en: `How did it go today at ${names}? Enter your score to see how your average changes!`
          }, 
          `/history`,
          'all'
        );
      }
    } catch (err) {
      console.error("Error in cron job for competition reminders:", err);
    }
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

app.get('/api/app-version', (req, res) => {
  res.json({
    bootId: SERVER_BOOT_ID,
    buildHash: CLIENT_BUILD_HASH
  });
});

app.post('/api/coach/chat', authenticateToken, async (req: any, res) => {
  const { message, history, systemInstruction } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Messaggio mancante' });
  }

  try {
    const response = await callGeminiWithRetry(async (ai) => {
      const chat = ai.chats.create({
        model: "gemini-3.5-flash",
        config: {
          systemInstruction: systemInstruction,
        },
        history: history || []
      });
      return await chat.sendMessage({ message });
    });

    res.json({ text: response.text });
  } catch (err: any) {
    console.error('Coach API Error:', err);
    res.status(500).json({ error: `Errore del Coach: ${err.message}` });
  }
});

app.post('/api/ai/generate', authenticateToken, async (req: any, res) => {
  let { prompt, model = "gemini-3.5-flash" } = req.body;
  if (model === "gemini-1.5-flash" || model === "gemini-flash-latest") {
    model = "gemini-3.5-flash";
  }
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt mancante' });
  }

  try {
    const response = await callGeminiWithRetry(async (ai) => {
      return await ai.models.generateContent({
        model: model,
        contents: prompt
      });
    });

    res.json({ text: response.text });
  } catch (err: any) {
    console.error('AI Generate Error:', err);
    res.status(500).json({ error: `Errore AI: ${err.message}` });
  }
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
const sendPushNotification = async (
  userIds: (number | string)[], 
  title: string | { it: string, en: string }, 
  body: string | { it: string, en: string }, 
  url: string, 
  recipientType?: 'all' | 'society' | 'team',
  eventId?: string
) => {
  try {
    let resolvedEventId = eventId;
    if (!resolvedEventId && url) {
      const match = url.match(/[?&]id=([^&]+)/);
      if (match) {
        resolvedEventId = match[1];
      }
    }

    if (resolvedEventId) {
      const { rows: eventRows } = await pool.query("SELECT end_date FROM events WHERE id = $1", [resolvedEventId]);
      if (eventRows.length > 0) {
        const endDateStr = eventRows[0].end_date;
        if (endDateStr) {
          const dateMatch = endDateStr.match(/^(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            const endDateOnly = dateMatch[1];
            const todayStr = new Date().toISOString().split('T')[0];
            if (todayStr > endDateOnly) {
              console.log(`Skipping notification for event ${resolvedEventId} because its end date (${endDateOnly}) has passed (today: ${todayStr}).`);
              return;
            }
          }
        }
      }
    }

    // Get Admin ID and settings
    const { rows: adminRows } = await pool.query("SELECT id, language FROM users WHERE email = 'snecaj@gmail.com'");
    const adminId = adminRows[0]?.id;
    const adminLanguage = adminRows[0]?.language || 'it';

    if (!adminId) return;

    const { rows: settingsRows } = await pool.query("SELECT * FROM notification_settings WHERE user_id = $1", [adminId]);
    const settings = settingsRows[0] || { global_enabled: true, admin_notifications_enabled: false, muted_entities: [] };

    if (!settings.global_enabled) return;

    // Ensure all IDs are numbers and deduplicated
    const numericAdminId = Number(adminId);
    let numericUserIds = [...new Set(userIds.map(id => Number(id)).filter(id => !isNaN(id)))];

    if (settings.admin_notifications_enabled) {
      if (numericUserIds.length === 0 || recipientType === 'all') {
        if (!numericUserIds.includes(numericAdminId)) {
          numericUserIds.push(numericAdminId);
        }
      }
    }

    // 1. Fetch user languages and notification settings/counts in bulk
    if (numericUserIds.length === 0) return;

    const { rows: userDatas } = await pool.query(
      `SELECT u.id, u.language, ns.rate_limit, ns.global_enabled,
        (SELECT COUNT(*) FROM notifications n WHERE n.user_id = u.id AND DATE(n.created_at) = CURRENT_DATE) as today_count
       FROM users u
       LEFT JOIN notification_settings ns ON u.id = ns.user_id
       WHERE u.id = ANY($1)`,
      [numericUserIds]
    );

    const usersToNotify = userDatas.filter(u => {
      // Respect user's individual global toggle
      if (u.global_enabled === false) return false;
      
      const limit = u.rate_limit !== null ? u.rate_limit : settings.rate_limit;
      return parseInt(u.today_count) < (limit || 100);
    });

    if (usersToNotify.length === 0) return;

    // 2. Save notifications and prepare for push
    const notificationValues: string[] = [];
    const notificationParams: any[] = [];
    
    usersToNotify.forEach((userData, i) => {
      const lang = (userData.language || 'it') as 'it' | 'en';
      const resolvedTitle = typeof title === 'string' ? title : (title[lang] || title['it']);
      const resolvedBody = typeof body === 'string' ? body : (body[lang] || body['it']);
      
      const baseIdx = i * 4;
      notificationValues.push(`($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4})`);
      notificationParams.push(userData.id, resolvedTitle, resolvedBody, url);
    });

    if (notificationParams.length > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, body, url) VALUES ${notificationValues.join(', ')}`,
        notificationParams
      );
    }

    // Bulk fetch all subscriptions for the relevant users
    const { rows: allSubscriptions } = await pool.query(
      "SELECT * FROM push_subscriptions WHERE user_id = ANY($1)",
      [usersToNotify.map(u => u.id)]
    );

    const subscriptionsByUser: { [key: number]: any[] } = {};
    allSubscriptions.forEach(sub => {
      if (!subscriptionsByUser[sub.user_id]) subscriptionsByUser[sub.user_id] = [];
      subscriptionsByUser[sub.user_id].push(sub);
    });

    // 3. Prepare push promises
    const pushPromises: Promise<any>[] = [];

    for (const userData of usersToNotify) {
      const lang = (userData.language || 'it') as 'it' | 'en';
      const resolvedTitle = typeof title === 'string' ? title : (title[lang] || title['it']);
      const resolvedBody = typeof body === 'string' ? body : (body[lang] || body['it']);

      const userSubs = subscriptionsByUser[userData.id] || [];
      for (const sub of userSubs) {
        pushPromises.push(
          (async () => {
            try {
              const payload = JSON.stringify({ title: resolvedTitle, body: resolvedBody, url });
              if (typeof webpush !== 'undefined') {
                await webpush.sendNotification(sub.subscription, payload);
              }
            } catch (err: any) {
              if (err.statusCode === 404 || err.statusCode === 410) {
                await pool.query("DELETE FROM push_subscriptions WHERE id = $1", [sub.id]);
              }
            }
          })()
        );
      }
    }
    
    // Process all push notifications in parallel
    await Promise.all(pushPromises);
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
app.post('/api/auth/register', async (req, res) => {
  const { 
    name, surname, email, password, 
    birth_date, phone, 
    is_international, is_cacciatore, nationality, international_id, original_club,
    society, shooter_code, qualification, category,
    language
  } = req.body;

  try {
    let finalShooterCode = shooter_code;
    let finalSociety = society;
    let finalCategory = category;
    let finalQualification = qualification;

    if (!!is_cacciatore) {
      if (!finalShooterCode) {
        const rand = Math.round(100000 + Math.random() * 900000);
        finalShooterCode = `CAC-${rand}`;
      }
      if (!finalSociety) {
        finalSociety = 'Cacciatori';
      }
      if (!finalCategory) {
        finalCategory = 'Cacciatore';
      }
      if (!finalQualification) {
        finalQualification = 'Cacciatori';
      }
    }

    if (!finalShooterCode) {
      return res.status(400).json({ error: 'Il codice tiratore è obbligatorio.' });
    }

    // Check shooter_code uniqueness instead of email
    const { rows: existingByShooterCode } = await pool.query(
      "SELECT id FROM users WHERE LOWER(shooter_code) = LOWER($1)", 
      [finalShooterCode]
    );
    if (existingByShooterCode.length > 0) {
      return res.status(400).json({ error: 'Un account con questo codice tiratore esiste già.' });
    }

    const finalPassword = password || finalShooterCode;
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(finalPassword, salt);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const userLanguage = language || (!!is_international ? 'en' : 'it');
    
    if (!finalQualification && birth_date) {
        finalQualification = getAutoQualification(birth_date, null, name);
    }

    const resolvedSociety = !!is_international ? 'INTERNATIONAL SHOOTERS' : (finalSociety || null);
    const upperName = name ? name.toUpperCase().trim() : "";
    const upperSurname = surname ? surname.toUpperCase().trim() : "";
    const upperSociety = resolvedSociety ? resolvedSociety.toUpperCase().trim() : null;
    const upperOriginalClub = original_club ? original_club.toUpperCase().trim() : null;

    await pool.query(
      `INSERT INTO users (
        name, surname, email, password, role, 
        birth_date, phone, status, 
        is_international, is_cacciatore, nationality, international_id, original_club,
        society, shooter_code, qualification, category,
        verification_token, email_verified, language
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        upperName, upperSurname, email, hash, 'user', 
        birth_date || null, phone || null, 'active',
        !!is_international, !!is_cacciatore, nationality || null, international_id || null, upperOriginalClub,
        upperSociety, finalShooterCode || null, finalQualification || null, finalCategory || null,
        verificationToken, false, userLanguage
      ]
    );

    await sendVerificationEmail(email, upperName || 'Tiratore', verificationToken, req.get('host'), userLanguage);

    res.json({ success: true });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Errore durante la registrazione.' });
  }
});

app.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Token mancante.');

  try {
    const { rows } = await pool.query("SELECT id FROM users WHERE verification_token = $1", [token]);
    if (rows.length === 0) return res.status(400).send('Token non valido o scaduto.');

    await pool.query("UPDATE users SET email_verified = true, verification_token = NULL WHERE id = $1", [rows[0].id]);
    
    res.send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px; background-color: #0f172a; color: white; min-height: 100vh;">
        <h1 style="color: #ea580c; font-size: 48px; margin-bottom: 20px;">✓</h1>
        <h1 style="color: white; text-transform: uppercase;">Email Verificata!</h1>
        <p style="color: #94a3b8; margin-bottom: 30px;">Il tuo account è ora attivo. Puoi tornare all'app e procedere con il login.</p>
        <a href="/" style="display: inline-block; background-color: #ea580c; color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; letter-spacing: 1px;">ACCEDI ORA</a>
      </div>
    `);
  } catch (err) {
    res.status(500).send('Errore durante la verifica.');
  }
});

app.post('/api/auth/resend-verification', async (req, res) => {
  const { email } = req.body;
  console.log(`[DEBUG] Attempting to resend verification to: ${email}`);
  try {
    const { rows } = await pool.query("SELECT id, name, email_verified FROM users WHERE LOWER(email) = LOWER($1)", [email]);
    if (rows.length === 0) {
      console.log(`[DEBUG] User not found for email: ${email}`);
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    if (rows[0].email_verified) {
      console.log(`[DEBUG] Email already verified: ${email}`);
      return res.status(400).json({ error: 'Email già verificata' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    await pool.query("UPDATE users SET verification_token = $1 WHERE id = $2", [verificationToken, rows[0].id]);
    await sendVerificationEmail(email, rows[0].name, verificationToken, req.get('host'));
    console.log(`[DEBUG] Verification email successfully processed for: ${email}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[DEBUG] Error resending verification:`, err);
    res.status(500).json({ error: 'Errore durante l\'invio.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(`Login attempt for: ${email} on database: ${process.env.DATABASE_URL?.substring(0, 30)}...`);
  try {
    // Look up by either email OR shooter_code (which becomes the primary unique identifier)
    const { rows } = await pool.query(
      `SELECT u.*, s.region as society_region 
       FROM users u 
       LEFT JOIN societies s ON LOWER(TRIM(u.society)) = LOWER(TRIM(s.name)) OR LOWER(TRIM(u.society)) = LOWER(TRIM(s.code))
       WHERE LOWER(u.email) = LOWER($1) OR LOWER(u.shooter_code) = LOWER($1)`, 
      [email]
    );

    let user = null;
    if (rows.length === 1) {
      user = rows[0];
    } else if (rows.length > 1) {
      // Find the user whose password hash matches the given credentials
      for (const r of rows) {
        if (bcrypt.compareSync(password, r.password)) {
          user = r;
          break;
        }
      }
      // If none matches, fallback to the first one so we can show standard password error
      if (!user) {
        user = rows[0];
      }
    }

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

    // Verification check as a warning in UI rather than hard block
    /* Removed hard block to allow initial access for auto-generated accounts */
    /*
    if (!user.email_verified && user.role !== 'admin') {
      console.log(`Login blocked: Email not verified for ${email}`);
      return res.status(401).json({ 
        error: 'Email non verificata', 
        message: 'Devi verificare la tua email prima di poter accedere. Controlla la tua casella di posta o richiedi un nuovo invio.' 
      });
    }
    */

    console.log(`Login successful: ${email}`);
    // Update login count and last login
    await pool.query("UPDATE users SET login_count = login_count + 1, last_login = CURRENT_TIMESTAMP WHERE id = $1", [user.id]);
    await pool.query("INSERT INTO login_logs (user_id) VALUES ($1)", [user.id]);

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, society: user.society }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        surname: user.surname, 
        email: user.email, 
        role: user.role, 
        category: user.category, 
        qualification: user.qualification, 
        society: user.society, 
        society_region: user.society_region || null,
        shooter_code: user.shooter_code, 
        avatar: user.avatar, 
        birth_date: user.birth_date, 
        phone: user.phone,
        is_international: !!user.is_international,
        is_cacciatore: !!user.is_cacciatore,
        email_verified: !!user.email_verified,
        nationality: user.nationality,
        international_id: user.international_id,
        original_club: user.original_club,
        language: user.language,
        shotgun_brand: user.shotgun_brand,
        shotgun_model: user.shotgun_model,
        cartridge_brand: user.cartridge_brand,
        cartridge_model: user.cartridge_model,
        discipline_categories: user.discipline_categories
      } 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/user/profile', authenticateToken, async (req: any, res) => {
  try {
    const result = await pool.query(
      `SELECT u.*, s.region as society_region 
       FROM users u 
       LEFT JOIN societies s ON LOWER(TRIM(u.society)) = LOWER(TRIM(s.name)) OR LOWER(TRIM(u.society)) = LOWER(TRIM(s.code)) 
       WHERE u.id = $1`, 
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    const user = result.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      role: user.role,
      category: user.category,
      qualification: user.qualification,
      society: user.society,
      society_region: user.society_region || null,
      shooter_code: user.shooter_code,
      avatar: user.avatar,
      birth_date: user.birth_date,
      phone: user.phone,
      is_international: !!user.is_international,
      is_cacciatore: !!user.is_cacciatore,
      email_verified: !!user.email_verified,
      nationality: user.nationality,
      international_id: user.international_id,
      original_club: user.original_club,
      language: user.language,
      shotgun_brand: user.shotgun_brand,
      shotgun_model: user.shotgun_model,
      cartridge_brand: user.cartridge_brand,
      cartridge_model: user.cartridge_model,
      discipline_categories: user.discipline_categories
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

  app.put('/api/user/profile', authenticateToken, async (req: any, res) => {
  const { 
    name, surname, email, password, category, qualification, society, shooter_code, avatar, birth_date, phone,
    nationality, international_id, original_club, email_verified, language,
    shotgun_brand, shotgun_model, cartridge_brand, cartridge_model
  } = req.body;
  
  const finalQualification = getAutoQualification(birth_date, qualification, name);
  const upperName = name ? name.toUpperCase().trim() : "";
  const upperSurname = surname ? surname.toUpperCase().trim() : "";
  const upperSociety = society ? society.toUpperCase().trim() : null;
  const upperOriginalClub = original_club ? original_club.toUpperCase().trim() : null;

  try {
    const existingUserRes = await pool.query("SELECT email_verified FROM users WHERE id = $1", [req.user.id]);
    const currentEmailVerified = existingUserRes.rows[0]?.email_verified || false;
    const targetEmailVerified = email_verified !== undefined ? !!email_verified : currentEmailVerified;

    if (password) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      await pool.query(
        `UPDATE users SET 
          name = $1, surname = $2, email = $3, password = $4, category = $5, qualification = $6, 
          society = $7, shooter_code = $8, avatar = $9, birth_date = $10, phone = $11,
          nationality = $13, international_id = $14, original_club = $15,
          email_verified = $16, language = $17,
          shotgun_brand = $18, shotgun_model = $19, cartridge_brand = $20, cartridge_model = $21
        WHERE id = $12`,
        [
          upperName, upperSurname, email, hash, category, finalQualification, 
          upperSociety, shooter_code, avatar, birth_date || null, phone || null, 
          req.user.id,
          nationality || null, international_id || null, upperOriginalClub,
          targetEmailVerified, language || 'it',
          shotgun_brand || null, shotgun_model || null, cartridge_brand || null, cartridge_model || null
        ]
      );
    } else {
      await pool.query(
        `UPDATE users SET 
          name = $1, surname = $2, email = $3, category = $4, qualification = $5, 
          society = $6, shooter_code = $7, avatar = $8, birth_date = $9, phone = $10,
          nationality = $12, international_id = $13, original_club = $14,
          email_verified = $15, language = $16,
          shotgun_brand = $17, shotgun_model = $18, cartridge_brand = $19, cartridge_model = $20
        WHERE id = $11`,
        [
          upperName, upperSurname, email, category, finalQualification, 
          upperSociety, shooter_code, avatar, birth_date || null, phone || null, 
          req.user.id,
          nationality || null, international_id || null, upperOriginalClub,
          targetEmailVerified, language || 'it',
          shotgun_brand || null, shotgun_model || null, cartridge_brand || null, cartridge_model || null
        ]
      );
    }
    res.json({ success: true });
  } catch (_) {
    res.status(400).json({ error: 'Email already in use or other error' });
  }
});

app.put('/api/admin/events/:id/toggle-management', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    // Check ownership if not admin
    if (req.user.role !== 'admin') {
      const { rows: eventSearch } = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
      if (eventSearch.length === 0) {
        return res.status(404).json({ error: 'Evento non trovato' });
      }
      const event = eventSearch[0];
      
      const { rows: userSearch } = await pool.query('SELECT society FROM users WHERE id = $1', [req.user.id]);
      const userSociety = userSearch[0]?.society;

      if (!userSociety || userSociety !== event.location) {
        return res.status(403).json({ error: 'Non autorizzato a gestire questa gara' });
      }
    }

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

          // Fire and forget combined push notification
          sendPushNotification(
            recipientIds,
            { it: "Iscrizioni Aperte!", en: "Registration Open!" },
            { 
              it: body,
              en: `Registration for the competition "${event.name}" at ${event.location} is now open! Register now!`
            },
            `/gare?id=${event.id}`,
            'all',
            event.id
          ).catch(e => console.error("Error sending registration notification:", e));
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

app.get('/api/notification-settings', authenticateToken, async (req: any, res) => {
  try {
    const { rows } = await pool.query("SELECT global_enabled, rate_limit, templates, muted_entities FROM notification_settings WHERE user_id = $1", [req.user.id]);
    if (rows.length === 0) {
      const { rows: newRows } = await pool.query(
        "INSERT INTO notification_settings (user_id) VALUES ($1) RETURNING global_enabled, rate_limit, templates, muted_entities",
        [req.user.id]
      );
      return res.json(newRows[0]);
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching notification settings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/notification-settings', authenticateToken, async (req: any, res) => {
  try {
    const { global_enabled, muted_entities } = req.body;
    
    await pool.query(`
      INSERT INTO notification_settings 
        (user_id, global_enabled, muted_entities, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        global_enabled = EXCLUDED.global_enabled,
        muted_entities = EXCLUDED.muted_entities,
        updated_at = CURRENT_TIMESTAMP
    `, [req.user.id, global_enabled, JSON.stringify(muted_entities || [])]);

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating notification settings:', err);
    res.status(500).json({ error: 'Internal server error' });
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
    const societyFilter = req.query.society as string;
    
    let query = "SELECT id, name, surname, email, role, category, qualification, society, shooter_code, avatar, birth_date, phone, status, login_count, last_login, created_at, email_verified, is_international, is_cacciatore, nationality, international_id, original_club, shotgun_brand, shotgun_model, cartridge_brand, cartridge_model, discipline_categories FROM users";
    let countQuery = "SELECT COUNT(*) FROM users";
    let params: any[] = [];
    let whereClauses: string[] = [];
    
    if (req.user.role !== 'admin') {
      whereClauses.push("LOWER(society) != LOWER('International Shooters')");
    }

    if (req.user.role === 'society') {
      if (req.query.all === 'true') {
        // When searching for all shooters (e.g. for event registration or results),
        // include all users and admins regardless of society
        whereClauses.push("role IN ('user', 'admin')");
      } else {
        // In standard lists (like "Gestione Tiratori"), only show users and admins 
        // that belong to the requester's society
        whereClauses.push("role IN ('user', 'admin') AND society = $" + (params.length + 1));
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

    if (societyFilter) {
      whereClauses.push("LOWER(society) LIKE $" + (params.length + 1));
      params.push("%" + societyFilter.toLowerCase() + "%");
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
  const { 
    name, surname, email, password, role, category, qualification, society, shooter_code, avatar, birth_date, phone,
    is_international, is_cacciatore, nationality, international_id, original_club, email_verified,
    shotgun_brand, shotgun_model, cartridge_brand, cartridge_model, discipline_categories
  } = req.body;
  
  let finalShooterCode = shooter_code;
  let finalSociety = society ? society.toUpperCase().trim() : null;
  let finalCategory = category;
  let finalQualification = getAutoQualification(birth_date, qualification, name);

  if (!!is_cacciatore) {
    if (!finalShooterCode) {
      const rand = Math.round(100000 + Math.random() * 900000);
      finalShooterCode = `CAC-${rand}`;
    }
    if (!finalSociety) {
      finalSociety = 'CACCIATORI';
    }
    if (!finalCategory) {
      finalCategory = 'Cacciatore';
    }
    if (!finalQualification) {
      finalQualification = 'Cacciatori';
    }
  }

  const finalRole = role || 'user';
  if ((finalRole === 'user' || finalRole === 'society') && !finalShooterCode) {
    return res.status(400).json({ error: 'Il campo codice tiratore/codice società è obbligatorio.' });
  }

  if (req.user.role === 'society') {
    if (role && role !== 'user') {
      return res.status(403).json({ error: 'Le società possono creare solo tiratori' });
    }
  }

  // Enforce unique shooter_code on creation if provided
  if (finalShooterCode) {
    try {
      const { rows: existingByCode } = await pool.query(
        "SELECT id FROM users WHERE LOWER(shooter_code) = LOWER($1)",
        [finalShooterCode]
      );
      if (existingByCode.length > 0) {
        return res.status(400).json({ error: 'Un utente con questo codice tiratore/società esiste già.' });
      }
    } catch {
      // Ignore database temporary check errors
    }
  }

  const actualPassword = password || finalShooterCode || 'ClayTracker123!';
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(actualPassword, salt);

  const upperName = name ? name.toUpperCase().trim() : "";
  const upperSurname = surname ? surname.toUpperCase().trim() : "";
  const upperOriginalClub = original_club ? original_club.toUpperCase().trim() : null;

  try {
    const { rows } = await pool.query(
      "INSERT INTO users (name, surname, email, password, role, category, qualification, society, shooter_code, avatar, birth_date, phone, status, is_international, is_cacciatore, nationality, international_id, original_club, email_verified, shotgun_brand, shotgun_model, cartridge_brand, cartridge_model, discipline_categories) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24) RETURNING id",
      [
        upperName, upperSurname, email, hash, finalRole, finalCategory, finalQualification, finalSociety, finalShooterCode, avatar || null, birth_date || null, phone || null, 'active',
        !!is_international, !!is_cacciatore, nationality || null, international_id || null, upperOriginalClub, !!email_verified,
        shotgun_brand || null, shotgun_model || null, cartridge_brand || null, cartridge_model || null, discipline_categories || null
      ]
    );
    
    // Notify Admin about new user
    const newUserId = rows[0].id;
    const creatorNameObj = req.user.role === 'society' 
      ? { it: `la società ${req.user.society}`, en: `the society ${req.user.society}` }
      : { it: "l'amministratore", en: "the administrator" };

    sendPushNotification([], 
      { it: "Nuovo Utente Registrato", en: "New User Registered" },
      { 
        it: `È stato aggiunto un nuovo tiratore: ${upperName} ${upperSurname} da parte di ${creatorNameObj.it}.`,
        en: `A new shooter has been added: ${upperName} ${upperSurname} by ${creatorNameObj.en}.`
      }, 
      `/admin?tab=users`
    );

    res.json({ 
      id: newUserId, name: upperName, surname: upperSurname, email, role: role || 'user', category: finalCategory, qualification: finalQualification, society: finalSociety, shooter_code: finalShooterCode, avatar, birth_date, phone, status: 'active',
      shotgun_brand, shotgun_model, cartridge_brand, cartridge_model, discipline_categories
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/users/import/validate', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  const { users } = req.body;
  if (!Array.isArray(users)) return res.status(400).json({ error: 'Formato dati non valido' });

  const client = await pool.connect();
  try {
    const validatedUsers = [];
    // Cache societies for faster lookup
    const { rows: societies } = await client.query("SELECT name, code FROM societies");
    const societyMap = new Map(societies.map(s => [s.code?.toLowerCase(), s.name]));

    for (const u of users) {
      if (!u.shooter_code) {
        validatedUsers.push({
          user: u,
          state: 'error',
          reason: 'Codice Tiratore mancante'
        });
        continue;
      }

      if (!u.email) {
        // Automatically generate standard email
        const cleanName = (u.name || 'user').toLowerCase().replace(/\s+/g, '').replace(/[\s']/g, '');
        const cleanSurname = (u.surname || 'surname').toLowerCase().replace(/\s+/g, '').replace(/[\s']/g, '');
        u.email = `${cleanName}.${cleanSurname}@gmail.com`;
      }

      try {
        let societyName = u.society;
        if (societyName) {
          const checkCode = societyMap.get(societyName.toString().trim().toLowerCase());
          if (checkCode) {
            societyName = checkCode;
          }
        }
        if (u.society_code) {
          const foundName = societyMap.get(u.society_code.toString().toLowerCase());
          if (foundName) societyName = foundName;
        }

        if (req.user.role === 'society') {
          societyName = req.user.society;
        }

        const finalQual = getAutoQualification(u.birth_date, u.qualification, u.name);

        // Cerchiamo corrispondenza per email nel database dei nostri utenti
        const { rows: matchesByEmail } = await client.query("SELECT * FROM users WHERE email = $1", [u.email]);
        
        // Cerchiamo corrispondenza per codice tiratore (se presente nell'import)
        let matchesByCode: any[] = [];
        if (u.shooter_code) {
          const { rows } = await client.query("SELECT * FROM users WHERE shooter_code = $1", [u.shooter_code]);
          matchesByCode = rows;
        }

        // 1. Stesso codice tiratore -> Identità certa, è lo stesso utente.
        if (matchesByCode.length > 0) {
          const existing = matchesByCode[0];
          const needsLadyUpgrade = (finalQual === 'LAD' && existing.qualification !== 'LAD');
          const msg = needsLadyUpgrade 
            ? `Tiratore esistente (${u.shooter_code}). Profilo salvaguardato, verrà aggiornata solo la qualifica Lady.`
            : `Tiratore esistente (${u.shooter_code}). Profilo salvaguardato (nessuna modifica).`;
          validatedUsers.push({
            user: {
              ...existing,
              qualification: needsLadyUpgrade ? 'LAD' : existing.qualification
            },
            existing: { 
              id: existing.id, 
              name: existing.name, 
              surname: existing.surname, 
              email: existing.email, 
              role: existing.role,
              category: existing.category,
              qualification: existing.qualification,
              society: existing.society,
              shooter_code: existing.shooter_code, 
              birth_date: existing.birth_date, 
              phone: existing.phone 
            },
            state: 'update',
            method: 'code',
            message: msg
          });
        }
        // 2. Stessa email ma codice tiratore assente o diverso -> Conflitto di omonimia potenziale!
        else if (matchesByEmail.length > 0) {
          const existing = matchesByEmail[0];
          
          if (existing.shooter_code && u.shooter_code && existing.shooter_code !== u.shooter_code) {
            // Entrambi hanno codice tiratore ed essi DIFFERISCONO. Omonimia certa!
            validatedUsers.push({
              user: { ...u, society: societyName, qualification: finalQual },
              existing: { 
                id: existing.id, 
                name: existing.name, 
                surname: existing.surname, 
                email: existing.email, 
                role: existing.role,
                category: existing.category,
                qualification: existing.qualification,
                society: existing.society,
                shooter_code: existing.shooter_code, 
                birth_date: existing.birth_date, 
                phone: existing.phone 
              },
              state: 'conflict_omonimia',
              method: 'email',
              message: `Conflitto: l'email '${u.email}' appartiene a ${existing.name} ${existing.surname} (Codice: ${existing.shooter_code}), ma il tiratore caricato ha codice differente (${u.shooter_code}).`
            });
          } else {
            // Uno o entrambi non hanno codice tiratore. Potrebbero essere omonimi o la stessa persona.
            // Consentiamo la scelta interattiva per sicurezza.
            validatedUsers.push({
              user: { ...u, society: societyName, qualification: finalQual },
              existing: { 
                id: existing.id, 
                name: existing.name, 
                surname: existing.surname, 
                email: existing.email, 
                role: existing.role,
                category: existing.category,
                qualification: existing.qualification,
                society: existing.society,
                shooter_code: existing.shooter_code, 
                birth_date: existing.birth_date, 
                phone: existing.phone 
              },
              state: 'conflict_omonimia',
              method: 'email',
              message: `L'email '${u.email}' è già presente nel server (associata a ${existing.name} ${existing.surname}). Confermi l'aggiornamento o vuoi registrare un nuovo account diverso?`
            });
          }
        }
        // 3. Nuovo utente
        else {
          validatedUsers.push({
            user: { ...u, society: societyName, qualification: finalQual },
            state: 'create',
            message: 'Nuovo utente'
          });
        }

      } catch (err: any) {
        validatedUsers.push({
          user: u,
          state: 'error',
          reason: err.message
        });
      }
    }

    res.json(validatedUsers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post('/api/admin/users/update-categories', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  const { users } = req.body;
  if (!Array.isArray(users)) return res.status(400).json({ error: 'Invalid data format' });

  const results = { updated: 0, errors: 0, missing: 0 };
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const u of users) {
      if (!u.shooter_code) {
        results.errors++;
        continue;
      }

      const { rows } = await client.query("SELECT id FROM users WHERE LOWER(shooter_code) = LOWER($1)", [u.shooter_code]);
      if (rows.length === 0) {
        results.missing++;
        continue;
      }

      await client.query("UPDATE users SET discipline_categories = $1 WHERE id = $2", [u.discipline_categories, rows[0].id]);
      results.updated++;
    }

    await client.query('COMMIT');
    res.json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating categories:', err);
    res.status(500).json({ error: 'Failed to update categories' });
  } finally {
    client.release();
  }
});

app.post('/api/admin/users/import', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  const { users } = req.body;
  if (!Array.isArray(users)) return res.status(400).json({ error: 'Invalid data format' });

  const results = { created: 0, updated: 0, errors: 0 };
  const updatedDetails: any[] = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    // Cache societies for faster lookup
    const { rows: societies } = await client.query("SELECT name, code FROM societies");
    const societyMap = new Map(societies.map(s => [s.code?.toLowerCase(), s.name]));

    for (const item of users) {
      let isRichFormat = false;
      let action: 'create' | 'update' = 'create';
      let existingUserId: number | null = null;
      let u: any = {};

      if (item && item.action && item.data) {
        isRichFormat = true;
        action = item.action;
        existingUserId = item.existingUserId || null;
        u = item.data;
      } else {
        u = item;
      }

      if (u.name) u.name = u.name.toUpperCase().trim();
      if (u.surname) u.surname = u.surname.toUpperCase().trim();
      if (u.society) u.society = u.society.toUpperCase().trim();
      if (u.original_club) u.original_club = u.original_club.toUpperCase().trim();

      if (!u.shooter_code) {
        results.errors++;
        continue;
      }

      if (!u.email) {
        const cleanName = (u.name || 'user').toLowerCase().replace(/\s+/g, '').replace(/[\s']/g, '');
        const cleanSurname = (u.surname || 'surname').toLowerCase().replace(/\s+/g, '').replace(/[\s']/g, '');
        u.email = `${cleanName}.${cleanSurname}@gmail.com`;
      }

      try {
        let societyName = u.society;
        if (societyName) {
          const checkCode = societyMap.get(societyName.toString().trim().toLowerCase());
          if (checkCode) {
            societyName = checkCode;
          }
        }
        if (u.society_code) {
          const foundName = societyMap.get(u.society_code.toString().toLowerCase());
          if (foundName) societyName = foundName;
        }

        // If society is importing, force their own society
        if (req.user.role === 'society') {
          societyName = req.user.society;
        }

        const finalQual = getAutoQualification(u.birth_date, u.qualification, u.name);

        let existingUserObj: any = null;
        let matchedByShooterCode = false;
        if (isRichFormat) {
          if (action === 'update' && existingUserId) {
            const { rows } = await client.query("SELECT * FROM users WHERE id = $1", [existingUserId]);
            if (rows.length > 0) {
              existingUserObj = rows[0];
              if (existingUserObj.shooter_code) {
                matchedByShooterCode = true;
              }
            }
          }
          // Se action === 'create', existingUserObj rimarrà null per consentire la creazione di un nuovo utente sdoppiato
        } else {
          // Se non è formato rich (import diretto), cerchiamo corrispondenze per codice o e-mail
          if (u.shooter_code) {
            const { rows } = await client.query("SELECT * FROM users WHERE LOWER(shooter_code) = LOWER($1)", [u.shooter_code]);
            if (rows.length > 0) {
              existingUserObj = rows[0];
              matchedByShooterCode = true;
            }
          }
          if (!existingUserObj && u.email) {
            const { rows } = await client.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [u.email]);
            if (rows.length > 0) existingUserObj = rows[0];
          }
        }

        if (existingUserObj) {
          const old = existingUserObj;

          // If the user already exists (matched by shooter_code), skip profile replacement to avoid losing
          // any custom changes, except that we allow updating qualification to 'LAD' if they match female names
          if (matchedByShooterCode) {
            const needsLadyUpgrade = (finalQual === 'LAD' && old.qualification !== 'LAD');
            if (needsLadyUpgrade) {
              await client.query("UPDATE users SET qualification = 'LAD' WHERE id = $1", [old.id]);
              results.updated++;
              updatedDetails.push({
                name: old.name,
                surname: old.surname,
                email: old.email,
                changes: [`Qualifica: '${old.qualification || "Nessuna"}' ➔ 'LAD' (Lady auto-aggiornamento)`]
              });
            } else {
              updatedDetails.push({
                name: old.name,
                surname: old.surname,
                email: old.email,
                changes: ["Profilo già esistente salvaguardato (nessuna modifica)"]
              });
            }
            continue; // Proceed to next import item
          }
          
          // Verifica se la password è stata cambiata rispetto al default iniziale impostato
          // (ovvero se la password NON coincide con il codice tiratore, 'ClayTracker123!', o 'Password123!')
          let hasChangedPassword = false;
          if (old.password) {
            const matchesCode = old.shooter_code ? bcrypt.compareSync(old.shooter_code, old.password) : false;
            const matchesDefaultSec = bcrypt.compareSync('ClayTracker123!', old.password);
            const matchesDefaultSec2 = bcrypt.compareSync('Password123!', old.password);
            if (!matchesCode && !matchesDefaultSec && !matchesDefaultSec2) {
              hasChangedPassword = true;
            }
          }

          // Verifica se l'email è stata già modificata/personalizzata dall'utente
          // (se è diversa dal formato predefinito nome.cognome@gmail.com o è già stata verificata)
          const cleanName = (old.name || 'user').toLowerCase().replace(/\s+/g, '').replace(/[\s']/g, '');
          const cleanSurname = (old.surname || 'surname').toLowerCase().replace(/\s+/g, '').replace(/[\s']/g, '');
          const defaultEmail = `${cleanName}.${cleanSurname}@gmail.com`;

          let hasChangedEmail = false;
          if (old.email && old.email.toLowerCase() !== defaultEmail.toLowerCase()) {
            hasChangedEmail = true;
          }
          if (old.email_verified) {
            hasChangedEmail = true;
          }

          // Regola: Se questi campi sono stati cambiati dal tiratore allora non toccarli. 
          // Se invece il campo password è vuoto [o non cambiato] e l'email è uguale allora procediamo con l'aggiornamento con le regole attuali.
          let targetEmail = old.email;
          let targetPassword = old.password;

          if (matchedByShooterCode) {
            // Se l'utente è stato riconosciuto tramite codice tiratore, non modifichiamo mai email e password
            // per evitare di sovrascrivere o resettare le credenziali che potrebbe aver cambiato o personalizzato.
          } else {
            if (!hasChangedEmail && u.email && u.email !== old.email) {
              targetEmail = u.email;
            }

            if (!hasChangedPassword && u.password) {
              const salt = bcrypt.genSaltSync(10);
              targetPassword = bcrypt.hashSync(u.password, salt);
            }
          }

          // Track detailed changes
          const changes: string[] = [];
          
          if (u.name && u.name !== old.name) {
            changes.push(`Nome: '${old.name || ""}' ➔ '${u.name}'`);
          }
          if (u.surname && u.surname !== old.surname) {
            changes.push(`Cognome: '${old.surname || ""}' ➔ '${u.surname}'`);
          }
          if (u.category && u.category !== old.category) {
            changes.push(`Categoria: '${old.category || "Nessuna"}' ➔ '${u.category}'`);
          }
          if (finalQual && finalQual !== old.qualification) {
            changes.push(`Qualifica: '${old.qualification || "Nessuna"}' ➔ '${finalQual}'`);
          }
          if (societyName && societyName !== old.society) {
            changes.push(`Società: '${old.society || "Nessuna"}' ➔ '${societyName}'`);
          }
          if (u.shooter_code !== undefined && u.shooter_code !== null && u.shooter_code !== old.shooter_code) {
            changes.push(`Codice Tiratore: '${old.shooter_code || "Nessuno"}' ➔ '${u.shooter_code}'`);
          }
          if (u.phone !== undefined && u.phone !== null && u.phone !== old.phone) {
            changes.push(`Telefono: '${old.phone || "Nessuno"}' ➔ '${u.phone}'`);
          }
          if (targetEmail !== old.email) {
            changes.push(`Email: '${old.email}' ➔ '${targetEmail}'`);
          }
          if (targetPassword !== old.password) {
            changes.push(`Password agganciata o aggiornata`);
          }
          if (u.discipline_categories !== undefined && u.discipline_categories !== null && u.discipline_categories !== old.discipline_categories) {
            changes.push(`Discipline Categories: '${old.discipline_categories || "Nessuna"}' ➔ '${u.discipline_categories}'`);
          }
          if (u.birth_date) {
            try {
              const oldBirth = old.birth_date ? new Date(old.birth_date).toISOString().split('T')[0] : '';
              const newBirth = new Date(u.birth_date).toISOString().split('T')[0];
              if (oldBirth !== newBirth) {
                changes.push(`Data di Nascita: '${oldBirth || "Nessuna"}' ➔ '${newBirth}'`);
              }
            } catch (e) {
              // ignore date parsing error in comparison
            }
          }

          // Update profile, including email/password conditionally matching our target variables
          await client.query(
            "UPDATE users SET name = $1, surname = $2, category = $3, qualification = $4, society = $5, shooter_code = $6, birth_date = $7, phone = $8, is_international = $9, nationality = $10, international_id = $11, original_club = $12, email_verified = $13, email = $14, password = $15, discipline_categories = $16 WHERE id = $17",
            [
              u.name || old.name, u.surname || old.surname, u.category || old.category, finalQual || old.qualification, societyName || old.society, 
              u.shooter_code !== undefined ? u.shooter_code : old.shooter_code, 
              u.birth_date || old.birth_date, u.phone !== undefined ? u.phone : old.phone,
              u.is_international !== undefined ? !!u.is_international : !!old.is_international, 
              u.nationality !== undefined ? u.nationality : old.nationality, 
              u.international_id !== undefined ? u.international_id : old.international_id, 
              u.original_club !== undefined ? u.original_club : old.original_club, 
              u.email_verified !== undefined ? !!u.email_verified : !!old.email_verified,
              targetEmail,
              targetPassword,
              u.discipline_categories !== undefined ? u.discipline_categories : old.discipline_categories,
              old.id
            ]
          );
          results.updated++;
          updatedDetails.push({
            name: u.name || old.name,
            surname: u.surname || old.surname,
            email: targetEmail,
            changes: changes.length > 0 ? changes : ["Dati personali riallineati"]
          });
        } else {
          // Create new
          const salt = bcrypt.genSaltSync(10);
          const hash = bcrypt.hashSync(u.password || u.shooter_code || 'Password123!', salt);
          await client.query(
            "INSERT INTO users (name, surname, email, password, role, category, qualification, society, shooter_code, birth_date, phone, status, is_international, nationality, international_id, original_club, email_verified, discipline_categories) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12, $13, $14, $15, $16, $17)",
            [
              u.name, u.surname, u.email, hash, u.role || 'user', u.category, finalQual, societyName, u.shooter_code, u.birth_date || null, u.phone || null,
              !!u.is_international, u.nationality || null, u.international_id || null, u.original_club || null, !!u.email_verified,
              u.discipline_categories || null
            ]
          );
          results.created++;
        }
      } catch (err) {
        console.error('Error importing user:', u.email, err);
        results.errors++;
      }
    }
    
    await client.query('COMMIT');
    res.json({
      created: results.created,
      updated: results.updated,
      errors: results.errors,
      updatedDetails
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.put('/api/admin/users/:id', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  const { 
    name, surname, email, role, password, category, qualification, society, shooter_code, avatar, birth_date, phone, status,
    is_international, is_cacciatore, nationality, international_id, original_club, email_verified, language,
    shotgun_brand, shotgun_model, cartridge_brand, cartridge_model, discipline_categories
  } = req.body;
  
  const finalQualification = getAutoQualification(birth_date, qualification, name);

  const finalRole = role || 'user';
  if ((finalRole === 'user' || finalRole === 'society') && !shooter_code) {
    return res.status(400).json({ error: 'Il campo codice tiratore/codice società è obbligatorio.' });
  }

  // Enforce unique shooter_code on update if provided
  if (shooter_code) {
    try {
      const { rows: existingWithCode } = await pool.query(
        "SELECT id FROM users WHERE LOWER(shooter_code) = LOWER($1) AND id <> $2",
        [shooter_code, req.params.id]
      );
      if (existingWithCode.length > 0) {
        return res.status(400).json({ error: 'Un utente con questo codice tiratore/società esiste già.' });
      }
    } catch {
      // Ignore database errors
    }
  }

  const upperName = name ? name.toUpperCase().trim() : "";
  const upperSurname = surname ? surname.toUpperCase().trim() : "";
  const upperSociety = society ? society.toUpperCase().trim() : null;
  const upperOriginalClub = original_club ? original_club.toUpperCase().trim() : null;

  try {
    const userCheck = await pool.query("SELECT role, society, email_verified FROM users WHERE id = $1", [req.params.id]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const targetEmailVerified = email_verified !== undefined ? !!email_verified : userCheck.rows[0].email_verified;

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
        "UPDATE users SET name = $1, surname = $2, email = $3, role = $4, password = $5, category = $6, qualification = $7, society = $8, shooter_code = $9, avatar = $10, birth_date = $11, phone = $12, status = $13, is_international = $14, is_cacciatore = $25, nationality = $15, international_id = $16, original_club = $17, email_verified = $18, language = $20, shotgun_brand = $21, shotgun_model = $22, cartridge_brand = $23, cartridge_model = $24, discipline_categories = $26 WHERE id = $19",
        [
          upperName, upperSurname, email, role, hash, category, finalQualification, upperSociety, shooter_code, avatar || null, birth_date || null, phone || null, status || 'active',
          !!is_international, nationality || null, international_id || null, upperOriginalClub, targetEmailVerified,
          req.params.id, language || 'it',
          shotgun_brand || null, shotgun_model || null, cartridge_brand || null, cartridge_model || null,
          !!is_cacciatore, discipline_categories || null
        ]
      );
    } else {
      await pool.query(
        "UPDATE users SET name = $1, surname = $2, email = $3, role = $4, category = $5, qualification = $6, society = $7, shooter_code = $8, avatar = $9, birth_date = $10, phone = $11, status = $12, is_international = $13, is_cacciatore = $24, nationality = $14, international_id = $15, original_club = $16, email_verified = $17, language = $19, shotgun_brand = $20, shotgun_model = $21, cartridge_brand = $22, cartridge_model = $23, discipline_categories = $25 WHERE id = $18",
        [
          upperName, upperSurname, email, role, category, finalQualification, upperSociety, shooter_code, avatar || null, birth_date || null, phone || null, status || 'active',
          !!is_international, nationality || null, international_id || null, upperOriginalClub, targetEmailVerified,
          req.params.id, language || 'it',
          shotgun_brand || null, shotgun_model || null, cartridge_brand || null, cartridge_model || null,
          !!is_cacciatore, discipline_categories || null
        ]
      );
    }
    
    // Notify Admin if a society modifies a user
    if (req.user.role === 'society') {
      sendPushNotification([], 
        { it: "Utente Modificato", en: "User Modified" },
        { 
          it: `La società ${req.user.society} ha modificato i dati dell'utente: ${upperName} ${upperSurname}.`,
          en: `The society ${req.user.society} has modified the following user: ${upperName} ${upperSurname}.`
        }, 
        `/admin?tab=users`
      );
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

app.post('/api/admin/users/bulk-delete', authenticateToken, requireAdminOrSociety, async (req: any, res) => {
  try {
    if (req.user.role === 'society') {
      return res.status(403).json({ error: 'Solo l\'amministratore può eliminare gli utenti' });
    }
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Nessun identificativo fornito' });
    }
    
    // Filtriamo per non cancellare l'admin principale
    const { rows: protectedUsers } = await pool.query(
      "SELECT id FROM users WHERE email = 'snecaj@gmail.com' AND id = ANY($1)",
      [ids]
    );
    const protectedIds = protectedUsers.map((u: any) => u.id);
    const targetIds = ids.filter(id => !protectedIds.includes(Number(id)));
    
    if (targetIds.length === 0) {
      return res.json({ success: true, count: 0 });
    }
    
    await pool.query("DELETE FROM users WHERE id = ANY($1)", [targetIds]);
    res.json({ success: true, count: targetIds.length });
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
app.get('/api/societies', authenticateToken, async (req: any, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    let query = `
      SELECT s.*, 
             EXISTS(SELECT 1 FROM users u WHERE u.role = 'society' AND u.society = s.name) as has_account
      FROM societies s 
    `;
    
    if (!isAdmin) {
      query += ` WHERE s.name != 'International Shooters' `;
    }
    
    query += ` ORDER BY s.name ASC `;
    
    const { rows } = await pool.query(query);
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

  const upperName = name ? name.toUpperCase().trim() : "";

  try {
    const { rows } = await pool.query(
      "INSERT INTO societies (name, code, email, address, city, region, zip_code, phone, mobile, website, contact_name, logo, opening_hours, disciplines, lat, lng, google_maps_link) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id",
      [upperName, code, email || null, address, city, region, zip_code, phone, mobile, website, contact_name, logo || null, opening_hours || null, disciplines || null, lat || null, lng || null, google_maps_link || null]
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

  const upperName = name ? name.toUpperCase().trim() : "";

  try {
    if (req.user.role === 'society') {
      const { rows } = await pool.query("SELECT name FROM societies WHERE id = $1", [req.params.id]);
      if (rows.length === 0 || rows[0].name !== req.user.society) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (upperName !== req.user.society) {
        return res.status(403).json({ error: 'Cannot change society name' });
      }
    }

    await pool.query(
      "UPDATE societies SET name = $1, code = $2, email = $3, address = $4, city = $5, region = $6, zip_code = $7, phone = $8, mobile = $9, website = $10, contact_name = $11, logo = $12, opening_hours = $13, disciplines = $14, lat = $15, lng = $16, google_maps_link = $17 WHERE id = $18",
      [upperName, code, email || null, address, city, region, zip_code, phone, mobile, website, contact_name, logo || null, opening_hours || null, disciplines || null, lat || null, lng || null, google_maps_link || null, req.params.id]
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

app.post('/api/admin/societies/import', authenticateToken, requireAdmin, async (req: any, res) => {
  const { societies } = req.body;
  if (!Array.isArray(societies)) return res.status(400).json({ error: 'Invalid data format' });

  const results = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    for (const s of societies) {
      if (!s.name || !s.code) {
        results.errors++;
        continue;
      }

      s.name = s.name.toUpperCase().trim();

      try {
        // Find society by code
        const { rows: existing } = await client.query(
          "SELECT * FROM societies WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))", 
          [s.code]
        );
        
        if (existing.length > 0) {
          const e = existing[0];
          const updateFields = [];
          const updateParams = [];
          
          const fieldsMap = [
            { key: 'name', val: s.name },
            { key: 'email', val: s.email },
            { key: 'website', val: s.website },
            { key: 'address', val: s.address },
            { key: 'city', val: s.city },
            { key: 'region', val: s.region },
            { key: 'zip_code', val: s.zip || s.zip_code },
            { key: 'phone', val: s.phone },
            { key: 'mobile', val: s.mobile },
            { key: 'disciplines', val: s.disciplines },
            { key: 'lat', val: s.lat },
            { key: 'lng', val: s.lng }
          ];

          for (const field of fieldsMap) {
            const dbVal = e[field.key];
            const newVal = field.val;
            // Update only if database value is null or empty, and new value is provided
            if ((dbVal === null || String(dbVal).trim() === '') && newVal !== undefined && newVal !== null && String(newVal).trim() !== '') {
              updateFields.push(`${field.key} = $${updateParams.length + 1}`);
              updateParams.push(newVal);
            }
          }

          if (updateFields.length > 0) {
            updateParams.push(e.id);
            await client.query(
              `UPDATE societies SET ${updateFields.join(', ')} WHERE id = $${updateParams.length}`,
              updateParams
            );
            results.updated++;
          } else {
            results.skipped++;
          }
        } else {
          // Create new if not found by code
          await client.query(
            "INSERT INTO societies (name, code, email, website, address, city, region, zip_code, phone, mobile, disciplines, lat, lng) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
            [
              s.name, s.code, s.email || null, s.website || null, s.address || null, 
              s.city || null, s.region || null, s.zip || s.zip_code || null, s.phone || null, 
              s.mobile || null, s.disciplines || null, 
              s.lat ? parseFloat(s.lat) : null, s.lng ? parseFloat(s.lng) : null
            ]
          );
          results.created++;
        }
      } catch (err) {
        console.error('Error importing society:', s.name, err);
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

app.post('/api/admin/societies/update-codes', authenticateToken, requireAdmin, async (req: any, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'Invalid data format' });

  const results = { updated: 0, skipped: 0, errors: 0 };
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    for (const u of updates) {
      if (!u.name || !u.code) {
        results.errors++;
        continue;
      }

      try {
        const { rowCount } = await client.query(
          "UPDATE societies SET code = $1 WHERE LOWER(TRIM(name)) = LOWER(TRIM($2)) AND (code IS NULL OR code = '')",
          [u.code, u.name]
        );
        
        if (rowCount > 0) {
          results.updated++;
        } else {
          // Check if it already has the same code or name doesn't exist or already has a different code
          results.skipped++;
        }
      } catch (err) {
        console.error('Error updating society code:', u.name, err);
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
        sendPushNotification(userIds, 
          { it: "Nuova Sfida!", en: "New Challenge!" },
          { 
            it: `${name} - ${prize}`,
            en: `${name} - ${prize}`
          }, 
          `/challenges`, 
          'society'
        );
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
    const { rows: challengeRows } = await pool.query("SELECT society_id, name FROM challenges WHERE id = $1", [req.params.id]);
    if (challengeRows.length === 0) return res.status(404).json({ error: 'Sfida non trovata' });

    const notificationName = name || challengeRows[0].name;

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
    await sendAdminCompactNotification('sfida', notificationName, 'aggiornata', 'Gara di Società', societyName, from);

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

// Friendly Challenges ("Sfide tra Amici") Routes
app.get('/api/shooters-list', authenticateToken, async (req: any, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, surname, category, qualification, society, shooter_code, email FROM users WHERE role != 'society' ORDER BY surname, name"
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/friendly-challenges', authenticateToken, async (req: any, res) => {
  try {
    const userFullName = `${req.user.surname || ''} ${req.user.name || ''}`.trim().toLowerCase();
    const userNameFull = `${req.user.name || ''} ${req.user.surname || ''}`.trim().toLowerCase();

    const { rows } = await pool.query("SELECT * FROM friendly_challenges ORDER BY created_at DESC");
    
    const userChallenges = rows.filter(r => {
      if (r.creator_id === req.user.id) return true;
      try {
        const shooters = JSON.parse(r.shooters || '[]');
        return shooters.some((s: any) => 
          (s.id && String(s.id) === String(req.user.id)) ||
          (s.name && (
            s.name.toLowerCase().includes(userFullName) || 
            s.name.toLowerCase().includes(userNameFull) || 
            userFullName.includes(s.name.toLowerCase()) ||
            userNameFull.includes(s.name.toLowerCase())
          ))
        );
      } catch (err) {
        return false;
      }
    });

    res.json(userChallenges);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/friendly-challenges', authenticateToken, async (req: any, res) => {
  const { name, discipline, location, group_by_category, shooters, status } = req.body;
  
  if (!name || !discipline || !shooters) {
    return res.status(400).json({ error: 'Name, discipline, and shooters are required.' });
  }

  const id = Math.random().toString(36).substr(2, 9);
  try {
    await pool.query(
      `INSERT INTO friendly_challenges (id, creator_id, name, discipline, location, group_by_category, shooters, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id, 
        req.user.id, 
        name, 
        discipline, 
        location || 'Campo Privato', 
        group_by_category || false, 
        JSON.stringify(shooters), 
        status || 'completed'
      ]
    );
    res.json({ id, success: true });
  } catch (err: any) {
    console.error('Error creating friendly challenge:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/friendly-challenges/:id', authenticateToken, async (req: any, res) => {
  const { name, discipline, location, group_by_category, shooters, status } = req.body;
  try {
    const { rows } = await pool.query("SELECT creator_id, shooters FROM friendly_challenges WHERE id = $1", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Sfida non trovata' });
    }

    const challenge = rows[0];
    const isCreator = challenge.creator_id === req.user.id;
    
    // Check if participant is editing scores
    let isParticipant = false;
    try {
      const existingShooters = JSON.parse(challenge.shooters || '[]');
      isParticipant = existingShooters.some((s: any) => s.id && String(s.id) === String(req.user.id));
    } catch (e) {}

    if (!isCreator && !isParticipant && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Non hai l\'autorizzazione per aggiornare questa sfida.' });
    }

    await pool.query(
      `UPDATE friendly_challenges 
       SET name = COALESCE($1, name), 
           discipline = COALESCE($2, discipline), 
           location = COALESCE($3, location), 
           group_by_category = COALESCE($4, group_by_category), 
           shooters = COALESCE($5, shooters), 
           status = COALESCE($6, status) 
       WHERE id = $7`,
      [
        name, 
        discipline, 
        location, 
        group_by_category !== undefined ? group_by_category : null, 
        shooters ? JSON.stringify(shooters) : null, 
        status, 
        req.params.id
      ]
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error updating friendly challenge:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/friendly-challenges/:id', authenticateToken, async (req: any, res) => {
  try {
    const { rows } = await pool.query("SELECT creator_id FROM friendly_challenges WHERE id = $1", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Sfida non trovata' });
    }

    if (rows[0].creator_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo l\'ideatore della sfida può eliminarla.' });
    }

    await pool.query("DELETE FROM friendly_challenges WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
      SELECT 
        c.id, c.user_id, c.name, c.date, c.enddate, c.location, c.discipline, c.level, 
        c.totalscore, c.totaltargets, c.averageperseries, c.position, c.cost, c.win, 
        c.notes, c.weather, c.scores, c.detailedscores, c.usedcartridges, c.chokes, 
        c.event_id, c.shoot_off,
        u.name as user_name, u.surname as user_surname, u.category, u.qualification
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
          const bonusMap: Record<string, number> = { 
            'E': 0, 'Eccellenza': 0, 
            '1*': 1, 'Prima': 1, 
            '2*': 2, 'Seconda': 2, 
            '3*': 3, 'Terza': 3 
          };
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
  const { name, size, memberIds, competition_name, event_id, discipline, society: bodySociety, date, targets, type } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const society = req.user.role === 'society' ? req.user.society : bodySociety;
    const { rows } = await client.query(
      "INSERT INTO teams (name, size, society, competition_name, event_id, discipline, date, location, targets, created_by, type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id",
      [name, size, society, competition_name, event_id, discipline, date, req.body.location, targets || 100, req.user.id, type]
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
  const { name, size, memberIds, competition_name, event_id, discipline, society: bodySociety, date, targets, type } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get current team info for authorization and notification fallback
    const { rows: teamRows } = await client.query("SELECT society, name FROM teams WHERE id = $1", [id]);
    if (teamRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Team not found" });
    }

    if (req.user.role === 'society') {
      const teamSociety = teamRows[0].society?.toString().trim().toLowerCase();
      const userSociety = req.user.society?.toString().trim().toLowerCase();
      if (teamSociety !== userSociety) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: "Unauthorized" });
      }
    }

    const teamId = parseInt(id);
    const finalTeamName = name || teamRows[0].name;
    const society = req.user.role === 'society' ? req.user.society : bodySociety;
    const numericMemberIds = memberIds.map((mid: any) => parseInt(mid));

    // Get old members to identify changes
    const { rows: oldMemberRows } = await client.query("SELECT user_id FROM team_members WHERE team_id = $1", [teamId]);
    const oldMemberIds = oldMemberRows.map(r => r.user_id);

    console.log(`Syncing team ${teamId}: oldMembers=${oldMemberIds}, newMembers=${numericMemberIds}`);

    await client.query(
      "UPDATE teams SET name = $1, size = $2, competition_name = $3, event_id = $4, discipline = $5, society = $6, date = $7, location = $8, targets = $9, type = $11 WHERE id = $10",
      [name, size, competition_name, event_id, discipline, society, date, req.body.location, targets || 100, teamId, type]
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
        { it: "Squadra Aggiornata", en: "Squad Updated" },
        { 
          it: `La squadra "${finalTeamName}" è stata modificata. Controlla i dettagli.`,
          en: `The squad "${finalTeamName}" has been modified. Check the details.`
        },
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
        { it: "Squadra Sciolta", en: "Squad Disbanded" },
        { 
          it: `La squadra "${team.name}" è stata eliminata dall'amministratore o dalla società.`,
          en: `The squad "${team.name}" has been deleted by the administrator or the club.`
        },
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
        { it: "Gara Assegnata!", en: "Event Assigned!" },
        { 
          it: `La gara "${team.competition_name || team.name}" è stata assegnata alla tua squadra "${team.name}".`,
          en: `The event "${team.competition_name || team.name}" has been assigned to your squad "${team.name}".`
        },
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
    if (req.query.lightweight === 'true') {
      let eventQuery = `
        SELECT e.id, e.name, e.location, e.discipline, e.start_date, e.end_date, e.status
        FROM events e
      `;
      let eventParams: any[] = [];
      if (req.user.role !== 'admin') {
        eventQuery += " WHERE e.location = $1 OR e.visibility = 'Pubblica' OR e.created_by = $2";
        eventParams.push(req.user.role === 'society' ? req.user.society : (req.user.society || ''), req.user.id);
      }
      eventQuery += " ORDER BY e.start_date DESC";
      const { rows: events } = await pool.query(eventQuery, eventParams);
      return res.json(events);
    }

    // 1. Fetch regular events with result count
    let eventQuery = `
      SELECT DISTINCT ON (e.id) e.*, s.region as society_region,
      (SELECT COUNT(*)::INTEGER FROM competitions c WHERE c.event_id = e.id) as result_count,
      (SELECT COUNT(*)::INTEGER FROM event_registrations r WHERE r.event_id = e.id) as registration_count,
      (SELECT COUNT(*)::INTEGER FROM event_registrations r WHERE r.event_id = e.id AND r.user_id = '${req.user.id}') > 0 as is_registered
      FROM events e
      LEFT JOIN societies s ON LOWER(TRIM(e.location)) = LOWER(TRIM(s.name)) OR LOWER(TRIM(e.location)) = LOWER(TRIM(s.code))
      ORDER BY e.id
    `;
    let eventParams: any[] = [];

    if (req.user.role === 'admin') {
      // Admin sees all
    } else if (req.user.role === 'society') {
      // Society sees their own, public, and those they created
      eventQuery += " WHERE e.location = $1 OR e.visibility = 'Pubblica' OR e.created_by = $2";
      eventParams.push(req.user.society, req.user.id);
    } else {
      // User sees their society's, public, and those they created
      eventQuery += " WHERE e.location = $1 OR e.visibility = 'Pubblica' OR e.created_by = $2";
      eventParams.push(req.user.society || '', req.user.id);
    }

    const { rows: events } = await pool.query(eventQuery, eventParams);
    console.log('API: /api/events fetched events count:', events.length, 'for user:', req.user.email, 'role:', req.user.role);

    const mappedEvents = events.map((ev: any) => ({
      ...ev,
      region: ev.region || ev.society_region
    }));

    // 4. Combine and sort
    const allEvents = [...mappedEvents].sort((a, b) => {
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
             COALESCE(json_agg(
               json_build_object(
                 'id', tm.user_id,
                 'first_name', u.name,
                 'last_name', u.surname,
                 'category', u.category,
                 'qualification', u.qualification
               )
             ) FILTER (WHERE tm.user_id IS NOT NULL), '[]') as members,
             COALESCE(json_agg(tm.user_id) FILTER (WHERE tm.user_id IS NOT NULL), '[]') as member_ids
      FROM teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      LEFT JOIN users u ON tm.user_id = u.id
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
    const { name, society, type, team_type, memberIds } = req.body; // memberIds are user IDs
    
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
    else if (type === 'A') size = 6;
    else if (type === 'B') size = 3;

    // Create team in `teams` table
    const newTeam = await client.query(`
      INSERT INTO teams (name, size, society, competition_name, discipline, date, location, targets, team_type, type, event_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [name, size, society, event.name, event.discipline, event.start_date, event.location, event.targets, team_type, type, eventId, req.user.id]);

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
        { it: "Nuova Squadra!", en: "New Squad!" },
        { 
          it: `Sei stato inserito nella squadra "${name}" per la gara "${event.name}".`,
          en: `You have been added to the squad "${name}" for the event "${event.name}".`
        },
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
    const { name, society, type, team_type, memberIds } = req.body;
    
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
    else if (type === 'A') size = 6;
    else if (type === 'B') size = 3;

    const oldTeamRes = await client.query('SELECT is_sent, date, name FROM teams WHERE id = $1', [teamId]);
    const wasSent = oldTeamRes.rows[0]?.is_sent;
    const teamDate = oldTeamRes.rows[0]?.date || '-';
    const finalName = name || oldTeamRes.rows[0]?.name;

    const updatedTeam = await client.query(`
      UPDATE teams SET name = $1, society = $2, size = $3, team_type = $4, type = $7
      WHERE id = $5 AND competition_name = $6
      RETURNING *
    `, [name, society, size, team_type, teamId, event.name, type]);

    if (updatedTeam.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Squadra non trovata' });
    }

    // Update members
    if (memberIds) {
      const oldMembersRes = await client.query('SELECT user_id FROM team_members WHERE team_id = $1', [teamId]);
      const oldMemberIds = oldMembersRes.rows.map(r => Number(r.user_id));
      const numericMemberIds = memberIds.map((id: any) => Number(id));

      const removedMemberIds = oldMemberIds.filter(id => !numericMemberIds.includes(id));
      const addedMemberIds = numericMemberIds.filter(id => !oldMemberIds.includes(id));
      const keptMemberIds = numericMemberIds.filter(id => oldMemberIds.includes(id));

      // Remove all members from this team
      await client.query(`DELETE FROM team_members WHERE team_id = $1`, [teamId]);
      
      // Remove team_id from competitions for this event
      await client.query(`
        UPDATE competitions SET team_id = NULL, team_name = NULL 
        WHERE team_id = $1 AND event_id = $2
      `, [teamId, eventId]);

      if (wasSent) {
        // 1. Handle REMOVED members
        if (removedMemberIds.length > 0) {
          const removedUsersRes = await client.query(`
            SELECT id, name, surname, email, email_verified, language
            FROM users WHERE id = ANY($1)
          `, [removedMemberIds]);

          for (const u of removedUsersRes.rows) {
            if (u.email && u.email_verified) {
              sendUnregistrationEmail(
                u.email,
                `${u.name} ${u.surname}`,
                event.name,
                event.location,
                u.language || 'it',
                true
              ).catch(err => console.error('Error sending unregistration email on team update:', err));
            }
            await client.query(`
              DELETE FROM event_registrations 
              WHERE event_id = $1 AND user_id = $2 AND registration_day = $3 AND registration_type = 'Iscrizione da Squadra'
            `, [eventId, u.id, teamDate]);
          }
        }

        // 2. Handle ADDED members
        if (addedMemberIds.length > 0) {
          const addedUsersRes = await client.query(`
            SELECT id, name, surname, email, email_verified, language, phone,
                   shotgun_brand, shotgun_model, cartridge_brand, cartridge_model
            FROM users WHERE id = ANY($1)
          `, [addedMemberIds]);

          for (const u of addedUsersRes.rows) {
            const phone = u.phone || '';
            const shotgun_brand = u.shotgun_brand || 'Beretta';
            const shotgun_model = u.shotgun_model || '';
            const cartridge_brand = u.cartridge_brand || 'Fiocchi';
            const cartridge_model = u.cartridge_model || '';

            await client.query(`
              INSERT INTO event_registrations (
                event_id, user_id, registration_day, registration_type,
                shotgun_brand, shotgun_model, cartridge_brand, cartridge_model,
                shooting_session, notes, phone
              )
              VALUES ($1, $2, $3, 'Iscrizione da Squadra', $4, $5, $6, $7, 'morning', '', $8)
              ON CONFLICT (event_id, user_id) DO UPDATE SET
                registration_type = EXCLUDED.registration_type,
                shotgun_brand = EXCLUDED.shotgun_brand, shotgun_model = EXCLUDED.shotgun_model,
                cartridge_brand = EXCLUDED.cartridge_brand, cartridge_model = EXCLUDED.cartridge_model,
                phone = EXCLUDED.phone, updated_at = CURRENT_TIMESTAMP
            `, [eventId, u.id, teamDate, shotgun_brand, shotgun_model, cartridge_brand, cartridge_model, phone]);

            if (u.email && u.email_verified) {
              sendRegistrationEmail(
                u.email,
                `${u.name} ${u.surname}`,
                event.name,
                event.start_date,
                event.location,
                phone,
                teamDate,
                'morning',
                u.language || 'it',
                true
              ).catch(err => console.error('Error sending registration email on team update:', err));
            }
          }
        }

        // 3. Handle KEPT members (send modification email if team properties changed)
        // For simplicity, we send it if the team was sent, as the name or other things might have changed
        if (keptMemberIds.length > 0) {
          const keptUsersRes = await client.query(`
            SELECT id, name, surname, email, email_verified, language, phone
            FROM users WHERE id = ANY($1)
          `, [keptMemberIds]);

          for (const u of keptUsersRes.rows) {
            if (u.email && u.email_verified) {
              sendRegistrationModifiedEmail(
                u.email,
                `${u.name} ${u.surname}`,
                event.name,
                event.start_date,
                event.location,
                u.phone || '-',
                teamDate,
                'morning',
                u.language || 'it',
                true
              ).catch(err => console.error('Error sending modification email on team update:', err));
            }
          }
        }
      }

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
        `, [teamId, finalName, eventId, memberIds]);
        
        // Send push notification to team members
        await sendPushNotification(
          memberIds,
          { it: "Squadra Aggiornata", en: "Squad Updated" },
          { 
            it: `La squadra "${finalName}" per la gara "${event.name}" è stata modificata.`,
            en: `The squad "${finalName}" for the event "${event.name}" has been modified.`
          },
          `/history`,
          'team'
        );
      }

      // Cleanup any empty squads for this event
      await client.query(`
        DELETE FROM event_squads 
        WHERE event_id = $1 
        AND id NOT IN (SELECT squad_id FROM event_squad_members)
      `, [eventId]);
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

app.post('/api/events/:id/teams/:teamId/send', authenticateToken, async (req: any, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id: eventId, teamId } = req.params;
    
    await client.query('UPDATE teams SET is_sent = TRUE WHERE id = $1', [teamId]);
    
    // Fetch event details for emails
    const eventRes = await client.query('SELECT name, location, start_date FROM events WHERE id = $1', [eventId]);
    if (eventRes.rows.length === 0) throw new Error('Evento non trovato');
    const event = eventRes.rows[0];

    const teamRes = await client.query('SELECT date FROM teams WHERE id = $1', [teamId]);
    const teamDate = teamRes.rows[0]?.date || '-';

    const membersRes = await client.query(`
      SELECT tm.user_id, u.name, u.surname, u.email, u.email_verified, u.language, u.phone,
             u.shotgun_brand, u.shotgun_model, u.cartridge_brand, u.cartridge_model
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1
    `, [teamId]);

    for (const m of membersRes.rows) {
      if (!m.user_id) continue;
      
      const phone = m.phone || '';
      const shotgun_brand = m.shotgun_brand || 'Beretta';
      const shotgun_model = m.shotgun_model || '';
      const cartridge_brand = m.cartridge_brand || 'Fiocchi';
      const cartridge_model = m.cartridge_model || '';
      
      const regRes = await client.query('SELECT id FROM event_registrations WHERE event_id = $1 AND user_id = $2', [eventId, m.user_id]);
      const isUpdate = regRes.rows.length > 0;
      
      if (!isUpdate) {
        await client.query(`
          INSERT INTO event_registrations (
            event_id, user_id, registration_day, registration_type,
            shotgun_brand, shotgun_model, cartridge_brand, cartridge_model,
            shooting_session, notes, phone
          )
          VALUES ($1, $2, $3, 'Iscrizione da Squadra', $4, $5, $6, $7, 'morning', '', $8)
        `, [eventId, m.user_id, teamDate, shotgun_brand, shotgun_model, cartridge_brand, cartridge_model, phone]);
        
        // Send email for new registration
        if (m.email && m.email_verified) {
          sendRegistrationEmail(
            m.email,
            `${m.name} ${m.surname}`,
            event.name,
            event.start_date,
            event.location,
            phone,
            teamDate,
            'morning',
            m.language || 'it',
            true
          ).catch(err => console.error('Error sending registration email from team send:', err));
        }
      } else {
        // Update existing registration with team info
        await client.query(`
          UPDATE event_registrations 
          SET registration_type = 'Iscrizione da Squadra', 
              shotgun_brand = $1, shotgun_model = $2, 
              cartridge_brand = $3, cartridge_model = $4,
              phone = $5, updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
        `, [shotgun_brand, shotgun_model, cartridge_brand, cartridge_model, phone, regRes.rows[0].id]);

        // Send email for modified registration
        if (m.email && m.email_verified) {
          sendRegistrationModifiedEmail(
            m.email,
            `${m.name} ${m.surname}`,
            event.name,
            event.start_date,
            event.location,
            phone,
            teamDate,
            'morning',
            m.language || 'it',
            true
          ).catch(err => console.error('Error sending modification email from team send:', err));
        }
      }
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Squadra inviata con successo' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post('/api/events/:id/teams/:teamId/withdraw', authenticateToken, async (req: any, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id: eventId, teamId } = req.params;
    
    // 1. Update team status
    await client.query('UPDATE teams SET is_sent = FALSE WHERE id = $1', [teamId]);

    // Fetch event details for emails
    const eventRes = await client.query('SELECT name, location FROM events WHERE id = $1', [eventId]);
    const event = eventRes.rows[0];

    // 2. Fetch members to send cancellation emails
    const membersRes = await client.query(`
      SELECT tm.user_id, u.name, u.surname, u.email, u.email_verified, u.language
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1
    `, [teamId]);
    
    const teamRes = await client.query('SELECT date FROM teams WHERE id = $1', [teamId]);
    const teamDate = teamRes.rows[0]?.date || '-';

    for (const m of membersRes.rows) {
      if (!m.user_id) continue;
      
      // Before deleting, send cancellation email
      if (m.email && m.email_verified) {
        sendUnregistrationEmail(
          m.email,
          `${m.name} ${m.surname}`,
          event?.name || 'Evento',
          event?.location || 'TAV',
          m.language || 'it',
          true
        ).catch(err => console.error('Error sending cancellation email from team withdraw:', err));
      }

      await client.query(`
        DELETE FROM event_registrations 
        WHERE event_id = $1 AND user_id = $2 AND registration_day = $3 AND registration_type = 'Iscrizione da Squadra'
      `, [eventId, m.user_id, teamDate]);
    }
    
    // Cleanup any empty squads for this event
    await client.query(`
      DELETE FROM event_squads 
      WHERE event_id = $1 
      AND id NOT IN (SELECT squad_id FROM event_squad_members)
    `, [eventId]);
    
    await client.query('COMMIT');
    res.json({ message: 'Squadra ritirata con successo' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
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
      SELECT DISTINCT ON (u.id)
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
        r.phone as registration_phone,
        sm.bib_number,
        (c.id IS NULL) as is_registered_only
      FROM users u
      LEFT JOIN event_registrations r ON r.user_id = u.id AND r.event_id = $1
      LEFT JOIN competitions c ON c.user_id = u.id AND c.event_id = $1
      LEFT JOIN (
        SELECT DISTINCT ON (registration_id) registration_id, bib_number 
        FROM event_squad_members
      ) sm ON sm.registration_id = r.id
      WHERE r.id IS NOT NULL OR c.id IS NOT NULL
      ORDER BY u.id, c.id DESC NULLS LAST, c.totalscore DESC NULLS LAST, c.shoot_off DESC NULLS LAST
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
    // Check if event exists and details for email
    const eventResult = await pool.query('SELECT name, start_date, end_date, location, is_management_enabled, discipline, targets, type FROM events WHERE id = $1', [id]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }
    const eventObj = eventResult.rows[0];

    if (!eventObj.is_management_enabled && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Le iscrizioni per questa gara non sono ancora attive.' });
    }

    // Determine the target user ID
    let targetUserId = req.user.id;
    if (user_id && (req.user.role === 'admin' || req.user.role === 'society')) {
      targetUserId = user_id;
    }

    // Fetch user details for email
    const userResult = await pool.query('SELECT name, surname, email, email_verified, language FROM users WHERE id = $1', [targetUserId]);
    const targetUser = userResult.rows[0];

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

    const regId = result.rows[0].id;

    // Create a competition record for the shooter (Le Tue Gare)
    try {
      const compId = `evt_${id}_${targetUserId}`;
      const userDetails = await pool.query('SELECT category, qualification, society, discipline_categories, is_cacciatore FROM users WHERE id = $1', [targetUserId]);
      const isCacciatore = userDetails.rows[0]?.is_cacciatore || false;
      let cat = userDetails.rows[0]?.category || null;
      const qual = userDetails.rows[0]?.qualification || null;
      const soc = userDetails.rows[0]?.society || null;
      const discCats = userDetails.rows[0]?.discipline_categories || null;

      if (!isCacciatore && discCats) {
        const discCat = getCategoryForDisciplineBackend(discCats, eventObj.discipline);
        if (discCat) {
          cat = normalizeCategoryBackend(discCat);
        }
      }
      
      const numSeries = Math.ceil((eventObj.targets || 100) / 25);
      const emptyScores = Array(numSeries).fill(0);

      await pool.query(
        `INSERT INTO competitions (
          id, user_id, name, date, enddate, location, discipline, level, 
          totalscore, totaltargets, averageperseries, scores, event_id,
          category_at_time, qualification_at_time, society_at_time, hidden_from_user
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, FALSE)
        ON CONFLICT (id) DO UPDATE SET 
          name = EXCLUDED.name, date = EXCLUDED.date, enddate = EXCLUDED.enddate, 
          location = EXCLUDED.location, discipline = EXCLUDED.discipline, level = EXCLUDED.level,
          totaltargets = EXCLUDED.totaltargets, event_id = EXCLUDED.event_id,
          hidden_from_user = FALSE`,
        [
          compId, targetUserId, eventObj.name, eventObj.start_date, eventObj.end_date || null, 
          eventObj.location, eventObj.discipline, eventObj.type || 'Regionale',
          0, eventObj.targets || 100, 0, JSON.stringify(emptyScores), id,
          cat, qual, soc
        ]
      );
    } catch (compErr) {
      console.error('Error creating linked competition record:', compErr);
      // Don't fail the whole registration if this fails
    }

    // Update user phone and equipment if provided
    if (phone) {
      await pool.query('UPDATE users SET phone = $1 WHERE id = $2', [phone, targetUserId]);
    }
    if (shotgun_brand) {
      await pool.query('UPDATE users SET shotgun_brand = $1 WHERE id = $2', [shotgun_brand, targetUserId]);
    }
    if (shotgun_model) {
      await pool.query('UPDATE users SET shotgun_model = $1 WHERE id = $2', [shotgun_model, targetUserId]);
    }
    if (cartridge_brand) {
      await pool.query('UPDATE users SET cartridge_brand = $1 WHERE id = $2', [cartridge_brand, targetUserId]);
    }
    if (cartridge_model) {
      await pool.query('UPDATE users SET cartridge_model = $1 WHERE id = $2', [cartridge_model, targetUserId]);
    }

    // Handle automatic squad assignment if time is specified OR if explicitly requested
    const { addToSquad } = req.body;
    const isTimeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(shooting_session);
    
    if (isTimeFormat || (addToSquad && (req.user.role === 'admin' || req.user.role === 'society'))) {
      if (isTimeFormat) {
        // Find existing squad for this time and day (handle date format normalization)
        let altDay = registration_day;
        if (registration_day && registration_day.includes('-')) {
          const parts = registration_day.split('-');
          altDay = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else if (registration_day && registration_day.includes('/')) {
          const parts = registration_day.split('/');
          altDay = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }

        let squadRes = await pool.query(
          'SELECT id FROM event_squads WHERE event_id = $1 AND (squad_day = $2 OR squad_day = $3) AND start_time = $4 AND round_number = 1 ORDER BY id ASC',
          [id, registration_day, altDay, shooting_session]
        );
        
        let squadId = null;
        for (const s of squadRes.rows) {
          const membersCount = await pool.query('SELECT COUNT(*) FROM event_squad_members WHERE squad_id = $1', [s.id]);
          if (parseInt(membersCount.rows[0].count) < 6) {
            squadId = s.id;
            break;
          }
        }

        if (!squadId) {
          // Create new squad
          const maxSquadNumRes = await pool.query('SELECT MAX(squad_number) as max_num FROM event_squads WHERE event_id = $1 AND squad_day = $2', [id, registration_day]);
          const nextSquadNum = (maxSquadNumRes.rows[0].max_num || 0) + 1;
          
          const newSquad = await pool.query(
            'INSERT INTO event_squads (event_id, squad_number, field_number, round_number, squad_day, start_time) VALUES ($1, $2, 1, 1, $3, $4) RETURNING id',
            [id, nextSquadNum, registration_day, shooting_session]
          );
          squadId = newSquad.rows[0].id;
        }

        // Add to squad
        const maxBibResult = await pool.query('SELECT MAX(bib_number) as max_bib FROM event_squad_members sm JOIN event_squads s ON sm.squad_id = s.id WHERE s.event_id = $1', [id]);
        const nextBib = (maxBibResult.rows[0].max_bib || 0) + 1;
        const nextPosRes = await pool.query('SELECT MAX(position) as max_pos FROM event_squad_members WHERE squad_id = $1', [squadId]);
        const nextPos = (nextPosRes.rows[0].max_pos || 0) + 1;

        await pool.query(
          'INSERT INTO event_squad_members (squad_id, registration_id, position, bib_number) VALUES ($1, $2, $3, $4)',
          [squadId, regId, nextPos, nextBib]
        );
      }
    }
    
    // Fetch the NEW record with JOINED details to ensure frontend has all fields
    const finalResult = await pool.query(
      `SELECT 
        r.id, r.event_id, r.user_id, r.registration_day, r.registration_type, 
        r.shotgun_brand, r.shotgun_model, r.cartridge_brand, r.cartridge_model, 
        r.shooting_session, r.notes, r.phone, r.created_at,
        u.name as first_name, u.surname as last_name, u.shooter_code, u.society, u.category, u.qualification, u.email
       FROM event_registrations r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [regId]
    );

    // Send email if email exists and verified
    if (targetUser && targetUser.email && targetUser.email_verified) {
      const eventDateRange = eventObj.start_date === eventObj.end_date 
        ? eventObj.start_date 
        : `${eventObj.start_date} - ${eventObj.end_date}`;
      
      const isSocietyAction = (req.user.role === 'admin' || req.user.role === 'society') && req.user.id !== targetUserId;

      sendRegistrationEmail(
        targetUser.email,
        `${targetUser.name} ${targetUser.surname}`,
        eventObj.name,
        eventDateRange,
        eventObj.location,
        phone || '-',
        registration_day || '-',
        shooting_session || '-',
        targetUser.language || 'it',
        isSocietyAction
      ).catch(err => console.error('Error in sendRegistrationEmail background call:', err));
    }

    res.json(finalResult.rows[0]);
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

// Get user's own registrations
app.get('/api/user/registrations', authenticateToken, async (req: any, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        r.id, r.event_id, r.user_id, r.registration_day, r.registration_type, 
        r.shotgun_brand, r.shotgun_model, r.cartridge_brand, r.cartridge_model, 
        r.shooting_session, r.notes, r.phone, r.created_at,
        u.name as first_name, u.surname as last_name, u.shooter_code, u.society, u.category, u.qualification,
        e.name as event_name, e.start_date, e.end_date, e.location as event_location, e.discipline as event_discipline, e.poster_url as event_poster_url
       FROM event_registrations r
       JOIN events e ON r.event_id = e.id
       JOIN users u ON r.user_id = u.id
       WHERE r.user_id = $1
       ORDER BY r.registration_day DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching user registrations:', error);
    res.status(500).json({ error: 'Failed to fetch registrations: ' + error.message });
  }
});

// Get registrations for an event
app.get('/api/events/:id/registrations', authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT 
        r.id, r.event_id, r.user_id, r.registration_day, r.registration_type, 
        r.shotgun_brand, r.shotgun_model, r.cartridge_brand, r.cartridge_model, 
        r.shooting_session, r.notes, r.phone, r.created_at,
        u.name as first_name, u.surname as last_name, u.shooter_code, u.society, u.category, u.qualification, u.email,
        r.original_registration_day, r.original_shooting_session,
        (SELECT bib_number FROM event_squad_members sm JOIN event_squads s ON sm.squad_id = s.id WHERE sm.registration_id = r.id AND s.event_id = r.event_id LIMIT 1) as bib_number
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
    const regCheck = await pool.query('SELECT user_id, event_id FROM event_registrations WHERE id = $1 AND event_id = $2', [registrationId, eventId]);
    if (regCheck.rows.length === 0) return res.status(404).json({ error: 'Registrazione non trovata' });

    const eventCheck = await pool.query('SELECT location, start_date, name, end_date FROM events WHERE id = $1', [eventId]);
    const eventObj = eventCheck.rows[0];
    const isOwner = regCheck.rows[0].user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isSociety = req.user.role === 'society' && req.user.society === eventObj?.location;

    if (!isOwner && !isAdmin && !isSociety) {
      return res.status(403).json({ error: 'Non hai i permessi per modificare questa iscrizione' });
    }

    // Deadline check for self-service
    if (isOwner && !isAdmin && !isSociety) {
      const eventStartDate = new Date(eventObj.start_date);
      const deadline = new Date(eventStartDate);
      deadline.setDate(deadline.getDate() - 1);
      deadline.setHours(16, 0, 0, 0);

      if (new Date() > deadline) {
        return res.status(403).json({ error: 'Termine ultimo per la modifica autonoma superato (ore 16:00 del giorno precedente l\'inizio gara).' });
      }
    }

    // Check existing registration to track history and detect changes
    const oldReg = await pool.query('SELECT registration_day, shooting_session, original_registration_day, original_shooting_session FROM event_registrations WHERE id = $1', [registrationId]);
    const { registration_day: oldDay, shooting_session: oldSession, original_registration_day: oldOrigDay, original_shooting_session: oldOrigSession } = oldReg.rows[0];

    // Check if was already in a squad
    const inSquadRes = await pool.query('SELECT squad_id FROM event_squad_members WHERE registration_id = $1', [registrationId]);
    const wasInSquad = inSquadRes.rows.length > 0;

    const updateFields = [];
    const updateValues = [];
    let fieldCount = 1;

    // Track original if not set yet (first modification)
    let newOrigRegDay = oldOrigDay;
    let newOrigShootingSession = oldOrigSession;
    
    if (!oldOrigDay && oldDay !== registration_day) {
        newOrigRegDay = oldDay;
    }
    if (!oldOrigSession && oldSession !== shooting_session) {
        newOrigShootingSession = oldSession;
    }

    const updateResult = await pool.query(
      `UPDATE event_registrations SET 
        registration_day = $1, registration_type = $2, shotgun_brand = $3, 
        shotgun_model = $4, cartridge_brand = $5, cartridge_model = $6, 
        shooting_session = $7, notes = $8, phone = $9, updated_at = CURRENT_TIMESTAMP,
        original_registration_day = $12, original_shooting_session = $13
      WHERE id = $10 AND event_id = $11
      RETURNING *`,
      [registration_day, registration_type, shotgun_brand, shotgun_model, cartridge_brand, cartridge_model, shooting_session, notes, phone, registrationId, eventId, newOrigRegDay, newOrigShootingSession]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }

    // Check if squad reassignment logic is needed
    const changed = oldDay !== registration_day || oldSession !== shooting_session;

    // Fetch user details for email
    const userResult = await pool.query('SELECT name, surname, email, email_verified, language FROM users WHERE id = $1', [regCheck.rows[0].user_id]);
    const targetUser = userResult.rows[0];
    
    // Fetch the UPDATED record with JOINED details to ensure frontend has all fields
    const finalResult = await pool.query(
      `SELECT 
        r.id, r.event_id, r.user_id, r.registration_day, r.registration_type, 
        r.shotgun_brand, r.shotgun_model, r.cartridge_brand, r.cartridge_model, 
        r.shooting_session, r.notes, r.phone, r.created_at,
        u.name as first_name, u.surname as last_name, u.shooter_code, u.society, u.category, u.qualification, u.email
       FROM event_registrations r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [registrationId]
    );

    // Send email if email exists and verified
    if (targetUser && targetUser.email && targetUser.email_verified) {
      const eventDateRange = eventObj.start_date === eventObj.end_date 
        ? eventObj.start_date 
        : `${eventObj.start_date} - ${eventObj.end_date}`;
      
      const isSocietyAction = (req.user.role === 'admin' || req.user.role === 'society') && req.user.id !== targetUser.id;

      sendRegistrationModifiedEmail(
        targetUser.email,
        `${targetUser.name} ${targetUser.surname}`,
        eventObj.name,
        eventDateRange,
        eventObj.location,
        phone || '-',
        registration_day || '-',
        shooting_session || '-',
        targetUser.language || 'it',
        isSocietyAction
      ).catch(err => console.error('Error in sendRegistrationModifiedEmail background call:', err));
    }

    res.json(finalResult.rows[0]);

    // Handle squad assignment if day/time changed OR if explicitly requested
    const { addToSquad } = req.body;
    const isTimeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(shooting_session);
    
    if (changed || (addToSquad && (isAdmin || isSociety))) {
      try {
        // Find squad and position before removal to reorder others
        const oldSquadInfo = await pool.query(
          `SELECT squad_id, position FROM event_squad_members 
           WHERE registration_id = $1 
           AND squad_id IN (SELECT id FROM event_squads WHERE event_id = $2)`,
          [registrationId, eventId]
        );

        if (oldSquadInfo.rows.length > 0) {
          const { squad_id: oldSqId, position: oldPos } = oldSquadInfo.rows[0];

          // Remove from squad
          await pool.query(
            "DELETE FROM event_squad_members WHERE registration_id = $1 AND squad_id = $2",
            [registrationId, oldSqId]
          );

          // Shift others UP to fill the gap
          await pool.query(
            "UPDATE event_squad_members SET position = position - 1 WHERE squad_id = $1 AND position > $2",
            [oldSqId, oldPos]
          );
        }

        if (isTimeFormat) {
          // Find existing squad for this time and day (handle date format normalization)
          let altDay = registration_day;
          if (registration_day && registration_day.includes('-')) {
            const parts = registration_day.split('-');
            altDay = `${parts[2]}/${parts[1]}/${parts[0]}`;
          } else if (registration_day && registration_day.includes('/')) {
            const parts = registration_day.split('/');
            altDay = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }

          let squadRes = await pool.query(
            'SELECT id FROM event_squads WHERE event_id = $1 AND (squad_day = $2 OR squad_day = $3) AND start_time = $4 AND round_number = 1 ORDER BY id ASC',
            [eventId, registration_day, altDay, shooting_session]
          );
          
          let squadId = null;
          for (const s of squadRes.rows) {
            const membersCount = await pool.query('SELECT COUNT(*) FROM event_squad_members WHERE squad_id = $1', [s.id]);
            if (parseInt(membersCount.rows[0].count) < 6) {
              squadId = s.id;
              break;
            }
          }

          if (!squadId) {
            // Create new squad
            const maxSquadNumRes = await pool.query('SELECT MAX(squad_number) as max_num FROM event_squads WHERE event_id = $1 AND squad_day = $2', [eventId, registration_day]);
            const nextSquadNum = (maxSquadNumRes.rows[0].max_num || 0) + 1;
            
            const newSquad = await pool.query(
              'INSERT INTO event_squads (event_id, squad_number, field_number, round_number, squad_day, start_time) VALUES ($1, $2, 1, 1, $3, $4) RETURNING id',
              [eventId, nextSquadNum, registration_day, shooting_session]
            );
            squadId = newSquad.rows[0].id;
          }

          // Add to squad
          const maxBibResult = await pool.query('SELECT MAX(bib_number) as max_bib FROM event_squad_members sm JOIN event_squads s ON sm.squad_id = s.id WHERE s.event_id = $1', [eventId]);
          const nextBib = (maxBibResult.rows[0].max_bib || 0) + 1;
          const nextPosRes = await pool.query('SELECT MAX(position) as max_pos FROM event_squad_members WHERE squad_id = $1', [squadId]);
          const nextPos = (nextPosRes.rows[0].max_pos || 0) + 1;

          await pool.query(
            'INSERT INTO event_squad_members (squad_id, registration_id, position, bib_number) VALUES ($1, $2, $3, $4)',
            [squadId, registrationId, nextPos, nextBib]
          );

          // Cleanup any empty squads for this event (the one we might have just left)
          await pool.query(`
            DELETE FROM event_squads 
            WHERE event_id = $1 
            AND id NOT IN (SELECT squad_id FROM event_squad_members)
          `, [eventId]);
        }
      } catch (squadErr) {
        console.error('Error auto-assigning squad during update:', squadErr);
        // We don't fail the whole request if squad assignment fails during update
      }
    }
  } catch (error: any) {
    console.error('Error updating registration:', error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento dell\'iscrizione: ' + error.message });
  }
});

// Delete a registration
app.delete('/api/events/:eventId/registrations/:registrationId', authenticateToken, async (req: any, res) => {
  const { eventId, registrationId } = req.params;

  try {
    // Check authorization
    const regCheck = await pool.query('SELECT user_id FROM event_registrations WHERE id = $1 AND event_id = $2', [registrationId, eventId]);
    if (regCheck.rows.length === 0) return res.status(404).json({ error: 'Registrazione non trovata' });

    const eventCheck = await pool.query('SELECT location, start_date FROM events WHERE id = $1', [eventId]);
    const eventObj = eventCheck.rows[0];
    const isOwner = regCheck.rows[0].user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isSociety = req.user.role === 'society' && req.user.society === eventObj?.location;

    if (!isOwner && !isAdmin && !isSociety) {
      return res.status(403).json({ error: 'Non hai i permessi per eliminare questa iscrizione' });
    }

    // Deadline check for self-service
    if (isOwner && !isAdmin && !isSociety) {
      const eventStartDate = new Date(eventObj.start_date);
      const deadline = new Date(eventStartDate);
      deadline.setDate(deadline.getDate() - 1);
      deadline.setHours(16, 0, 0, 0);

      if (new Date() > deadline) {
        return res.status(403).json({ error: 'Termine ultimo per la cancellazione autonoma superato (ore 16:00 del giorno precedente l\'inizio gara).' });
      }
    }

    // Check if user is in any squad and if it's locked
    const squadCheck = await pool.query(
      `SELECT sm.squad_id, s.is_locked 
       FROM event_squad_members sm 
       JOIN event_squads s ON sm.squad_id = s.id 
       WHERE sm.registration_id = $1`,
      [registrationId]
    );

    const isAnySquadLocked = squadCheck.rows.some(s => s.is_locked);

    // If shooter (owner) tries to delete but the squad is locked
    if (isOwner && isAnySquadLocked && !isAdmin && !isSociety) {
      return res.status(400).json({ error: 'squad_locked_contact_society' });
    }

    if (squadCheck.rows.length > 0 && !isOwner) {
      return res.status(400).json({ error: 'Impossibile eliminare l\'iscrizione: il tiratore è già assegnato a una batteria. Rimuovilo prima dalla batteria.' });
    }

    // Fetch details for email BEFORE deletion
    const detailsResult = await pool.query(`
      SELECT u.name, u.surname, u.email, u.email_verified, u.language, e.name as event_name, e.location
      FROM event_registrations r
      JOIN users u ON r.user_id = u.id
      JOIN events e ON r.event_id = e.id
      WHERE r.id = $1
    `, [registrationId]);
    const details = detailsResult.rows[0];

    // Find the squad and position before deletion to reorder others
    const squadInfo = await pool.query(
      'SELECT squad_id, position FROM event_squad_members WHERE registration_id = $1',
      [registrationId]
    );
    const affectedSquadId = squadInfo.rows[0]?.squad_id;
    const oldPosition = squadInfo.rows[0]?.position;

    // Remove from competition records if totalscore is 0 (hasn't started yet)
    await pool.query(
      'DELETE FROM competitions WHERE id = $1 AND totalscore = 0',
      [`evt_${eventId}_${regCheck.rows[0].user_id}`]
    );

    // If they were in a squad, manually remove and update positions to avoid gap
    if (affectedSquadId && oldPosition) {
      await pool.query(
        'DELETE FROM event_squad_members WHERE registration_id = $1 AND squad_id = $2',
        [registrationId, affectedSquadId]
      );
      await pool.query(
        'UPDATE event_squad_members SET position = position - 1 WHERE squad_id = $1 AND position > $2',
        [affectedSquadId, oldPosition]
      );
    }

    await pool.query('DELETE FROM event_registrations WHERE id = $1 AND event_id = $2', [registrationId, eventId]);

    // Cleanup any empty squads for this event
    await pool.query(`
      DELETE FROM event_squads 
      WHERE event_id = $1 
      AND id NOT IN (SELECT squad_id FROM event_squad_members)
    `, [eventId]);

    // Send unregistration email if email exists and verified
    if (details && details.email && details.email_verified) {
      sendUnregistrationEmail(
        details.email,
        `${details.name} ${details.surname}`,
        details.event_name,
        details.location,
        details.language || 'it',
        (isAdmin || isSociety) && !isOwner
      ).catch(err => console.error('Error in sendUnregistrationEmail background call:', err));
    }

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

    // Get registrations filtered by day if requested
    let regQuery = 'SELECT id, shooting_session FROM event_registrations WHERE event_id = $1';
    let regParams: any[] = [id];
    const { registrationDay } = req.body;
    
    console.log('Generating squads for event:', id, 'Registration day filter:', registrationDay);
    
    if (registrationDay && registrationDay !== 'all') {
      // Handle both YYYY-MM-DD and DD/MM/YYYY if they exist in DB
      regQuery += ' AND (registration_day = $2 OR registration_day = $3)';
      
      let altDay = registrationDay;
      if (registrationDay.includes('-')) {
        const parts = registrationDay.split('-');
        altDay = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else if (registrationDay.includes('/')) {
        const parts = registrationDay.split('/');
        altDay = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      
      regParams.push(registrationDay, altDay);
    }
    const regResult = await pool.query(regQuery, regParams);
    console.log('Query result count:', regResult.rows.length);
    
    if (regResult.rows.length === 0) {
      return res.status(400).json({ error: 'Nessun tiratore trovato per i criteri selezionati.' });
    }

    const eventUseFields = event.use_fields_capacity === true;
    const fieldsCountValue = eventUseFields ? (fieldsCount || event.total_fields || 1) : 1;
    // Always clear squads for the selected day before regenerating them
    if (registrationDay && registrationDay !== 'all') {
      let altDay = registrationDay;
      if (registrationDay.includes('-')) {
        const parts = registrationDay.split('-');
        altDay = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else if (registrationDay.includes('/')) {
        const parts = registrationDay.split('/');
        altDay = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      await pool.query('DELETE FROM event_squads WHERE event_id = $1 AND (squad_day = $2 OR squad_day = $3)', [id, registrationDay, altDay]);
    } else {
      await pool.query('DELETE FROM event_squads WHERE event_id = $1', [id]);
    }

    const isTimeFormat = (val: string) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val);

    // Filter registrations
    const specificTime = regResult.rows.filter(r => isTimeFormat(r.shooting_session));
    const morningPool = regResult.rows.filter(r => r.shooting_session === 'morning');
    const afternoonPool = regResult.rows.filter(r => r.shooting_session === 'afternoon');
    const randomPool = regResult.rows.filter(r => 
      !isTimeFormat(r.shooting_session) && 
      r.shooting_session !== 'morning' && 
      r.shooting_session !== 'afternoon'
    );

    // Shuffle pools
    const shuffle = (array: any[]) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    };
    shuffle(morningPool);
    shuffle(afternoonPool);
    shuffle(randomPool);

    // Structure to hold squads in memory: Map<time, Array<squad>>
    const finalSquads: Map<string, Array<{ field: number, members: number[] }>> = new Map();

    // Pass 1: Assign preferred specific HH:MM times
    for (const reg of specificTime) {
      const time = reg.shooting_session;
      if (!finalSquads.has(time)) {
        finalSquads.set(time, []);
      }

      const squadsAtTime = finalSquads.get(time)!;
      let placed = false;

      for (const squad of squadsAtTime) {
        if (squad.members.length < 6) {
          squad.members.push(reg.id);
          placed = true;
          break;
        }
      }

      if (!placed && squadsAtTime.length < fieldsCountValue) {
        const field = squadsAtTime.length + 1;
        squadsAtTime.push({ field, members: [reg.id] });
        placed = true;
      }

      if (!placed) randomPool.push(reg);
    }

    // Helper to check time constraints
    const timeToMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const MORNING_END = timeToMinutes('13:00');
    const AFTERNOON_START = timeToMinutes('13:20');

    // Pass 2: Fill remaining with combined pool logic
    const [startH, startM] = startTime.split(':').map(Number);
    let currentH = startH;
    let currentM = startM;

    let morningIdx = 0;
    let afternoonIdx = 0;
    let randomIdx = 0;

    const hasMore = () => morningIdx < morningPool.length || afternoonIdx < afternoonPool.length || randomIdx < randomPool.length;

    while (hasMore()) {
      const timeStr = `${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`;
      const currentMinutes = timeToMinutes(timeStr);
      
      if (!finalSquads.has(timeStr)) {
        finalSquads.set(timeStr, []);
      }

      const squadsAtTime = finalSquads.get(timeStr)!;

      // Ensure fields are available at this slot
      while (squadsAtTime.length < fieldsCountValue && hasMore()) {
        squadsAtTime.push({ field: squadsAtTime.length + 1, members: [] });
      }

      // Fill existing squads at this time
      for (const squad of squadsAtTime) {
        while (squad.members.length < 6) {
          let selected = null;
          if (currentMinutes < MORNING_END && morningIdx < morningPool.length) {
            selected = morningPool[morningIdx++];
          } else if (currentMinutes >= AFTERNOON_START && afternoonIdx < afternoonPool.length) {
            selected = afternoonPool[afternoonIdx++];
          } else if (randomIdx < randomPool.length) {
            selected = randomPool[randomIdx++];
          } else {
            break;
          }
          if (selected) squad.members.push(selected.id);
        }
      }

      // Move to next 20-min slot
      currentM += 20;
      if (currentM >= 60) {
        currentH += Math.floor(currentM / 60);
        currentM = currentM % 60;
      }
      if (currentH > 22) break;
    }

    // Remove empty squads
    for (const [time, squads] of finalSquads.entries()) {
      const filtered = squads.filter(s => s.members.length > 0);
      if (filtered.length === 0) finalSquads.delete(time);
      else finalSquads.set(time, filtered);
    }

    // Insert into DB
    let squadCounter = 1;
    let bibCounter = 1;

    // Get max bib for continuing numbering if needed
    if (registrationDay && registrationDay !== 'all') {
      const maxBibRes = await pool.query(`
        SELECT MAX(sm.bib_number) as max_bib 
        FROM event_squad_members sm 
        JOIN event_squads s ON sm.squad_id = s.id 
        WHERE s.event_id = $1
      `, [id]);
      bibCounter = (maxBibRes.rows[0].max_bib || 0) + 1;
    }

    // Sort times for insertion
    const sortedTimes = Array.from(finalSquads.keys()).sort();

    for (const time of sortedTimes) {
      const squads = finalSquads.get(time)!;
      for (const squad of squads) {
        const squadInsert = await pool.query(
          'INSERT INTO event_squads (event_id, squad_number, field_number, round_number, start_time, squad_day) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [id, squadCounter++, squad.field, 1, time, (registrationDay && registrationDay !== 'all') ? registrationDay : null]
        );
        const squadId = squadInsert.rows[0].id;

        for (let pos = 0; pos < squad.members.length; pos++) {
          await pool.query(
            'INSERT INTO event_squad_members (squad_id, registration_id, position, bib_number) VALUES ($1, $2, $3, $4)',
            [squadId, squad.members[pos], pos + 1, bibCounter++]
          );
        }
      }
    }

    res.json({ message: `Generate ${squadCounter - 1} batterie per la Serie 1. Duplica i giri successivi quando le batterie sono definitive.` });
  } catch (error) {
    console.error('Error generating squads:', error);
    res.status(500).json({ error: 'Failed to generate squads' });
  }
});

app.post('/api/events/:id/squads/bulk-lock', authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  const { roundNumber, squadDay, lock } = req.body;
  
  try {
    const eventResult = await pool.query('SELECT location FROM events WHERE id = $1', [id]);
    if (eventResult.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const event = eventResult.rows[0];

    const isAdmin = req.user.role === 'admin';
    const isSociety = req.user.role === 'society' && req.user.society === event.location;

    if (!isAdmin && !isSociety) {
      return res.status(403).json({ error: 'Permesso negato' });
    }

    let query = 'UPDATE event_squads SET is_locked = $1 WHERE event_id = $2';
    let params: any[] = [lock, id];
    
    if (roundNumber) {
      query += ' AND round_number = $3';
      params.push(roundNumber);
    }
    
    if (squadDay && squadDay !== 'all') {
      let altDay = squadDay;
      if (squadDay.includes('-')) {
        const parts = squadDay.split('-');
        altDay = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else if (squadDay.includes('/')) {
        const parts = squadDay.split('/');
        altDay = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      query += ` AND (squad_day = $${params.length + 1} OR squad_day = $${params.length + 2})`;
      params.push(squadDay, altDay);
    }
    
    await pool.query(query, params);
    res.json({ message: 'Batterie aggiornate con successo' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Duplicate rounds logic
app.post('/api/events/:id/squads/duplicate-rounds', authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  const { registrationDay, startTime } = req.body;

  try {
    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    if (eventResult.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const event = eventResult.rows[0];

    const totalRounds = event.total_rounds || 1;
    const totalFields = event.total_fields || 1;

    if (totalRounds <= 1) {
      return res.status(400).json({ error: 'Numero di serie (giri) deve essere maggiore di 1 per duplicare.' });
    }

    // Get all squads for round 1 of the selected day
    let round1Query = 'SELECT * FROM event_squads WHERE event_id = $1 AND round_number = 1';
    let queryParams: any[] = [id];
    if (registrationDay && registrationDay !== 'all') {
      let altDay = registrationDay;
      if (registrationDay.includes('-')) {
        const parts = registrationDay.split('-');
        altDay = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else if (registrationDay.includes('/')) {
        const parts = registrationDay.split('/');
        altDay = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      round1Query += ' AND (squad_day = $2 OR squad_day = $3)';
      queryParams.push(registrationDay, altDay);
    }
    const round1SquadsResult = await pool.query(round1Query, queryParams);
    const round1Squads = round1SquadsResult.rows;
    
    console.log('Round 1 squads found for duplication:', round1Squads.map(s => ({ id: s.id, num: s.squad_number, locked: s.is_locked, day: s.squad_day })));

    if (round1Squads.length === 0) {
      return res.status(400).json({ error: 'Nessuna batteria trovata per il giro 1.' });
    }

    // Check if all round 1 squads are locked
    const unlockedSquads = round1Squads.filter(s => !s.is_locked);
    if (unlockedSquads.length > 0) {
      const unlockedDetails = unlockedSquads.map(s => `B${s.squad_number} (${s.squad_day || 'Senza data'})`).join(', ');
      return res.status(400).json({ 
        error: `Ci sono ancora ${unlockedSquads.length} batterie da confermare nella Serie 1: ${unlockedDetails}. Assicurati che siano tutte bloccate per questo giorno.` 
      });
    }

    // Delete rounds > 1 for the selected day
    let deleteQuery = 'DELETE FROM event_squads WHERE event_id = $1 AND round_number > 1';
    let deleteParams: any[] = [id];
    if (registrationDay && registrationDay !== 'all') {
      let altDay = registrationDay;
      if (registrationDay.includes('-')) {
        const parts = registrationDay.split('-');
        altDay = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else if (registrationDay.includes('/')) {
        const parts = registrationDay.split('/');
        altDay = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      deleteQuery += ' AND (squad_day = $2 OR squad_day = $3)';
      deleteParams.push(registrationDay, altDay);
    }
    await pool.query(deleteQuery, deleteParams);

    // Use the earliest start time from Round 1 as base to ensure continuity
    const round1Sorted = [...round1Squads].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const baseStartTime = round1Sorted[0].start_time;
    const startHour = parseInt(baseStartTime.split(':')[0]);
    const startMinute = parseInt(baseStartTime.split(':')[1]);

    // Sort squads by number to keep rotation consistent
    round1Squads.sort((a, b) => a.squad_number - b.squad_number);

    for (let r = 2; r <= totalRounds; r++) {
      for (let i = 0; i < round1Squads.length; i++) {
        const baseSquad = round1Squads[i];
        
        // Rotation logic: shift field by (r-1)
        const fieldNumber = ((i + (r - 1)) % totalFields) + 1;
        
        // Time calculation: 20 min intervals, strictly sequential across all squads and rounds
        const squadsPerRound = round1Squads.length;
        const timeSlotIndex = i + (r - 1) * squadsPerRound;
        
        const totalMinutes = startHour * 60 + startMinute + timeSlotIndex * 20;
        const squadHour = Math.floor(totalMinutes / 60);
        const squadMinute = totalMinutes % 60;
        const squadStartTime = `${squadHour.toString().padStart(2, '0')}:${squadMinute.toString().padStart(2, '0')}`;

        const squadInsert = await pool.query(
          'INSERT INTO event_squads (event_id, squad_number, field_number, round_number, start_time, squad_day, is_locked) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id',
          [id, baseSquad.squad_number, fieldNumber, r, squadStartTime, baseSquad.squad_day]
        );
        const newSquadId = squadInsert.rows[0].id;

        // Get members of base squad to duplicate them
        const membersResult = await pool.query('SELECT * FROM event_squad_members WHERE squad_id = $1', [baseSquad.id]);
        for (const member of membersResult.rows) {
          await pool.query(
            'INSERT INTO event_squad_members (squad_id, registration_id, position, bib_number) VALUES ($1, $2, $3, $4)',
            [newSquadId, member.registration_id, member.position, member.bib_number]
          );
        }
      }
    }

    res.json({ message: `Serie duplicate con successo: Serie 1 copiata nelle Serie 2-${totalRounds}` });
  } catch (err: any) {
    console.error('Error duplicating rounds:', err);
    res.status(500).json({ error: err.message });
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
        `SELECT m.position, m.bib_number, r.id as registration_id, u.name as first_name, u.surname as last_name, u.shooter_code, u.society, u.category, u.qualification
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

    const { squads, squad_day } = req.body;

    if (squad_day && squad_day !== 'all') {
      await pool.query('DELETE FROM event_squads WHERE event_id = $1 AND squad_day = $2', [id, squad_day]);
    } else {
      await pool.query('DELETE FROM event_squads WHERE event_id = $1', [id]);
    }

    for (const squad of squads) {
      const squadInsert = await pool.query(
        'INSERT INTO event_squads (event_id, squad_number, field_number, round_number, start_time, squad_day, is_locked) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [id, squad.squad_number, squad.field_number, squad.round_number || 1, squad.start_time, squad.squad_day || (squad_day !== 'all' ? squad_day : null), squad.is_locked || false]
      );
      const newSquadId = squadInsert.rows[0].id;

      for (let i = 0; i < squad.members.length; i++) {
        const member = squad.members[i];
        await pool.query(
          'INSERT INTO event_squad_members (squad_id, registration_id, position, bib_number) VALUES ($1, $2, $3, $4)',
          [newSquadId, member.registration_id, i + 1, member.bib_number]
        );

        // Sync shooting_session and day for Round 1 members to ensure occupancy limits are accurate
        if ((squad.round_number || 1) === 1 && squad.start_time) {
          await pool.query(
            'UPDATE event_registrations SET shooting_session = $1, registration_day = $2 WHERE id = $3 AND (shooting_session IS NULL OR shooting_session IN (\'morning\', \'afternoon\') OR shooting_session != $1)',
            [squad.start_time, squad.squad_day, member.registration_id]
          );
        }
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

  const { 
    id, name, type, visibility, discipline, location, targets, start_date, end_date, 
    cost, notes, poster_url, registration_link, prize_settings, ranking_logic, 
    ranking_preference_override, has_society_ranking, has_team_ranking,
    is_public, is_odt_public, region, total_fields, total_rounds, use_fields_capacity,
    start_time, end_time, show_time_slot_to_shooters
  } = req.body;
  
  let processedRegion = region;
  if (!processedRegion && location) {
    try {
      const { rows: societies } = await pool.query("SELECT region FROM societies WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))", [location]);
      if (societies.length > 0) processedRegion = societies[0].region;
    } catch (e) {
      console.error("Error fetching region for society:", e);
    }
  }
  
  try {
    await pool.query(
      `INSERT INTO events (
        id, name, type, visibility, discipline, location, targets, start_date, end_date, 
        cost, notes, poster_url, registration_link, created_by, prize_settings, 
        ranking_logic, ranking_preference_override, has_society_ranking, has_team_ranking,
        is_public, is_odt_public, region, total_fields, total_rounds, use_fields_capacity,
        start_time, end_time, show_time_slot_to_shooters
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
       ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name, type = EXCLUDED.type, visibility = EXCLUDED.visibility, 
        discipline = EXCLUDED.discipline, location = EXCLUDED.location, targets = EXCLUDED.targets, 
        start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, cost = EXCLUDED.cost, 
        notes = EXCLUDED.notes, poster_url = EXCLUDED.poster_url, registration_link = EXCLUDED.registration_link,
        prize_settings = EXCLUDED.prize_settings, ranking_logic = EXCLUDED.ranking_logic,
        ranking_preference_override = EXCLUDED.ranking_preference_override,
        has_society_ranking = EXCLUDED.has_society_ranking,
        has_team_ranking = EXCLUDED.has_team_ranking,
        is_public = EXCLUDED.is_public,
        is_odt_public = EXCLUDED.is_odt_public,
        region = EXCLUDED.region,
        total_fields = EXCLUDED.total_fields,
        total_rounds = EXCLUDED.total_rounds,
        use_fields_capacity = EXCLUDED.use_fields_capacity,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        show_time_slot_to_shooters = EXCLUDED.show_time_slot_to_shooters`,
      [
        id, name, type, visibility, discipline, location, targets, start_date, end_date, 
        cost, notes, poster_url, registration_link, req.user.id, prize_settings, 
        ranking_logic || 'individual', ranking_preference_override, has_society_ranking || false, 
        has_team_ranking || false, is_public || false, is_odt_public || false, processedRegion, total_fields || 1, total_rounds || 1,
        use_fields_capacity || false, start_time || '08:00', end_time || '18:00',
        show_time_slot_to_shooters === undefined ? true : show_time_slot_to_shooters
      ]
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
      sendPushNotification(userIds, 
        { it: "Nuovo Evento!", en: "New Event!" },
        { 
          it: `${name} presso ${location}`,
          en: `${name} at ${location}`
        }, 
        `/events?id=${id}`, 
        visibility === 'Pubblica' ? 'all' : 'society'
      );
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

app.patch('/api/events/:id/toggle-public', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'society') {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const { id } = req.params;

  try {
    const { rows: events } = await pool.query("SELECT is_public, location, region FROM events WHERE id = $1", [id]);
    if (events.length === 0) return res.status(404).json({ error: 'Gara non trovata' });

    const currentPublic = events[0].is_public;
    const location = events[0].location;
    let currentRegion = events[0].region;

    // Sync region from society when publishing to ensure it's correct
    if (!currentPublic) {
      const { rows: societies } = await pool.query("SELECT region FROM societies WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))", [location]);
      if (societies.length > 0 && societies[0].region) {
        currentRegion = societies[0].region;
      }
    }

    await pool.query(
      `UPDATE events SET is_public = $1, region = $2 WHERE id = $3`,
      [!currentPublic, currentRegion, id]
    );

    res.json({ success: true, is_public: !currentPublic, region: currentRegion });
  } catch (err) {
    console.error('Error toggling public status:', err);
    res.status(500).json({ error: 'Errore interno' });
  }
});

app.patch('/api/events/:id/toggle-odt', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'society') {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const { id } = req.params;

  try {
    const { rows: events } = await pool.query("SELECT is_odt_public FROM events WHERE id = $1", [id]);
    if (events.length === 0) return res.status(404).json({ error: 'Gara non trovata' });

    const currentOdtPublic = events[0].is_odt_public || false;

    await pool.query(
      `UPDATE events SET is_odt_public = $1 WHERE id = $2`,
      [!currentOdtPublic, id]
    );

    res.json({ success: true, is_odt_public: !currentOdtPublic });
  } catch (err) {
    console.error('Error toggling ODT public status:', err);
    res.status(500).json({ error: 'Errore durante la modifica ODT' });
  }
});

app.put('/api/events/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'society') {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const { 
    name, type, visibility, discipline, location, targets, start_date, end_date, 
    cost, notes, poster_url, registration_link, prize_settings, ranking_logic, 
    ranking_preference_override, has_society_ranking, has_team_ranking,
    is_public, region, total_fields, total_rounds, use_fields_capacity,
    start_time, end_time, show_time_slot_to_shooters
  } = req.body;
  
  let processedRegion = region;
  if (!processedRegion && location) {
    try {
      const { rows: societies } = await pool.query("SELECT region FROM societies WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))", [location]);
      if (societies.length > 0) processedRegion = societies[0].region;
    } catch (e) {
      console.error("Error fetching region for society:", e);
    }
  }
  
  try {
    // Check if event is validated
    const { rows: currentEvent } = await pool.query("SELECT status, location, created_by, name, visibility FROM events WHERE id = $1", [req.params.id]);
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
        has_team_ranking = COALESCE($17, has_team_ranking),
        is_public = COALESCE($18, is_public),
        region = COALESCE($19, region),
        total_fields = COALESCE($20, total_fields),
        total_rounds = COALESCE($21, total_rounds),
        use_fields_capacity = COALESCE($22, use_fields_capacity),
        start_time = COALESCE($23, start_time),
        end_time = COALESCE($24, end_time),
        show_time_slot_to_shooters = COALESCE($26, show_time_slot_to_shooters)
      WHERE id = $25`,
      [
        name, type, visibility, discipline, location, targets, start_date, end_date, 
        cost, notes, poster_url, registration_link, prize_settings, ranking_logic, 
        ranking_preference_override, has_society_ranking, has_team_ranking, is_public, processedRegion, 
        total_fields, total_rounds, use_fields_capacity, start_time, end_time,
        req.params.id, show_time_slot_to_shooters === undefined ? true : show_time_slot_to_shooters
      ]
    );

    // Use fallbacks for notification logic (for partial updates where body might be missing these fields)
    const notificationName = name || currentEvent[0].name;
    const notificationVisibility = visibility || currentEvent[0].visibility;
    const notificationLocation = location || currentEvent[0].location;

    // Send push notification for update
    let userIds: number[] = [];
    if (notificationVisibility === 'Pubblica') {
      const { rows: users } = await pool.query("SELECT id FROM users WHERE role != 'society'");
      userIds = users.map(u => u.id);
    } else {
      let targetSociety = req.user.society;
      if (!targetSociety && req.user.role === 'admin') {
        targetSociety = notificationLocation;
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
      sendPushNotification(userIds, 
        { it: "Evento Aggiornato", en: "Event Updated" },
        { 
          it: `L'evento "${notificationName}" ha subito delle modifiche.`,
          en: `The event "${notificationName}" has been modified.`
        }, 
        `/events?id=${req.params.id}`, 
        notificationVisibility === 'Pubblica' ? 'all' : 'society',
        req.params.id
      );
    }

    // Admin compact notification
    const from = req.user.role === 'admin' ? 'Admin' : req.user.society;
    const targetSociety = notificationVisibility === 'Pubblica' ? null : (req.user.society || notificationLocation);
    await sendAdminCompactNotification('gara', notificationName, 'aggiornata', notificationVisibility, targetSociety, from);

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
      sendPushNotification(userIds, 
        { it: "Evento Annullato", en: "Event Cancelled" },
        { 
          it: `L'evento "${event.name}" è stato annullato.`,
          en: `The event "${event.name}" has been cancelled.`
        }, 
        `/events`, 
        event.visibility === 'Pubblica' ? 'all' : 'society'
      );
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

    // Send push notification indicating results have been published
    const notificationName = event.name;
    const notificationVisibility = event.visibility;
    const notificationLocation = event.location;

    let userIds: number[] = [];
    if (notificationVisibility === 'Pubblica') {
      const { rows: users } = await pool.query("SELECT id FROM users WHERE role != 'society'");
      userIds = users.map(u => u.id);
    } else {
      let targetSociety = req.user.society;
      if (!targetSociety && req.user.role === 'admin') {
        targetSociety = notificationLocation;
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
      await sendPushNotification(userIds, 
        { it: "Risultati Pubblicati! 🏆", en: "Results Published! 🏆" },
        { 
          it: `I risultati e la classifica per "${notificationName}" sono stati pubblicati nel portale risultati.`,
          en: `The results and ranking for "${notificationName}" have been published in the results portal.`
        }, 
        `/gare?id=${id}`, 
        notificationVisibility === 'Pubblica' ? 'all' : 'society',
        id
      );
    }

    // Admin compact notification
    const from = req.user.role === 'admin' ? 'Admin' : req.user.society;
    const targetSociety = notificationVisibility === 'Pubblica' ? null : (req.user.society || notificationLocation);
    await sendAdminCompactNotification('gara', notificationName, 'pubblicata', notificationVisibility, targetSociety, from);

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
const sendAdminCompactNotification = async (entityType: 'gara' | 'sfida', name: string, action: 'inserita' | 'aggiornata' | 'eliminata' | 'pubblicata', visibility: string, targetSociety: string | null, from: string) => {
  try {
    const { rows: adminRows } = await pool.query("SELECT id FROM users WHERE email = 'snecaj@gmail.com'");
    const adminId = adminRows[0]?.id;
    if (!adminId) return;

    const { rows: settingsRows } = await pool.query("SELECT admin_notifications_enabled FROM notification_settings WHERE user_id = $1", [adminId]);
    if (settingsRows.length > 0 && !settingsRows[0].admin_notifications_enabled) return;

    const targetDesc = visibility === 'Pubblica' 
      ? { it: 'tutti i tiratori', en: 'all shooters' } 
      : { it: `i tiratori della "${targetSociety || 'Società'}"`, en: `shooters of "${targetSociety || 'Club'}"` };
    
    const body = {
      it: `La ${entityType === 'gara' ? 'gara' : 'sfida'} "${name}" è stata ${action} ed inviata a ${targetDesc.it} da ${from}.`,
      en: `The ${entityType === 'gara' ? 'event' : 'challenge'} "${name}" has been ${action === 'inserita' ? 'inserted' : action === 'aggiornata' ? 'updated' : action === 'pubblicata' ? 'published' : 'deleted'} and sent to ${targetDesc.en} by ${from}.`
    };
    
    await sendPushNotification([adminId], { it: "Notifica Admin", en: "Admin Notification" }, body, entityType === 'gara' ? '/events' : '/challenges');
  } catch (err) {
    console.error("Error in sendAdminCompactNotification:", err);
  }
};
// Public endpoints for results portal
app.get('/api/public/events', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${new Date().toISOString()}] [${requestId}] PUBLIC FETCH: GET /api/public/events from ${req.ip}`);
  try {
    const query = `
      SELECT 
        e.*, 
        s.code as society_code,
        u.name as creator_name,
        (SELECT COUNT(*)::INTEGER FROM competitions c WHERE c.event_id = e.id) as result_count
      FROM events e 
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN societies s ON LOWER(TRIM(e.location)) = LOWER(TRIM(s.name))
      WHERE COALESCE(e.is_public, FALSE) = TRUE
      ORDER BY e.start_date DESC
    `;
    
    console.log(`[${new Date().toISOString()}] [${requestId}] PUBLIC FETCH: Executing query...`);
    const { rows: events } = await pool.query(query);
    console.log(`[${new Date().toISOString()}] [${requestId}] PUBLIC FETCH: Query executed, found ${events.length} rows`);
    res.json(events);
  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] [${requestId}] PUBLIC FETCH ERROR:`, {
      message: err.message,
      stack: err.stack,
      code: err.code,
      detail: err.detail
    });
    // Send a clearer message to the client
    res.status(500).json({ 
      error: 'Failed to fetch public events', 
      details: err.message,
      code: err.code 
    });
  }
});

app.get('/api/public/events/:id/results', async (req, res) => {
  try {
    const { rows: results } = await pool.query(
      `SELECT 
         c.id, c.user_id, c.name, c.date, c.enddate, c.location, c.discipline, c.level, 
         c.totalscore, c.totaltargets, c.averageperseries, c.position, c.cost, c.win, 
         c.notes, c.weather, c.scores, c.detailedscores, c.usedcartridges, c.chokes, 
         c.event_id, c.shoot_off, c.category_at_time, c.qualification_at_time, c.society_at_time, 
         c.ranking_preference, c.ranking_preference_override, c.hidden_from_user, c.team_id, c.team_name,
         u.id as user_id, u.name as user_name, u.surname as user_surname, u.society, u.avatar
       FROM competitions c
       JOIN users u ON c.user_id = u.id
       JOIN events e ON c.event_id = e.id
       WHERE c.event_id = $1 AND e.is_public = TRUE
       ORDER BY c.totalscore DESC`,
      [req.params.id]
    );

    const parsedResults = results.map(r => ({
      ...r,
      scores: r.scores ? (typeof r.scores === 'string' ? JSON.parse(r.scores) : r.scores) : [],
      detailedScores: r.detailedscores ? (typeof r.detailedscores === 'string' ? JSON.parse(r.detailedscores) : r.detailedscores) : null
    }));

    res.json(parsedResults);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET public squads for an event
app.get('/api/public/events/:id/squads', async (req, res) => {
  const { id } = req.params;
  try {
    const squadsResult = await pool.query(
      'SELECT * FROM event_squads WHERE event_id = $1 ORDER BY squad_number',
      [id]
    );
    const squads = squadsResult.rows;

    for (const squad of squads) {
      const membersResult = await pool.query(
        `SELECT m.position, m.bib_number, r.id as registration_id, u.name as first_name, u.surname as last_name, u.shooter_code, u.society, u.category, u.qualification
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
    console.error('Error fetching public squads:', error);
    res.status(500).json({ error: 'Failed to fetch public squads' });
  }
});

app.get('/api/public/events/:id/teams', async (req, res) => {
  try {
    const eventId = req.params.id;
    // Get event name
    const eventRes = await pool.query('SELECT name, is_public FROM events WHERE id = $1', [eventId]);
    if (eventRes.rows.length === 0 || !eventRes.rows[0].is_public) {
      return res.status(404).json({ error: 'Event not found or not public' });
    }
    const eventName = eventRes.rows[0].name;

    const { rows: teams } = await pool.query(
      `SELECT t.*, 
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', u.id,
                    'first_name', u.name,
                    'last_name', u.surname,
                    'category', u.category,
                    'qualification', u.qualification
                  )
                ) FILTER (WHERE u.id IS NOT NULL), 
                '[]'
              ) as members,
              COALESCE(json_agg(tm.user_id) FILTER (WHERE tm.user_id IS NOT NULL), '[]') as member_ids
       FROM teams t
       JOIN events e ON e.name = t.competition_name
       LEFT JOIN team_members tm ON t.id = tm.team_id
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE e.id = $1 AND e.is_public = TRUE
       GROUP BY t.id`,
      [eventId]
    );
    res.json(teams);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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
    const userDetails = await pool.query('SELECT category, qualification, society, discipline_categories, is_cacciatore FROM users WHERE id = $1', [targetUserId]);
    const isCacciatore = userDetails.rows[0]?.is_cacciatore || false;
    let cat = userDetails.rows[0]?.category || null;
    const qual = userDetails.rows[0]?.qualification || null;
    const soc = userDetails.rows[0]?.society || null;
    const discCats = userDetails.rows[0]?.discipline_categories || null;

    if (!isCacciatore && discCats) {
      const discCat = getCategoryForDisciplineBackend(discCats, c.discipline);
      if (discCat) {
        cat = normalizeCategoryBackend(discCat);
      }
    }

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
        'all',
        c.eventId || undefined
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
        'all',
        compEventId || undefined
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
    // Check if competition is linked to a validated event or locked squad
    const compCheck = await pool.query('SELECT event_id, user_id FROM competitions WHERE id = $1', [req.params.id]);
    if (compCheck.rows.length > 0 && compCheck.rows[0].event_id) {
      const eventId = compCheck.rows[0].event_id;
      const targetUserId = compCheck.rows[0].user_id;

      // validated event check
      const eventCheck = await pool.query('SELECT status FROM events WHERE id = $1', [eventId]);
      if (eventCheck.rows.length > 0 && eventCheck.rows[0].status === 'validated' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Questa gara è stata convalidata e non può più essere modificata.' });
      }

      // locked squad check for shooter
      if (req.user.role === 'user' && req.user.id === targetUserId) {
        const squadCheck = await pool.query(
          `SELECT s.is_locked 
           FROM event_squad_members sm 
           JOIN event_squads s ON sm.squad_id = s.id 
           JOIN event_registrations er ON sm.registration_id = er.id
           WHERE er.event_id = $1 AND er.user_id = $2`,
          [eventId, targetUserId]
        );
        if (squadCheck.rows.some(s => s.is_locked)) {
          return res.status(400).json({ error: 'squad_locked_contact_society' });
        }
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

// Regional Championships Routes
app.get('/api/regional-championships', authenticateToken, async (req: any, res) => {
  try {
    let query = 'SELECT * FROM regional_championships';
    if (req.user.role !== 'admin') {
      query += ' WHERE is_visible = true';
    }
    query += ' ORDER BY year DESC, name ASC';
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/regional-championships', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo gli amministratori possono gestire i campionati regionali.' });
    }
    const { id, name, year, season, region, discipline, trial1_name, trial1_event_id, trial2_name, trial2_event_id, trial3_name, trial3_event_id, trial4_name, trial4_event_id } = req.body;
    const rcId = id || 'rc_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    await pool.query(
      `INSERT INTO regional_championships (id, name, year, season, region, discipline, trial1_name, trial1_event_id, trial2_name, trial2_event_id, trial3_name, trial3_event_id, trial4_name, trial4_event_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [rcId, name, parseInt(year) || new Date().getFullYear(), season, region, discipline, trial1_name || null, trial1_event_id || null, trial2_name || null, trial2_event_id || null, trial3_name || null, trial3_event_id || null, trial4_name || null, trial4_event_id || null]
    );
    res.json({ success: true, id: rcId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/regional-championships/:id', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo gli amministratori possono gestire i campionati regionali.' });
    }
    const { name, year, season, region, discipline, trial1_name, trial1_event_id, trial2_name, trial2_event_id, trial3_name, trial3_event_id, trial4_name, trial4_event_id } = req.body;
    await pool.query(
      `UPDATE regional_championships 
       SET name=$1, year=$2, season=$3, region=$4, discipline=$5, 
           trial1_name=$6, trial1_event_id=$7, 
           trial2_name=$8, trial2_event_id=$9, 
           trial3_name=$10, trial3_event_id=$11, 
           trial4_name=$12, trial4_event_id=$13
       WHERE id=$14`,
      [name, parseInt(year) || new Date().getFullYear(), season, region, discipline, trial1_name || null, trial1_event_id || null, trial2_name || null, trial2_event_id || null, trial3_name || null, trial3_event_id || null, trial4_name || null, trial4_event_id || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/regional-championships/:id/toggle-visibility', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo gli amministratori possono gestire i campionati regionali.' });
    }
    const { is_visible } = req.body;
    await pool.query(
      `UPDATE regional_championships SET is_visible=$1 WHERE id=$2`,
      [is_visible, req.params.id]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/regional-championships/:id', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo gli amministratori possono gestire i campionati regionali.' });
    }
    await pool.query('DELETE FROM regional_championships WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/regional-championships/:id/ranking', authenticateToken, async (req: any, res) => {
  try {
    const champRes = await pool.query('SELECT * FROM regional_championships WHERE id = $1', [req.params.id]);
    if (champRes.rows.length === 0) return res.status(404).json({ error: 'Campionato non trovato.' });
    const rc = champRes.rows[0];

    // Fetch ALL users and join their society to check their region
    let shootersQuery = `
      SELECT u.id, u.name, u.surname, u.shooter_code, u.category, u.qualification, u.society, s.region as society_region
      FROM users u
      LEFT JOIN societies s ON LOWER(TRIM(u.society)) = LOWER(TRIM(s.name)) OR LOWER(TRIM(u.society)) = LOWER(TRIM(s.code))
      WHERE u.role != 'society'
    `;
    let shootersParams: any[] = [];
    if (rc.region !== 'Tutte' && rc.region !== '') {
      shootersQuery += ` AND s.region IS NOT NULL AND LOWER(TRIM(s.region)) = LOWER(TRIM($1))`;
      shootersParams.push(rc.region);
    }
    const shootersRes = await pool.query(shootersQuery, shootersParams);
    const shooters = shootersRes.rows;

    // Fetch ALL active competitions of this discipline
    const compsRes = await pool.query(`
      SELECT c.*, u.name as "userName", u.surname as "userSurname", u.shooter_code as "shooterCode"
      FROM competitions c
      JOIN users u ON c.user_id = u.id
      WHERE c.totalscore > 0
    `);

    const cleanDisc = (str: string) => {
      return (str || '')
        .toLowerCase()
        .replace(/\s*\(.*?\)\s*/g, '') // Rimuove sigle tra parentesi tipo (CK) o (FO)
        .trim();
    };

    const targetDisciplineClean = cleanDisc(rc.discipline);
    const competitions = compsRes.rows.filter((c: any) => {
      const dbDisciplineClean = cleanDisc(c.discipline);
      return dbDisciplineClean === targetDisciplineClean ||
             dbDisciplineClean.includes(targetDisciplineClean) ||
             targetDisciplineClean.includes(dbDisciplineClean) ||
             (targetDisciplineClean === 'percorso di caccia' && dbDisciplineClean === 'sporting') ||
             (targetDisciplineClean === 'sporting' && dbDisciplineClean === 'percorso di caccia');
    });

    const isTrialMatch = (comp: any, trialName: string | null, trialEventId: string | null) => {
      if (trialEventId && comp.event_id === trialEventId) return true;
      if (!trialName) return false;
      const compName = (comp.name || '').toLowerCase().trim();
      const tName = trialName.toLowerCase().trim();
      const compLocation = (comp.location || '').toLowerCase().trim();
      if (compName === tName || compLocation === tName || compName.includes(tName) || tName.includes(compName)) return true;

      const normalize = (str: string) => {
        return str
          .replace(/[°ªº\.\-\,\/]/g, ' ')
          .replace(/\b(1a|1o|1°|1st|prima|1ª|1º)\b/gi, '1')
          .replace(/\b(2a|2o|2°|2nd|seconda|2ª|2º)\b/gi, '2')
          .replace(/\b(3a|3o|3°|3rd|terza|3ª|3º)\b/gi, '3')
          .replace(/\b(4a|4o|4°|4th|quarta|4ª|4º)\b/gi, '4')
          .replace(/\btav\b/gi, '')
          .replace(/\basd\b/gi, '')
          .toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > 1);
      };

      const compTokens = normalize(compName);
      const trialTokens = normalize(tName);
      const locTokens = normalize(compLocation);

      if (compTokens.length === 0 || trialTokens.length === 0) return false;

      const getNumber = (tokens: string[]) => tokens.find(t => ['1', '2', '3', '4'].includes(t));
      const compNum = getNumber(compTokens);
      const trialNum = getNumber(trialTokens);

      if (compNum && trialNum && compNum !== trialNum) return false;

      const intersection = compTokens.filter(t => trialTokens.includes(t));
      const locIntersection = locTokens.filter(t => trialTokens.includes(t));
      const totalMatchCount = new Set([...intersection, ...locIntersection]).size;

      const minTokensToMatch = Math.min(compTokens.length, 3);
      if (totalMatchCount >= minTokensToMatch) {
         return true;
      }
      return false;
    };

    const shooterTrials = new Map();

    shooters.forEach((s: any) => {
      const userComps = competitions.filter((c: any) => c.user_id === s.id);
      let score1: number | null = null;
      let score2: number | null = null;
      let score3: number | null = null;
      let score4: number | null = null;
      const matchedComps: any[] = [];
      const matchedCompIds = new Set<string>();

      // A helper to match specific trial
      const checkMatch = (comp: any, trialName: string | null, trialEventId: string | null) => {
        // If event_id is specified, strictly require matching event_id
        if (trialEventId) {
          return comp.event_id === trialEventId;
        }
        // Otherwise use name fuzzy match
        return isTrialMatch(comp, trialName, trialEventId);
      };

      // Match Trial 1
      userComps.forEach((c: any) => {
        if (!matchedCompIds.has(c.id) && checkMatch(c, rc.trial1_name, rc.trial1_event_id)) {
          if (score1 === null || c.totalscore > score1) score1 = c.totalscore;
          matchedCompIds.add(c.id);
          matchedComps.push(c);
        }
      });

      // Match Trial 2
      userComps.forEach((c: any) => {
        if (!matchedCompIds.has(c.id) && checkMatch(c, rc.trial2_name, rc.trial2_event_id)) {
          if (score2 === null || c.totalscore > score2) score2 = c.totalscore;
          matchedCompIds.add(c.id);
          matchedComps.push(c);
        }
      });

      // Match Trial 3
      userComps.forEach((c: any) => {
        if (!matchedCompIds.has(c.id) && checkMatch(c, rc.trial3_name, rc.trial3_event_id)) {
          if (score3 === null || c.totalscore > score3) score3 = c.totalscore;
          matchedCompIds.add(c.id);
          matchedComps.push(c);
        }
      });

      // Match Trial 4
      userComps.forEach((c: any) => {
        if (!matchedCompIds.has(c.id) && checkMatch(c, rc.trial4_name, rc.trial4_event_id)) {
          if (score4 === null || c.totalscore > score4) score4 = c.totalscore;
          matchedCompIds.add(c.id);
          matchedComps.push(c);
        }
      });

      // Sort matchedComps chronologically (by date) to lock first choice
      matchedComps.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const firstComp = matchedComps.length > 0 ? matchedComps[0] : null;

      shooterTrials.set(s.id, {
        trial1: score1,
        trial2: score2,
        trial3: score3,
        trial4: score4,
        firstComp
      });
    });

    const shooterClassification = new Map();
    shooters.forEach((s: any) => {
      const tr = shooterTrials.get(s.id);
      let mode: 'categoria' | 'qualifica' = 'categoria';
      let value: string = s.category || 'Terza';

      if (tr && tr.firstComp) {
        const pref = tr.firstComp.ranking_preference || tr.firstComp.ranking_preference_override || 'categoria';
        if (pref === 'qualifica') {
          mode = 'qualifica';
          value = tr.firstComp.qualification_at_time || s.qualification || 'Senior';
        } else {
          mode = 'categoria';
          value = tr.firstComp.category_at_time || s.category || 'Terza';
        }
      } else {
        mode = 'categoria';
        value = s.category || 'Terza';
      }
      shooterClassification.set(s.id, { mode, value });
    });

    const maxScoresCategory: { [trial: string]: { [cat: string]: number } } = { t1: {}, t2: {}, t3: {}, t4: {} };
    const maxScoresQualification: { [trial: string]: { [qual: string]: number } } = { t1: {}, t2: {}, t3: {}, t4: {} };

    shooters.forEach((s: any) => {
      const tr = shooterTrials.get(s.id);
      const cls = shooterClassification.get(s.id);
      if (!tr || !cls) return;
      const { mode, value } = cls;

      const checkMax = (trialKey: 'trial1' | 'trial2' | 'trial3' | 'trial4', maxDictKey: 't1' | 't2' | 't3' | 't4') => {
        const score = tr[trialKey];
        if (score !== null) {
          if (mode === 'categoria') {
            const currentMax = maxScoresCategory[maxDictKey][value] || 0;
            if (score > currentMax) maxScoresCategory[maxDictKey][value] = score;
          } else {
            const currentMax = maxScoresQualification[maxDictKey][value] || 0;
            if (score > currentMax) maxScoresQualification[maxDictKey][value] = score;
          }
        }
      };

      checkMax('trial1', 't1');
      checkMax('trial2', 't2');
      checkMax('trial3', 't3');
      checkMax('trial4', 't4');
    });

    const shooterPenalties = shooters.map((s: any) => {
      const tr = shooterTrials.get(s.id)!;
      const cls = shooterClassification.get(s.id)!;
      const { mode, value } = cls;

      const getPenalty = (score: number | null, maxScores: { [key: string]: number }) => {
        if (score === null) return null;
        const maxScore = maxScores[value] || score;
        return Math.max(0, maxScore - score);
      };

      const p1 = getPenalty(tr.trial1, maxScoresCategory.t1);
      const p2 = getPenalty(tr.trial2, maxScoresCategory.t2);
      const p3 = getPenalty(tr.trial3, maxScoresCategory.t3);
      const p4 = getPenalty(tr.trial4, maxScoresCategory.t4);

      const p1q = getPenalty(tr.trial1, maxScoresQualification.t1);
      const p2q = getPenalty(tr.trial2, maxScoresQualification.t2);
      const p3q = getPenalty(tr.trial3, maxScoresQualification.t3);
      const p4q = getPenalty(tr.trial4, maxScoresQualification.t4);

      const actualP1 = mode === 'categoria' ? p1 : p1q;
      const actualP2 = mode === 'categoria' ? p2 : p2q;
      const actualP3 = mode === 'categoria' ? p3 : p3q;
      const actualP4 = mode === 'categoria' ? p4 : p4q;

      const penaltiesList = [actualP1, actualP2, actualP3, actualP4].filter((p): p is number => p !== null);
      const participatedCount = penaltiesList.length;
      let totalPenalties = 0;
      let discardedTrialIdx: number | null = null;
      const isClassified = participatedCount >= (rc.season === 'Invernale' ? 2 : 3);

      if (isClassified) {
        if ((rc.season === 'Invernale' && participatedCount === 3) || participatedCount === 4) {
          const maxP = Math.max(...penaltiesList);
          totalPenalties = penaltiesList.reduce((acc, p) => acc + p, 0) - maxP;
          if (actualP1 === maxP) discardedTrialIdx = 1;
          else if (actualP2 === maxP) discardedTrialIdx = 2;
          else if (actualP3 === maxP) discardedTrialIdx = 3;
          else if (actualP4 === maxP) discardedTrialIdx = 4;
        } else {
          totalPenalties = penaltiesList.reduce((acc, p) => acc + p, 0);
        }
      } else {
        totalPenalties = penaltiesList.reduce((acc, p) => acc + p, 0);
      }

      const totalTargetsHit = [tr.trial1, tr.trial2, tr.trial3, tr.trial4]
        .filter((t): t is number => t !== null)
        .reduce((acc, t) => acc + t, 0);

      return {
        shooterId: s.id,
        name: s.name,
        surname: s.surname,
        shooter_code: s.shooter_code,
        category: s.category,
        society: s.society,
        society_region: s.society_region,
        classificationMode: mode,
        classificationValue: value,
        trialScores: {
          trial1: tr.trial1,
          trial2: tr.trial2,
          trial3: tr.trial3,
          trial4: tr.trial4
        },
        trialPenalties: {
          trial1: actualP1,
          trial2: actualP2,
          trial3: actualP3,
          trial4: actualP4
        },
        participatedCount,
        totalPenalties,
        discardedTrialIdx,
        isClassified,
        totalTargetsHit
      };
    });

    const groupedRankings: { [groupKey: string]: any[] } = {};
    shooterPenalties.forEach((sp: any) => {
      // Include any shooter with at least 1 trial to be shown in intermediate rankings
      if (sp.participatedCount === 0) return;
      const key = `${sp.classificationMode}_${sp.classificationValue}`;
      if (!groupedRankings[key]) groupedRankings[key] = [];
      groupedRankings[key].push(sp);
    });

    Object.keys(groupedRankings).forEach((key) => {
      groupedRankings[key].sort((a, b) => {
        // 1. Sort by qualification status first (classified shooters with >= 3 trials at the top)
        if (a.isClassified !== b.isClassified) {
          return a.isClassified ? -1 : 1;
        }
        // 2. Sort by how many trials they completed (descending so they compare on equal footing)
        if (a.participatedCount !== b.participatedCount) {
          return b.participatedCount - a.participatedCount;
        }
        // 3. Sort by total penalties (ascending)
        if (a.totalPenalties !== b.totalPenalties) {
          return a.totalPenalties - b.totalPenalties;
        }
        // 4. Sort by total targets hit (descending)
        return b.totalTargetsHit - a.totalTargetsHit;
      });
      groupedRankings[key].forEach((sp, idx) => {
        sp.position = idx + 1;
      });
    });

    const uniqueSocieties = [...new Set(shooters.map((s: any) => s.society).filter((soc): soc is string => !!soc))];
    const dL = rc.discipline.toLowerCase();
    const topN = (dL.includes('fossa') || dL.includes('trap')) ? 6 : 3;
    const maxEP = (dL.includes('fossa') || dL.includes('trap')) ? 2 : 1;

    const isEccellenzaOrPrima = (categoryValue: string | null) => {
      if (!categoryValue) return false;
      const cat = categoryValue.toLowerCase().trim();
      return cat === 'e' || cat === 'eccellenza' || cat === '1*' || cat === '1' || cat === 'prima' || cat === 'prima categoria';
    };

    const societyTrials: { [society: string]: { [trial: string]: { score: number, shooters: any[] } | null } } = {};
    uniqueSocieties.forEach((soc) => {
      societyTrials[soc] = { trial1: null, trial2: null, trial3: null, trial4: null };

      const calculateSocietyTrial = (trialKey: 'trial1' | 'trial2' | 'trial3' | 'trial4') => {
        const activeShooters = shooterPenalties.filter((sp) => sp.society === soc && sp.trialScores[trialKey] !== null);
        if (activeShooters.length === 0) return null;

        activeShooters.sort((a, b) => b.trialScores[trialKey]! - a.trialScores[trialKey]!);
        
        const selectedShooters: any[] = [];
        let epCount = 0;

        for (const shooter of activeShooters) {
          if (selectedShooters.length >= topN) break;

          const isEP = isEccellenzaOrPrima(shooter.category);
          if (isEP) {
            if (epCount < maxEP) {
              selectedShooters.push(shooter);
              epCount++;
            }
          } else {
            selectedShooters.push(shooter);
          }
        }

        const sumOfScores = selectedShooters.reduce((acc, s) => acc + s.trialScores[trialKey]!, 0);

        if (selectedShooters.length < topN) return null;

        return {
          score: sumOfScores,
          shooters: selectedShooters.map(s => ({
            id: s.shooterId,
            name: s.name,
            surname: s.surname,
            score: s.trialScores[trialKey],
            category: s.classificationValue,
            mode: s.classificationMode
          }))
        };
      };

      societyTrials[soc].trial1 = calculateSocietyTrial('trial1');
      societyTrials[soc].trial2 = calculateSocietyTrial('trial2');
      societyTrials[soc].trial3 = calculateSocietyTrial('trial3');
      societyTrials[soc].trial4 = calculateSocietyTrial('trial4');
    });

    const maxSocietyScores = { trial1: 0, trial2: 0, trial3: 0, trial4: 0 };
    uniqueSocieties.forEach((soc) => {
      ['trial1', 'trial2', 'trial3', 'trial4'].forEach((tKey) => {
        const sTrial = societyTrials[soc][tKey];
        if (sTrial && sTrial.score > maxSocietyScores[tKey as 'trial1' | 'trial2' | 'trial3' | 'trial4']) {
          maxSocietyScores[tKey as 'trial1' | 'trial2' | 'trial3' | 'trial4'] = sTrial.score;
        }
      });
    });

    const societyPenalties = uniqueSocieties.map((soc) => {
      const st = societyTrials[soc];
      const getSocPenalty = (trialKey: 'trial1' | 'trial2' | 'trial3' | 'trial4') => {
        const run = st[trialKey];
        if (!run) return null;
        return Math.max(0, maxSocietyScores[trialKey] - run.score);
      };

      const p1 = getSocPenalty('trial1');
      const p2 = getSocPenalty('trial2');
      const p3 = getSocPenalty('trial3');
      const p4 = getSocPenalty('trial4');

      const pList = [p1, p2, p3, p4].filter((p): p is number => p !== null);
      const participatedCount = pList.length;
      const isClassified = participatedCount >= (rc.season === 'Invernale' ? 2 : 3);
      let totalPenalties = 0;
      let discardedTrialIdx: number | null = null;

      if (isClassified) {
        if ((rc.season === 'Invernale' && participatedCount === 3) || participatedCount === 4) {
          const maxP = Math.max(...pList);
          totalPenalties = pList.reduce((acc, p) => acc + p, 0) - maxP;
          if (p1 === maxP) discardedTrialIdx = 1;
          else if (p2 === maxP) discardedTrialIdx = 2;
          else if (p3 === maxP) discardedTrialIdx = 3;
          else if (p4 === maxP) discardedTrialIdx = 4;
        } else {
          totalPenalties = pList.reduce((acc, p) => acc + p, 0);
        }
      } else {
        totalPenalties = pList.reduce((acc, p) => acc + p, 0);
      }

      const totalScoreSum = [st.trial1, st.trial2, st.trial3, st.trial4]
        .filter((t): t is { score: number, shooters: any[] } => t !== null)
        .reduce((acc, t) => acc + t.score, 0);

      return {
        societyName: soc,
        trialScores: {
          trial1: st.trial1 ? st.trial1.score : null,
          trial2: st.trial2 ? st.trial2.score : null,
          trial3: st.trial3 ? st.trial3.score : null,
          trial4: st.trial4 ? st.trial4.score : null
        },
        trialDetails: {
          trial1: st.trial1 ? st.trial1.shooters : [],
          trial2: st.trial2 ? st.trial2.shooters : [],
          trial3: st.trial3 ? st.trial3.shooters : [],
          trial4: st.trial4 ? st.trial4.shooters : []
        },
        trialPenalties: {
          trial1: p1,
          trial2: p2,
          trial3: p3,
          trial4: p4
        },
        participatedCount,
        totalPenalties,
        discardedTrialIdx,
        isClassified,
        totalScoreSum,
        position: undefined as number | undefined
      };
    });

    const classifiedSocieties = societyPenalties.filter(sp => sp.participatedCount >= 1);
    classifiedSocieties.sort((a, b) => {
      // 1. Sort by qualification status first (classified societies with >= 3 trials at the top)
      if (a.isClassified !== b.isClassified) {
        return a.isClassified ? -1 : 1;
      }
      // 2. Sort by how many trials they completed (descending so they compare on equal footing)
      if (a.participatedCount !== b.participatedCount) {
        return b.participatedCount - a.participatedCount;
      }
      // 3. Sort by total penalties (ascending)
      if (a.totalPenalties !== b.totalPenalties) {
        return a.totalPenalties - b.totalPenalties;
      }
      // 4. Sort by total score sum (descending)
      return b.totalScoreSum - a.totalScoreSum;
    });
    classifiedSocieties.forEach((sp, idx) => {
      sp.position = idx + 1;
    });

    res.json({
      championship: rc,
      scoreMaxes: {
        category: maxScoresCategory,
        qualification: maxScoresQualification,
        society: maxSocietyScores
      },
      shooters: shooterPenalties,
      groupedRankings,
      societies: societyPenalties,
      classifiedSocieties
    });
  } catch (err: any) {
    console.error('Error in RC ranking:', err);
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

app.post('/api/admin/parse-pdf', authenticateToken, async (req: any, res) => {
  const { pdfBase64, numSeries, targetsPerSeries } = req.body;
  if (!pdfBase64) {
    return res.status(400).json({ error: "Dati PDF base64 mancanti" });
  }

  try {
    const response = await callGeminiWithRetry(async (ai) => {
      const pdfPart = {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64,
        }
      };

      const textPart = {
        text: `Sei un sistema esperto deputato all'estrazione di dati strutturati da report PDF generati dal software gestionale Gestgare per gare FITAV (Federazione Italiana Tiro a Volo).
Il PDF rappresenta la classifica di una gara. Analizza attentamente tutta la classifica (comprese eventuali righe divise, testi concatenati, ecc.) ed estrai le informazioni per ciascun tiratore.

Regole fondamentali di estrazione:
1. ORDINE: Estrai i tiratori mantenendo rigorosamente l'ordine del PDF. Inserisci il campo 'rank' corrispondente alla posizione numerica nella classifica del PDF.
2. Per ciascun tiratore inserisci un record separato.
3. Identifica la stringa col nome del tiratore e codice:
   La struttura tipica è: COGNOME NOME<br>CODICETIRATORE (es. "IESCE MARIO<br>IMM80LT02" o "IESCE MARIO IMM80LT02").
   - Il Cognome (surname) deve essere ricavato in formato con prima lettera maiuscola, es. "Iesce".
   - Il Nome (name) deve essere ricavato in formato con prima lettera maiuscola, es. "Mario".
   - Il Codice Tiratore (shooterCode) è la stringa alfanumerica di 9 caratteri dopo il tag <br> o spazio, ad esempio "IMM80LT02".
4. Identifica la Categoria, Qualifica e Preferenza Classifica:
   - Formato tipico: un numero e un eventuale codice (come "1<br>" o "2<br>SE").
   - Se c'è solo un numero seguito da <br> o nulla (es. "1<br>"), significa che gareggia per Categoria "1*". Quindi imposta 'category' = '1*', 'qualification' = '', e 'rankingPreference' = 'categoria'.
   - Se c'è un numero seguito dal codice qualifica (es. "2<br>SE"), significa che la categoria è "2*", la qualifica è "SE", e gareggia per Qualifica. Quindi imposta 'category' = '2*', 'qualification' = 'Senior' (o la decodifica opportuna), e 'rankingPreference' = 'qualifica'.
   - Decodifica i codici delle qualifiche in italiano:
     - 'SE' o 'SEN' o 'SR' -> 'Senior'
     - 'MA' o 'MAS' -> 'Master'
     - 'VE' o 'VET' -> 'Veterani'
     - 'JU' o 'JUN' -> 'Junior'
     - 'LA' o 'LAD' -> 'Lady'
     - 'SG' -> 'Settore Giovanile'
     - 'PT' o 'PR' o 'PA' -> 'Paralimpici'
   - Se trovi altre diciture o codici, decodificali opportunamente (es. "Ecc" o "E" -> "E", "Cacc" -> "Cacciatore").
5. Serie e punteggi:
   - Trova i punteggi delle serie. Solitamente indicati sotto le colonne "S.1", "S.2", "S.3"... o come sequenza di numeri di serie per tiratore.
   - Restituisci sotto forma di array di interi chiamato "scores". L'array deve avere lunghezza esattamente pari a ${numSeries || 4} serie. Adatta i valori di conseguenza o riempi con 0 se mancanti.
6. Spareggio / Shoot-off:
   - Se presente il punteggio dello spareggio (shoot-off / spareggio / barrage) o indicazioni di barrage, impostalo in "shootOff" come intero, altrimenti impostalo a null.
7. Premi (awarded):
   - Nella colonna "Pos" (Posizione), se accanto al numero c'è una "P" (es.  "1P"), significa che il tiratore è andato a premio. Imposta "awarded" a true. Altrimenti false.
8. Società (society):
   - Se presente la società sportiva di appartenenza, estraila in "society" (es. "A.S.D. T.A.V. ...").
   
RISPETTA TASSATIVAMENTE lo schema JSON specificato per l'output. Non aggiungere spiegazioni o testo, fornisci solo l'array JSON valido.`
      };

      return await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [textPart, pdfPart],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                rank: { type: Type.INTEGER, description: "The rank/position in the PDF, used to maintain order." },
                surname: { type: Type.STRING },
                name: { type: Type.STRING },
                shooterCode: { type: Type.STRING },
                society: { type: Type.STRING, description: "Name of the shooting club/society if available" },
                category: { type: Type.STRING },
                qualification: { type: Type.STRING, description: "Normalized qualification like 'Senior', 'Master', 'Lady' or empty string if none." },
                scores: {
                  type: Type.ARRAY,
                  items: { type: Type.INTEGER }
                },
                shootOff: { type: Type.INTEGER, description: "Shoot-off score if present, otherwise null." },
                awarded: { type: Type.BOOLEAN, description: "True if position has 'P' (e.g., 1P), false otherwise." },
                rankingPreference: { type: Type.STRING, description: "Must be 'categoria' or 'qualifica'" },
              },
              required: ["rank", "surname", "name", "shooterCode", "category", "rankingPreference", "scores", "awarded"]
            }
          }
        }
      });
    });

    const parsedText = response.text || "[]";
    const parsedData = JSON.parse(parsedText);
    res.json(parsedData);
  } catch (err: any) {
    console.error('PDF parsing error:', err);
    res.status(500).json({ error: `Errore durante l'elaborazione del PDF con Gemini: ${err.message}` });
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

// Final catch-all for API routes to ensure they always return JSON
app.all('/api/*all', (req, res) => {
  res.status(404).json({ 
    error: `API route not found: ${req.method} ${req.url}`,
    path: req.url,
    method: req.method
  });
});

async function setupVite(app: any) {
  const isProd = process.env.NODE_ENV === "production";
  const buildPath = path.resolve(process.cwd(), 'dist');

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
        app.get('*all', (req: any, res: any) => {
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
      app.get('*all', (req: any, res: any) => {
        res.status(500).send('Production build not found. Run npm run build.');
      });
    }
  }
}

function serveStatic(app: any) {
  const buildPath = path.resolve(process.cwd(), 'dist');
  app.use(express.static(buildPath));
  app.use((req: any, res: any) => {
    res.sendFile(path.resolve(buildPath, 'index.html'));
  });
}

async function startApp() {
  try {
    // Initialize Database
    await initDB();

    // Setup Vite or Static serving (API routes are already defined)
    await setupVite(app);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error: any) {
    console.error('CRITICAL ERROR DURING STARTUP:', error);
    // Even if DB or Vite fails, try to start Express so it can serve health checks or 500 errors instead of being dead
    if (!app.listenerCount('listen')) {
      app.get('/api/health', (req, res) => res.status(500).json({ status: 'degraded', error: error.message }));
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running in DEGRADED MODE on port ${PORT}`);
      });
    }
  }
}

startApp();

