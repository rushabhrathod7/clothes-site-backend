import nodemailer from "nodemailer";

// Configure transporter using Mailtrap
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.mailtrap.io",
  port: process.env.EMAIL_PORT || 2525,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send password reset email
export const sendPasswordResetEmail = async (
  email,
  resetToken,
  frontendUrl
) => {
  // const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  const message = {
    from: process.env.EMAIL_FROM || '"Admin System" <admin@example.com>',
    to: email,
    subject: "Password Reset Request",
    html: `
      <h1>Password Reset Request</h1>
      <p>You requested a password reset. Please click the link below to reset your password:</p>
      <a href="${resetUrl}" target="_blank">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  };

  await transporter.sendMail(message);
};
