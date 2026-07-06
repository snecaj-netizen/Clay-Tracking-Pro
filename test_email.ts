import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function run() {
  console.log('Verifying transporter...');
  try {
    await transporter.verify();
    console.log('✅ Connection verified!');
  } catch (err: any) {
    console.error('❌ Verification failed:', err);
  }

  console.log('Sending test email...');
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'Clay Performance <no-reply@clay-performance.it>',
      to: 'snecaj@gmail.com',
      subject: 'Test verification',
      text: 'Test verification body'
    });
    console.log('✅ Sent successfully!', info);
  } catch (err: any) {
    console.error('❌ Send failed:', err);
  }
}

run();
