import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class TagActionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Tag Groups ──────────────────────────────────────

  async createTagGroup(input: { familyId: string; name: string }) {
    return this.prisma.tagGroup.create({
      data: {
        family: { connect: { id: input.familyId } },
        name: input.name,
      },
      include: { tags: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async findTagGroupsByFamily(familyId: string) {
    return this.prisma.tagGroup.findMany({
      where: { familyId },
      include: { tags: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async findTagGroupById(id: string, familyId: string) {
    return this.prisma.tagGroup.findFirst({
      where: { id, familyId },
      include: { tags: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async updateTagGroup(id: string, familyId: string, input: { name?: string }) {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;

    return this.prisma.tagGroup.update({
      where: { id, familyId },
      data,
      include: { tags: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async deleteTagGroup(id: string, familyId: string) {
    return this.prisma.tagGroup.delete({
      where: { id, familyId },
    });
  }

  // ─── Tags ────────────────────────────────────────────

  async createTag(input: {
    tagGroupId: string;
    name: string;
    color?: string;
    icon?: string;
    imageUrl?: string;
    sortOrder?: number;
  }) {
    return this.prisma.tag.create({
      data: {
        tagGroup: { connect: { id: input.tagGroupId } },
        name: input.name,
        color: input.color,
        icon: input.icon,
        imageUrl: input.imageUrl,
        sortOrder: input.sortOrder,
      },
    });
  }

  async findTagsByGroup(tagGroupId: string) {
    return this.prisma.tag.findMany({
      where: { tagGroupId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findTagById(id: string) {
    return this.prisma.tag.findFirst({
      where: { id },
    });
  }

  async updateTag(id: string, input: {
    name?: string;
    color?: string;
    icon?: string;
    imageUrl?: string;
    sortOrder?: number;
  }) {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.color !== undefined) data.color = input.color;
    if (input.icon !== undefined) data.icon = input.icon;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    return this.prisma.tag.update({
      where: { id },
      data,
    });
  }

  async deleteTag(id: string) {
    return this.prisma.tag.delete({
      where: { id },
    });
  }

  async bulkUpdateTagOrder(tags: { id: string; sortOrder: number }[]) {
    const updates = tags.map((t) =>
      this.prisma.tag.update({
        where: { id: t.id },
        data: { sortOrder: t.sortOrder },
      }),
    );
    return this.prisma.$transaction(updates);
  }
}
