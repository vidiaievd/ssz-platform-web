export async function cookies() {
  return {
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
  } as const;
}

export async function headers() {
  return new Headers();
}
