import { useAuth } from '../auth/AuthContext';
import { useDev } from '../context/DevContext';
import type { UserRole } from '../types/api';

export function useEffectiveRole(): UserRole | undefined {
  const { user } = useAuth();
  const { roleOverride } = useDev();
  return roleOverride ?? user?.role;
}
