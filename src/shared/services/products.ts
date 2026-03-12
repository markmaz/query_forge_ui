import { Product, ProductResponse } from "../../domain-model/Products";
import { productClient } from "./clients/productClient";

type ProductListParams = {
  status: string;
  limit: number;
  cursor: string;
  direction: string;
};

type SigmaProductPayload = {
  type: string;
  product_group_id: string;
  product_name: string;
  sigma_dashboard_id: string;
  role_ids: string[];
};

type ProductPayload = {
  product_group_id: string;
  product_name: string;
  role_ids: string[];
};

function normalizeProductListParams({
  status,
  limit,
  cursor,
  direction,
}: ProductListParams) {
  return {
    status: status !== "All" ? status : undefined,
    limit: limit > 0 ? limit : undefined,
    cursor: cursor || undefined,
    direction: direction || undefined,
  };
}

function roleMutationPayload(role_id: string) {
  return { role_id };
}

function statusMutationPayload(status: string) {
  return { status };
}

export const fetchProducts = async (
  status: string,
  limit: number,
  cursor: string,
  direction: string
): Promise<ProductResponse> => {
  const params = normalizeProductListParams({ status, limit, cursor, direction });
  const response = await productClient.fetchProducts(params);
  return response.data;
};

export const fetchProductCounts = async () => {
  const response = await productClient.fetchProductCounts();
  return response.data;
};

export async function addSigmaProduct(payload: SigmaProductPayload) {
  const response = await productClient.addSigmaProduct(payload);
  return response.data;
}

export async function addProduct(payload: ProductPayload) {
  const response = await productClient.addProduct(payload);
  return response.data;
}

export const fetchProductInfo = async (product_id: string): Promise<Product> => {
  const response = await productClient.fetchProduct(product_id);
  return response.data;
};

export const addProductRole = async (product_id: string, role_id: string) => {
  return productClient.addProductRole(product_id, roleMutationPayload(role_id));
};

export const removeProductRole = async (product_id: string, role_id: string) => {
  return productClient.removeProductRole(product_id, role_id);
};

export const updateProductStatus = async (product_id: string, status: string) => {
  return productClient.updateProductStatus(product_id, statusMutationPayload(status));
};

export const mapProductToProductGroup = async (
  product_id: string,
  product_group_id: string
) => {
  return productClient.mapProductToGroup(product_id, product_group_id);
};

export const removeProductFromProductGroup = async (
  product_id: string,
  product_group_id: string
) => {
  return productClient.removeProductFromGroup(product_id, product_group_id);
};
