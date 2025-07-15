import { NotificationService } from '../../notification/notification.service';

export enum SubscriptionEventType {
  CREATED = 'created',
  UPGRADED = 'upgraded',
  DOWNGRADED = 'downgraded',
  CANCELLED = 'cancelled',
}

export const sendSubscriptionEmail = async (
  notificationService: NotificationService,
  user: { name?: string; email: string },
  eventType: SubscriptionEventType,
): Promise<void> => {
  if (!user?.email) {
    console.warn('No email found for user. Skipping subscription email.');
    return;
  }

  const name = user.name || 'User';

  const templates = {
    [SubscriptionEventType.CREATED]: {
      subject: 'Subscription Created',
      html: `<p>Hello ${name},</p><p>Your subscription has been successfully created.</p>`,
    },
    [SubscriptionEventType.UPGRADED]: {
      subject: 'Subscription Upgraded',
      html: `<p>Hello ${name},</p><p>Your subscription has been upgraded.</p>`,
    },
    [SubscriptionEventType.DOWNGRADED]: {
      subject: 'Subscription Downgrade Scheduled',
      html: `<p>Hello ${name},</p><p>Your subscription downgrade has been scheduled.</p>`,
    },
    [SubscriptionEventType.CANCELLED]: {
      subject: 'Subscription Cancelled',
      html: `<p>Hello ${name},</p><p>Your subscription has been cancelled.</p>`,
    },
  };

  const { subject, html } = templates[eventType];

  try {
    await notificationService.sendEmail({
      to: user.email,
      subject,
      html,
    });
  } catch (error) {
    console.error(`Failed to send ${eventType} email:`, error);
  }
};
