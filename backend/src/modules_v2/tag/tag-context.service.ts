import { Injectable, NotFoundException } from '@nestjs/common';
import { TagActionsService } from './tag-actions.service';
import { CreateTagGroupDto } from './dto/create-tag-group.dto';
import { UpdateTagGroupDto } from './dto/update-tag-group.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagContextService {
  constructor(private readonly tagActions: TagActionsService) {}

  // ─── Tag Groups ──────────────────────────────────────

  async createTagGroup(familyId: string, input: CreateTagGroupDto) {
    return this.tagActions.createTagGroup({
      familyId,
      name: input.name,
    });
  }

  async getTagGroups(familyId: string) {
    return this.tagActions.findTagGroupsByFamily(familyId);
  }

  async getTagGroup(id: string, familyId: string) {
    const group = await this.tagActions.findTagGroupById(id, familyId);
    if (!group) throw new NotFoundException('Tag group not found');
    return group;
  }

  async updateTagGroup(id: string, familyId: string, input: UpdateTagGroupDto) {
    const existing = await this.tagActions.findTagGroupById(id, familyId);
    if (!existing) throw new NotFoundException('Tag group not found');
    return this.tagActions.updateTagGroup(id, familyId, { name: input.name });
  }

  async deleteTagGroup(id: string, familyId: string) {
    const existing = await this.tagActions.findTagGroupById(id, familyId);
    if (!existing) throw new NotFoundException('Tag group not found');
    await this.tagActions.deleteTagGroup(id, familyId);
  }

  // ─── Tags ────────────────────────────────────────────

  async createTag(groupId: string, familyId: string, input: CreateTagDto) {
    // Verify group belongs to family
    const group = await this.tagActions.findTagGroupById(groupId, familyId);
    if (!group) throw new NotFoundException('Tag group not found');

    return this.tagActions.createTag({
      tagGroupId: groupId,
      name: input.name,
      color: input.color,
      icon: input.icon,
      imageUrl: input.imageUrl,
      sortOrder: input.sortOrder,
    });
  }

  async updateTag(tagId: string, groupId: string, familyId: string, input: UpdateTagDto) {
    const group = await this.tagActions.findTagGroupById(groupId, familyId);
    if (!group) throw new NotFoundException('Tag group not found');

    const tag = await this.tagActions.findTagById(tagId);
    if (!tag || tag.tagGroupId !== groupId) throw new NotFoundException('Tag not found');

    return this.tagActions.updateTag(tagId, {
      name: input.name,
      color: input.color,
      icon: input.icon,
      imageUrl: input.imageUrl,
      sortOrder: input.sortOrder,
    });
  }

  async deleteTag(tagId: string, groupId: string, familyId: string) {
    const group = await this.tagActions.findTagGroupById(groupId, familyId);
    if (!group) throw new NotFoundException('Tag group not found');

    const tag = await this.tagActions.findTagById(tagId);
    if (!tag || tag.tagGroupId !== groupId) throw new NotFoundException('Tag not found');

    await this.tagActions.deleteTag(tagId);
  }

  async reorderTags(groupId: string, familyId: string, tags: { id: string; sortOrder: number }[]) {
    const group = await this.tagActions.findTagGroupById(groupId, familyId);
    if (!group) throw new NotFoundException('Tag group not found');

    return this.tagActions.bulkUpdateTagOrder(tags);
  }
}
