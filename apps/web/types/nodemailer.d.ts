declare module "nodemailer" {
  import type { Readable } from "stream";

  export type TransportOptions = {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user: string; pass: string };
  };

  export type SendMailOptions = {
    from?: string;
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
    replyTo?: string;
  };

  export type SentMessageInfo = {
    messageId?: string;
    response?: string;
  };

  export type Transporter = {
    sendMail: (mail: SendMailOptions) => Promise<SentMessageInfo>;
    verify: () => Promise<true>;
    close: () => void;
  };

  export function createTransport(options: TransportOptions): Transporter;

  const nodemailer: {
    createTransport: typeof createTransport;
  };
  export default nodemailer;
}
