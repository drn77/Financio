import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { Prisma, User, FamilyMember } from '@prisma/client';

const DEFAULT_CATEGORIES = [
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

@Injectable()
export class AuthActionsService {
  constructor(private readonly prisma: PrismaService) {}

  // #region Create
  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async createUserWithFamily(userData: Prisma.UserCreateInput): Promise<{
    user: User;
    familyId: string;
    familyRole: string;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: userData });

      const family = await tx.family.create({
        data: {
          name: `${user.username}'s Family`,
          currency: 'PLN',
        },
      });

      const membership = await tx.familyMember.create({
        data: {
          userId: user.id,
          familyId: family.id,
          role: 'OWNER',
        },
      });

      await tx.category.createMany({
        data: DEFAULT_CATEGORIES.map((cat, i) => ({
          familyId: family.id,
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          sortOrder: i,
        })),
      });

      // Create default expense template
      await tx.template.create({
        data: {
          familyId: family.id,
          createdById: user.id,
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

      return { user, familyId: family.id, familyRole: membership.role };
    });
  }
  // #endregion

  // #region Read
  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findUserByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findFamilyMembership(userId: string): Promise<FamilyMember | null> {
    return this.prisma.familyMember.findFirst({ where: { userId } });
  }
  // #endregion

  // #region Update
  // #endregion

  // #region Delete
  // #endregion

  // #region Misc
  // #endregion
}
