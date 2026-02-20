# Privacy Policy — DeepSight

**Last updated: February 2026**

## 1. Introduction

DeepSight ("we", "our", "us") operates the DeepSight mobile application and web platform (https://www.deepsightsynthesis.com). This Privacy Policy explains how we collect, use, store, and protect your personal data when you use our services.

We are committed to complying with the General Data Protection Regulation (GDPR) and applicable French data protection laws.

## 2. Data Controller

DeepSight SAS
Email: privacy@deepsightsynthesis.com
Website: https://www.deepsightsynthesis.com

## 3. Data We Collect

### 3.1 Account Data
- Email address
- Encrypted password (hashed with bcrypt)
- Display name (optional)
- Account creation date

### 3.2 Usage Data
- YouTube video URLs submitted for analysis
- AI-generated analysis results (summaries, fact-checks, study tools)
- Chat conversation history with the AI assistant
- Analysis history and preferences
- Subscription plan and billing status

### 3.3 Technical Data
- Device type and operating system version
- App version
- Crash reports and error logs (via Sentry)
- Anonymous usage analytics

### 3.4 Data We Do NOT Collect
- Location data
- Contacts or address book
- Photos, camera, or microphone access
- Health or biometric data
- Financial information (payments are processed by Stripe)
- Browsing history outside the app

## 4. How We Use Your Data

| Purpose | Legal Basis (GDPR) |
|---------|-------------------|
| Provide the analysis service | Contract performance (Art. 6(1)(b)) |
| Manage your account and subscription | Contract performance (Art. 6(1)(b)) |
| Send transactional emails (verification, password reset) | Contract performance (Art. 6(1)(b)) |
| Improve the service and fix bugs | Legitimate interest (Art. 6(1)(f)) |
| Crash reporting and error monitoring | Legitimate interest (Art. 6(1)(f)) |
| Respond to support requests | Legitimate interest (Art. 6(1)(f)) |

We do NOT use your data for advertising, profiling, or selling to third parties.

## 5. Artificial Intelligence Usage

DeepSight uses third-party AI services to provide its core functionality:

- **Mistral AI** (Paris, France) — Generates video summaries, flashcards, quizzes, concept definitions, and chat responses from YouTube video transcripts.
- **Perplexity AI** (San Francisco, USA) — Performs fact-checking by verifying claims against external sources.

### What is sent to AI services:
- YouTube video transcript text (publicly available content)
- Your chat messages when using the contextual chat feature

### What is NOT sent to AI services:
- Your email, password, or personal information
- Your browsing history or device data
- Data from other users

AI-generated content is clearly labeled with certainty markers. We encourage users to verify claims independently.

## 6. Third-Party Services

| Service | Purpose | Data Shared | Location |
|---------|---------|-------------|----------|
| Stripe | Payment processing | Email, plan selection | USA (PCI DSS compliant) |
| Sentry | Error monitoring | Crash reports, device info | USA |
| Railway | Backend hosting | All backend data | EU (Germany) |
| Vercel | Frontend hosting | Static assets only | Global CDN |
| YouTube Data API | Video metadata | YouTube URLs | USA (Google) |
| Resend | Transactional email | Email address | USA |

## 7. Data Storage and Security

- Backend data is stored on Railway servers located in the EU (Germany)
- All data in transit is encrypted via TLS 1.2+
- Passwords are hashed using bcrypt with salt
- Authentication uses JWT tokens with short expiration (15 minutes)
- Database access is restricted to the application server only
- Regular backups are performed automatically

## 8. Data Retention

| Data Type | Retention Period |
|-----------|-----------------|
| Account data | Until account deletion |
| Analysis history | Based on plan (3 days Free, 30 days Student, 60 days Starter, unlimited Pro) |
| Chat history | Same as analysis history |
| Crash reports | 90 days |
| Server logs | 30 days |

## 9. Your Rights (GDPR)

As a user in the European Union, you have the following rights:

- **Right of Access** — Request a copy of all your personal data
- **Right to Rectification** — Correct inaccurate personal data
- **Right to Erasure** — Delete your account and all associated data
- **Right to Portability** — Receive your data in a machine-readable format
- **Right to Restriction** — Limit how we process your data
- **Right to Object** — Object to data processing based on legitimate interest
- **Right to Withdraw Consent** — Withdraw consent at any time (where applicable)

### How to Exercise Your Rights
- **Delete account**: Settings > Delete Account (in the app)
- **Data export**: Contact privacy@deepsightsynthesis.com
- **Other requests**: Email privacy@deepsightsynthesis.com

We will respond to all requests within 30 days.

## 10. Children's Privacy

DeepSight is not intended for children under 16 years of age. We do not knowingly collect personal data from children under 16. If you believe a child has provided us with personal data, please contact us at privacy@deepsightsynthesis.com.

## 11. International Data Transfers

Some of our third-party service providers are located outside the EU (see Section 6). For these transfers, we rely on:
- Standard Contractual Clauses (SCCs) approved by the European Commission
- Adequacy decisions where applicable
- Service providers' compliance with equivalent data protection standards

## 12. Cookies and Tracking

The mobile app does not use cookies. The web platform uses:
- **Essential cookies** — Session management and authentication (no consent required)
- **No advertising or tracking cookies** — We do not use any

## 13. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify users of significant changes via email or in-app notification. The "Last updated" date at the top reflects the most recent revision.

## 14. Contact Us

For any questions about this Privacy Policy or your personal data:

Email: privacy@deepsightsynthesis.com
Website: https://www.deepsightsynthesis.com
Address: DeepSight SAS, France

---

*This privacy policy was last updated on February 12, 2026.*
