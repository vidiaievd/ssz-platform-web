import {
  DEFAULT_AI,
  DEFAULT_CHECK,
  DEFAULT_FLOW,
  DEFAULT_LANGS,
  type Item,
  type Translate,
} from '@/lib/shared-kernel/translate';

/** A worked sentence, the way the scaffold writes one. */
export function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    dir: 'to_target',
    source: 'Я живу в Тромсё три года.',
    refs: ['Jeg har bodd i Tromsø i tre år.'],
    gloss: [],
    require: [],
    forbid: [],
    ...overrides,
  };
}

export function makeDoc(overrides: Partial<Translate> = {}): Translate {
  return {
    id: 'ex-1',
    type: 'translate_to_target',
    moduleId: 'module-1',
    title: '',
    instructions: 'Oversett setningene til norsk.',
    dir: 'to_target',
    langs: { ...DEFAULT_LANGS },
    format: 'set',
    note: '',
    items: [makeItem()],
    check: { ...DEFAULT_CHECK },
    flow: { ...DEFAULT_FLOW },
    ai: { ...DEFAULT_AI },
    updatedAt: '2026-08-14T10:00:00.000Z',
    ...overrides,
  };
}
