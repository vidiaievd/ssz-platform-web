import type { Messages, Namespace } from './messages';

export function pickMessages(
  messages: Messages,
  namespaces: readonly Namespace[],
): Partial<Messages> {
  return Object.fromEntries(
    namespaces.filter((ns) => ns in messages).map((ns) => [ns, messages[ns]]),
  ) as Partial<Messages>;
}
