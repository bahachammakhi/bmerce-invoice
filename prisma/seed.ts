import { PrismaClient, InvoiceStatus } from '../src/generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Seed Currencies
  const currencies = [
    {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      isActive: true,
    },
    {
      code: 'EUR',
      name: 'Euro',
      symbol: '€',
      isActive: true,
    },
    {
      code: 'TND',
      name: 'Tunisian Dinar',
      symbol: 'د.ت',
      isActive: true,
    },
    {
      code: 'GBP',
      name: 'British Pound',
      symbol: '£',
      isActive: true,
    },
  ];

  console.log('💱 Seeding currencies...');
  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: {},
      create: currency,
    });
  }

  // Seed Custom Fields
  const customFields = [
    {
      name: 'tax_registration_number',
      label: 'Tax Registration Number',
      type: 'TEXT',
      required: true,
      entityType: 'CLIENT',
      country: 'TN',
    },
    {
      name: 'customs_code',
      label: 'Customs Code',
      type: 'TEXT',
      required: false,
      entityType: 'INVOICE',
      country: 'TN',
    },
    {
      name: 'fiscal_stamp',
      label: 'Fiscal Stamp',
      type: 'NUMBER',
      required: false,
      entityType: 'INVOICE',
      country: 'TN',
    },
    {
      name: 'vat_number',
      label: 'VAT Number',
      type: 'TEXT',
      required: false,
      entityType: 'CLIENT',
      country: 'EU',
    },
    {
      name: 'business_license',
      label: 'Business License',
      type: 'TEXT',
      required: false,
      entityType: 'CLIENT',
      country: 'US',
    },
  ];

  console.log('🏷️ Seeding custom fields...');
  for (const field of customFields) {
    await prisma.customField.upsert({
      where: {
        name_entityType_country: {
          name: field.name,
          entityType: field.entityType as any,
          country: field.country,
        },
      },
      update: {},
      create: field as any,
    });
  }

  // Seed Test Users
  const testUsers = [
    {
      email: 'admin@invoice.test',
      name: 'Admin User',
      password: await bcrypt.hash('password123', 12),
      role: 'ADMIN',
    },
    {
      email: 'user@invoice.test',
      name: 'Test User',
      password: await bcrypt.hash('password123', 12),
      role: 'USER',
    },
    {
      email: 'demo@invoice.test',
      name: 'Demo User',
      password: await bcrypt.hash('demo123', 12),
      role: 'USER',
    },
  ];

  console.log('👥 Seeding test users...');
  const createdUsers = [];
  for (const userData of testUsers) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: userData as any,
    });
    createdUsers.push(user);
  }

  // Get currencies for invoice creation
  const usdCurrency = await prisma.currency.findUnique({ where: { code: 'USD' } });
  const eurCurrency = await prisma.currency.findUnique({ where: { code: 'EUR' } });
  const tndCurrency = await prisma.currency.findUnique({ where: { code: 'TND' } });

  // Seed Test Clients
  const testClients = [
    {
      name: 'Acme Corporation',
      email: 'contact@acme.com',
      phone: '+1-555-0123',
      address: '123 Business St',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
      taxId: 'US123456789',
      customFields: {
        business_license: 'BL-123456',
      },
    },
    {
      name: 'TechStart Tunisia',
      email: 'info@techstart.tn',
      phone: '+216-71-123456',
      address: 'Avenue Habib Bourguiba',
      city: 'Tunis',
      postalCode: '1000',
      country: 'TN',
      taxId: 'TN987654321',
      customFields: {
        tax_registration_number: 'TRN-123456789',
      },
    },
    {
      name: 'European Solutions GmbH',
      email: 'sales@eusolutions.de',
      phone: '+49-30-12345678',
      address: 'Unter den Linden 1',
      city: 'Berlin',
      postalCode: '10117',
      country: 'DE',
      taxId: 'DE123456789',
      customFields: {
        vat_number: 'DE123456789',
      },
    },
    {
      name: 'London Consulting Ltd',
      email: 'hello@londonconsult.co.uk',
      phone: '+44-20-7123-4567',
      address: '10 Downing Street',
      city: 'London',
      postalCode: 'SW1A 2AA',
      country: 'GB',
      taxId: 'GB123456789',
    },
    {
      name: 'Freelancer John Doe',
      email: 'john@freelancer.com',
      phone: '+1-555-0199',
      address: '456 Freelance Ave',
      city: 'San Francisco',
      postalCode: '94102',
      country: 'US',
    },
  ];

  console.log('🏢 Seeding test clients...');
  const createdClients = [];
  for (const clientData of testClients) {
    const existingClient = await prisma.client.findFirst({
      where: {
        userId: createdUsers[0].id,
        name: clientData.name,
      },
    });

    let client;
    if (existingClient) {
      client = existingClient;
    } else {
      client = await prisma.client.create({
        data: {
          ...clientData,
          userId: createdUsers[0].id,
        },
      });
    }
    createdClients.push(client);
  }

  // Seed Test Invoices
  const testInvoices = [
    {
      clientId: createdClients[0].id,
      currencyId: usdCurrency!.id,
      status: InvoiceStatus.PAID,
      issueDate: new Date('2024-01-15'),
      dueDate: new Date('2024-02-15'),
      notes: 'Payment received on time. Thank you!',
      items: [
        {
          description: 'Web Development Services',
          quantity: 40,
          unitPrice: 150,
          taxRate: 8.25,
        },
        {
          description: 'Project Management',
          quantity: 10,
          unitPrice: 200,
          taxRate: 8.25,
        },
      ],
    },
    {
      clientId: createdClients[1].id,
      currencyId: tndCurrency!.id,
      status: InvoiceStatus.SENT,
      issueDate: new Date('2024-02-01'),
      dueDate: new Date('2024-03-01'),
      notes: 'Mobile app development project',
      customFields: {
        customs_code: 'CC-123456',
        fiscal_stamp: 2.5,
      },
      items: [
        {
          description: 'Mobile App Development',
          quantity: 80,
          unitPrice: 75,
          taxRate: 19,
        },
        {
          description: 'UI/UX Design',
          quantity: 20,
          unitPrice: 100,
          taxRate: 19,
        },
      ],
    },
    {
      clientId: createdClients[2].id,
      currencyId: eurCurrency!.id,
      status: InvoiceStatus.OVERDUE,
      issueDate: new Date('2024-01-01'),
      dueDate: new Date('2024-01-31'),
      notes: 'Please process payment as soon as possible',
      items: [
        {
          description: 'Enterprise Software License',
          quantity: 1,
          unitPrice: 5000,
          taxRate: 19,
        },
        {
          description: 'Implementation Services',
          quantity: 50,
          unitPrice: 200,
          taxRate: 19,
        },
      ],
    },
    {
      clientId: createdClients[3].id,
      currencyId: usdCurrency!.id,
      status: InvoiceStatus.DRAFT,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      notes: 'Draft invoice for consulting services',
      items: [
        {
          description: 'Business Consulting',
          quantity: 25,
          unitPrice: 300,
          taxRate: 10,
        },
      ],
    },
    {
      clientId: createdClients[4].id,
      currencyId: usdCurrency!.id,
      status: InvoiceStatus.PAID,
      issueDate: new Date('2024-02-15'),
      dueDate: new Date('2024-03-15'),
      notes: 'Freelance work completed successfully',
      items: [
        {
          description: 'Graphic Design Services',
          quantity: 15,
          unitPrice: 80,
          taxRate: 8.25,
        },
        {
          description: 'Logo Design',
          quantity: 1,
          unitPrice: 500,
          taxRate: 8.25,
        },
      ],
    },
  ];

  console.log('📄 Seeding test invoices...');
  for (const invoiceData of testInvoices) {
    const { items, ...invoice } = invoiceData;
    
    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const taxAmount = items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      return sum + (itemTotal * item.taxRate / 100);
    }, 0);
    const total = subtotal + taxAmount;
    
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await prisma.invoice.create({
      data: {
        ...invoice,
        number: invoiceNumber,
        subtotal,
        taxAmount,
        total,
        userId: createdUsers[0].id,
        items: {
          create: items.map(item => ({
            ...item,
            total: item.quantity * item.unitPrice,
          })),
        },
      },
    });
  }

  // Seed Exchange Rates
  console.log('💱 Seeding exchange rates...');
  const exchangeRates = [
    { fromCurrency: 'USD', toCurrency: 'EUR', rate: 0.85, date: new Date() },
    { fromCurrency: 'USD', toCurrency: 'TND', rate: 3.1, date: new Date() },
    { fromCurrency: 'USD', toCurrency: 'GBP', rate: 0.79, date: new Date() },
    { fromCurrency: 'EUR', toCurrency: 'USD', rate: 1.18, date: new Date() },
    { fromCurrency: 'EUR', toCurrency: 'TND', rate: 3.65, date: new Date() },
    { fromCurrency: 'EUR', toCurrency: 'GBP', rate: 0.93, date: new Date() },
  ];

  for (const rate of exchangeRates) {
    await prisma.exchangeRate.upsert({
      where: {
        fromCurrency_toCurrency_date: {
          fromCurrency: rate.fromCurrency,
          toCurrency: rate.toCurrency,
          date: rate.date,
        },
      },
      update: { rate: rate.rate },
      create: rate,
    });
  }

  console.log('✅ Database seeded successfully!');
  console.log('📊 Seeded data summary:');
  console.log(`   - ${currencies.length} currencies`);
  console.log(`   - ${customFields.length} custom fields`);
  console.log(`   - ${testUsers.length} test users`);
  console.log(`   - ${testClients.length} test clients`);
  console.log(`   - ${testInvoices.length} test invoices`);
  console.log(`   - ${exchangeRates.length} exchange rates`);
  console.log('');
  console.log('🔐 Test user credentials:');
  console.log('   - admin@invoice.test / password123 (Admin)');
  console.log('   - user@invoice.test / password123 (User)');
  console.log('   - demo@invoice.test / demo123 (Demo User)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });