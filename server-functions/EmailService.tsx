import nodemailer from "nodemailer";

const SMTP_SERVER_HOST = process.env.SMTP_SERVER_HOST;
const EMAIL_FROM = process.env.EMAIL_FROM;

const transporter = nodemailer.createTransport({
  service: "smtp",
  host: SMTP_SERVER_HOST,
  secure: true,
});

export const EmailService_Send = async ({
  sendTo,
  subject,
  text,
  html,
}: {
  email: string;
  sendTo?: string;
  subject: string;
  text: string;
  html?: string;
}) => {
  if (process.env.NODE_ENV === "development") {
    return;
  }

  await transporter.verify();

  const info = await transporter.sendMail({
    from: EMAIL_FROM,
    to: sendTo,
    subject: subject,
    text: text,
    html: html ? html : "",
  });

  return info;
};
