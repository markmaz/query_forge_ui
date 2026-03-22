import { ReactNode } from "react";
import { useCan } from "./useCan";

type GuardProps = {
  featureAnyOf?: string[];
  capsAnyOf?: string[];
  capsAllOf?: string[];
  fallback?: ReactNode;
  children: ReactNode;
};

function meetsFeatureRequirement(
  featureAnyOf: string[] | undefined,
  hasFeature: (feature: string) => boolean
) {
  if (!featureAnyOf || featureAnyOf.length === 0) return true;
  return featureAnyOf.some((feature) => hasFeature(feature));
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
  featureAnyOf,
  capsAnyOf,
  capsAllOf,
  fallback = null,
  children,
}: GuardProps) {
  const { hasFeature, any, all } = useCan();

  const featureOk = meetsFeatureRequirement(featureAnyOf, hasFeature);
  const capabilityOk = meetsCapabilityRequirement(capsAnyOf, capsAllOf, any, all);

  return featureOk && capabilityOk ? <>{children}</> : <>{fallback}</>;
}
