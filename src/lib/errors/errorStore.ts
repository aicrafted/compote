import { create } from 'zustand';

export type AppErrorLevel = 'error' | 'warning';

export interface AppErrorMessage {
  id: string;
  title: string;
  message: string;
  level: AppErrorLevel;
}

interface AppErrorState {
  errors: AppErrorMessage[];
  reportError: (error: unknown, options?: { title?: string; level?: AppErrorLevel }) => void;
  dismissError: (id: string) => void;
  clearErrors: () => void;
}

export const useAppErrorStore = create<AppErrorState>((set) => ({
  errors: [],
  reportError: (error, options) => {
    const message = getErrorMessage(error);
    set((state) => ({
      errors: [
        ...state.errors,
        {
          id: crypto.randomUUID(),
          title: options?.title || 'Something went wrong',
          message,
          level: options?.level || 'error',
        },
      ].slice(-3),
    }));
  },
  dismissError: (id) =>
    set((state) => ({
      errors: state.errors.filter((error) => error.id !== id),
    })),
  clearErrors: () => set({ errors: [] }),
}));

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return 'Unexpected error. Please try again.';
}
