'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AtomTrack, GrammarRule, GrammarRuleAtom } from '@/features/content/types';

import {
  AtomKeyTakenError,
  useCreateGrammarAtom,
  useDeleteGrammarAtom,
  useGrammarAtoms,
  useMoveGrammarAtom,
  useReorderGrammarAtoms,
  useUpdateGrammarAtom,
} from '../api/use-grammar-atoms';
import { EditorCard } from './editor-card';

/** `Definite plural (-ene)` → `definite-plural-ene`, the shape the backend accepts. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[æ]/g, 'ae')
    .replace(/[ø]/g, 'o')
    .replace(/[å]/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

export interface GrammarAtomsPanelProps {
  ruleId: string;
  /** The other grammar rules of this course — where an atom can be moved to. */
  otherRules: GrammarRule[];
}

/**
 * What this rule is made of — plan 63, phase 0, as the author sees it.
 *
 * The panel exists because a rule is the wrong size to remember: a learner who is reliably
 * right about the definite singular and reliably wrong about the definite plural has one
 * rule at 50%, which says nothing anybody can act on. Cut into atoms, the same learner has
 * one fact known and one not, and an exercise can be aimed at the second.
 *
 * The lede carries the cutting criterion rather than leaving it in the plan: an author
 * cutting for the first time is the person who most needs it, and they are here, now.
 */
