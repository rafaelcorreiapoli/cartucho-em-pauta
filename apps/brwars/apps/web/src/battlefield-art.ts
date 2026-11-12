import type { BattlefieldKind } from '@brwars/simulation';

export const battlefieldBackgrounds: Partial<Record<BattlefieldKind, string>> = {
  campo: '/assets/battlefield-regions.png',
  paulista: '/assets/maps/paulista-field-v13.webp',
  floresta: '/assets/maps/reserva-field-v2.webp',
  deserto: '/assets/maps/deserto-field-v2.webp',
};
