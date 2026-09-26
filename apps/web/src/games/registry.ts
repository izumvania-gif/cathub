import type { GameKey } from '@cathub/core';
import { lazy, type ComponentType } from 'react';
import type { CatLook } from '../cat/look';

export interface GameProps {
  look: CatLook;
  seed: number;
  paused: boolean;
  /** Called once when the run is over; activeMs excludes pauses. */
  onEnd: (stats: Record<string, number>, activeMs: number) => void;
}

/** Each game is its own chunk. */
export const GAME_COMPONENTS: Record<GameKey, ComponentType<GameProps>> = {
  jump: lazy(() => import('./jump/Jump').then((m) => ({ default: m.Jump }))),
  defense: lazy(() => import('./defense/Defense').then((m) => ({ default: m.Defense }))),
  cards: lazy(() => import('./cards/Cards').then((m) => ({ default: m.Cards }))),
  fishing: lazy(() => import('./fishing/Fishing').then((m) => ({ default: m.Fishing }))),
};

export const HOW_TO: Record<GameKey, string[]> = {
  jump: [
    'Веди пальцем: кот прыгает туда, где палец. Можно стрелками или наклоном телефона.',
    'Подушка подбрасывает выше, картонка ломается, мята даёт полетать.',
    'Пылесос сверху не трогай, а на него сверху можно прыгнуть.',
  ],
  defense: [
    'Мыши бегут по полкам справа к миске. Коснись полки, и кот прыгнет туда ловить.',
    'За пойманных мышей падает сыр 🧀: ставь на него помощников.',
    'Продержись 5 волн и сохрани как можно больше корма.',
  ],
  cards: [
    'Каждый ход 3 энергии: разыгрывай карты, потом «Конец хода».',
    'Над врагом видно, что он сделает: атаку или защиту.',
    'После боя возьми новую карту. Три этажа, в конце каждого босс.',
  ],
  fishing: [
    'Рыбки плывут мимо лапы. Коснись экрана, когда рыбка в светлой полосе.',
    'Серия без промахов умножает очки. Золотая рыбка стоит втрое.',
    'Промах и колючий ёрш сбивают серию и отнимают 2,5 секунды.',
  ],
};

/** What the result screen calls the score. */
export const SCORE_LABEL: Record<GameKey, string> = {
  jump: 'очков',
  defense: 'очков',
  cards: 'очков',
  fishing: 'очков',
};
