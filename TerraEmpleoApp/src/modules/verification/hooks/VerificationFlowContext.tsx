import React, { createContext, useContext, useMemo } from 'react';
import { useVerificationFlow } from './useVerificationFlow';

interface VerificationFlowProviderProps {
  children: React.ReactNode;
  usuarioId: number | string;
}

type VerificationFlowValue = ReturnType<typeof useVerificationFlow>;

const VerificationFlowContext = createContext<VerificationFlowValue | null>(null);

export function VerificationFlowProvider({ children, usuarioId }: VerificationFlowProviderProps) {
  const flow = useVerificationFlow(usuarioId);
  const value = useMemo(() => flow, [flow]);

  return <VerificationFlowContext.Provider value={value}>{children}</VerificationFlowContext.Provider>;
}

export function useVerificationFlowContext(): VerificationFlowValue {
  const context = useContext(VerificationFlowContext);
  if (!context) {
    throw new Error('useVerificationFlowContext debe usarse dentro de VerificationFlowProvider.');
  }

  return context;
}
