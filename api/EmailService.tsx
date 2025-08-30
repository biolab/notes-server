"use server";

import nodemailer from "nodemailer";

const SMTP_SERVER_HOST = process.env.SMTP_SERVER_HOST;
const EMAIL_FROM = process.env.EMAIL_FROM;

const transporter = nodemailer.createTransport({
  service: "smtp",
  host: SMTP_SERVER_HOST,
  secure: true,
});

export const sendEmail = async ({
  sendTo,
  subject,
  html,
}: {
  sendTo: string;
  subject: string;
  html: string;
}) => {
  if (process.env.NODE_ENV === "development") {
    return;
  }

  await transporter.verify();

  const info = await transporter.sendMail({
    from: EMAIL_FROM,
    to: sendTo,
    subject: subject,
    html: html ? html : "",
  });

  return info;
};
