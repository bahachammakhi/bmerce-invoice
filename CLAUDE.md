# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev              # Start development server with Turbopack
npm run build            # Build production bundle
npm start                # Start production server
npm run lint             # Run ESLint
```

### Database
```bash
npm run db:push          # Push schema changes to database (Prisma)
npm run db:seed          # Seed database with initial data (currencies, custom fields)
npm run db:test          # Test database connection
npm run docker:up        # Start PostgreSQL container (port 5432) and Adminer (port 8080)
npm run docker:down      # Stop Docker containers
```

### Testing
```bash
npm test                 # Run Playwright tests
npm run test:headed      # Run tests with browser visible
npm run test:ui          # Open Playwright UI mode
npm run test:debug       # Run tests in debug mode
```

## Architecture

### Tech Stack Overview
- **Framework**: Next.js 15 with App Router and Turbopack
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL with Prisma ORM (client generated to `src/generated/prisma/`)
- **API**: tRPC for type-safe client-server communication
- **Auth**: NextAuth.js with credentials provider
- **UI**: Tailwind CSS with shadcn/ui components
- **PDF**: jsPDF with autoTable for invoice generation
- **Email**: Nodemailer for SMTP delivery

### Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── auth/              # Sign in/sign up pages
│   ├── dashboard/         # Protected dashboard routes
│   │   ├── clients/       # Client CRUD pages
│   │   ├── invoices/      # Invoice CRUD pages
│   │   ├── currencies/    # Currency management
│   │   └── settings/      # User settings & company info
├── components/            # React components
│   ├── ui/               # shadcn/ui base components
│   └── providers.tsx     # tRPC, React Query, NextAuth providers
├── lib/                  # Utility libraries
│   ├── auth.ts          # NextAuth configuration
│   ├── db.ts            # Prisma client singleton
│   ├── trpc.ts          # tRPC client setup
│   ├── pdf-generator.ts           # Standard PDF generator
│   ├── tunisian-pdf-generator.ts  # Tunisian compliance PDFs
│   ├── email.ts                   # Email service (Nodemailer)
│   ├── exchange-rates.ts          # Currency conversion API
│   └── invoice-number.ts          # Invoice number generation
├── server/api/          # tRPC server
│   ├── trpc.ts          # Server context & procedures
│   ├── root.ts          # Router composition
│   └── routers/         # API route handlers
│       ├── client.ts
│       ├── invoice.ts
│       ├── currency.ts
│       ├── analytics.ts
│       ├── custom-fields.ts
│       ├── user.ts
│       └── debug.ts
└── generated/prisma/    # Prisma client (DO NOT EDIT)
```

### tRPC Router Structure
All API calls use the pattern `api.<router>.<procedure>`. Available routers:
- `api.clients.*` - Client management (CRUD operations)
- `api.invoice.*` - Invoice operations including `sendEmail` for delivery
- `api.currency.*` - Currency and exchange rate management
- `api.analytics.*` - Dashboard statistics and reporting
- `api.customFields.*` - Dynamic custom field management
- `api.user.*` - User settings and company info management
- `api.debug.*` - Development debugging utilities

### Database Schema Key Points
- **Prisma Output**: Client generated to `src/generated/prisma/` (not default `node_modules/.prisma`)
- **Custom Fields**: JSON columns (`customFields`) on Client and Invoice models for extensibility
- **Dual Invoice Systems**: User model has `invoiceSystem` enum (NORMAL | TUNISIAN)
  - NORMAL: Uses `PDFGenerator` from `lib/pdf-generator.ts`
  - TUNISIAN: Uses `TunisianPDFGenerator` from `lib/tunisian-pdf-generator.ts` with compliance fields
- **Tunisian Fields**: Invoices have optional `timbreAmount`, `tvaNumber`, `mfNumber` for fiscal compliance
- **Tax Compliance**: Invoices support `withholdingTax`, `isTaxExempt`, and `exemptionReason`
- **Company Info**: User model stores `companyInfo` and `bankDetails` as JSON for invoice templates

