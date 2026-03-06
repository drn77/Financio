import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

const EVENT_INCLUDE = {
  items: { orderBy: { sortOrder: 'asc' as const } },
  todos: { orderBy: { sortOrder: 'asc' as const } },
  notes: { orderBy: { sortOrder: 'asc' as const } },
  expenses: { orderBy: { date: 'desc' as const } },
};

@Injectable()
export class EventActionsService {
  constructor(private readonly prisma: PrismaService) {}

  // #region Private helpers
  private _mapDecimal(val: any): number | null {
    if (val === null || val === undefined) return null;
    return typeof val === 'object' && 'toNumber' in val ? val.toNumber() : Number(val);
  }

  private _mapEvent(event: any) {
    return {
      ...event,
      budgetLimit: this._mapDecimal(event.budgetLimit),
      items: event.items?.map((item: any) => ({
        ...item,
        quantity: this._mapDecimal(item.quantity) ?? 1,
        estimatedPrice: this._mapDecimal(item.estimatedPrice),
        actualPrice: this._mapDecimal(item.actualPrice),
      })),
      expenses: event.expenses?.map((exp: any) => ({
        ...exp,
        amount: this._mapDecimal(exp.amount) ?? 0,
      })),
    };
  }
  // #endregion

  // #region Event CRUD
  async createEvent(input: {
    familyId: string;
    createdById: string;
    name: string;
    description?: string;
    startDate: Date;
    endDate?: Date;
    budgetLimit?: number;
    currency?: string;
    color?: string;
    icon?: string;
    location?: string;
    status?: string;
    items?: { name: string; quantity?: number; estimatedPrice?: number; categoryId?: string; assignedToId?: string; notes?: string }[];
    todos?: { title: string; description?: string; assignedToId?: string; dueDate?: Date; priority?: string }[];
  }) {
    const event = await this.prisma.event.create({
      data: {
        family: { connect: { id: input.familyId } },
        createdBy: { connect: { id: input.createdById } },
        name: input.name,
        description: input.description,
        startDate: input.startDate,
        endDate: input.endDate,
        budgetLimit: input.budgetLimit,
        currency: input.currency,
        color: input.color,
        icon: input.icon,
        location: input.location,
        status: (input.status as any) ?? undefined,
        items: input.items?.length
          ? {
              create: input.items.map((item, i) => ({
                name: item.name,
                quantity: item.quantity ?? 1,
                estimatedPrice: item.estimatedPrice,
                categoryId: item.categoryId,
                assignedToId: item.assignedToId,
                notes: item.notes,
                sortOrder: i,
              })),
            }
          : undefined,
        todos: input.todos?.length
          ? {
              create: input.todos.map((todo, i) => ({
                title: todo.title,
                description: todo.description,
                assignedToId: todo.assignedToId,
                dueDate: todo.dueDate,
                priority: (todo.priority as any) ?? undefined,
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: EVENT_INCLUDE,
    });
    return this._mapEvent(event);
  }

  async findEventsByFamily(
    familyId: string,
    filters?: { status?: string; from?: Date; to?: Date; search?: string },
  ) {
    const where: any = { familyId };

    if (filters?.status) where.status = filters.status;
    if (filters?.from || filters?.to) {
      where.startDate = {};
      if (filters.from) where.startDate.gte = filters.from;
      if (filters.to) where.startDate.lte = filters.to;
    }
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const events = await this.prisma.event.findMany({
      where,
      include: EVENT_INCLUDE,
      orderBy: { startDate: 'desc' },
    });

    return events.map((e) => this._mapEvent(e));
  }

  async findEventById(id: string, familyId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, familyId },
      include: EVENT_INCLUDE,
    });
    return event ? this._mapEvent(event) : null;
  }

  async updateEvent(id: string, familyId: string, input: {
    name?: string;
    description?: string;
    startDate?: Date;
    endDate?: Date;
    budgetLimit?: number;
    currency?: string;
    color?: string;
    icon?: string;
    location?: string;
    status?: string;
  }) {
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.startDate !== undefined) data.startDate = input.startDate;
    if (input.endDate !== undefined) data.endDate = input.endDate;
    if (input.budgetLimit !== undefined) data.budgetLimit = input.budgetLimit;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.color !== undefined) data.color = input.color;
    if (input.icon !== undefined) data.icon = input.icon;
    if (input.location !== undefined) data.location = input.location;
    if (input.status !== undefined) data.status = input.status;

    const event = await this.prisma.event.update({
      where: { id, familyId },
      data,
      include: EVENT_INCLUDE,
    });
    return this._mapEvent(event);
  }

