import { ITEMS, STARTER_ITEMS, type ItemKey } from '../cat/room';
import { useRoomItems } from './queries';

/** Items shown in the room: the starter set plus bought ones that aren't put away. */
export function useRoomKeys(): ItemKey[] {
  const room = useRoomItems();
  const placed = (room.data ?? [])
    .filter((r) => r.placed && r.item in ITEMS)
    .map((r) => r.item as ItemKey);
  return [...STARTER_ITEMS, ...placed];
}
