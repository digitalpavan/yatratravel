#!/usr/bin/env node
// Checks the Gmail settings before they go into Vercel: signs in with GMAIL_USER and GMAIL_APP_PASSWORD from
// .env.local and sends one test email. Prints Google's answer; never prints the password.
//
//   npm run email:test                    send the test to GMAIL_USER itself
//   npm run email:test -- you@example.com send it to another address

import nodemailer from 'nodemailer';

const user = process.env.GMAIL_USER?.trim();
const pass = process.env.GMAIL_APP_PASSWORD?.replace(/[\s"']/g, '');
const to = process.argv[2] || user;

if (!user || !pass) {
  console.error('Add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local first (see docs/08-booking-workflow.md → Setting up Gmail).');
  process.exit(1);
}
console.log(`Gmail account: ${user}`);
console.log(`App Password: ${pass.length} characters${pass.length === 16 && /^[a-z]+$/.test(pass) ? ' (looks like an App Password)' : ' (an App Password is 16 lowercase letters: this does not look like one)'}`);

const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass }, connectionTimeout: 10_000 });
try {
  await transport.verify();
  console.log('Sign-in: OK');
  await transport.sendMail({
    from: { name: 'Yatra Travels', address: user }, to,
    subject: 'Yatra Travels: test email',
    text: 'This is a test from the Yatra Travels website. Gmail sending works.',
  });
  console.log(`Test email sent to ${to}. Put the same App Password in Vercel (GMAIL_APP_PASSWORD) and redeploy.`);
} catch (e) {
  console.error(`Failed: ${e.code ?? ''} ${e.response ?? e.message}`);
  if (e.responseCode === 535) console.error('Google did not accept this address and App Password. Create a new App Password at myaccount.google.com/apppasswords while signed in as this account, and copy all 16 letters.');
  if (e.responseCode === 534) console.error('This is the normal Gmail password. Use an App Password instead (needs 2-Step Verification).');
  process.exit(1);
}
