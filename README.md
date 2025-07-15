🧾 Stripe Subscription Management API – NestJS
A full-featured NestJS backend for managing Stripe subscriptions, including:

💳 Creating subscriptions with payment methods

📤 Webhooks syncing

📈 Upgrading/downgrading subscriptions

❌ Canceling subscriptions with refund logic

📬 Email notifications (Nodemailer)

📦 Features
Stripe payment and subscription integration

Mongoose schemas for Subscription, Plan, Refund, StripeEvent

Nodemailer for transactional emails (create, cancel, upgrade, downgrade)

Webhook-based syncing from Stripe

Auto refund on cancellation (full/prorated)

Logs and error tracking with NestJS Logger

⚙️ Tech Stack
NestJS – Modular backend framework

Stripe API – Payment and subscription management

MongoDB + Mongoose – Data storage

Nodemailer – Email service

Logger – Structured request logging

dotenv/config – Environment configuration


🧪 Environment Setup
Create a .env file at the project root:

env
Copy
Edit
# Stripe
STRIPE_SECRET_KEY=sk_test_***************
STRIPE_WEBHOOK_SECRET=whsec_*************

# Email (Gmail recommended)
EMAIL_USER=yourgmail@gmail.com
EMAIL_PASS=yourgmailapppassword

# MongoDB
MONGODB_URI=mongodb://localhost:27017/subscription_db


📘 API Usage
🔐 Create Subscription
http
Copy
Edit
POST /subscriptions
Body:

json
Copy
Edit
{
  "customerId": "cus_123...",
  "priceId": "price_abc...",
  "paymentMethodId": "pm_123..."
}
📈 Upgrade Subscription
h
Copy
Edit
PATCH /subscriptions/:id/upgrade
Body:

json
Copy
Edit
{
  "newPriceId": "price_xyz..."
}
📉 Schedule Downgrade
http
Copy
Edit
PATCH /subscriptions/:id/downgrade
Body:

json
Copy
Edit
{
  "newPriceId": "price_basic..."
}
❌ Cancel Subscription
http
Copy
Edit
DELETE /subscriptions/:id
📬 Emails Sent
Emails are sent to the user when:

✅ Subscription is created

⬆️ Subscription is upgraded

⬇️ Subscription is scheduled to downgrade

❌ Subscription is cancelled

Configured with Gmail using Nodemailer.

🧾 Webhook Events Handled

product.created/updated/deleted

price.created/updated/deleted

customer.subscription.created/updated/deleted

invoice.*

checkout.session.completed

subscription_schedule.canceled

charge.refunded

refund.created/updated
