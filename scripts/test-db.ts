import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected successfully!');
    
    // Count records
    const [userCount, clientCount, currencyCount, customFieldCount] = await Promise.all([
      prisma.user.count(),
      prisma.client.count(),
      prisma.currency.count(),
      prisma.customField.count(),
    ]);
    
    console.log('📊 Database Statistics:');
    console.log(`   Users: ${userCount}`);
    console.log(`   Clients: ${clientCount}`);
    console.log(`   Currencies: ${currencyCount}`);
    console.log(`   Custom Fields: ${customFieldCount}`);
    
    // List currencies
    const currencies = await prisma.currency.findMany();
    console.log('💱 Available Currencies:');
    currencies.forEach(currency => {
      console.log(`   ${currency.code} (${currency.symbol}) - ${currency.name}`);
    });
    
    // List custom fields
    const customFields = await prisma.customField.findMany();
    console.log('🏷️ Custom Fields:');
    customFields.forEach(field => {
      console.log(`   ${field.name} (${field.entityType}${field.country ? ` - ${field.country}` : ''}): ${field.label}`);
    });
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('✅ Database test completed!');
  }
}

testDatabase();