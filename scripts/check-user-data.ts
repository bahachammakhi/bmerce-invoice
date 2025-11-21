import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function checkUserData() {
  try {
    console.log('🔍 Checking user data relationships...');
    
    // Get admin user
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@invoice.test' },
      include: {
        clients: true,
        invoices: true,
      }
    });
    
    if (!adminUser) {
      console.log('❌ Admin user not found!');
      return;
    }
    
    console.log('👤 Admin User:', adminUser.name, '(', adminUser.email, ')');
    console.log('📋 Admin Clients:', adminUser.clients.length);
    console.log('📄 Admin Invoices:', adminUser.invoices.length);
    
    if (adminUser.clients.length > 0) {
      console.log('\n🏢 Admin Clients:');
      adminUser.clients.forEach(client => {
        console.log(`   - ${client.name} (${client.email})`);
      });
    }
    
    if (adminUser.invoices.length > 0) {
      console.log('\n📄 Admin Invoices:');
      adminUser.invoices.forEach(invoice => {
        console.log(`   - ${invoice.number} - ${invoice.status} - $${invoice.total}`);
      });
    }
    
    // Get all clients with their user info
    console.log('\n🏢 All Clients in Database:');
    const allClients = await prisma.client.findMany({
      include: {
        user: true,
      }
    });
    
    allClients.forEach(client => {
      console.log(`   - ${client.name} (Owner: ${client.user.email})`);
    });
    
    // Get all invoices with their user info
    console.log('\n📄 All Invoices in Database:');
    const allInvoices = await prisma.invoice.findMany({
      include: {
        user: true,
        client: true,
      }
    });
    
    allInvoices.forEach(invoice => {
      console.log(`   - ${invoice.number} for ${invoice.client.name} (Owner: ${invoice.user.email})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking user data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserData();