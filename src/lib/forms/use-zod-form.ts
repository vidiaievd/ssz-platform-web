import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form';
import type { ZodType } from 'zod';

type ZodFormProps<
  TIn extends FieldValues,
  TOut,
  TSchema extends ZodType<TOut, TIn>,
> = Omit<UseFormProps<TIn, unknown, TOut>, 'resolver' | 'defaultValues'> & {
  schema: TSchema;
  defaultValues?: DefaultValues<TIn>;
};

export function useZodForm<
  TIn extends FieldValues,
  TOut,
  TSchema extends ZodType<TOut, TIn>,
>({
  schema,
  ...props
}: ZodFormProps<TIn, TOut, TSchema>): UseFormReturn<TIn, unknown, TOut> {
  return useForm<TIn, unknown, TOut>({
    ...props,
    resolver: zodResolver(schema) as unknown as Resolver<TIn, unknown, TOut>,
  });
}
