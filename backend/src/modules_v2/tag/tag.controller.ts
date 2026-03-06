import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId } from '../../shared/decorators/session.decorator';
import { TagContextService } from './tag-context.service';
import { CreateTagGroupDto } from './dto/create-tag-group.dto';
import { UpdateTagGroupDto } from './dto/update-tag-group.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Controller('v2/tag-groups')
@UseGuards(SessionAuthGuard)
export class TagController {
  constructor(private readonly tagContext: TagContextService) {}

  // ─── Tag Groups ──────────────────────────────────────

  @Get()
  async getTagGroups(@FamilyId() familyId: string) {
    return this.tagContext.getTagGroups(familyId);
  }

  @Get(':id')
  async getTagGroup(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.tagContext.getTagGroup(id, familyId);
  }

  @Post()
  async createTagGroup(@FamilyId() familyId: string, @Body() input: CreateTagGroupDto) {
    return this.tagContext.createTagGroup(familyId, input);
  }

  @Put(':id')
  async updateTagGroup(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: UpdateTagGroupDto,
  ) {
    return this.tagContext.updateTagGroup(id, familyId, input);
  }

  @Delete(':id')
  async deleteTagGroup(@FamilyId() familyId: string, @Param('id') id: string) {
    await this.tagContext.deleteTagGroup(id, familyId);
    return { message: 'Tag group deleted successfully' };
  }

  // ─── Tags ────────────────────────────────────────────

  @Put(':groupId/tags/reorder')
  async reorderTags(
    @FamilyId() familyId: string,
    @Param('groupId') groupId: string,
    @Body() body: { tags: { id: string; sortOrder: number }[] },
  ) {
    return this.tagContext.reorderTags(groupId, familyId, body.tags);
  }

  @Post(':groupId/tags')
  async createTag(
    @FamilyId() familyId: string,
    @Param('groupId') groupId: string,
    @Body() input: CreateTagDto,
  ) {
    return this.tagContext.createTag(groupId, familyId, input);
  }

  @Put(':groupId/tags/:tagId')
  async updateTag(
    @FamilyId() familyId: string,
    @Param('groupId') groupId: string,
    @Param('tagId') tagId: string,
    @Body() input: UpdateTagDto,
  ) {
    return this.tagContext.updateTag(tagId, groupId, familyId, input);
  }

  @Delete(':groupId/tags/:tagId')
  async deleteTag(
    @FamilyId() familyId: string,
    @Param('groupId') groupId: string,
    @Param('tagId') tagId: string,
  ) {
    await this.tagContext.deleteTag(tagId, groupId, familyId);
    return { message: 'Tag deleted successfully' };
  }
}
