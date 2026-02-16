"use server";

import nodemailer from "nodemailer";
import db from "@/utils/db";
import { MailPath } from "@/ingest/mail";
import { CONFIG } from "@/utils/config";


const SMTP_SERVER_HOST = CONFIG.SMTPHost;
const SMTP_PORT = CONFIG.SMTPPort;
const EMAIL_FROM = CONFIG.emailFrom;

const transporter = nodemailer.createTransport({
  host: SMTP_SERVER_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
    tls: {
    // do not fail on invalid certs
    rejectUnauthorized: false,
  },
});

export const mailForPath = async (path: string): Promise<MailPath | undefined> =>
  db.get(`
    SELECT path, subject, plain, html
    FROM loginmails
    WHERE ? LIKE path || '%'
    ORDER BY LENGTH(path) DESC
    LIMIT 1;`, [path]);


export const sendEmail = async ({sendTo, subject, text, html}: {
  sendTo: string;
  subject: string;
  text: string;
  html?: string;
}) => {
  if (process.env.NODE_ENV === "development") {
    return;
  }

  await transporter.verify();
  return await transporter.sendMail(
    {from: EMAIL_FROM, to: sendTo, subject, text, html});
};
