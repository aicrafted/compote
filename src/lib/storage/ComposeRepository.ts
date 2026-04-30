import { del, get, set } from 'idb-keyval';
import { ComposeData } from '@/types';

class ComposeRepository {
  private key(hostId: string, composeId: string) {
    return `compose-data-${hostId}-${composeId}`;
  }

  async get(hostId: string, composeId: string): Promise<ComposeData | undefined> {
    return await get<ComposeData>(this.key(hostId, composeId));
  }

  async save(hostId: string, composeId: string, data: ComposeData): Promise<void> {
    await set(this.key(hostId, composeId), data);
  }

  async delete(hostId: string, composeId: string): Promise<void> {
    await del(this.key(hostId, composeId));
  }

  async getAllForHost(hostId: string, composeIds: string[]): Promise<Record<string, ComposeData>> {
    const entries = await Promise.all(
      composeIds.map(async (composeId) => {
        const data = await this.get(hostId, composeId);
        return [composeId, data] as const;
      })
    );

    return entries.reduce<Record<string, ComposeData>>((acc, [composeId, data]) => {
      if (data) {
        acc[composeId] = data;
      }
      return acc;
    }, {});
  }
}

export const composeRepository = new ComposeRepository();
