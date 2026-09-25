export const PENDING_CODE_KEY = 'cathub.inviteCode';

export function inviteLink(code: string) {
  return `${window.location.origin}/join/${code}`;
}
