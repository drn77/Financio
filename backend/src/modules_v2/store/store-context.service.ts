import { Injectable, NotFoundException } from '@nestjs/common';
import { StoreActionsService } from './store-actions.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@Injectable()
export class StoreContextService {
  constructor(private readonly storeActions: StoreActionsService) {}

  // #region Create
  async createStore(familyId: string, input: CreateStoreDto) {
    return this.storeActions.createStore({
      familyId,
      name: input.name,
      defaultCategoryId: input.defaultCategoryId,
      icon: input.icon,
      address: input.address,
      notes: input.notes,
    });
  }
  // #endregion

  // #region Read
  async getStores(familyId: string) {
    const stores = await this.storeActions.findStoresByFamily(familyId);

    // Enrich with stats
    const enriched = await Promise.all(
      stores.map(async (store) => {
        const stats = await this.storeActions.getStoreStats(store.id, familyId);
        return { ...store, ...stats };
      }),
    );

    return enriched;
  }

  async getStore(id: string, familyId: string) {
    const store = await this.storeActions.findStoreById(id, familyId);
    if (!store) throw new NotFoundException('Store not found');

    const stats = await this.storeActions.getStoreStats(id, familyId);
    return { ...store, ...stats };
  }
  // #endregion

  // #region Update
  async updateStore(id: string, familyId: string, input: UpdateStoreDto) {
    const existing = await this.storeActions.findStoreById(id, familyId);
    if (!existing) throw new NotFoundException('Store not found');

    return this.storeActions.updateStore(id, familyId, {
      name: input.name,
      defaultCategoryId: input.defaultCategoryId,
      icon: input.icon,
      address: input.address,
      notes: input.notes,
    });
  }
  // #endregion

  // #region Delete
  async deleteStore(id: string, familyId: string) {
    const existing = await this.storeActions.findStoreById(id, familyId);
    if (!existing) throw new NotFoundException('Store not found');

    await this.storeActions.deleteStore(id, familyId);
  }
  // #endregion
}
