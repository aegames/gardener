export function notEmpty<TValue>(
  value: TValue | null | undefined
): value is TValue {
  return value !== null && value !== undefined;
}

export function notFalse<TValue>(value: TValue | false): value is TValue {
  return value !== false;
}
