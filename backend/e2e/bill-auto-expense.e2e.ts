import 'dotenv/config';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { BillActionsService } from '../src/modules_v2/bill/bill-actions.service';
import { BillContextService } from '../src/modules_v2/bill/bill-context.service';
import { TemplateActionsService } from '../src/modules_v2/template/template-actions.service';
import { RecordActionsService } from '../src/modules_v2/template/record-actions.service';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
}

async function run(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();

  const billActions = new BillActionsService(prisma);
  const templateActions = new TemplateActionsService(prisma);
  const recordActions = new RecordActionsService(prisma);
  const billContext = new BillContextService(billActions, templateActions, recordActions);

  const suffix = Date.now().toString();
  const userId = randomUUID();
  const familyId = randomUUID();

  try {
    await prisma.user.create({
      data: {
        id: userId,
        username: `e2e_bill_user_${suffix}`,
        email: `e2e_bill_${suffix}@example.com`,
        password: 'test-password',
      },
    });

    await prisma.family.create({
      data: {
        id: familyId,
        name: `E2E Bill Family ${suffix}`,
      },
    });

    const paymentTypeGroup = await prisma.tagGroup.create({
      data: {
        familyId,
        name: `Typ kosztu ${suffix}`,
      },
    });

    const ownershipGroup = await prisma.tagGroup.create({
      data: {
        familyId,
        name: `Wlasnosc ${suffix}`,
      },
    });

    const recurringTag = await prisma.tag.create({
      data: {
        tagGroupId: paymentTypeGroup.id,
        name: `Rachunek ${suffix}`,
        color: '#e53935',
      },
    });

    const homeTag = await prisma.tag.create({
      data: {
        tagGroupId: ownershipGroup.id,
        name: `Dom ${suffix}`,
        color: '#43a047',
      },
    });

    const template = await prisma.template.create({
      data: {
        familyId,
        createdById: userId,
        name: `E2E Template ${suffix}`,
        isDefault: true,
        columns: [
          { id: 'col_date', name: 'Data', type: 'date' },
          {
            id: 'col_amount',
            name: 'Kwota',
            type: 'currency',
            colorFieldByTag: 'col_type_tags',
          },
          {
            id: 'col_type_tags',
            name: 'Typ',
            type: 'tag_group',
            tagGroupId: paymentTypeGroup.id,
          },
          {
            id: 'col_ownership_tags',
            name: 'Wlasnosc',
            type: 'tag_group',
            tagGroupId: ownershipGroup.id,
          },
        ] as any,
      },
    });

    const billWithTags = await billContext.createBill(familyId, {
      name: `Internet ${suffix}`,
      amount: 129.99,
      dueDay: 15,
      frequency: 'MONTHLY',
      notes: 'E2E test bill with tags',
      paymentType: 'MANUAL',
      autoCreateExpense: true,
      reminderDays: 2,
      tagIds: [recurringTag.id, homeTag.id],
    });

    const paidBillWithTags = await billContext.payBill(billWithTags.id, familyId, {
      amount: 129.99,
      dueDate: todayIso(),
      notes: 'E2E payment with tags',
    });

    const createdRecord = await prisma.templateRecord.findFirst({
      where: {
        templateId: template.id,
        data: { path: ['_billPaymentId'], equals: paidBillWithTags.id } as any,
      },
      orderBy: { createdAt: 'desc' },
    });

    assert.ok(createdRecord, 'Auto-created expense record should exist after bill payment');

    const createdData = ((createdRecord as any).data ?? {}) as Record<string, unknown>;
    const typeTags = toStringArray(createdData.col_type_tags);
    const ownershipTags = toStringArray(createdData.col_ownership_tags);

    assert.ok(typeTags.includes(recurringTag.name), 'Expense record should include payment-type tag');
    assert.ok(ownershipTags.includes(homeTag.name), 'Expense record should include ownership tag');
    assert.equal((createdData.col_amount as any)?.amount, 129.99, 'Expense record amount should match payment amount');
    assert.equal((createdData.col_amount as any)?.currency, 'PLN', 'Expense record currency should default to PLN');
    assert.equal(createdData._billId, billWithTags.id, 'Expense record should reference source bill id');

    const billWithoutTags = await billContext.createBill(familyId, {
      name: `Telefon ${suffix}`,
      amount: 59.5,
      dueDay: 20,
      frequency: 'MONTHLY',
      notes: 'E2E test bill without tags',
      paymentType: 'MANUAL',
      autoCreateExpense: true,
      reminderDays: 2,
      tagIds: [],
    });

    const paidBillWithoutTags = await billContext.payBill(billWithoutTags.id, familyId, {
      amount: 59.5,
      dueDate: todayIso(),
      notes: 'E2E payment without tags',
    });

    const createdRecordWithoutTags = await prisma.templateRecord.findFirst({
      where: {
        templateId: template.id,
        data: { path: ['_billPaymentId'], equals: paidBillWithoutTags.id } as any,
      },
      orderBy: { createdAt: 'desc' },
    });

    assert.ok(createdRecordWithoutTags, 'Auto-created expense record should exist for bill without tags');

    const noTagsData = ((createdRecordWithoutTags as any).data ?? {}) as Record<string, unknown>;
    assert.equal(toStringArray(noTagsData.col_type_tags).length, 0, 'Tag-driven column should stay empty when bill has no matching tags');
    assert.equal(toStringArray(noTagsData.col_ownership_tags).length, 0, 'All mapped tag-group columns should be empty when no tags are assigned');

    console.log('E2E OK: bill payment creates expense records with tag-group mapping from bill tags.');
  } finally {
    await prisma.family.deleteMany({ where: { id: familyId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error('E2E FAILED:', error);
  process.exit(1);
});
