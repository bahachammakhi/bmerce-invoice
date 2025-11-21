# Invoice Manager

A comprehensive multi-currency invoice management system built with Next.js, featuring custom fields support, PDF generation, email integration, and real-time analytics. Designed with special consideration for Tunisian business requirements while being globally applicable.

## 🚀 Features

### Core Functionality
- **Multi-Currency Support**: Handle invoices in multiple currencies with real-time exchange rates
- **Client Management**: Complete CRUD operations for client management with custom fields
- **Invoice Creation**: Dynamic invoice builder with line items, tax calculations, and custom fields
- **PDF Generation**: Professional PDF invoices with customizable templates
- **Email Integration**: Send invoices and payment reminders via email with PDF attachments
- **Real-time Analytics**: Comprehensive dashboard with revenue tracking and business insights

### Advanced Features
- **Custom Fields System**: Configurable fields for country-specific requirements (e.g., Tunisian tax compliance)
- **Exchange Rate Management**: Automatic currency conversion with cached exchange rates
- **Invoice Status Tracking**: Draft, Sent, Paid, Overdue, and Cancelled status management
- **Payment Reminders**: Automated reminder system for overdue invoices
- **Responsive Design**: Mobile-optimized interface built with Tailwind CSS and shadcn/ui

### Tunisian Business Support
- Pre-configured custom fields for Tunisian tax requirements
- Support for Tunisian Dinar (TND) currency
- Tax registration number and customs code fields
- Fiscal stamp calculations

## 🛠 Tech Stack

- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes with tRPC for type-safe APIs
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with credentials provider
- **PDF Generation**: jsPDF with auto-table support
- **Email**: Nodemailer with SMTP support
- **Currency**: Exchange rate API integration with caching

## 🏗 Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Main application dashboard
│   │   ├── clients/       # Client management
│   │   ├── invoices/      # Invoice management
│   │   └── currencies/    # Currency & exchange rates
├── components/            # Reusable UI components
│   ├── ui/               # shadcn/ui components
│   └── providers.tsx     # App providers (tRPC, React Query, Auth)
├── lib/                  # Utility libraries
│   ├── auth.ts          # NextAuth configuration
│   ├── db.ts            # Prisma client
│   ├── trpc.ts          # tRPC client configuration
│   ├── pdf-generator.ts # PDF generation utilities
│   ├── email.ts         # Email service
│   └── exchange-rates.ts # Currency exchange utilities
├── server/api/          # tRPC server setup
│   ├── routers/         # API route handlers
│   └── trpc.ts          # tRPC server configuration
└── generated/prisma/    # Prisma generated client
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- SMTP email service (Gmail, SendGrid, etc.)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd invoice-processing
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Copy `.env` and configure your environment variables:
   ```bash
   # Database
   DATABASE_URL="postgresql://postgres:password@localhost:5432/invoice_db"
   
   # Authentication
   NEXTAUTH_SECRET="your-nextauth-secret-here"
   NEXTAUTH_URL="http://localhost:3000"
   
   # Email Configuration
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="587"
   SMTP_USER="your-email@gmail.com"
   SMTP_PASS="your-app-password"
   SMTP_FROM="your-email@gmail.com"
   COMPANY_NAME="Your Company Name"
   ```

4. **Database Setup**
   ```bash
   # Push database schema
   npm run db:push
   
   # Seed initial data (currencies, custom fields)
   npm run db:seed
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to access the application.

## 📊 Database Schema

### Core Models
- **Users**: User accounts with role-based access
- **Clients**: Customer information with custom fields support
- **Invoices**: Invoice records with multi-currency support
- **InvoiceItems**: Line items for each invoice
- **Currencies**: Supported currencies with symbols
- **ExchangeRates**: Historical exchange rate data
- **CustomFields**: Configurable fields for entities

### Custom Fields System
The system supports dynamic custom fields for different entity types:
- **Client Fields**: Tax IDs, registration numbers, industry-specific data
- **Invoice Fields**: Customs codes, fiscal stamps, compliance requirements
- **Country-Specific**: Pre-configured fields for different countries (Tunisia, US, EU, etc.)

## 🔧 API Routes

### tRPC Routers
- **`api.client.*`**: Client management operations
- **`api.invoice.*`**: Invoice CRUD and email operations
- **`api.currency.*`**: Currency and exchange rate management
- **`api.analytics.*`**: Business analytics and reporting
- **`api.customFields.*`**: Dynamic field management

### Key Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/trpc/invoice.sendEmail` - Send invoice via email
- `GET /api/trpc/analytics.getDashboardStats` - Dashboard statistics
- `POST /api/trpc/currency.updateExchangeRates` - Refresh exchange rates

## 📧 Email Configuration

### Supported SMTP Providers
- Gmail (with App Passwords)
- SendGrid
- Mailgun
- Custom SMTP servers

### Email Features
- Invoice delivery with PDF attachments
- Payment reminder automation
- Overdue notice system
- Customizable email templates

## 💰 Currency Support

### Supported Currencies
- USD (US Dollar)
- EUR (Euro)
- TND (Tunisian Dinar)
- GBP (British Pound)
- Easily extensible for additional currencies

### Exchange Rate Features
- Real-time rate fetching from exchange rate APIs
- Automatic rate caching (1-hour refresh)
- Historical rate tracking
- Multi-currency invoice conversion

## 📱 Responsive Design

The application is fully responsive and optimized for:
- Desktop browsers (1024px+)
- Tablets (768px - 1023px)
- Mobile devices (320px - 767px)

## 🔒 Security Features

- **Authentication**: Secure password hashing with bcrypt
- **Authorization**: Session-based auth with NextAuth.js
- **Data Validation**: Comprehensive input validation with Zod
- **SQL Injection Protection**: Prisma ORM with parameterized queries
- **CSRF Protection**: Built-in Next.js CSRF protection

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Docker Deployment
```bash
# Build and run with Docker
docker build -t invoice-manager .
docker run -p 3000:3000 invoice-manager
```

### Database Deployment
- **Vercel Postgres**: Seamless integration with Vercel
- **Railway**: Easy PostgreSQL hosting
- **Supabase**: PostgreSQL with additional features
- **AWS RDS**: Enterprise PostgreSQL hosting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team
- Check the documentation for common solutions

## 🗺 Roadmap

### Upcoming Features
- **Multi-language Support**: Arabic and French localization
- **Advanced Reporting**: Custom report builder
- **API Integration**: Third-party accounting software integration
- **Mobile App**: React Native mobile application
- **Recurring Invoices**: Subscription and recurring billing
- **Payment Gateway**: Stripe and PayPal integration

---

**Built with ❤️ for global businesses with special attention to Tunisian market requirements.**
