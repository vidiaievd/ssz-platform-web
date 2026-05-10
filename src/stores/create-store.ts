import { create, type StateCreator } from 'zustand';
import { devtools } from 'zustand/middleware';

export function createStore<T>(name: string, initializer: StateCreator<T>) {
  return create<T>()(
    devtools(initializer, { name, enabled: process.env.NODE_ENV !== 'production' }),
  );
}