### Authentication Flow
- NextAuth.js with credentials provider configured in `src/lib/auth.ts`
- Session-based authentication (JWT strategy)
- Protected routes use `protectedProcedure` in tRPC (see `src/server/api/trpc.ts`)
- User sessions include `userId` and `invoiceSystem` preference

### PDF Generation
Two separate PDF generators exist for different invoice systems:
- **Standard** (`lib/pdf-generator.ts`): Generic international invoices
- **Tunisian** (`lib/tunisian-pdf-generator.ts`): Includes Tunisian-specific fields:
  - Timbre fiscal (fiscal stamp)
  - TVA number (VAT number)
  - MF number (Matricule fiscal)
  - Number-to-words conversion for amounts (French/Arabic)
  - Company info header with full registration details

### Currency & Exchange Rates
- Currencies stored in database with `code`, `symbol`, `name`
- Exchange rates cached with timestamps in `ExchangeRate` model
- Rate fetching managed through `lib/exchange-rates.ts`
- Supported: USD, EUR, TND, GBP (extensible)

### Path Aliasing
The project uses `@/*` for imports mapping to `src/*`:
```typescript
import { db } from '@/lib/db';
import { appRouter } from '@/server/api/root';
```

### Environment Variables Required
```bash
DATABASE_URL              # PostgreSQL connection string
NEXTAUTH_SECRET          # NextAuth.js secret
NEXTAUTH_URL             # Application URL
SMTP_HOST                # Email server
SMTP_PORT                # Email port
SMTP_USER                # Email username
SMTP_PASS                # Email password
SMTP_FROM                # From email address
COMPANY_NAME             # Company name for emails
```

### Docker Development
- `docker-compose.yml` includes PostgreSQL (port 5432) and Adminer (port 8080)
- Default credentials: `postgres/password`, database: `invoice_db`
- Adminer provides web-based database management

### Testing Setup
- Playwright for E2E testing
- Configuration in `playwright.config.ts`
- Tests should cover invoice creation, PDF generation, and email sending

## Development Patterns

### Adding New Invoice Fields
1. Update `prisma/schema.prisma` Invoice model
2. Run `npm run db:push` to sync database
3. Update TypeScript interfaces in relevant PDF generators
4. Update invoice form in `src/app/dashboard/invoices/new/page.tsx`
5. Update invoice display in `src/app/dashboard/invoices/[id]/page.tsx`

### Creating New tRPC Endpoints
1. Add procedure to appropriate router in `src/server/api/routers/`
2. Use `publicProcedure` for unauthenticated or `protectedProcedure` for authenticated routes
3. Define input schema with Zod for type safety
4. Access database via `ctx.db` (Prisma client)
5. Access user ID via `ctx.session.user.id` in protected procedures

### Working with Custom Fields
- Custom fields are country/entity-specific configurations stored in database
- Client and Invoice models have `customFields` JSON column for dynamic data
- Use `api.customFields.*` router to manage field definitions
- Seed script (`prisma/seed.ts`) initializes default custom fields

### Handling Tunisian vs Normal Invoices
Check user's `invoiceSystem` preference:
```typescript
const user = await ctx.db.user.findUnique({ where: { id: userId } });
if (user.invoiceSystem === 'TUNISIAN') {
  // Use TunisianPDFGenerator with timbre, TVA, MF fields
} else {
  // Use standard PDFGenerator
}
```

## Important Notes

- **Never commit `.env`** - contains sensitive credentials
- **Prisma migrations**: Use `db:push` for development; use proper migrations for production
- **Email testing**: Verify SMTP settings before testing email functionality
- **PDF fonts**: jsPDF uses built-in fonts; custom fonts require additional setup
- **Invoice numbering**: Auto-generated in `lib/invoice-number.ts` with format `INV-YYYYMMDD-XXX`
- **Decimal precision**: Database uses `Decimal(10, 3)` for currency amounts to handle fractional currencies
