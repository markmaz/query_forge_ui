import { useMemo } from "react";
import { useCan } from "../../../shared/runtime/useCan";

export function useSemanticAdminPermissions() {
  const { capabilities, rolesByFeature } = useCan();

  return useMemo(() => {
    const capabilityAdmin = capabilities.some((capability) => capability.endsWith(":admin"));
    const roleAdmin = Object.values(rolesByFeature).some((roles) => roles.includes("admin"));
    return {
      canMutate: capabilityAdmin || roleAdmin,
    };
  }, [capabilities, rolesByFeature]);
}

export default useSemanticAdminPermissions;