  async deleteEvent(id: string, familyId: string) {
    return this.prisma.event.delete({ where: { id, familyId } });
  }

  async duplicateEvent(id: string, familyId: string, createdById: string) {
    const original = await this.prisma.event.findFirst({
      where: { id, familyId },
      include: EVENT_INCLUDE,
    });
    if (!original) return null;

    const event = await this.prisma.event.create({
      data: {
        family: { connect: { id: familyId } },
        createdBy: { connect: { id: createdById } },
        name: `${original.name} (kopia)`,
        description: original.description,
        startDate: original.startDate,
        endDate: original.endDate,
        budgetLimit: original.budgetLimit,
        currency: original.currency,
        color: original.color,
        icon: original.icon,
        location: original.location,
        status: 'PLANNED' as any,
        items: original.items.length
          ? {
              create: original.items.map((item: any, i: number) => ({
                name: item.name,
                quantity: item.quantity,
                estimatedPrice: item.estimatedPrice,
                categoryId: item.categoryId,
                assignedToId: item.assignedToId,
                notes: item.notes,
                sortOrder: i,
              })),
            }
          : undefined,
        todos: original.todos.length
          ? {
              create: original.todos.map((todo: any, i: number) => ({
                title: todo.title,
                description: todo.description,
                assignedToId: todo.assignedToId,
                dueDate: todo.dueDate,
                priority: todo.priority,
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: EVENT_INCLUDE,
    });
    return this._mapEvent(event);
  }
  // #endregion

  // #region Event Items
  async createItem(eventId: string, input: {
    name: string;
    quantity?: number;
    estimatedPrice?: number;
    actualPrice?: number;
    categoryId?: string;
    assignedToId?: string;
    status?: string;
    notes?: string;
  }) {
    const maxOrder = await this.prisma.eventItem.aggregate({
      where: { eventId },
      _max: { sortOrder: true },
    });

    const item = await this.prisma.eventItem.create({
      data: {
        event: { connect: { id: eventId } },
        name: input.name,
        quantity: input.quantity ?? 1,
        estimatedPrice: input.estimatedPrice,
        actualPrice: input.actualPrice,
        categoryId: input.categoryId,
        assignedToId: input.assignedToId,
        status: (input.status as any) ?? undefined,
        notes: input.notes,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });

    return {
      ...item,
      quantity: this._mapDecimal(item.quantity) ?? 1,
      estimatedPrice: this._mapDecimal(item.estimatedPrice),
      actualPrice: this._mapDecimal(item.actualPrice),
    };
  }

  async updateItem(itemId: string, eventId: string, input: {
    name?: string;
    quantity?: number;
    estimatedPrice?: number;
    actualPrice?: number;
    categoryId?: string;
    assignedToId?: string;
    status?: string;
    notes?: string;
  }) {
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.quantity !== undefined) data.quantity = input.quantity;
    if (input.estimatedPrice !== undefined) data.estimatedPrice = input.estimatedPrice;
    if (input.actualPrice !== undefined) data.actualPrice = input.actualPrice;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.assignedToId !== undefined) data.assignedToId = input.assignedToId;
    if (input.status !== undefined) data.status = input.status;
    if (input.notes !== undefined) data.notes = input.notes;

    const item = await this.prisma.eventItem.update({
      where: { id: itemId, eventId },
      data,
    });

    return {
      ...item,
      quantity: this._mapDecimal(item.quantity) ?? 1,
      estimatedPrice: this._mapDecimal(item.estimatedPrice),
      actualPrice: this._mapDecimal(item.actualPrice),
    };
  }

  async deleteItem(itemId: string, eventId: string) {
    return this.prisma.eventItem.delete({ where: { id: itemId, eventId } });
  }

  async reorderItems(eventId: string, itemIds: string[]) {
    const updates = itemIds.map((id, index) =>
      this.prisma.eventItem.update({ where: { id, eventId }, data: { sortOrder: index } }),
    );
    await this.prisma.$transaction(updates);
  }
  // #endregion

  // #region Event Todos
  async createTodo(eventId: string, input: {
    title: string;
    description?: string;
    assignedToId?: string;
    dueDate?: Date;
    priority?: string;
  }) {
    const maxOrder = await this.prisma.eventTodo.aggregate({
      where: { eventId },
      _max: { sortOrder: true },
    });

    return this.prisma.eventTodo.create({
      data: {
        event: { connect: { id: eventId } },
        title: input.title,
        description: input.description,
        assignedToId: input.assignedToId,
        dueDate: input.dueDate,
        priority: (input.priority as any) ?? undefined,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
  }

  async updateTodo(todoId: string, eventId: string, input: {
    title?: string;
    description?: string;
    assignedToId?: string;
    dueDate?: Date;
    priority?: string;
    isCompleted?: boolean;
  }) {
    const data: any = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.assignedToId !== undefined) data.assignedToId = input.assignedToId;
    if (input.dueDate !== undefined) data.dueDate = input.dueDate;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.isCompleted !== undefined) data.isCompleted = input.isCompleted;

    return this.prisma.eventTodo.update({
      where: { id: todoId, eventId },
      data,
    });
  }

  async toggleTodo(todoId: string, eventId: string) {
    const todo = await this.prisma.eventTodo.findFirst({ where: { id: todoId, eventId } });
    if (!todo) return null;

    return this.prisma.eventTodo.update({
      where: { id: todoId },
      data: { isCompleted: !todo.isCompleted },
    });
  }

  async deleteTodo(todoId: string, eventId: string) {
    return this.prisma.eventTodo.delete({ where: { id: todoId, eventId } });
  }
  // #endregion

  // #region Event Notes
  async createNote(eventId: string, input: { title: string; content: string }) {
    const maxOrder = await this.prisma.eventNote.aggregate({
      where: { eventId },
      _max: { sortOrder: true },
    });

    return this.prisma.eventNote.create({
      data: {
        event: { connect: { id: eventId } },
        title: input.title,
        content: input.content,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
  }

  async updateNote(noteId: string, eventId: string, input: { title?: string; content?: string }) {
    const data: any = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.content !== undefined) data.content = input.content;

    return this.prisma.eventNote.update({
      where: { id: noteId, eventId },
      data,
    });
  }

  async deleteNote(noteId: string, eventId: string) {
    return this.prisma.eventNote.delete({ where: { id: noteId, eventId } });
  }
  // #endregion

  // #region Event Expenses
  async createExpense(eventId: string, input: {
    name: string;
    amount: number;
    currency?: string;
    date: Date;
    receiptId?: string;
    categoryId?: string;
    personId?: string;
    notes?: string;
  }) {
    const expense = await this.prisma.eventExpense.create({
      data: {
        event: { connect: { id: eventId } },
        name: input.name,
        amount: input.amount,
        currency: input.currency,
        date: input.date,
        receiptId: input.receiptId,
        categoryId: input.categoryId,
        personId: input.personId,
        notes: input.notes,
      },
    });

    return { ...expense, amount: this._mapDecimal(expense.amount) ?? 0 };
  }

  async updateExpense(expenseId: string, eventId: string, input: {
    name?: string;
    amount?: number;
    currency?: string;
    date?: Date;
    receiptId?: string;
    categoryId?: string;
    personId?: string;
    notes?: string;
  }) {
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.amount !== undefined) data.amount = input.amount;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.date !== undefined) data.date = input.date;
    if (input.receiptId !== undefined) data.receiptId = input.receiptId;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.personId !== undefined) data.personId = input.personId;
    if (input.notes !== undefined) data.notes = input.notes;

    const expense = await this.prisma.eventExpense.update({
      where: { id: expenseId, eventId },
      data,
    });

    return { ...expense, amount: this._mapDecimal(expense.amount) ?? 0 };
  }

  async deleteExpense(expenseId: string, eventId: string) {
    return this.prisma.eventExpense.delete({ where: { id: expenseId, eventId } });
  }
  // #endregion

  // #region Stats
  async getEventStats(familyId: string) {
    const events = await this.prisma.event.findMany({
      where: { familyId },
      include: { expenses: true },
    });

    const now = new Date();
    let totalBudget = 0;
    let totalSpent = 0;
    let activeEvents = 0;
    let upcomingCount = 0;

    for (const event of events) {
      if (event.budgetLimit) totalBudget += Number(event.budgetLimit);
      for (const exp of event.expenses) totalSpent += Number(exp.amount);
      if (event.status === 'ACTIVE') activeEvents++;
      if (event.status === 'PLANNED' && event.startDate > now) upcomingCount++;
    }

    return {
      totalEvents: events.length,
      activeEvents,
      totalBudget,
      totalSpent,
      upcomingCount,
    };
  }
  // #endregion
}
