import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Notification, Exam, CalendarEvent, MockTest } from './exam.entities';
import { UserNotificationPreference, UserActivityLog } from '../settings/settings.entities';
import { NotebookDocument } from '../notebook/notebook.entity';
import { SupabaseService } from '../settings/supabase.service';
import { OpenRouterAiProviderService } from '../chat/openrouter-ai-provider.service';
import * as net from 'net';
import * as tls from 'tls';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private dispatcherRunning = false;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly entityManager: EntityManager,
    private readonly supabaseService: SupabaseService,
    private readonly aiProvider: OpenRouterAiProviderService,
  ) {
    this.ensureSqliteLogsTable();
    this.startEmailDispatcher();
  }

  /**
   * Create a dashboard and push notification (triggered immediately)
   */
  async createNotification(
    userId: string,
    title: string,
    message: string,
    triggerTimeOffsetMins: number = 0,
    priority: string = 'normal',
    deliveryChannel: string = 'all',
    type: string = 'alert'
  ) {
    const triggerTime = new Date();
    triggerTime.setMinutes(triggerTime.getMinutes() + triggerTimeOffsetMins);

    const notification = new Notification();
    notification.userId = userId;
    notification.title = title;
    notification.message = message;
    notification.triggerTime = triggerTime;
    notification.isRead = false;
    notification.emailSent = false;
    notification.priority = priority;
    notification.deliveryChannel = deliveryChannel;
    notification.type = type;

    await this.notificationRepository.save(notification);
    this.logger.log(`Created notification: "${title}" for user ${userId}. Scheduled for ${triggerTime.toISOString()}`);

    try {
      await this.supabaseService.createNotification({
        user_id: userId,
        title,
        message,
        trigger_time: triggerTime.toISOString(),
        is_read: false,
        email_sent: false,
        priority,
        delivery_channel: deliveryChannel,
        type,
      });
    } catch (err) {
      this.logger.warn(`Failed to sync newly created notification to Supabase: ${err.message}`);
    }
  }

  /**
   * Create a scheduled notification to trigger in the future
   */
  async createScheduledNotification(
    userId: string,
    title: string,
    message: string,
    triggerTime: Date,
    priority: string = 'normal',
    deliveryChannel: string = 'all',
    type: string = 'alert'
  ) {
    const notification = new Notification();
    notification.userId = userId;
    notification.title = title;
    notification.message = message;
    notification.triggerTime = triggerTime;
    notification.isRead = false;
    notification.emailSent = false;
    notification.priority = priority;
    notification.deliveryChannel = deliveryChannel;
    notification.type = type;

    await this.notificationRepository.save(notification);
    this.logger.log(`Created scheduled notification: "${title}" for user ${userId}. Trigger at ${triggerTime.toISOString()}`);

    try {
      await this.supabaseService.createNotification({
        user_id: userId,
        title,
        message,
        trigger_time: triggerTime.toISOString(),
        is_read: false,
        email_sent: false,
        priority,
        delivery_channel: deliveryChannel,
        type,
      });
    } catch (err) {
      this.logger.warn(`Failed to sync scheduled notification to Supabase: ${err.message}`);
    }
  }

  /**
   * Get all unread notifications for a user that are triggered (trigger_time <= now)
   */
  async getTriggeredNotifications(userId: string): Promise<Notification[]> {
    const now = new Date();
    return this.notificationRepository.createQueryBuilder('n')
      .where('n.user_id = :userId', { userId })
      .andWhere('n.trigger_time <= :now', { now })
      .orderBy('n.trigger_time', 'DESC')
      .getMany();
  }

  async markAsRead(userId: string) {
    const unread = await this.notificationRepository.find({
      where: { userId, isRead: false }
    });
    
    if (unread.length > 0) {
      const ids = unread.map(n => n.id);
      const nowStr = new Date().toISOString();

      await this.notificationRepository.update(
        { userId, isRead: false },
        { isRead: true }
      );

      // Update SQLite logs
      try {
        for (const id of ids) {
          await this.entityManager.query(
            `UPDATE notification_logs SET opened_at = ? WHERE user_id = ? AND notification_id = ?`,
            [nowStr, userId, id]
          );
        }
      } catch (err) {
        this.logger.warn(`Failed to update opened_at in SQLite logs: ${err.message}`);
      }

      // Update Supabase notifications
      try {
        for (const id of ids) {
          await axios.patch(
            `${this.supabaseService.supabaseUrl}/rest/v1/notifications?id=eq.${id}`,
            { opened_at: nowStr, is_read: true },
            { headers: this.supabaseService.getHeaders() }
          );
        }
      } catch (err) {
        this.logger.warn(`Failed to update opened_at in Supabase notifications: ${err.message}`);
      }

      // Update Supabase logs
      try {
        for (const id of ids) {
          await axios.patch(
            `${this.supabaseService.supabaseUrl}/rest/v1/notification_logs?notification_id=eq.${id}`,
            { opened_at: nowStr },
            { headers: this.supabaseService.getHeaders() }
          );
        }
      } catch (err) {
        this.logger.warn(`Failed to update opened_at in Supabase logs: ${err.message}`);
      }
    }
    this.logger.log(`Marked all notifications as read for user ${userId}`);
  }

  private async ensureSqliteLogsTable() {
    try {
      await this.entityManager.query(`
        CREATE TABLE IF NOT EXISTS notification_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          notification_id TEXT,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          channel TEXT NOT NULL,
          status TEXT NOT NULL,
          error_message TEXT,
          sent_at TEXT NOT NULL,
          opened_at TEXT
        )
      `);
      try {
        await this.entityManager.query(`ALTER TABLE notification_logs ADD COLUMN opened_at TEXT`);
      } catch (e) {
        // ignore if already exists
      }
      try {
        await this.entityManager.query(`ALTER TABLE notification_logs ADD COLUMN notification_id TEXT`);
      } catch (e) {
        // ignore if already exists
      }
      try {
        await this.entityManager.query(`ALTER TABLE notification_logs ADD COLUMN channel TEXT`);
      } catch (e) {
        // ignore if already exists
      }
      try {
        await this.entityManager.query(`ALTER TABLE notification_logs ADD COLUMN status TEXT`);
      } catch (e) {
        // ignore if already exists
      }
      try {
        await this.entityManager.query(`ALTER TABLE notification_logs ADD COLUMN error_message TEXT`);
      } catch (e) {
        // ignore if already exists
      }
      try {
        await this.entityManager.query(`ALTER TABLE notification_logs ADD COLUMN sent_at TEXT`);
      } catch (e) {
        // ignore if already exists
      }
    } catch (e) {
      this.logger.warn(`Failed to ensure SQLite notification_logs table exists: ${e.message}`);
    }
  }

  private isPrioritySuppressed(notifPriority: string, userPreference: string): boolean {
    const userPref = (userPreference || 'All Notifications').toLowerCase();
    const notifPrio = (notifPriority || 'normal').toLowerCase();

    if (userPref.includes('critical')) {
      return notifPrio !== 'critical';
    }
    if (userPref.includes('important')) {
      return notifPrio !== 'important' && notifPrio !== 'critical';
    }
    return false; // All Notifications
  }

  private isInQuietHours(date: Date, startStr: string, endStr: string): boolean {
    const [sh, sm] = (startStr || '22:00').split(':').map(Number);
    const [eh, em] = (endStr || '07:00').split(':').map(Number);

    const currentHour = date.getHours();
    const currentMin = date.getMinutes();

    const startVal = sh * 60 + sm;
    const endVal = eh * 60 + em;
    const currentVal = currentHour * 60 + currentMin;

    if (startVal === endVal) {
      return false; // No quiet hours configured
    }

    if (startVal < endVal) {
      return currentVal >= startVal && currentVal < endVal;
    } else {
      return currentVal >= startVal || currentVal < endVal;
    }
  }

  private getEndOfQuietHours(date: Date, endStr: string): Date {
    const [eh, em] = (endStr || '07:00').split(':').map(Number);
    const target = new Date(date);
    target.setHours(eh, em, 0, 0);

    if (target.getTime() <= date.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target;
  }

  private async markProcessed(id: string, usingSupabase: boolean, examId?: string) {
    if (usingSupabase) {
      try {
        await this.supabaseService.markEmailSent(id, examId);
      } catch (err) {
        this.logger.warn(`Failed to mark email sent on Supabase: ${err.message}`);
      }
    }
    try {
      await this.notificationRepository.update({ id }, { emailSent: true });
    } catch (err) {
      this.logger.error(`Failed to mark notification processed in SQLite: ${err.message}`);
    }
  }

  private async sendPushNotification(fcmToken: string, title: string, message: string): Promise<boolean> {
    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey) {
      this.logger.warn('FCM_SERVER_KEY is missing from environment. Browser push notification simulated.');
      return false;
    }
    try {
      await axios.post(
        'https://fcm.googleapis.com/fcm/send',
        {
          to: fcmToken,
          notification: {
            title,
            body: message,
            click_action: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
            icon: '/logo.png',
          },
        },
        {
          headers: {
            Authorization: `key=${serverKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      this.logger.log(`FCM Push notification sent successfully.`);
      return true;
    } catch (err: any) {
      this.logger.error(`FCM Push notification request failed: ${err.message}`);
      return false;
    }
  }

  private async logDelivery(
    userId: string,
    notificationId: string,
    title: string,
    message: string,
    channel: string,
    status: string,
    errorMessage?: string
  ) {
    const logData = {
      user_id: userId,
      notification_id: notificationId,
      title,
      message,
      channel,
      status,
      error_message: errorMessage || null
    };

    try {
      await this.supabaseService.logDelivery(logData);
    } catch (err) {
      this.logger.warn(`Failed to log delivery to Supabase: ${err.message}`);
    }

    try {
      await this.entityManager.query(
        `INSERT INTO notification_logs (id, user_id, notification_id, title, message, channel, status, error_message, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
          userId,
          notificationId,
          title,
          message,
          channel,
          status,
          errorMessage || null,
          new Date().toISOString()
        ]
      );
    } catch (err) {
      this.logger.error(`Error logging notification delivery in SQLite: ${err.message}`);
    }
  }

  /**
   * Start the background notification dispatcher polling loop
   */
  private startEmailDispatcher() {
    if (process.env.ENABLE_BACKGROUND_NOTIFICATION_DISPATCHER !== 'true') {
      this.logger.log('Background notification dispatcher skipped. Set ENABLE_BACKGROUND_NOTIFICATION_DISPATCHER=true to enable it.');
      return;
    }
    if (!this.supabaseService.isConfigured()) {
      this.logger.log('Background notification dispatcher skipped: Supabase is not configured.');
      return;
    }
    this.logger.log('Starting background notification dispatcher...');
    const dispatch = async () => {
      if (this.dispatcherRunning) return;
      this.dispatcherRunning = true;
      try {
        const now = new Date();
        
        // Run checks for all active users to generate any pending alerts
        try {
          const userPrefs = await this.entityManager.getRepository(UserNotificationPreference).find();
          for (const pref of userPrefs) {
            await this.runNotificationChecksForUser(pref.userId);
          }
        } catch (err) {
          this.logger.warn(`Failed running background checks: ${err.message}`);
        }

        // Run exam reminder checks
        try {
          await this.checkUpcomingExamsAndTriggerReminders(now);
        } catch (err: any) {
          this.logger.warn(`Failed running exam reminder checks: ${err.message}`);
        }

        // Run daily internship reminders
        try {
          await this.checkDailyInternshipReminders(now);
        } catch (err: any) {
          this.logger.warn(`Failed running daily internship checks: ${err.message}`);
        }

        let pending = await this.supabaseService.getPendingNotifications();
        let usingSupabase = true;
        
        if (!pending) {
          usingSupabase = false;
          const localPending = await this.notificationRepository.find({
            where: { emailSent: false },
          });
          pending = localPending
            .filter((n) => n.triggerTime && n.triggerTime <= now)
            .map((n) => ({
              id: n.id,
              user_id: n.userId,
              title: n.title,
              message: n.message,
              trigger_time: n.triggerTime.toISOString(),
              priority: n.priority || 'normal',
              delivery_channel: n.deliveryChannel || 'all',
            }));
        } else {
          pending = pending.map((n: any) => ({
            id: n.id,
            user_id: n.user_id,
            exam_id: n.exam_id,
            title: n.title,
            message: n.message,
            type: n.type || 'alert',
            email_subject: n.email_subject || n.title,
            email_body: n.email_body || n.message,
            trigger_time: n.trigger_time,
            priority: n.priority || 'normal',
            delivery_channel: n.delivery_channel || 'all',
          }));
        }

        for (const notice of pending) {
          let prefs = await this.supabaseService.getPreferences(notice.user_id);
          if (!prefs) {
            try {
              const localPrefs = await this.entityManager
                .getRepository(UserNotificationPreference)
                .findOne({ where: { userId: notice.user_id } });
              if (localPrefs) {
                prefs = {
                  email_notifications: localPrefs.emailNotifications,
                  study_reminders: localPrefs.studyReminders,
                  quiz_reminders: localPrefs.quizReminders,
                  revision_alerts: localPrefs.revisionAlerts,
                  weekly_reports: localPrefs.weeklyReports,
                  delivery_email: localPrefs.deliveryEmail,
                  delivery_browser: localPrefs.deliveryBrowser,
                  delivery_mobile: localPrefs.deliveryMobile,
                  delivery_digest: localPrefs.deliveryDigest,
                  browser_push: localPrefs.browserPush,
                  mobile_push: localPrefs.mobilePush,
                  weekly_digest: localPrefs.weeklyDigest,
                  quiet_start: localPrefs.quietStart,
                  quiet_end: localPrefs.quietEnd,
                  quiet_hours_start: localPrefs.quietHoursStart,
                  quiet_hours_end: localPrefs.quietHoursEnd,
                  priority: localPrefs.priority,
                  notification_priority: localPrefs.notificationPriority,
                  fcm_token: localPrefs.fcmToken,
                };
              }
            } catch (err) {
              this.logger.warn(`Failed to resolve local preferences: ${err.message}`);
            }
          }

          const isExamReminder = notice.type === 'exam_reminder' || notice.type === 'internship_reminder';
          const emailNotifications = isExamReminder
            ? true
            : prefs ? (prefs.email_notifications ?? prefs.emailNotifications ?? true) : true;
          const deliveryEmail = prefs ? (prefs.delivery_email ?? prefs.deliveryEmail ?? true) : true;
          const deliveryBrowser = prefs ? (prefs.delivery_browser ?? prefs.deliveryBrowser ?? true) : true;
          const quietStart = prefs ? (prefs.quiet_hours_start ?? prefs.quietHoursStart ?? prefs.quiet_start ?? prefs.quietStart ?? '22:00') : '22:00';
          const quietEnd = prefs ? (prefs.quiet_hours_end ?? prefs.quietHoursEnd ?? prefs.quiet_end ?? prefs.quietEnd ?? '07:00') : '07:00';
          const prioritySetting = prefs ? (prefs.notification_priority ?? prefs.notificationPriority ?? prefs.priority ?? 'All Notifications') : 'All Notifications';
          const fcmToken = prefs ? (prefs.fcm_token ?? prefs.fcmToken ?? null) : null;

          if (!isExamReminder && this.isPrioritySuppressed(notice.priority, prioritySetting)) {
            this.logger.log(`Notification ${notice.id} suppressed due to priority filter (${notice.priority} vs setting: ${prioritySetting})`);
            await this.markProcessed(notice.id, usingSupabase, notice.exam_id);
            await this.logDelivery(
              notice.user_id,
              notice.id,
              notice.title,
              notice.message,
              'all',
              'suppressed_priority'
            );
            continue;
          }

          if (!isExamReminder && notice.priority !== 'critical' && this.isInQuietHours(now, quietStart, quietEnd)) {
            const nextTrigger = this.getEndOfQuietHours(now, quietEnd);
            this.logger.log(`Notification ${notice.id} delayed due to Quiet Hours until ${nextTrigger.toISOString()}`);
            
            if (usingSupabase) {
              await this.supabaseService.updateNotificationTriggerTime(notice.id, nextTrigger.toISOString());
            }
            await this.notificationRepository.update({ id: notice.id }, { triggerTime: nextTrigger });

            await this.logDelivery(
              notice.user_id,
              notice.id,
              notice.title,
              notice.message,
              'all',
              'delayed_quiet_hours',
              `Delayed until ${nextTrigger.toISOString()}`
            );
            continue;
          }

          let emailSentSuccess = false;
          const emailRequired =
            notice.delivery_channel === 'email' || (deliveryEmail && emailNotifications);
          if (emailRequired) {
            let userEmail = await this.supabaseService.getUserEmail(notice.user_id);
            if (!userEmail) {
              userEmail = await this.getUserEmail(notice.user_id);
            }

            if (userEmail) {
              this.logger.log(`Dispatching email to ${userEmail} for notice: ${notice.title}`);
              try {
                await this.sendNotificationEmail(
                  userEmail,
                  notice.email_subject || notice.title,
                  notice.email_body || notice.message,
                );
                emailSentSuccess = true;
                await this.logDelivery(
                  notice.user_id,
                  notice.id,
                  notice.title,
                  notice.message,
                  'email',
                  'delivered'
                );
              } catch (err) {
                this.logger.error(`Failed sending email to ${userEmail}: ${err.message}`);
                await this.logDelivery(
                  notice.user_id,
                  notice.id,
                  notice.title,
                  notice.message,
                  'email',
                  'failed',
                  err.message
                );
              }
            } else {
              this.logger.warn(`No email address resolved for user ${notice.user_id}`);
              await this.logDelivery(
                notice.user_id,
                notice.id,
                notice.title,
                notice.message,
                'email',
                'No email address found'
              );
            }
          }

          if (deliveryBrowser && fcmToken) {
            this.logger.log(`Dispatching browser push to token for user ${notice.user_id}`);
            const pushSuccess = await this.sendPushNotification(fcmToken, notice.title, notice.message);
            if (pushSuccess) {
              await this.logDelivery(
                notice.user_id,
                notice.id,
                notice.title,
                notice.message,
                'browser',
                'delivered'
              );
            } else {
              await this.logDelivery(
                notice.user_id,
                notice.id,
                notice.title,
                notice.message,
                'browser',
                'delivered',
                'FCM simulated push alert triggered (FCM_SERVER_KEY not set)'
              );
            }
          }

          if (emailRequired && !emailSentSuccess) {
            this.logger.warn(`Email notification ${notice.id} remains pending for retry.`);
            continue;
          }

          await this.markProcessed(notice.id, usingSupabase, notice.exam_id);
        }
      } catch (err) {
        this.logger.error(`Error in background email dispatcher: ${err.message}`);
      } finally {
        this.dispatcherRunning = false;
      }
    };

    void dispatch();
    setInterval(() => void dispatch(), 60000);
  }

  /**
   * Retrieve email from DB (works in SQLite and Postgres)
   */
  private async getUserEmail(userId: string): Promise<string | null> {
    try {
      const result = await this.entityManager.query(
        'SELECT email FROM users WHERE id = ?',
        [userId]
      );
      if (result && result[0]) {
        return result[0].email;
      }
    } catch (err) {
      try {
        const result = await this.entityManager.query(
          'SELECT email FROM users WHERE id = $1',
          [userId]
        );
        if (result && result[0]) {
          return result[0].email;
        }
      } catch (e) {
        this.logger.error(`Failed to retrieve email for user ID ${userId} from database: ${e.message}`);
      }
    }
    return null;
  }

  /**
   * Compile template and send SMTP email
   */
  public async sendNotificationEmail(toEmail: string, title: string, message: string): Promise<void> {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SECURITY_EMAIL_FROM || user || 'legatrixon2026@gmail.com';

    if (!host || !user || !pass) {
      throw new Error('SMTP_HOST, SMTP_USER, and SMTP_PASS are required for email delivery.');
    }

    const safeTitle = this.escapeHtml(title);
    const safeMessage = this.escapeHtml(message).replace(/\n/g, '<br>');
    const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
  <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #edf2f7; padding-bottom: 16px;">
    <h2 style="color: #b58920; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">LEGATRIXON Academic OS</h2>
    <p style="color: #718096; margin: 4px 0 0; font-size: 12px; font-weight: 600;">ACADEMIC NAVIGATION SIGNAL</p>
  </div>
  
  <div style="padding: 18px; background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 12px; margin-bottom: 24px;">
    <h3 style="margin-top: 0; color: #2d3748; font-size: 15px; font-weight: 700;">${safeTitle}</h3>
    <p style="color: #4a5568; font-size: 13px; line-height: 1.6; margin: 0;">
      ${safeMessage}
    </p>
  </div>
  
  <div style="text-align: center; font-size: 11px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 16px; line-height: 1.4;">
    This is an automated academic schedule reminder from your LEGATRIXON Academic Operating System.
  </div>
</div>
    `;

    const rawMessage = [
      `From: LEGATRIXON <${from}>`,
      `To: ${toEmail}`,
      `Subject: ${title}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlBody,
    ].join('\r\n');

    try {
      await this.sendSmtp({ host, port, user, pass, from, to: [toEmail], rawMessage });
      this.logger.log(`SMTP Email sent successfully to ${toEmail}.`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${toEmail} via SMTP: ${err.message}`);
      throw err;
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Secure SMTP socket sender
   */
  private sendSmtp(config: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
    to: string[];
    rawMessage: string;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const secure = config.port === 465;
      const socket = secure
        ? tls.connect(config.port, config.host, { servername: config.host })
        : net.connect(config.port, config.host);
      let buffer = '';
      let step = 0;
      let settled = false;
      let tlsActive = secure;
      let upgradedSocket: any = null;
      let lastSmtpResponse = '';

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (upgradedSocket) upgradedSocket.destroy();
        reject(error);
      };

      const send = (line: string) => {
        const activeSock = upgradedSocket || socket;
        activeSock.write(`${line}\r\n`);
      };

      const getExpectedCode = (currentStep: number, isTls: boolean): string[] => {
        if (currentStep === 0) return ['220']; // Banner
        if (currentStep === 1) return ['250']; // EHLO response
        if (currentStep === 2) return isTls ? ['334'] : ['220']; // Username challenge or STARTTLS response
        if (currentStep === 3) return ['334']; // Password challenge
        if (currentStep === 4) return ['235']; // Auth success
        if (currentStep === 5) return ['250']; // MAIL FROM response
        
        const recipientIndex = currentStep - 6;
        if (recipientIndex < config.to.length - 1) {
          return ['250']; // Response to RCPT TO
        } else if (recipientIndex === config.to.length - 1) {
          return ['250']; // Response to the last RCPT TO
        } else if (recipientIndex === config.to.length) {
          return ['354']; // Response to DATA command
        } else if (recipientIndex === config.to.length + 1) {
          return ['250']; // Response to message content dot
        } else {
          return ['221']; // Response to QUIT
        }
      };

      const continueFlow = (line: string) => {
        const code = line.slice(0, 3);
        const expected = getExpectedCode(step, tlsActive);
        
        if (!expected.includes(code)) {
          return fail(new Error(`SMTP error at step ${step} (TLS active: ${tlsActive}): expected ${expected.join('/')}, got response: ${line}`));
        }

        const currentStep = step;
        step++;

        switch (currentStep) {
          case 0:
            send(`EHLO ${config.host}`);
            break;
          case 1:
            if (tlsActive) {
              send(`AUTH LOGIN`);
            } else {
              send('STARTTLS');
            }
            break;
          case 2:
            if (tlsActive) {
              send(Buffer.from(config.user).toString('base64'));
            } else {
              const upgraded = tls.connect({ socket, servername: config.host }, () => {
                buffer = '';
                tlsActive = true;
                step = 1;
                send(`EHLO ${config.host}`);
              });
              socket.removeAllListeners('data');
              upgraded.on('data', onData);
              upgraded.on('error', fail);
              upgradedSocket = upgraded;
              return;
            }
            break;
          case 3:
            send(Buffer.from(config.pass).toString('base64'));
            break;
          case 4:
            send(`MAIL FROM:<${config.from}>`);
            break;
          case 5:
            send(`RCPT TO:<${config.to[0]}>`);
            break;
          default: {
            const recipientIndex = currentStep - 6;
            if (recipientIndex < config.to.length - 1) {
              send(`RCPT TO:<${config.to[recipientIndex + 1]}>`);
            } else if (recipientIndex === config.to.length - 1) {
              send('DATA');
            } else if (recipientIndex === config.to.length) {
              send(config.rawMessage + '\r\n.');
            } else {
              send('QUIT');
              if (!settled) {
                settled = true;
                resolve();
              }
            }
          }
        }
      };

      const onData = (data: Buffer) => {
        buffer += data.toString('utf8');
        const lines = buffer.split(/\r?\n/).filter(Boolean);
        const last = lines[lines.length - 1];
        if (!last || /^\d{3}-/.test(last)) return;
        buffer = '';
        lastSmtpResponse = last;
        continueFlow(last);
      };

      socket.setTimeout(15000, () => fail(new Error('SMTP delivery timed out.')));
      socket.on('data', onData);
      socket.on('error', fail);
    });
  }

  /**
   * Run dynamic checks to create alert notifications for upcoming milestones or missed events
   */
  async runNotificationChecks(userId: string) {
    await this.runNotificationChecksForUser(userId);
  }

  async compileWeeklyStats(userId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Fetch logs
    let logs = [];
    try {
      logs = await this.entityManager.getRepository(UserActivityLog).find({
        where: { userId }
      });
    } catch (e) {
      this.logger.warn(`Failed to retrieve logs in compileWeeklyStats: ${e.message}`);
    }
    
    const recentLogs = logs.filter((log) => new Date(log.createdAt) >= sevenDaysAgo);
    
    // Streak
    const days = new Set(logs.map((log) => log.createdAt ? log.createdAt.toISOString().slice(0, 10) : ''));
    let streak = 0;
    const cursor = new Date();
    const dateKey = (d: Date) => d.toISOString().slice(0, 10);
    if (!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (days.has(dateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    
    // Study hours
    let studyHours = 0.5;
    try {
      const logins = await this.supabaseService.getUserLogins(userId);
      let totalDurationMin = 0;
      logins.forEach((login: any) => {
        const inTime = new Date(login.login_time).getTime();
        const outTime = login.logout_time ? new Date(login.logout_time).getTime() : (inTime + 30 * 60 * 1000);
        totalDurationMin += (outTime - inTime) / (60 * 1000);
      });
      studyHours = Number((totalDurationMin / 60).toFixed(1));
    } catch (e) {
      studyHours = Number((recentLogs.length * 0.1).toFixed(1));
    }

    // Quiz accuracy
    let quizAccuracy = 75;
    try {
      const results = await this.supabaseService.getQuizResults(userId);
      const scores = results.map((q: any) => Number(q.score || 0));
      if (scores.length) {
        quizAccuracy = Math.round(scores.reduce((sum, val) => sum + val, 0) / scores.length);
      }
    } catch (e) {}

    // Mastery Score
    const studyCompletion = recentLogs.length ? 80 : 0;
    const masteryScore = Math.round(quizAccuracy * 0.4 + studyCompletion * 0.6);

    return {
      studyHours,
      masteryScore,
      quizAccuracy,
      streak,
      studySessions: recentLogs.filter((log) => ['Asked Question', 'Reviewed Flashcard', 'Completed Quiz'].includes(log.action)).length
    };
  }

  async runNotificationChecksForUser(userId: string) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Get user preferences
    let prefs = await this.supabaseService.getPreferences(userId);
    if (!prefs) {
      try {
        prefs = await this.entityManager.getRepository(UserNotificationPreference).findOne({ where: { userId } });
      } catch (err) {}
    }

    const studyRemindersEnabled = prefs ? (prefs.study_reminders ?? prefs.studyReminders ?? true) : true;
    const quizRemindersEnabled = prefs ? (prefs.quiz_reminders ?? prefs.quizReminders ?? true) : true;
    const revisionAlertsEnabled = prefs ? (prefs.revision_alerts ?? prefs.revisionAlerts ?? true) : true;
    const weeklyReportsEnabled = prefs ? (prefs.weekly_reports ?? prefs.weeklyReports ?? true) : true;
    const weeklyDigestEnabled = prefs ? (prefs.weekly_digest ?? prefs.weeklyDigest ?? prefs.delivery_digest ?? prefs.deliveryDigest ?? false) : false;

    // 1. Study Reminders (Calendar events at 24h, 1h, 15m)
    if (studyRemindersEnabled) {
      try {
        const events = await this.entityManager.getRepository(CalendarEvent).find({ where: { userId } });
        for (const event of events) {
          const eventStart = new Date(`${event.eventDate}T${event.eventTime || '00:00:00'}`);
          const minsDiff = (eventStart.getTime() - now.getTime()) / (60 * 1000);
          
          if (minsDiff <= 0) continue;
          
          const matchesType = ['study', 'research', 'moot', 'revision'].includes(event.eventType);
          const matchesCategory = event.category && ['Study Sessions', 'Research Sessions', 'Case Readings', 'Moot Court Practices'].includes(event.category);
          if (!matchesType && !matchesCategory) continue;

          let categoryLabel = 'Study Session';
          if (event.eventType === 'research' || event.category === 'Research Sessions') categoryLabel = 'Research Session';
          if (event.eventType === 'moot' || event.category === 'Moot Court Practices') categoryLabel = 'Moot Court Practice';
          if (event.eventType === 'revision' || event.category === 'Case Readings') categoryLabel = 'Case Reading';

          // 24 hours reminder
          if (minsDiff <= 24 * 60) {
            const title = `Upcoming ${categoryLabel} (24h): ${event.title}`;
            const existing = await this.notificationRepository.findOne({ where: { userId, title } });
            if (!existing) {
              await this.createNotification(
                userId,
                title,
                `Reminder: Your scheduled ${categoryLabel} "${event.title}" starts in 24 hours at ${event.eventTime}.`,
                0,
                'normal',
                'all',
                'alert'
              );
            }
          }
          
          // 1 hour reminder
          if (minsDiff <= 60) {
            const title = `Upcoming ${categoryLabel} (1h): ${event.title}`;
            const existing = await this.notificationRepository.findOne({ where: { userId, title } });
            if (!existing) {
              await this.createNotification(
                userId,
                title,
                `Reminder: Your scheduled ${categoryLabel} "${event.title}" starts in 1 hour at ${event.eventTime}.`,
                0,
                'normal',
                'all',
                'alert'
              );
            }
          }
          
          // 15 minutes reminder
          if (minsDiff <= 15) {
            const title = `Upcoming ${categoryLabel} (15m): ${event.title}`;
            const existing = await this.notificationRepository.findOne({ where: { userId, title } });
            if (!existing) {
              await this.createNotification(
                userId,
                title,
                `Reminder: Your scheduled ${categoryLabel} "${event.title}" starts in 15 minutes at ${event.eventTime}.`,
                0,
                'normal',
                'all',
                'alert'
              );
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Failed upcoming calendar reminders check: ${err.message}`);
      }
    }

    // 2. Upcoming exams check (within 7 days)
    if (studyRemindersEnabled) {
      try {
        const exams = await this.entityManager.getRepository(Exam).find({ where: { userId } });
        for (const exam of exams) {
          const timeDiff = exam.examDate.getTime() - now.getTime();
          const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
          if (daysDiff > 0 && daysDiff <= 7) {
            const alertTitle = `Upcoming Exam Alert: ${exam.subject}`;
            const existing = await this.notificationRepository.findOne({
              where: { userId, title: alertTitle }
            });
            if (!existing) {
              await this.createNotification(
                userId,
                alertTitle,
                `Your ${exam.subject} exam is in ${daysDiff} days (${exam.examDate.toISOString().split('T')[0]}). Keep reviewing high-yield areas!`,
                0,
                'important',
                'all',
                'alert'
              );
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Failed exam checks: ${err.message}`);
      }
    }

    // 3. Moot court milestones (within 3 days)
    if (studyRemindersEnabled) {
      try {
        const mootEvents = await this.entityManager.getRepository(CalendarEvent).find({
          where: { userId, eventType: 'moot' }
        });
        for (const event of mootEvents) {
          const eventDate = new Date(`${event.eventDate}T12:00:00`);
          const timeDiff = eventDate.getTime() - now.getTime();
          const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
          if (daysDiff > 0 && daysDiff <= 3) {
            const alertTitle = `Moot Court Milestone: ${event.title}`;
            const existing = await this.notificationRepository.findOne({
              where: { userId, title: alertTitle }
            });
            if (!existing) {
              await this.createNotification(
                userId,
                alertTitle,
                `Moot court milestone "${event.title}" is in ${daysDiff} days. Finalize your briefs and argument vectors.`,
                0,
                'normal',
                'all',
                'alert'
              );
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Failed moot court checks: ${err.message}`);
      }
    }

    // 4. Pending research deadlines check (within 3 days)
    if (studyRemindersEnabled) {
      try {
        const researchEvents = await this.entityManager.getRepository(CalendarEvent).find({
          where: { userId, eventType: 'research' }
        });
        for (const event of researchEvents) {
          const eventDate = new Date(`${event.eventDate}T12:00:00`);
          const timeDiff = eventDate.getTime() - now.getTime();
          const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
          if (daysDiff > 0 && daysDiff <= 3) {
            const alertTitle = `Research Deadline: ${event.title}`;
            const existing = await this.notificationRepository.findOne({
              where: { userId, title: alertTitle }
            });
            if (!existing) {
              await this.createNotification(
                userId,
                alertTitle,
                `Research deadline "${event.title}" is in ${daysDiff} days. Make sure to update your Legal Research notes.`,
                0,
                'normal',
                'all',
                'alert'
              );
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Failed research checks: ${err.message}`);
      }
    }

    // 5. Missed study sessions
    if (studyRemindersEnabled) {
      try {
        const studyEvents = await this.entityManager.getRepository(CalendarEvent)
          .createQueryBuilder('e')
          .where('e.user_id = :userId', { userId })
          .andWhere('e.event_type IN (:...types)', { types: ['study', 'revision'] })
          .andWhere('e.event_date < :todayStr', { todayStr })
          .andWhere('e.event_date >= :twoDaysAgo', { twoDaysAgo: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0] })
          .getMany();

        for (const event of studyEvents) {
          const alertTitle = `Missed Session: ${event.title}`;
          const existing = await this.notificationRepository.findOne({
            where: { userId, title: alertTitle }
          });
          if (!existing) {
            await this.createNotification(
              userId,
              alertTitle,
              `You missed your scheduled study session "${event.title}" on ${event.eventDate}. Try to reschedule it to stay on track.`,
              0,
              'normal',
              'all',
              'alert'
            );
          }
        }
      } catch (err) {
        this.logger.warn(`Failed study event checks: ${err.message}`);
      }
    }

    // 6. Inactivity revision alerts (triggered if no activity within 3 days)
    if (revisionAlertsEnabled) {
      try {
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        let recentLogs = [];
        try {
          recentLogs = await this.entityManager.getRepository(UserActivityLog).find({
            where: { userId },
            order: { createdAt: 'DESC' },
            take: 1
          });
        } catch (e) {}
        
        const lastActivity = recentLogs[0] ? new Date(recentLogs[0].createdAt) : null;
        const isInactive = !lastActivity || lastActivity < threeDaysAgo;
        
        if (isInactive) {
          const alertTitle = `Inactivity Alert: Revision Needed`;
          const lastAlert = await this.notificationRepository.createQueryBuilder('n')
            .where('n.user_id = :userId', { userId })
            .andWhere('n.title = :title', { title: alertTitle })
            .orderBy('n.trigger_time', 'DESC')
            .getOne();
            
          const canSendAlert = !lastAlert || (now.getTime() - new Date(lastAlert.triggerTime).getTime()) > 3 * 24 * 60 * 60 * 1000;
          
          if (canSendAlert) {
            const prompt = `You are LexMentor AI, the expert law tutor. The student has not logged any study activities on LEGATRIXON for over 3 days. Suggest a quick, friendly, and highly motivating 5-minute legal revision exercise to get them back on track. Keep your guidance extremely concise and action-oriented. Format in 1-2 paragraphs. Do not use markdown headers.`;
            let explanation = '';
            try {
              const result = await this.aiProvider.complete({
                messages: [
                  { role: 'system', content: 'You are LexMentor AI, a helpful law tutor.' },
                  { role: 'user', content: prompt }
                ],
                temperature: 0.7
              });
              explanation = result.content;
            } catch (err) {
              explanation = `LexMentor AI noticed you've been away for a few days. Consistency is key to mastering legal concepts! Try starting with a quick 5-minute flashcard review or a single practice quiz to keep your streak alive.`;
            }

            await this.createNotification(userId, alertTitle, explanation, 0, 'normal', 'all', 'alert');
          }
        }
      } catch (err) {
        this.logger.warn(`Failed inactivity revision checks: ${err.message}`);
      }
    }

    // 7. AI-driven Weak Concept Revision Alerts (LexMentor AI & Smart Study Forge)
    if (revisionAlertsEnabled) {
      try {
        const notebooks = await this.entityManager.getRepository(NotebookDocument).find({ where: { userId } });
        const weakFlashcards = [];
        for (const doc of notebooks) {
          const forge = doc.studyForge || {};
          const cards = Array.isArray(forge.flashcards) ? forge.flashcards : [];
          for (const card of cards) {
            if (card.mastery !== undefined && card.mastery < 75) {
              weakFlashcards.push({ docName: doc.name, question: card.q || card.question, answer: card.a || card.answer, mastery: card.mastery });
            }
          }
        }

        if (weakFlashcards.length > 0) {
          const fc = weakFlashcards[Math.floor(Math.random() * weakFlashcards.length)];
          const alertTitle = `LexMentor AI: Revision Needed on ${fc.docName}`;
          
          const existing = await this.notificationRepository.findOne({
            where: { userId, title: alertTitle }
          });
          
          if (!existing) {
            const prompt = `You are LexMentor AI, the expert law tutor. Suggest a 5-minute study technique for this legal question/concept where the student has low mastery (${fc.mastery}%):
Concept Question: ${fc.question}
Source Document: ${fc.docName}
Keep your guidance extremely concise and action-oriented. Format in 1-2 paragraphs. Do not use markdown headers.`;

            let explanation = '';
            try {
              const result = await this.aiProvider.complete({
                messages: [
                  { role: 'system', content: 'You are LexMentor AI, a helpful law tutor.' },
                  { role: 'user', content: prompt }
                ],
                temperature: 0.7
              });
              explanation = result.content;
            } catch (err) {
              explanation = `LexMentor AI recommends reviewing the concept: "${fc.question}" from your document "${fc.docName}". Your current mastery score is ${fc.mastery}%. A quick revision session will help commit this legal point to long-term memory.`;
            }

            await this.createNotification(userId, alertTitle, explanation, 0, 'normal', 'all', 'alert');
          }
        }
      } catch (err) {
        this.logger.warn(`Failed weak concept revision checks: ${err.message}`);
      }
    }

    // 8. Quiz Reminders / Mock Tests
    if (quizRemindersEnabled) {
      try {
        const userExams = await this.entityManager.getRepository(Exam).find({ where: { userId } });
        const userExamIds = userExams.map((e) => e.id);
        
        if (userExamIds.length > 0) {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
          
          const mockTests = await this.entityManager.getRepository(MockTest).find();
          const scheduledTests = mockTests.filter((test) => {
            const testDate = new Date(test.date);
            return userExamIds.includes(test.examId) && testDate >= startOfToday && testDate < endOfTomorrow && (test.score === null || test.score === undefined);
          });

          for (const test of scheduledTests) {
            const alertTitle = `Quiz Reminder: ${test.title}`;
            const existing = await this.notificationRepository.findOne({
              where: { userId, title: alertTitle }
            });
            if (!existing) {
              await this.createNotification(
                userId,
                alertTitle,
                `Your scheduled quiz "${test.title}" for subject "${test.subject}" is coming up on ${new Date(test.date).toLocaleDateString()}. Get ready to test your knowledge!`,
                0,
                'normal',
                'all',
                'alert'
              );
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Failed Quiz Reminders: ${err.message}`);
      }
    }

    // 9. Sunday Weekly academic performance summaries
    if (weeklyReportsEnabled && now.getDay() === 0) {
      try {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekStartStr = weekStart.toISOString().split('T')[0];
        const alertTitle = `Weekly Performance Summary - Week of ${weekStartStr}`;
        
        const existing = await this.notificationRepository.findOne({
          where: { userId, title: alertTitle }
        });
        if (!existing) {
          const stats = await this.compileWeeklyStats(userId);
          const prompt = `You are LexMentor AI, the user's personal academic coach.
Here is the user's performance summary for the past week:
- Study Hours: ${stats.studyHours} hours
- Mastery Score: ${stats.masteryScore}%
- Quiz Accuracy: ${stats.quizAccuracy}%
- Study Streak: ${stats.streak} days
- Core revision sessions (quizzes/flashcards/AI queries): ${stats.studySessions}

Write a comprehensive weekly performance summary. Highlight their persistence, suggest specific focus areas (such as doing more active recall if study activities are low), and end with an inspiring quote. Format it in 3 short, easy-to-read paragraphs. Do not use markdown titles.`;

          let weeklyReportContent = '';
          try {
            const result = await this.aiProvider.complete({
              messages: [
                { role: 'system', content: "You are LexMentor AI, the user's academic coach." },
                { role: 'user', content: prompt }
              ],
              temperature: 0.7
            });
            weeklyReportContent = result.content;
          } catch (err) {
            weeklyReportContent = `Here is your Weekly Performance Summary for the week starting ${weekStartStr}. You have logged ${stats.studyHours} study hours and completed ${stats.studySessions} study sessions. Keep up the consistent work to maintain your study streak. LexMentor AI recommends reviewing outstanding flashcards and mock tests this weekend to prepare for the upcoming week!`;
          }

          await this.createNotification(userId, alertTitle, weeklyReportContent, 0, 'important', 'all', 'weekly_report');
        }
      } catch (err) {
        this.logger.warn(`Failed weekly performance summary compiler: ${err.message}`);
      }
    }

    // 10. Sunday Weekly Digests
    if (weeklyDigestEnabled && now.getDay() === 0) {
      try {
        const digestTitle = `Weekly Digest - Updates and Milestones`;
        const existingDigest = await this.notificationRepository.findOne({
          where: { userId, title: digestTitle }
        });
        
        if (!existingDigest) {
          const digestMsg = `Here is your LEGATRIXON Weekly Digest. Over the past week, you had upcoming exams and research deadlines. Keep ahead of your study schedules. In the upcoming week, verify your calendar for new Moot Court practices and assignment deadlines!`;
          await this.createNotification(userId, digestTitle, digestMsg, 0, 'normal', 'all', 'digest');
        }
      } catch (err) {
        this.logger.warn(`Failed weekly digest: ${err.message}`);
      }
    }
  }

  async checkUpcomingExamsAndTriggerReminders(now: Date) {
    this.logger.log(`Checking upcoming exams for reminder triggers at ${now.toISOString()}`);
    
    // 1. Fetch upcoming exams from SQLite
    let sqliteExams: Exam[] = [];
    try {
      sqliteExams = await this.entityManager.getRepository(Exam)
        .createQueryBuilder('exam')
        .where('exam.reminderEnabled = :enabled', { enabled: true })
        .andWhere('exam.reminderSentAt IS NULL')
        .andWhere('exam.reminderTriggerAt <= :now', { now })
        .getMany();
    } catch (err: any) {
      this.logger.warn(`Failed to fetch due exam reminders from local SQLite: ${err.message}`);
    }

    // 2. Fetch upcoming exams from Supabase when configured
    let supabaseExams: any[] = [];
    if (this.supabaseService.isConfigured()) {
      try {
        const headers = this.supabaseService.getHeaders();
        const response = await axios.get(
          `${this.supabaseService.supabaseUrl}/rest/v1/exams?reminder_enabled=eq.true&reminder_sent_at=is.null&reminder_trigger_at=lte.${now.toISOString()}`,
          { headers }
        );
        supabaseExams = response.data || [];
      } catch (err: any) {
        this.logger.warn(`Failed to fetch due exam reminders from Supabase: ${err.message}`);
      }
    }

    // 3. Normalize and merge
    interface NormalizedExam {
      id: string;
      userId: string;
      clerkUserId: string;
      fullName: string;
      email: string;
      subjectName: string;
      examDate: Date;
      examTime: string;
      reminderType: string;
      reminderTriggerAt: Date;
    }

    const map = new Map<string, NormalizedExam>();

    const normalizeSQLite = (e: Exam): NormalizedExam => ({
      id: e.id,
      userId: e.userId,
      clerkUserId: e.clerkUserId,
      fullName: e.fullName,
      email: e.email,
      subjectName: e.subjectName || e.subject,
      examDate: new Date(e.examDate),
      examTime: e.examTime,
      reminderType: e.reminderType || '',
      reminderTriggerAt: e.reminderTriggerAt,
    });

    const normalizeSupabase = (e: any): NormalizedExam => ({
      id: e.id,
      userId: e.user_id,
      clerkUserId: e.clerk_user_id,
      fullName: e.full_name,
      email: e.email,
      subjectName: e.subject_name || e.subject,
      examDate: new Date(e.exam_date),
      examTime: e.exam_time,
      reminderType: e.reminder_type || '',
      reminderTriggerAt: new Date(e.reminder_trigger_at),
    });

    for (const e of sqliteExams) {
      map.set(e.id, normalizeSQLite(e));
    }
    for (const e of supabaseExams) {
      if (!map.has(e.id)) {
        map.set(e.id, normalizeSupabase(e));
      }
    }

    const dueExams = Array.from(map.values());
    if (dueExams.length === 0) {
      return;
    }

    this.logger.log(`Found ${dueExams.length} due exam reminder(s) to dispatch.`);

    const getRelativeDescription = (subjectName: string, minutes: number, examTime: string): string => {
      if (minutes >= 43200) {
        return `${subjectName} exam begins in 30 days.`;
      } else if (minutes >= 21600) {
        return `${subjectName} exam begins in 15 days.`;
      } else if (minutes >= 10080) {
        return `${subjectName} exam begins in 7 days.`;
      } else if (minutes >= 4320) {
        return `${subjectName} exam begins in 3 days.`;
      } else if (minutes >= 1440) {
        return `${subjectName} exam begins tomorrow at ${examTime || '9:00 AM'}.`;
      } else if (minutes >= 720) {
        return `${subjectName} exam begins in 12 hours at ${examTime || '9:00 AM'}.`;
      } else if (minutes >= 60) {
        return `${subjectName} exam begins in 1 hour at ${examTime || '9:00 AM'}.`;
      } else if (minutes >= 5) {
        return `${subjectName} exam begins in 5 minutes.`;
      } else if (minutes >= 2) {
        return `${subjectName} exam begins in 2 minutes.`;
      } else {
        return `${subjectName} exam begins in 1 minute.`;
      }
    };

    for (const exam of dueExams) {
      const nowStr = now.toISOString();

      // Immediately mark sent to prevent double dispatch
      try {
        await axios.patch(
          `${this.supabaseService.supabaseUrl}/rest/v1/exams?id=eq.${exam.id}`,
          { reminder_sent_at: nowStr },
          { headers: this.supabaseService.getHeaders() }
        );
      } catch (err: any) {
        this.logger.warn(`Failed to update reminder_sent_at on Supabase for exam ${exam.id}: ${err.message}`);
      }

      try {
        await this.entityManager.getRepository(Exam).update(
          { id: exam.id },
          { reminderSentAt: now }
        );
      } catch (err: any) {
        this.logger.warn(`Failed to update reminderSentAt locally for exam ${exam.id}: ${err.message}`);
      }

      // Prepare email content
      const examDateStr = exam.examDate.toLocaleDateString();
      const examTimeStr = exam.examTime || exam.examDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const studentName = exam.fullName || 'Student';
      const body = [
        `Hello ${studentName},`,
        '',
        'This is a reminder that your upcoming examination is approaching.',
        '',
        'Subject:',
        exam.subjectName,
        '',
        'Date:',
        examDateStr,
        '',
        'Time:',
        examTimeStr,
        '',
        'Recommended Action:',
        '',
        '• Review final notes',
        '• Complete revision checklist',
        '• Attempt one mock test',
        '• Revise important judgments and case laws',
        '',
        'Best of luck.',
        '',
        'Team LEGATRIXON™',
        '',
        'Powered by N-CYPHER Pvt. Ltd.',
      ].join('\n');

      let recipientEmail = exam.email;
      if (!recipientEmail) {
        recipientEmail = await this.getUserEmail(exam.userId);
      }

      let emailSent = false;
      let deliveryError = null;

      if (recipientEmail) {
        try {
          await this.sendNotificationEmail(
            recipientEmail,
            `LEGATRIXON Exam Reminder - ${exam.subjectName}`,
            body
          );
          emailSent = true;
        } catch (err: any) {
          this.logger.error(`Failed to send reminder email to ${recipientEmail}: ${err.message}`);
          deliveryError = err.message;
        }
      } else {
        this.logger.warn(`No email found for user ${exam.userId} of exam ${exam.id}`);
        deliveryError = 'No email address resolved';
      }

      // Calculate relative description
      let mins = 1440;
      if (exam.reminderType) {
        const match = exam.reminderType.match(/^(\d+)/);
        if (match) {
          mins = parseInt(match[1], 10);
        }
      }
      const description = getRelativeDescription(exam.subjectName, mins, examTimeStr);
      const notificationTitle = `Exam Reminder: ${exam.subjectName}`;

      // Insert platform notification in Supabase
      try {
        await this.supabaseService.createNotification({
          user_id: exam.userId,
          clerk_user_id: exam.clerkUserId,
          exam_id: exam.id,
          title: notificationTitle,
          message: description,
          type: 'exam_reminder',
          trigger_time: now.toISOString(),
          is_read: false,
          email_sent: emailSent,
          priority: 'critical',
          delivery_channel: 'all',
          email_subject: `LEGATRIXON Exam Reminder - ${exam.subjectName}`,
          email_body: body,
          delivered_at: emailSent ? now.toISOString() : null,
          failed_at: !emailSent ? now.toISOString() : null,
          delivery_error: deliveryError,
        });
      } catch (err: any) {
        this.logger.warn(`Failed to insert platform notification on Supabase: ${err.message}`);
      }

      // Save platform notification locally
      try {
        const localNotif = new Notification();
        localNotif.userId = exam.userId;
        localNotif.clerkUserId = exam.clerkUserId;
        localNotif.examId = exam.id;
        localNotif.title = notificationTitle;
        localNotif.message = description;
        localNotif.type = 'exam_reminder';
        localNotif.triggerTime = now;
        localNotif.isRead = false;
        localNotif.emailSent = emailSent;
        localNotif.priority = 'critical';
        localNotif.deliveryChannel = 'all';
        localNotif.emailSubject = `LEGATRIXON Exam Reminder - ${exam.subjectName}`;
        localNotif.emailBody = body;
        if (emailSent) {
          localNotif.deliveredAt = now;
        } else {
          localNotif.failedAt = now;
          localNotif.deliveryError = deliveryError;
        }
        await this.notificationRepository.save(localNotif);
      } catch (err: any) {
        this.logger.warn(`Failed to save platform notification locally: ${err.message}`);
      }

      // Log delivery activity
      try {
        await this.logDelivery(
          exam.userId,
          exam.id,
          notificationTitle,
          description,
          'email',
          emailSent ? 'delivered' : 'failed',
          deliveryError
        );
      } catch (err) {
        this.logger.warn(`Failed to log delivery: ${err.message}`);
      }
    }
  }

  async checkDailyInternshipReminders(now: Date) {
    if (!this.supabaseService.isConfigured()) return;
    this.logger.log(`Checking daily internship reminders at ${now.toISOString()}`);
    try {
      // 1. Fetch all internship applications
      const response = await axios.get(
        `${this.supabaseService.supabaseUrl}/rest/v1/internship_applications`,
        { headers: this.supabaseService.getHeaders() }
      );
      const internships = response.data || [];
      if (internships.length === 0) {
        return;
      }

      // 2. Group by user_id
      const userInternshipsMap = new Map<string, any[]>();
      for (const item of internships) {
        if (!item.user_id) continue;
        if (!userInternshipsMap.has(item.user_id)) {
          userInternshipsMap.set(item.user_id, []);
        }
        userInternshipsMap.get(item.user_id)!.push(item);
      }

      // 3. For each user, check if we sent a reminder in the last 24 hours
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      for (const [userId, items] of userInternshipsMap.entries()) {
        const existing = await this.notificationRepository.createQueryBuilder('n')
          .where('n.user_id = :userId', { userId })
          .andWhere('n.type = :type', { type: 'internship_reminder' })
          .andWhere('n.created_at >= :yesterday', { yesterday })
          .getOne();

        if (!existing) {
          // Compose summary
          const title = `Daily Internship Reminder`;
          let message = `Here is your daily update for your active internships:\n\n`;
          items.forEach((internship: any, index: number) => {
            message += `${index + 1}. **${internship.organization}** - *${internship.position}*\n`;
            message += `   - **Status**: ${internship.status || 'N/A'}\n`;
            if (internship.deadline) {
              message += `   - **Deadline**: ${new Date(internship.deadline).toLocaleDateString()}\n`;
            }
            if (internship.notes) {
              message += `   - **Notes**: ${internship.notes}\n`;
            }
            message += `\n`;
          });

          await this.createNotification(
            userId,
            title,
            message,
            0,
            'normal',
            'email',
            'internship_reminder'
          );
          this.logger.log(`Created daily internship reminder notification for user ${userId}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed daily internship reminders check: ${err.message}`);
    }
  }
}





