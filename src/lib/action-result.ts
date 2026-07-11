/**
 * Standard result shape returned by server actions to `useFormState` forms.
 * `fieldErrors` maps a field name to its Arabic validation messages.
 */
export interface ActionState {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialActionState: ActionState = { ok: false };

/** Build a failed ActionState from a Zod flattened error. */
export function fieldErrorState(
  fieldErrors: Record<string, string[] | undefined>,
  message = "يرجى تصحيح الحقول المميزة",
): ActionState {
  const cleaned: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(fieldErrors)) {
    if (value && value.length) cleaned[key] = value;
  }
  return { ok: false, message, fieldErrors: cleaned };
}

export function errorState(message: string): ActionState {
  return { ok: false, message };
}
