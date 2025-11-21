import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function checkUserIds() {
  try {
    console.log('🔍 Checking user IDs...');
    
    // Get all users with their data
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        _count: {
          select: {
            clients: true,
            invoices: true,
          }
        }
      }
    });
    
    console.log('👥 All Users:');
    users.forEach(user => {
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Clients: ${user._count.clients}`);
      console.log(`   Invoices: ${user._count.invoices}`);
      console.log('   ---');
    });
    
  } catch (error) {
    console.error('❌ Error checking user IDs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserIds();