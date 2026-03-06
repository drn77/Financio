import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId } from '../../shared/decorators/session.decorator';
import { RecordContextService } from './record-context.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { BulkUpdateRecordsDto } from './dto/bulk-update-records.dto';
import { ImportRecordsDto } from './dto/import-records.dto';

@Controller('v2/templates/:templateId/records')
@UseGuards(SessionAuthGuard)
export class RecordController {
  constructor(private readonly recordContext: RecordContextService) {}

  @Get()
  async getRecords(
    @FamilyId() familyId: string,
    @Param('templateId') templateId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: 'asc' | 'desc',
  ) {
    return this.recordContext.getRecords(templateId, familyId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      sort,
    });
  }

  @Get('stats')
  async getRecordStats(
    @FamilyId() familyId: string,
    @Param('templateId') templateId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.recordContext.getRecordStats(templateId, familyId, { from, to });
  }

  @Post()
  async createRecord(
    @FamilyId() familyId: string,
    @Param('templateId') templateId: string,
    @Body() input: CreateRecordDto,
  ) {
    return this.recordContext.createRecord(templateId, familyId, input);
  }

  @Post('import')
  async importRecords(
    @FamilyId() familyId: string,
    @Param('templateId') templateId: string,
    @Body() input: ImportRecordsDto,
  ) {
    return this.recordContext.importRecords(templateId, familyId, input);
  }

  @Post(':recordId/duplicate')
  async duplicateRecord(
    @FamilyId() familyId: string,
    @Param('templateId') templateId: string,
    @Param('recordId') recordId: string,
  ) {
    return this.recordContext.duplicateRecord(recordId, templateId, familyId);
  }

  @Put('bulk')
  async bulkUpdate(
    @FamilyId() familyId: string,
    @Param('templateId') templateId: string,
    @Body() input: BulkUpdateRecordsDto,
  ) {
    return this.recordContext.bulkUpdate(templateId, familyId, input);
  }

  @Put(':recordId')
  async updateRecord(
    @FamilyId() familyId: string,
    @Param('templateId') templateId: string,
    @Param('recordId') recordId: string,
    @Body() input: UpdateRecordDto,
  ) {
    return this.recordContext.updateRecord(recordId, templateId, familyId, input);
  }

  @Delete(':recordId')
  async deleteRecord(
    @FamilyId() familyId: string,
    @Param('templateId') templateId: string,
    @Param('recordId') recordId: string,
  ) {
    await this.recordContext.deleteRecord(recordId, templateId, familyId);
    return { message: 'Record deleted successfully' };
  }
}
