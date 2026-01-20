import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../../shared/lib/hooks';
import { useCan } from '../../../shared/lib/useCan';

type Props = {
  product: string;
  role?: string | string[];
  children: ReactNode;
  redirectTo?: string;
  fallback?: ReactNode;
};

export default function RequireRole({
  product,
  role,
  children,
  redirectTo = '/403',
  fallback,
}: Props) {

  const { initialized, loading } = useAppSelector((s) => s.user);
  const { hasProduct, hasRole } = useCan();

  if (loading || !initialized) {
    return <>{fallback ?? <div style={{ padding: 16 }}>Loading…</div>}</>;
  }

  const allowed =
    role == null
      ? hasProduct(product)
      : Array.isArray(role)
      ? role.some((r) => hasRole(product, r))
      : hasRole(product, role);

  return allowed ? <>{children}</> : <Navigate to={redirectTo} replace />;
}
