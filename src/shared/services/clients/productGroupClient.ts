import api from "../api";

export const productGroupClient = {
  fetchProductGroups(params: { status?: string }) {
    return api.get("/product-groups", { params });
  },
  createProductGroup(payload: { product_group_name: string }) {
    return api.post("/product-groups", payload);
  },
  deleteProductGroup(productGroupId: string) {
    return api.delete(`/product-groups/${productGroupId}`);
  },
};

