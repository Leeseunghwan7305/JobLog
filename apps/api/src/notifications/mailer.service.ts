import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

/** Resend 이메일 발송 래퍼. 키 없으면 비활성(콘솔 로그 폴백). */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private resolved = false;
  private client: Resend | null = null;

  private get instance(): Resend | null {
    if (!this.resolved) {
      this.resolved = true;
      this.client = process.env.RESEND_API_KEY
        ? new Resend(process.env.RESEND_API_KEY)
        : null;
    }
    return this.client;
  }

  get enabled(): boolean {
    return this.instance !== null;
  }

  async send(args: {
    to: string;
    subject: string;
    html: string;
  }): Promise<boolean> {
    const client = this.instance;
    if (!client) {
      this.logger.log(`[메일 비활성] to=${args.to} · ${args.subject}`);
      return false;
    }
    try {
      const from = process.env.MAIL_FROM ?? 'JobLog <onboarding@resend.dev>';
      const { error } = await client.emails.send({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
      });
      if (error) {
        this.logger.warn(`resend 오류: ${JSON.stringify(error)}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`메일 발송 실패: ${String(e)}`);
      return false;
    }
  }
}
