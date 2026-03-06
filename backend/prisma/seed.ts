import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const SALT_ROUNDS = 12;

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const existingAdmin = await prisma.user.findFirst({
      where: { username: 'admin' },
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin', SALT_ROUNDS);

      const admin = await prisma.user.create({
        data: {
          username: 'admin',
          email: 'admin@financio.local',
          password: hashedPassword,
          role: 'ADMIN',
          firstName: 'Admin',
          lastName: 'Financio',
        },
      });

      // Create family for admin
      const family = await prisma.family.create({
        data: {
          name: "Admin's Family",
          currency: 'PLN',
        },
      });

      await prisma.familyMember.create({
        data: {
          userId: admin.id,
          familyId: family.id,
          role: 'OWNER',
        },
      });

      // Default categories
      const defaultCategories = [
        { name: 'Jedzenie', color: '#FF6384', icon: 'utensils' },
        { name: 'Transport', color: '#36A2EB', icon: 'car' },
        { name: 'Rachunki', color: '#FFCE56', icon: 'file-text' },
        { name: 'Rozrywka', color: '#4BC0C0', icon: 'gamepad-2' },
        { name: 'Zdrowie', color: '#9966FF', icon: 'heart-pulse' },
        { name: 'Ubrania', color: '#FF9F40', icon: 'shirt' },
        { name: 'Edukacja', color: '#C9CBCF', icon: 'graduation-cap' },
        { name: 'Oszczędności', color: '#2ECC71', icon: 'piggy-bank' },
        { name: 'Podatki/Firma', color: '#E74C3C', icon: 'building-2' },
        { name: 'Spożywcze', color: '#F39C12', icon: 'shopping-cart' },
        { name: 'Osoby', color: '#3498DB', icon: 'users' },
        { name: 'Inne', color: '#95A5A6', icon: 'more-horizontal' },
      ];

      await prisma.category.createMany({
        data: defaultCategories.map((cat, i) => ({
          familyId: family.id,
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          sortOrder: i,
        })),
      });

      // Default expense template
      await prisma.template.create({
        data: {
          familyId: family.id,
          createdById: admin.id,
          name: 'Wydatki',
          description: 'Główna tabela wydatków',
          icon: 'receipt',
          isDefault: true,
          columns: [
            { id: 'col_date', name: 'Data', type: 'date', required: true, defaultBehavior: 'today' },
            { id: 'col_name', name: 'Nazwa', type: 'text', required: true, defaultBehavior: 'empty' },
            { id: 'col_type', name: 'Rodzaj', type: 'select', required: true, options: ['Wydatek', 'Przychód'], defaultBehavior: 'last_used' },
            { id: 'col_amount', name: 'Kwota', type: 'currency', required: true, currencyOptions: ['PLN', 'EUR', 'USD'], defaultBehavior: 'empty' },
            { id: 'col_status', name: 'Stan', type: 'select', required: false, options: ['Rozliczone', 'Zaległe', 'Planowe'], defaultBehavior: 'last_used' },
            { id: 'col_category', name: 'Kategoria', type: 'tags', required: false, defaultBehavior: 'empty' },
            { id: 'col_person', name: 'Dla kogo?', type: 'person', required: false, defaultBehavior: 'current_user' },
            { id: 'col_notes', name: 'Notatki', type: 'text', required: false, defaultBehavior: 'empty' },
          ],
        },
      });

      console.log('Admin user created with family, categories, and default template');
    } else {
      console.log('Admin user already exists — skipping seed');
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
