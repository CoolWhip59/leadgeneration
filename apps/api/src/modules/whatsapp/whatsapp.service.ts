import { Injectable, Logger } from '@nestjs/common';
import { OutboundMessageStatus, Prisma, WebsiteCheckStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AutoSendResult = {
  enabled: boolean;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
};

type WhatsAppApiResponse = {
  messages?: Array<{ id?: string }>;
  error?: { message?: string };
};

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly enabled = process.env.WHATSAPP_AUTO_SEND_ENABLED === 'true';
  private readonly requireOptIn = process.env.WHATSAPP_REQUIRE_OPT_IN !== 'false';
  private readonly testMode = process.env.WHATSAPP_TEST_MODE !== 'false';
  private readonly accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  private readonly apiBase = (process.env.WHATSAPP_API_BASE || 'https://graph.facebook.com').replace(/\/+$/, '');
  private readonly apiVersion = process.env.WHATSAPP_API_VERSION || 'v22.0';
  private readonly templateName = process.env.WHATSAPP_TEMPLATE_NAME || '';
  private readonly templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'tr';
  private readonly maxPerJob = Number(process.env.WHATSAPP_MAX_PER_JOB || 200);
  private readonly cooldownDays = Number(process.env.WHATSAPP_COOLDOWN_DAYS || 30);
  private readonly overrideTo = process.env.WHATSAPP_TEST_OVERRIDE_TO || '';

  constructor(private readonly prisma: PrismaService) {}

  async autoSendNoWebsiteForJob(jobId: string): Promise<AutoSendResult> {
    if (!this.enabled) {
      return { enabled: false, processed: 0, sent: 0, failed: 0, skipped: 0 };
    }

    const job = await this.prisma.job.findFirst({
      where: { id: jobId, deletedAt: null },
      include: {
        jobCities: {
          where: { deletedAt: null },
          select: { cityId: true },
        },
      },
    });

    if (!job || job.status !== 'COMPLETED') {
      return { enabled: true, processed: 0, sent: 0, failed: 0, skipped: 0 };
    }

    const cityIds = Array.from(new Set(job.jobCities.map((jc) => jc.cityId)));
    if (cityIds.length === 0) {
      return { enabled: true, processed: 0, sent: 0, failed: 0, skipped: 0 };
    }

    const candidates = await this.prisma.business.findMany({
      where: {
        deletedAt: null,
        cityId: { in: cityIds },
        categoryId: job.categoryId,
        websiteStatus: {
          in: [
            WebsiteCheckStatus.NO_WEBSITE,
            WebsiteCheckStatus.SOCIAL_ONLY,
            WebsiteCheckStatus.TIMEOUT,
            WebsiteCheckStatus.HTTP_ERROR,
          ],
        },
        AND: [{ phone: { not: null } }, { phone: { not: '' } }],
        outboundMessages: {
          none: {
            jobId,
            channel: 'whatsapp',
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: this.maxPerJob,
      select: {
        id: true,
        phone: true,
        whatsappOptIn: true,
        whatsappLastMessageAt: true,
      },
    });

    const readyToSend = this.testMode || this.hasSendConfig();

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const business of candidates) {
      const toPhone = this.overrideTo || this.normalizePhone(business.phone);

      if (!toPhone) {
        skipped += 1;
        await this.upsertLog({
          jobId,
          businessId: business.id,
          toPhone: business.phone || '',
          status: OutboundMessageStatus.SKIPPED,
          reason: 'invalid_phone',
        });
        continue;
      }

      if (this.requireOptIn && !business.whatsappOptIn) {
        skipped += 1;
        await this.upsertLog({
          jobId,
          businessId: business.id,
          toPhone,
          status: OutboundMessageStatus.SKIPPED,
          reason: 'missing_opt_in',
        });
        continue;
      }

      if (this.isInCooldown(business.whatsappLastMessageAt)) {
        skipped += 1;
        await this.upsertLog({
          jobId,
          businessId: business.id,
          toPhone,
          status: OutboundMessageStatus.SKIPPED,
          reason: 'cooldown',
        });
        continue;
      }

      if (!readyToSend) {
        skipped += 1;
        await this.upsertLog({
          jobId,
          businessId: business.id,
          toPhone,
          status: OutboundMessageStatus.SKIPPED,
          reason: 'whatsapp_not_configured',
        });
        continue;
      }

      const claimed = await this.tryCreateSendClaim({
        jobId,
        businessId: business.id,
        toPhone,
      });

      if (!claimed) {
        skipped += 1;
        continue;
      }

      try {
        const sendResult = this.testMode
          ? { providerMessageId: `test-${jobId}-${business.id}`, rawPayload: '{"mode":"test"}' }
          : await this.sendTemplateMessage(toPhone);

        sent += 1;

        await this.prisma.business.update({
          where: { id: business.id },
          data: {
            whatsappLastMessageAt: new Date(),
            whatsappLastMessageStatus: 'SENT',
          },
        });

        await this.upsertLog({
          jobId,
          businessId: business.id,
          toPhone,
          status: OutboundMessageStatus.SENT,
          providerMessageId: sendResult.providerMessageId,
          payload: sendResult.rawPayload,
        });
      } catch (error) {
        failed += 1;
        const reason = error instanceof Error ? error.message : 'unknown_error';

        await this.prisma.business.update({
          where: { id: business.id },
          data: {
            whatsappLastMessageStatus: 'FAILED',
          },
        });

        await this.upsertLog({
          jobId,
          businessId: business.id,
          toPhone,
          status: OutboundMessageStatus.FAILED,
          reason,
        });
      }
    }

    const result = {
      enabled: true,
      processed: candidates.length,
      sent,
      failed,
      skipped,
    };

    this.logger.log(
      `Auto-send finished for job ${jobId}: processed=${result.processed} sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`,
    );

    return result;
  }

  private hasSendConfig(): boolean {
    return Boolean(this.accessToken && this.phoneNumberId && this.templateName);
  }

  private isInCooldown(lastMessageAt: Date | null): boolean {
    if (!lastMessageAt || this.cooldownDays <= 0) return false;
    const cooldownMs = this.cooldownDays * 24 * 60 * 60 * 1000;
    return Date.now() - lastMessageAt.getTime() < cooldownMs;
  }

  private normalizePhone(phone?: string | null): string | null {
    if (!phone) return null;

    let raw = phone.trim();
    if (!raw) return null;

    if (raw.startsWith('00')) {
      raw = `+${raw.slice(2)}`;
    }

    if (raw.startsWith('+')) {
      const digits = raw.slice(1).replace(/\D/g, '');
      if (digits.length < 11 || digits.length > 15) return null;
      return `+${digits}`;
    }

    const digits = raw.replace(/\D/g, '');

    if (digits.length === 10) {
      return `+90${digits}`;
    }

    if (digits.length === 11 && digits.startsWith('0')) {
      return `+90${digits.slice(1)}`;
    }

    if (digits.length === 12 && digits.startsWith('90')) {
      return `+${digits}`;
    }

    if (digits.length >= 11 && digits.length <= 15) {
      return `+${digits}`;
    }

    return null;
  }

  private async sendTemplateMessage(toPhone: string): Promise<{ providerMessageId: string; rawPayload: string }> {
    const whatsappRecipient = toPhone.replace(/\D/g, '');
    if (!whatsappRecipient) {
      throw new Error('invalid_whatsapp_recipient');
    }

    const url = `${this.apiBase}/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to: whatsappRecipient,
      type: 'template',
      template: {
        name: this.templateName,
        language: { code: this.templateLang },
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const rawPayload = await response.text();

    if (!response.ok) {
      throw new Error(`whatsapp_http_${response.status}:${rawPayload}`);
    }

    let parsed: WhatsAppApiResponse | null = null;
    try {
      parsed = JSON.parse(rawPayload) as WhatsAppApiResponse;
    } catch {
      parsed = null;
    }

    const providerMessageId = parsed?.messages?.[0]?.id || '';

    return { providerMessageId, rawPayload };
  }

  private async upsertLog(params: {
    jobId: string;
    businessId: string;
    toPhone: string;
    status: OutboundMessageStatus;
    reason?: string;
    providerMessageId?: string;
    payload?: string;
  }) {
    await this.prisma.outboundMessageLog.upsert({
      where: {
        jobId_businessId_channel: {
          jobId: params.jobId,
          businessId: params.businessId,
          channel: 'whatsapp',
        },
      },
      update: {
        toPhone: params.toPhone,
        templateName: this.templateName || null,
        status: params.status,
        reason: params.reason || null,
        providerMessageId: params.providerMessageId || null,
        payload: params.payload || null,
      },
      create: {
        jobId: params.jobId,
        businessId: params.businessId,
        channel: 'whatsapp',
        toPhone: params.toPhone,
        templateName: this.templateName || null,
        status: params.status,
        reason: params.reason || null,
        providerMessageId: params.providerMessageId || null,
        payload: params.payload || null,
      },
    });
  }

  private async tryCreateSendClaim(params: {
    jobId: string;
    businessId: string;
    toPhone: string;
  }): Promise<boolean> {
    try {
      await this.prisma.outboundMessageLog.create({
        data: {
          jobId: params.jobId,
          businessId: params.businessId,
          channel: 'whatsapp',
          toPhone: params.toPhone,
          templateName: this.templateName || null,
          status: OutboundMessageStatus.QUEUED,
        },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }
}
