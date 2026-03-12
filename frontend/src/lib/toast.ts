export type AppToastType = 'success' | 'error' | 'info';

export interface AppToastPayload {
  title?: string;
  description: string;
  type?: AppToastType;
  durationMs?: number;
}

const TOAST_EVENT_NAME = 'financio:toast';

export function showToast(payload: AppToastPayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AppToastPayload>(TOAST_EVENT_NAME, { detail: payload }));
}

export function toastSuccess(description: string, title = 'Sukces'): void {
  showToast({ title, description, type: 'success' });
}

export function toastError(description: string, title = 'Błąd'): void {
  showToast({ title, description, type: 'error', durationMs: 6000 });
}

export function toastInfo(description: string, title = 'Informacja'): void {
  showToast({ title, description, type: 'info' });
}

export { TOAST_EVENT_NAME };
