import type { HealthType } from './types';

export const HEALTH_TYPES: Record<
  HealthType,
  { label: string; emoji: string; placeholder: string }
> = {
  vaccination: { label: 'Прививка', emoji: '💉', placeholder: 'Нобивак Tricat Trio' },
  visit: { label: 'Визит', emoji: '🩺', placeholder: 'Профилактический осмотр' },
  medication: { label: 'Лекарство', emoji: '💊', placeholder: 'Мильбемакс, 1 таблетка' },
  lab: { label: 'Анализы', emoji: '🧪', placeholder: 'Общий анализ крови' },
  other: { label: 'Другое', emoji: '📄', placeholder: 'Что произошло' },
};

/** Which task a record of this type usually completes (for the "also mark done" default). */
export const TYPE_CATEGORIES: Record<HealthType, string[]> = {
  vaccination: ['vaccines'],
  visit: ['vet'],
  medication: ['parasites'],
  lab: ['vet'],
  other: [],
};
