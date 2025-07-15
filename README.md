# 🚀 NestJS Stripe Subscription API

This is a **NestJS-based backend API** that manages user accounts, Stripe subscriptions, and handles Stripe webhook events.

---

## 📦 Features

- 🧑‍💼 User Management (Create, Read, Update, Delete)
- 💳 Stripe Subscription Management (Create, Cancel, Upgrade, Downgrade)
- 🔔 Webhook Event Listener for Stripe (Product, Price, Subscription, Invoice events)
- 📘 Swagger Documentation for API

✅ Tech Stack
NestJS

MongoDB (Mongoose)

Stripe SDK


🔌 API Endpoints
👤 User Routes
Method	Route	Description
POST	/users	Create new user
GET	/users	Get all users
GET	/users/:id	Get user by ID
PATCH	/users/:id	Update user by ID
DELETE	/users/:id	Delete user by ID

📦 Subscription Routes
Method	Route	Description
POST	/subscriptions	Create a new subscription
GET	/subscriptions	Get all subscriptions
GET	/subscriptions/:id	Get subscription by ID
PATCH	/subscriptions/cancel/:id	Cancel a subscription
PATCH	/subscriptions/upgrade/:id	Upgrade subscription (price ID)
PATCH	/subscriptions/downgrade/:id	Downgrade (schedule change)

🧾 Subscription Creation Payload:
json
Copy
Edit
{
  "customerId": "cus_xxx",
  "priceId": "price_xxx",
  "paymentMethodId": "pm_xxx"
}
🔔 Stripe Webhook
Method	Route	Description
POST	/webhook/stripe	Stripe webhook handler

Automatically handles events like invoice.paid, subscription.updated, product.created, etc.

🧠 Handled Webhook Events
product.created, product.updated, product.deleted

price.created, price.updated, price.deleted

customer.subscription.created, customer.subscription.updated, customer.subscription.deleted

invoice.payment_succeeded, invoice.payment_failed, invoice.updated, etc.

checkout.session.completed

refund.created, refund.updated

charge.refunded

