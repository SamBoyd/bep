export const BET_ID_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidBetId(id: string): boolean {
  return BET_ID_REGEX.test(id);
}
