import api from "../api";

export const productClient = {
  fetchProducts(params: {
    status?: string;
    limit?: number;
    cursor?: string;
    direction?: string;
  }) {
    return api.get("/products", { params });
  },
  fetchProductCounts() {
    return api.get("/products/counts");
  },
  addSigmaProduct(payload: unknown) {
    return api.post("/products/sigma", payload);
  },
  addProduct(payload: unknown) {
    return api.post("/products", payload);
  },
  fetchProduct(productId: string) {
    return api.get(`/products/${productId}`);
  },
  addProductRole(productId: string, payload: { role_id: string }) {
    return api.put(`/products/${productId}/roles`, payload);
  },
  removeProductRole(productId: string, roleId: string) {
    return api.delete(`/products/${productId}/roles/${roleId}`);
  },
  updateProductStatus(productId: string, payload: { status: string }) {
    return api.put(`/products/${productId}`, payload);
  },
  mapProductToGroup(productId: string, productGroupId: string) {
    return api.put(`/product-groups/${productGroupId}/products/${productId}`);
  },
  removeProductFromGroup(productId: string, productGroupId: string) {
    return api.delete(`/product-groups/${productGroupId}/products/${productId}`);
  },
};

