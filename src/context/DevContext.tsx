import React, { createContext, useCallback, useContext, useState } from 'react';
import type { UserRole } from '../types/api';

interface DevContextValue {
  roleOverride: UserRole | null;
  setRoleOverride: (role: UserRole | null) => void;
}

const DevContext = createContext<DevContextValue | null>(null);

export function DevProvider({ children }: { children: React.ReactNode }) {
  const [roleOverride, setRoleOverrideState] = useState<UserRole | null>(null);
  const setRoleOverride = useCallback((role: UserRole | null) => {
    setRoleOverrideState(role);
  }, []);
  return (
    <DevContext.Provider value={{ roleOverride, setRoleOverride }}>
      {children}
    </DevContext.Provider>
  );
}

export function useDev() {
  const ctx = useContext(DevContext);
  return ctx ?? { roleOverride: null, setRoleOverride: () => {} };
}
