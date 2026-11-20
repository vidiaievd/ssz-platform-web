'use client';

import { useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';

import { useEntityTags, useTagSuggestions } from '../api/use-authoring-tags';
import { authoringKeys } from '../api/keys';
import { assignTagAction, createAndAssignTagAction, removeTagAction } from '../actions/tag';
import { useErrorMessage } from '@/lib/errors/use-error-message';
import type { Result } from '@/lib/result';

interface TagInputProps {
  entityType: string;
  entityId: string;
  /** The material's school: its own tags are offered and a new tag becomes the school's. */
  ownerSchoolId: string | null;
  disabled?: boolean;
}

export function TagInput({ entityType, entityId, ownerSchoolId, disabled }: TagInputProps) {
  const t = useTranslations('Authoring');
  const tErrors = useErrorMessage();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const { data: tags, isLoading } = useEntityTags(entityType, entityId);
  const { data: suggestions } = useTagSuggestions(ownerSchoolId, inputValue, open);

  const trimmedInput = inputValue.trim();
  const appliedIds = new Set((tags ?? []).map((tag) => tag.id));
  const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

  const filteredSuggestions = (suggestions ?? []).filter((s) => !appliedIds.has(s.id));

  // A name already on offer (or on the material) is picked, not created twice. Only a school's
  // material gets new tags: global ones are the platform's.
  const canCreate =
    ownerSchoolId !== null &&
    trimmedInput.length > 0 &&
    !(suggestions ?? []).some((s) => sameName(s.name, trimmedInput)) &&
    !(tags ?? []).some((tag) => sameName(tag.name, trimmedInput));

  function finish(result: Result<unknown>, creating = false) {
    if (!result.ok) {
      toast.error(
        creating && result.error.code === 'forbidden' ? t('tags.createForbidden') : tErrors(result.error),
      );
      return;
    }
    void queryClient.invalidateQueries({ queryKey: authoringKeys.tags(entityType, entityId) });
    void queryClient.invalidateQueries({ queryKey: ['tag-suggestions'] });
  }

  function close() {
    setOpen(false);
    setInputValue('');
  }

  function handlePick(tagId: string) {
    close();
    startTransition(async () => {
      finish(await assignTagAction(entityType, entityId, tagId));
    });
  }

  function handleCreate(name: string) {
    if (!name.trim()) return;
    close();
    startTransition(async () => {
      finish(await createAndAssignTagAction(entityType, entityId, name, ownerSchoolId), true);
    });
  }

  function handleRemove(tagId: string) {
    startTransition(async () => {
      finish(await removeTagAction(entityType, entityId, tagId));
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 min-h-7">
        {isLoading ? (
          <>
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </>
        ) : (tags ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('tags.empty')}</p>
        ) : (
          (tags ?? []).map((tag) => (
            <Badge key={tag.id} variant="muted" className="gap-1 pr-1.5">
              {tag.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(tag.id)}
                  disabled={isPending}
                  className="rounded-sm opacity-60 transition-opacity hover:opacity-100 disabled:pointer-events-none"
                  aria-label={t('tags.removeAriaLabel', { name: tag.name })}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))
        )}
      </div>

      {!disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" type="button" disabled={isPending}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t('tags.add')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder={t('tags.searchPlaceholder')}
                value={inputValue}
                onValueChange={setInputValue}
              />
              <CommandList>
                {filteredSuggestions.length === 0 && !canCreate && (
                  <CommandEmpty>{t('tags.noResults')}</CommandEmpty>
                )}

                {filteredSuggestions.length > 0 && (
                  <CommandGroup>
                    {filteredSuggestions.map((tag) => (
                      <CommandItem key={tag.id} value={tag.id} onSelect={() => handlePick(tag.id)}>
                        {tag.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {canCreate && (
                  <>
                    {filteredSuggestions.length > 0 && <CommandSeparator />}
                    <CommandGroup>
                      <CommandItem
                        value={`__create__:${trimmedInput}`}
                        onSelect={() => handleCreate(trimmedInput)}
                      >
                        <Plus className="mr-1.5 h-4 w-4" />
                        {t('tags.create', { name: trimmedInput })}
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
