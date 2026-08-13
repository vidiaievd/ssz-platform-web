'use client';

import { useRef, type ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

/** Anything sortable by this component just needs a stable id and a display title. */
interface ReorderableItem {
  id: string;
  title?: string | null;
}

interface SortableItemProps<T extends ReorderableItem> {
  item: T;
  /** 1-based position within the list — used for the a11y aria-label. */
  position: number;
  total: number;
  children: ReactNode;
}

export function SortableItem<T extends ReorderableItem>({
  item,
  position,
  total,
  children,
}: SortableItemProps<T>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-2"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label={`Drag to reorder ${item.title ?? 'item'}, position ${position} of ${total}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {/* The row itself must fill the track; without this it is a flex item
          sized to its content and stops short of the panel edge. */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

interface LessonReorderProps<T extends ReorderableItem> {
  items: T[];
  onReorder: (reordered: T[]) => void;
  /** Called after each reorder so the parent can announce to screen readers. */
  onAnnounce?: (message: string) => void;
  children: (item: T, position: number) => ReactNode;
}

export function LessonReorder<T extends ReorderableItem>({
  items,
  onReorder,
  onAnnounce,
  children,
}: LessonReorderProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    onReorder(reordered);

    const movedItem = items[oldIndex];
    if (movedItem && onAnnounce) {
      onAnnounce(
        `${movedItem.title ?? 'Item'} moved to position ${newIndex + 1} of ${items.length}`,
      );
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item, idx) => (
          <SortableItem key={item.id} item={item} position={idx + 1} total={items.length}>
            {children(item, idx + 1)}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
}

/** Wraps a LessonReorder list with an aria-live region for keyboard-reorder announcements. */
export function ReorderWithAnnouncer<T extends ReorderableItem>({
  items,
  onReorder,
  children,
}: Omit<LessonReorderProps<T>, 'onAnnounce'>) {
  const announceRef = useRef<HTMLSpanElement>(null);

  function handleAnnounce(message: string) {
    if (!announceRef.current) return;
    announceRef.current.textContent = '';
    // Force a DOM mutation so the live region re-announces even for the same message
    requestAnimationFrame(() => {
      if (announceRef.current) announceRef.current.textContent = message;
    });
  }

  return (
    <>
      <span
        ref={announceRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <LessonReorder items={items} onReorder={onReorder} onAnnounce={handleAnnounce}>
        {children}
      </LessonReorder>
    </>
  );
}
