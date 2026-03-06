import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId } from '../../shared/decorators/session.decorator';
import { StoreContextService } from './store-context.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@Controller('v2/stores')
@UseGuards(SessionAuthGuard)
export class StoreController {
  constructor(private readonly storeContext: StoreContextService) {}

  @Get()
  async getStores(@FamilyId() familyId: string) {
    return this.storeContext.getStores(familyId);
  }

  @Get(':id')
  async getStore(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.storeContext.getStore(id, familyId);
  }

  @Post()
  async createStore(@FamilyId() familyId: string, @Body() input: CreateStoreDto) {
    return this.storeContext.createStore(familyId, input);
  }

  @Put(':id')
  async updateStore(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: UpdateStoreDto,
  ) {
    return this.storeContext.updateStore(id, familyId, input);
  }

  @Delete(':id')
  async deleteStore(@FamilyId() familyId: string, @Param('id') id: string) {
    await this.storeContext.deleteStore(id, familyId);
    return { message: 'Store deleted successfully' };
  }
}
