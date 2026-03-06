import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId } from '../../shared/decorators/session.decorator';
import { UserId } from '../../shared/decorators/session.decorator';
import { EventContextService } from './event-context.service';
import { CreateEventDto, CreateEventItemDto, CreateEventTodoDto, CreateEventNoteDto, CreateEventExpenseDto } from './dto/create-event.dto';
import { UpdateEventDto, UpdateEventItemDto, UpdateEventTodoDto, UpdateEventNoteDto, UpdateEventExpenseDto } from './dto/update-event.dto';

@Controller('v2/events')
@UseGuards(SessionAuthGuard)
export class EventController {
  constructor(private readonly eventContext: EventContextService) {}

  // ─── Events ─────────────────────────────────────────
  @Get()
  async getEvents(
    @FamilyId() familyId: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
  ) {
    return this.eventContext.getEvents(familyId, { status, from, to, search });
  }

  @Get('stats')
  async getStats(@FamilyId() familyId: string) {
    return this.eventContext.getStats(familyId);
  }

  @Get('upcoming')
  async getUpcoming(@FamilyId() familyId: string) {
    return this.eventContext.getUpcomingEvents(familyId);
  }

  @Get(':id')
  async getEvent(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.eventContext.getEvent(id, familyId);
  }

  @Post()
  async createEvent(
    @FamilyId() familyId: string,
    @UserId() userId: string,
    @Body() input: CreateEventDto,
  ) {
    return this.eventContext.createEvent(familyId, userId, input);
  }

  @Put(':id')
  async updateEvent(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: UpdateEventDto,
  ) {
    return this.eventContext.updateEvent(id, familyId, input);
  }

  @Delete(':id')
  async deleteEvent(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.eventContext.deleteEvent(id, familyId);
  }

  @Post(':id/duplicate')
  async duplicateEvent(
    @FamilyId() familyId: string,
    @UserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.eventContext.duplicateEvent(id, familyId, userId);
  }

  // ─── Items (Shopping List) ──────────────────────────
  @Post(':id/items')
  async addItem(
    @FamilyId() familyId: string,
    @Param('id') eventId: string,
    @Body() input: CreateEventItemDto,
  ) {
    return this.eventContext.addItem(eventId, familyId, input);
  }

  @Put(':id/items/:itemId')
  async updateItem(
    @FamilyId() familyId: string,
    @Param('id') eventId: string,
    @Param('itemId') itemId: string,
    @Body() input: UpdateEventItemDto,
  ) {
    return this.eventContext.updateItem(eventId, itemId, familyId, input);
  }

  @Delete(':id/items/:itemId')
  async deleteItem(
    @FamilyId() familyId: string,
    @Param('id') eventId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.eventContext.deleteItem(eventId, itemId, familyId);
  }

  @Put(':id/items/reorder')
  async reorderItems(
    @FamilyId() familyId: string,
    @Param('id') eventId: string,
    @Body() body: { itemIds: string[] },
  ) {
    return this.eventContext.reorderItems(eventId, familyId, body.itemIds);
  }

  // ─── Todos ──────────────────────────────────────────
  @Post(':id/todos')
  async addTodo(
    @FamilyId() familyId: string,
    @Param('id') eventId: string,
    @Body() input: CreateEventTodoDto,
  ) {
    return this.eventContext.addTodo(eventId, familyId, input);
  }

  @Put(':id/todos/:todoId')
  async updateTodo(
    @FamilyId() familyId: string,
    @Param('id') eventId: string,
    @Param('todoId') todoId: string,
    @Body() input: UpdateEventTodoDto,
  ) {
    return this.eventContext.updateTodo(eventId, todoId, familyId, input);
  }

  @Post(':id/todos/:todoId/toggle')
  async toggleTodo(
    @FamilyId() familyId: string,
    @Param('id') eventId: string,
    @Param('todoId') todoId: string,
  ) {
    return this.eventContext.toggleTodo(eventId, todoId, familyId);
  }

  @Delete(':id/todos/:todoId')
  async deleteTodo(
    @FamilyId() familyId: string,
    @Param('id') eventId: string,
    @Param('todoId') todoId: string,
  ) {
    return this.eventContext.deleteTodo(eventId, todoId, familyId);
  }

  // ─── Notes ──────────────────────────────────────────
  @Post(':id/notes')
  async addNote(
    @FamilyId() familyId: string,
    @Param('id') eventId: string,
    @Body() input: CreateEventNoteDto,
  ) {
    return this.eventContext.addNote(eventId, familyId, input);
  }

  @Put(':id/notes/:noteId')
  async updateNote(
    @FamilyId() familyId: string,
    @Param('id') eventId: string,
    @Param('noteId') noteId: string,
    @Body() input: UpdateEventNoteDto,
  ) {
    return this.eventContext.updateNote(eventId, noteId, familyId, input);
  }

  @Delete(':id/notes/:noteId')
  async deleteNote(
    @FamilyId() familyId: string,
    @Param('id') eventId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.eventContext.deleteNote(eventId, noteId, familyId);
  }

  // ─── Expenses ───────────────────────────────────────
  @Post(':id/expenses')
  async addExpense(
    @FamilyId() familyId: string,
    @Param('id') eventId: string,
    @Body() input: CreateEventExpenseDto,
  ) {
    return this.eventContext.addExpense(eventId, familyId, input);
  }

  @Put(':id/expenses/:expenseId')
  async updateExpense(
    @FamilyId() familyId: string,
    @Param('id') eventId: string,
    @Param('expenseId') expenseId: string,
    @Body() input: UpdateEventExpenseDto,
  ) {
    return this.eventContext.updateExpense(eventId, expenseId, familyId, input);
  }

  @Delete(':id/expenses/:expenseId')
  async deleteExpense(
    @FamilyId() familyId: string,
    @Param('id') eventId: string,
    @Param('expenseId') expenseId: string,
  ) {
    return this.eventContext.deleteExpense(eventId, expenseId, familyId);
  }
}
