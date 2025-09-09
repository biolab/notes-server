"use server";

import nodemailer from "nodemailer";

const SMTP_SERVER_HOST = process.env.SMTP_SERVER_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "25");
const EMAIL_FROM = process.env.EMAIL_FROM;

const transporter = nodemailer.createTransport({
  host: SMTP_SERVER_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465
});

export const sendEmail = async ({sendTo, subject, text, html}: {
  sendTo: string;
  subject: string;
  text: string;
  html: string;
}) => {
  if (process.env.NODE_ENV === "development") {
    return;
  }

  await transporter.verify();
  return await transporter.sendMail(
    {from: EMAIL_FROM, to: sendTo, subject, text, html });
};
