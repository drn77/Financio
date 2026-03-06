import { Injectable, NotFoundException } from '@nestjs/common';
import { EventActionsService } from './event-actions.service';
import { CreateEventDto, CreateEventItemDto, CreateEventTodoDto, CreateEventNoteDto, CreateEventExpenseDto } from './dto/create-event.dto';
import { UpdateEventDto, UpdateEventItemDto, UpdateEventTodoDto, UpdateEventNoteDto, UpdateEventExpenseDto } from './dto/update-event.dto';

@Injectable()
export class EventContextService {
  constructor(private readonly eventActions: EventActionsService) {}

  // #region Private
  private _enrichEvent(event: any) {
    const now = new Date();
    const startDate = new Date(event.startDate);

    const totalEstimated = (event.items ?? []).reduce(
      (sum: number, i: any) => sum + (i.estimatedPrice ?? 0) * (i.quantity ?? 1),
      0,
    );
    const totalActual = (event.items ?? []).reduce(
      (sum: number, i: any) => sum + (i.status === 'BOUGHT' ? (i.actualPrice ?? i.estimatedPrice ?? 0) * (i.quantity ?? 1) : 0),
      0,
    );
    const totalExpenses = (event.expenses ?? []).reduce(
      (sum: number, e: any) => sum + (e.amount ?? 0),
      0,
    );

    const allItems = event.items ?? [];
    const itemsBought = allItems.filter((i: any) => i.status === 'BOUGHT').length;
    const allTodos = event.todos ?? [];
    const todosCompleted = allTodos.filter((t: any) => t.isCompleted).length;

    const diffMs = startDate.getTime() - now.getTime();
    const daysUntil = diffMs > 0 ? Math.ceil(diffMs / (1000 * 60 * 60 * 24)) : null;

    return {
      ...event,
      totalEstimated: Math.round(totalEstimated * 100) / 100,
      totalActual: Math.round(totalActual * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      itemsBought,
      itemsTotal: allItems.length,
      todosCompleted,
      todosTotal: allTodos.length,
      daysUntil,
    };
  }
  // #endregion

  // #region Events
  async createEvent(familyId: string, userId: string, input: CreateEventDto) {
    const event = await this.eventActions.createEvent({
      familyId,
      createdById: userId,
      name: input.name,
      description: input.description,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      budgetLimit: input.budgetLimit,
      currency: input.currency,
      color: input.color,
      icon: input.icon,
      location: input.location,
      status: input.status,
      items: input.items?.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        estimatedPrice: i.estimatedPrice,
        categoryId: i.categoryId,
        assignedToId: i.assignedToId,
        notes: i.notes,
      })),
      todos: input.todos?.map((t) => ({
        title: t.title,
        description: t.description,
        assignedToId: t.assignedToId,
        dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
        priority: t.priority,
      })),
    });
    return this._enrichEvent(event);
  }

  async getEvents(familyId: string, filters?: { status?: string; from?: string; to?: string; search?: string }) {
    const events = await this.eventActions.findEventsByFamily(familyId, {
      status: filters?.status,
      from: filters?.from ? new Date(filters.from) : undefined,
      to: filters?.to ? new Date(filters.to) : undefined,
      search: filters?.search,
    });
    return events.map((e) => this._enrichEvent(e));
  }

  async getEvent(id: string, familyId: string) {
    const event = await this.eventActions.findEventById(id, familyId);
    if (!event) throw new NotFoundException('Event not found');
    return this._enrichEvent(event);
  }

  async getUpcomingEvents(familyId: string) {
    const now = new Date();
    const events = await this.eventActions.findEventsByFamily(familyId, {
      from: now,
    });
    const filtered = events.filter((e: any) => e.status === 'PLANNED' || e.status === 'ACTIVE');
    return filtered.map((e) => this._enrichEvent(e)).sort((a: any, b: any) => {
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
  }

  async updateEvent(id: string, familyId: string, input: UpdateEventDto) {
    const event = await this.eventActions.updateEvent(id, familyId, {
      name: input.name,
      description: input.description,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      budgetLimit: input.budgetLimit,
      currency: input.currency,
      color: input.color,
      icon: input.icon,
      location: input.location,
      status: input.status,
    });
    return this._enrichEvent(event);
  }

  async deleteEvent(id: string, familyId: string) {
    await this.eventActions.deleteEvent(id, familyId);
  }

  async duplicateEvent(id: string, familyId: string, userId: string) {
    const event = await this.eventActions.duplicateEvent(id, familyId, userId);
    if (!event) throw new NotFoundException('Event not found');
    return this._enrichEvent(event);
  }

  async getStats(familyId: string) {
    return this.eventActions.getEventStats(familyId);
  }
  // #endregion

  // #region Items
  async addItem(eventId: string, familyId: string, input: CreateEventItemDto) {
    // Verify event belongs to family
    const event = await this.eventActions.findEventById(eventId, familyId);
    if (!event) throw new NotFoundException('Event not found');

    return this.eventActions.createItem(eventId, {
      name: input.name,
      quantity: input.quantity,
      estimatedPrice: input.estimatedPrice,
      actualPrice: input.actualPrice,
      categoryId: input.categoryId,
      assignedToId: input.assignedToId,
      status: input.status,
      notes: input.notes,
    });
  }

  async updateItem(eventId: string, itemId: string, familyId: string, input: UpdateEventItemDto) {
    const event = await this.eventActions.findEventById(eventId, familyId);
    if (!event) throw new NotFoundException('Event not found');

    return this.eventActions.updateItem(itemId, eventId, input);
  }

  async deleteItem(eventId: string, itemId: string, familyId: string) {
    const event = await this.eventActions.findEventById(eventId, familyId);
    if (!event) throw new NotFoundException('Event not found');

    await this.eventActions.deleteItem(itemId, eventId);
  }

  async reorderItems(eventId: string, familyId: string, itemIds: string[]) {
    const event = await this.eventActions.findEventById(eventId, familyId);
    if (!event) throw new NotFoundException('Event not found');

    await this.eventActions.reorderItems(eventId, itemIds);
  }
  // #endregion

  // #region Todos
  async addTodo(eventId: string, familyId: string, input: CreateEventTodoDto) {
    const event = await this.eventActions.findEventById(eventId, familyId);
    if (!event) throw new NotFoundException('Event not found');

    return this.eventActions.createTodo(eventId, {
      title: input.title,
      description: input.description,
      assignedToId: input.assignedToId,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      priority: input.priority,
    });
  }

  async updateTodo(eventId: string, todoId: string, familyId: string, input: UpdateEventTodoDto) {
    const event = await this.eventActions.findEventById(eventId, familyId);
    if (!event) throw new NotFoundException('Event not found');

    return this.eventActions.updateTodo(todoId, eventId, {
      ...input,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
    });
  }

  async toggleTodo(eventId: string, todoId: string, familyId: string) {
    const event = await this.eventActions.findEventById(eventId, familyId);
    if (!event) throw new NotFoundException('Event not found');

    const result = await this.eventActions.toggleTodo(todoId, eventId);
    if (!result) throw new NotFoundException('Todo not found');
    return result;
  }

  async deleteTodo(eventId: string, todoId: string, familyId: string) {
    const event = await this.eventActions.findEventById(eventId, familyId);
    if (!event) throw new NotFoundException('Event not found');

    await this.eventActions.deleteTodo(todoId, eventId);
  }
  // #endregion

  // #region Notes
  async addNote(eventId: string, familyId: string, input: CreateEventNoteDto) {
    const event = await this.eventActions.findEventById(eventId, familyId);
    if (!event) throw new NotFoundException('Event not found');

    return this.eventActions.createNote(eventId, { title: input.title, content: input.content });
  }

  async updateNote(eventId: string, noteId: string, familyId: string, input: UpdateEventNoteDto) {
    const event = await this.eventActions.findEventById(eventId, familyId);
    if (!event) throw new NotFoundException('Event not found');

    return this.eventActions.updateNote(noteId, eventId, input);
  }

  async deleteNote(eventId: string, noteId: string, familyId: string) {
    const event = await this.eventActions.findEventById(eventId, familyId);
    if (!event) throw new NotFoundException('Event not found');

    await this.eventActions.deleteNote(noteId, eventId);
  }
  // #endregion

  // #region Expenses
  async addExpense(eventId: string, familyId: string, input: CreateEventExpenseDto) {
    const event = await this.eventActions.findEventById(eventId, familyId);
    if (!event) throw new NotFoundException('Event not found');

    return this.eventActions.createExpense(eventId, {
      name: input.name,
      amount: input.amount,
      currency: input.currency,
      date: new Date(input.date),
      receiptId: input.receiptId,
      categoryId: input.categoryId,
      personId: input.personId,
      notes: input.notes,
    });
  }

  async updateExpense(eventId: string, expenseId: string, familyId: string, input: UpdateEventExpenseDto) {
    const event = await this.eventActions.findEventById(eventId, familyId);
    if (!event) throw new NotFoundException('Event not found');

    return this.eventActions.updateExpense(expenseId, eventId, {
      ...input,
      date: input.date ? new Date(input.date) : undefined,
    });
  }

  async deleteExpense(eventId: string, expenseId: string, familyId: string) {
    const event = await this.eventActions.findEventById(eventId, familyId);
    if (!event) throw new NotFoundException('Event not found');

    await this.eventActions.deleteExpense(expenseId, eventId);
  }
  // #endregion
}
