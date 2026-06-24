import type { Notification } from '../types';

export type DayGroupLabel = 'today' | 'yesterday' | 'older';

export interface DayGroup {
  label: DayGroupLabel;
  date: string;
  items: Notification[];
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function groupNotificationsByDay(items: Notification[]): DayGroup[] {
  const today = startOfDay(new Date());
  const yesterday = today - 86_400_000;

  const groups: DayGroup[] = [];
  let current: DayGroup | undefined;

  for (const item of items) {
    const day = startOfDay(new Date(item.createdAt));
    const label: DayGroupLabel = day === today ? 'today' : day === yesterday ? 'yesterday' : 'older';
    const dateKey = new Date(day).toISOString().slice(0, 10);

    if (!current || current.label !== label || current.date !== dateKey) {
      current = { label, date: dateKey, items: [] };
      groups.push(current);
    }
    current.items.push(item);
  }

  return groups;
}
