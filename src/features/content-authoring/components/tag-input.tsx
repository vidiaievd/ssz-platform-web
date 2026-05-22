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
import { addTagAction, removeTagAction } from '../actions/tag';

interface TagInputProps {
  entityType: string;
  entityId: string;
  disabled?: boolean;
}

export function TagInput({ entityType, entityId, disabled }: TagInputProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const { data: tags, isLoading } = useEntityTags(entityType, entityId);
  const { data: suggestions } = useTagSuggestions(entityType, inputValue);

  const trimmedInput = inputValue.trim();
  const appliedNames = new Set((tags ?? []).map((tag) => tag.name));

  const filteredSuggestions = (suggestions ?? []).filter(
    (s) =>
      !appliedNames.has(s) &&
      (trimmedInput === '' || s.toLowerCase().includes(trimmedInput.toLowerCase())),
  );

  const canCreate = trimmedInput.length > 0 && !appliedNames.has(trimmedInput);

  function handleAdd(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setOpen(false);
    setInputValue('');
    startTransition(async () => {
      const result = await addTagAction(entityType, entityId, trimmed);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: authoringKeys.tags(entityType, entityId),
      });
    });
  }

  function handleRemove(tagId: string) {
    startTransition(async () => {
      const result = await removeTagAction(tagId, entityType, entityId);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: authoringKeys.tags(entityType, entityId),
      });
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
                    {filteredSuggestions.map((name) => (
                      <CommandItem key={name} value={name} onSelect={() => handleAdd(name)}>
                        {name}
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
                        onSelect={() => handleAdd(trimmedInput)}
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
