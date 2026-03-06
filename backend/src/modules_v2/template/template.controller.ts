import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId, UserId } from '../../shared/decorators/session.decorator';
import { TemplateContextService } from './template-context.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Controller('v2/templates')
@UseGuards(SessionAuthGuard)
export class TemplateController {
  constructor(private readonly templateContext: TemplateContextService) {}

  @Get()
  async getTemplates(@FamilyId() familyId: string) {
    return this.templateContext.getTemplates(familyId);
  }

  @Get('default')
  async getDefaultTemplate(@FamilyId() familyId: string) {
    return this.templateContext.getDefaultTemplate(familyId);
  }

  @Get(':id')
  async getTemplate(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.templateContext.getTemplate(id, familyId);
  }

  @Post()
  async createTemplate(
    @FamilyId() familyId: string,
    @UserId() userId: string,
    @Body() input: CreateTemplateDto,
  ) {
    return this.templateContext.createTemplate(familyId, userId, input);
  }

  @Put(':id')
  async updateTemplate(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: UpdateTemplateDto,
  ) {
    return this.templateContext.updateTemplate(id, familyId, input);
  }

  @Delete(':id')
  async deleteTemplate(@FamilyId() familyId: string, @Param('id') id: string) {
    await this.templateContext.deleteTemplate(id, familyId);
    return { message: 'Template deleted successfully' };
  }
}
