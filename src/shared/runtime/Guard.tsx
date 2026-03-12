import { ReactNode } from "react";
import { useCan } from "./useCan";

type GuardProps = {
  productAnyOf?: string[];
  capsAnyOf?: string[];
  capsAllOf?: string[];
  fallback?: ReactNode;
  children: ReactNode;
};

function meetsProductRequirement(
  productAnyOf: string[] | undefined,
  hasProduct: (product: string) => boolean
) {
  if (!productAnyOf || productAnyOf.length === 0) return true;
  return productAnyOf.some((product) => hasProduct(product));
}

function meetsCapabilityRequirement(
  capsAnyOf: string[] | undefined,
  capsAllOf: string[] | undefined,
  any: (caps: string[]) => boolean,
  all: (caps: string[]) => boolean
) {
  const anyOk = !capsAnyOf || capsAnyOf.length === 0 || any(capsAnyOf);
  const allOk = !capsAllOf || capsAllOf.length === 0 || all(capsAllOf);
  return anyOk && allOk;
}

export default function Guard({
  productAnyOf,
  capsAnyOf,
  capsAllOf,
  fallback = null,
  children,
}: GuardProps) {
  const { hasProduct, any, all } = useCan();

  const productOk = meetsProductRequirement(productAnyOf, hasProduct);
  const capabilityOk = meetsCapabilityRequirement(capsAnyOf, capsAllOf, any, all);

  return productOk && capabilityOk ? <>{children}</> : <>{fallback}</>;
}
