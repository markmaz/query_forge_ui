import { toast } from "react-toastify";

export const SemanticToast = {
  success(message: string) {
    toast.success(message);
  },
  error(message: string) {
    toast.error(message);
  },
};

export default SemanticToast;

