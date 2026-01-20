// auth/Guard.tsx
import { ReactNode } from 'react';
import { useCan } from './useCan';

type GuardProps = {
  productAnyOf?: string[];
  capsAnyOf?: string[];
  capsAllOf?: string[];
  fallback?: ReactNode;
  children: ReactNode;
};

export default function Guard({ productAnyOf, capsAnyOf, capsAllOf, fallback = null, children }: GuardProps) {
  const { hasProduct, any, all } = useCan();
  const okProduct = !productAnyOf || productAnyOf.some((p) => hasProduct(p));
  const okCaps    = (!capsAnyOf || any(capsAnyOf)) && (!capsAllOf || all(capsAllOf));
  return okProduct && okCaps ? <>{children}</> : <>{fallback}</>;
}
