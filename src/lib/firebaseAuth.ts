import type { AxiosError } from 'axios';

/** Map API / network errors to user-friendly login messages. */
export function getAuthErrorMessage(err: unknown): string {
  const axiosErr = err as AxiosError<{ message?: string }>;
  const status = axiosErr?.response?.status;
  const message = err instanceof Error ? err.message : String(err ?? '');

  if (status === 401 || status === 400) return 'Wrong email or password.';
  if (status === 429) return 'Too many attempts. Wait a few minutes and try again.';
  if (status === 403) return 'This account has been disabled.';

  if (
    axiosErr?.code === 'ERR_NETWORK' ||
    /network|fetch|connection|ECONNREFUSED|ETIMEDOUT|ERR_NETWORK|-1017/i.test(message)
  ) {
    return 'Connection error. Check your network and try again.';
  }

  return axiosErr?.response?.data?.message || message || 'Login failed. Check your email and password.';
}