export function GrammarAtomsPanel({ ruleId, otherRules }: GrammarAtomsPanelProps) {
  const t = useTranslations('Authoring');

  const { data: atoms = [], isLoading, isError } = useGrammarAtoms(ruleId);
  const create = useCreateGrammarAtom(ruleId);
  const update = useUpdateGrammarAtom(ruleId);
  const remove = useDeleteGrammarAtom(ruleId);
  const reorder = useReorderGrammarAtoms(ruleId);
  const move = useMoveGrammarAtom(ruleId);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function reportError(e: unknown) {
    toast.error(e instanceof AtomKeyTakenError ? t('atoms.keyTaken') : t('atoms.saveFailed'));
  }

  function moveBy(index: number, delta: number) {
    const target = index + delta;
    const moved = atoms[index];
    const displaced = atoms[target];
    if (!moved || !displaced) return;
    const next = atoms.map((atom, i) => (i === index ? displaced : i === target ? moved : atom));
    // Every living atom is named: a subset would leave the atoms left out holding the
    // positions the reordered ones are claiming.
    reorder.mutate(
      { items: next.map((atom, position) => ({ atomId: atom.id, position })) },
      { onError: () => toast.error(t('atoms.saveFailed')) },
    );
  }

  return (
    <EditorCard
      title={t('atoms.title')}
      right={
        <Button variant="ghost" size="sm" type="button" onClick={() => setAdding((v) => !v)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('atoms.add')}
        </Button>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">{t('atoms.lede')}</p>

      {isError ? (
        <p className="rounded-md border border-border px-3 py-2 text-xs text-error" role="status">
          {t('atoms.loadFailed')}
        </p>
      ) : isLoading ? (
        <p className="text-xs text-muted-foreground">{t('atoms.loading')}</p>
      ) : atoms.length === 0 && !adding ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          {t('atoms.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {atoms.map((atom, index) =>
            editingId === atom.id ? (
              <li key={atom.id}>
                <AtomForm
                  atom={atom}
                  otherRules={otherRules}
                  busy={update.isPending || move.isPending}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(values) =>
                    update.mutate(
                      { atomId: atom.id, ...values },
                      { onSuccess: () => setEditingId(null), onError: reportError },
                    )
                  }
                  onMove={(targetRuleId, key) =>
                    move.mutate(
                      { atomId: atom.id, targetRuleId, key: key || undefined },
                      {
                        onSuccess: () => {
                          setEditingId(null);
                          toast.success(t('atoms.moved'));
                        },
                        onError: reportError,
                      },
                    )
                  }
                />
              </li>
            ) : (
              <li
                key={atom.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3"
              >
                <span className="min-w-40 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{atom.title}</span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {t(`atoms.track.${atom.track}` as 'atoms.track.grammar')}
                    </span>
                  </span>
                  <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                    {atom.key}
                  </span>
                  {atom.description ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {atom.description}
                    </span>
                  ) : null}
                </span>

                <span className="flex items-center gap-1">
                  <IconButton
                    label={t('atoms.moveUp', { atom: atom.title })}
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => moveBy(index, -1)}
                  >
                    <ArrowUp className="size-3.5" aria-hidden />
                  </IconButton>
                  <IconButton
                    label={t('atoms.moveDown', { atom: atom.title })}
                    disabled={index === atoms.length - 1 || reorder.isPending}
                    onClick={() => moveBy(index, 1)}
                  >
                    <ArrowDown className="size-3.5" aria-hidden />
                  </IconButton>
                  <IconButton
                    label={t('atoms.edit', { atom: atom.title })}
                    onClick={() => {
                      setAdding(false);
                      setEditingId(atom.id);
                    }}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </IconButton>
                  <IconButton
                    label={t('atoms.retire', { atom: atom.title })}
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate(
                        { atomId: atom.id },
                        { onError: () => toast.error(t('atoms.saveFailed')) },
                      )
                    }
                  >
                    <X className="size-3.5" aria-hidden />
                  </IconButton>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      {adding ? (
        <div className="mt-2">
          <AtomForm
            atom={null}
            otherRules={otherRules}
            busy={create.isPending}
            onCancel={() => setAdding(false)}
            onSubmit={(values) =>
              create.mutate(
                {
                  key: values.key,
                  title: values.title,
                  track: values.track,
                  description: values.description.trim() || undefined,
                },
                { onSuccess: () => setAdding(false), onError: reportError },
              )
            }
          />
        </div>
      ) : null}
    </EditorCard>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md border border-border hover:bg-[var(--ssz-bg-subtle)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

interface AtomFormValues {
  key: string;
  title: string;
  description: string;
  track: AtomTrack;
}

/**
 * One atom being written or rewritten. Deliberately not react-hook-form: four fields, no
 * cross-field rules, and the panel it sits in already owns the submitting state.
 *
 * The key is derived from the title while it has not been typed into, and stops following
 * it the moment it has — an author who wants `double-definiteness` for "Definite plural"
 * should not have it overwritten by the next keystroke in the title.
 */
function AtomForm({
  atom,
  otherRules,
  busy,
  onSubmit,
  onCancel,
  onMove,
}: {
  atom: GrammarRuleAtom | null;
  otherRules: GrammarRule[];
  busy: boolean;
  onSubmit: (values: AtomFormValues) => void;
  onCancel: () => void;
  onMove?: (targetRuleId: string, key: string) => void;
}) {
  const t = useTranslations('Authoring');

  const [title, setTitle] = useState(atom?.title ?? '');
  const [key, setKey] = useState(atom?.key ?? '');
  const [keyTouched, setKeyTouched] = useState(atom !== null);
  const [description, setDescription] = useState(atom?.description ?? '');
  const [track, setTrack] = useState<AtomTrack>(atom?.track ?? 'grammar');

  const [moveTarget, setMoveTarget] = useState('');
  const [moveKey, setMoveKey] = useState('');

  const effectiveKey = keyTouched ? key : slugify(title);
  const canSave = title.trim() !== '' && effectiveKey !== '';

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('atoms.fields.title')} htmlFor={`atom-title-${atom?.id ?? 'new'}`} required>
          <Input
            id={`atom-title-${atom?.id ?? 'new'}`}
            value={title}
            placeholder={t('atoms.fields.titlePlaceholder')}
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label={t('atoms.fields.key')} htmlFor={`atom-key-${atom?.id ?? 'new'}`} required>
          <Input
            id={`atom-key-${atom?.id ?? 'new'}`}
            value={effectiveKey}
            placeholder="definite-plural"
            disabled={busy}
            onChange={(e) => {
              setKeyTouched(true);
              setKey(e.target.value);
            }}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">{t('atoms.fields.track')}</span>
        <Segmented
          size="sm"
          aria-label={t('atoms.fields.track')}
          value={track}
          onValueChange={(value) => setTrack(value as AtomTrack)}
          options={[
            { value: 'grammar', label: t('atoms.track.grammar') },
            { value: 'lexis', label: t('atoms.track.lexis') },
          ]}
        />
        <span className="text-xs text-muted-foreground">{t('atoms.fields.trackHint')}</span>
      </div>

      <Field label={t('atoms.fields.note')} htmlFor={`atom-note-${atom?.id ?? 'new'}`}>
        <Textarea
          id={`atom-note-${atom?.id ?? 'new'}`}
          rows={2}
          value={description}
          placeholder={t('atoms.fields.notePlaceholder')}
          disabled={busy}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          loading={busy}
          disabled={!canSave}
          onClick={() => onSubmit({ key: effectiveKey, title: title.trim(), description, track })}
        >
          <Check className="mr-1.5 size-4" aria-hidden />
          {t('form.save')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          {t('atoms.cancel')}
        </Button>
      </div>

      {onMove && otherRules.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <span className="text-xs font-medium">{t('atoms.move.title')}</span>
          <span className="text-xs text-muted-foreground">{t('atoms.move.lede')}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={moveTarget} onValueChange={setMoveTarget}>
              <SelectTrigger size="sm" className="min-w-56" aria-label={t('atoms.move.target')}>
                <SelectValue placeholder={t('atoms.move.target')} />
              </SelectTrigger>
              <SelectContent>
                {otherRules.map((rule) => (
                  <SelectItem key={rule.id} value={rule.id}>
                    {rule.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={moveKey}
              placeholder={t('atoms.move.keyPlaceholder')}
              disabled={busy}
              className="max-w-48"
              onChange={(e) => setMoveKey(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={moveTarget === '' || busy}
              onClick={() => onMove(moveTarget, moveKey.trim())}
            >
              {t('atoms.move.action')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
