import { useMemo } from "react";
import { useCan } from "../../../shared/lib/useCan";

export function useSemanticAdminPermissions() {
  const { capabilities, rolesByProduct } = useCan();

  return useMemo(() => {
    const capabilityAdmin = capabilities.some((capability) => capability.endsWith(":admin"));
    const roleAdmin = Object.values(rolesByProduct).some((roles) => roles.includes("admin"));
    return {
      canMutate: capabilityAdmin || roleAdmin,
    };
  }, [capabilities, rolesByProduct]);
}

export default useSemanticAdminPermissions;

