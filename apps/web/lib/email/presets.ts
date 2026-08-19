export type MailboxCredentials = {
  emailAddress: string;
  username: string;
  password: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
};

export const MAIL_PRESETS = {
  gmail: {
    label: "Gmail / Google Workspace",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecure: true,
    hint: "Usa una App Password de Google (cuenta → Seguridad), no tu clave normal.",
  },
  outlook: {
    label: "Outlook / Microsoft 365",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecure: false,
    hint: "Activa IMAP en Outlook y usa tu usuario completo + contraseña o app password.",
  },
  custom: {
    label: "Custom IMAP/SMTP",
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "",
    smtpPort: 465,
    smtpSecure: true,
    hint: "Cualquier proveedor institucional (Zoho, Fastmail, cPanel, etc.).",
  },
} as const;

export type MailPresetKey = keyof typeof MAIL_PRESETS;
