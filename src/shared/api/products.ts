import { Product, ProductResponse } from "../../entities/Products";
import api from "./api";

export const fetchProducts = async (
  status: string,
  limit: number,
  cursor: string,
  direction: string
): Promise<ProductResponse> => {
  const response = await api.get('/products', {
    params: {
      status: status !== 'All' ? status : undefined,
      limit: limit > 0 ? limit : undefined,
      cursor: cursor || undefined,
      direction: direction || undefined,
    },
  });

  return response.data;
};

export const fetchProductCounts = async() => {
  const response = await api.get(`/products/counts`);
  return response.data;
}

export async function addSigmaProduct(payload: {
  type: string,
  product_group_id: string,
  product_name: string,
  sigma_dashboard_id: string,
  role_ids: string[]
}){
  console.log(payload)
  const response = await api.post('/products/sigma', payload);
  return response.data
}

export async function addProduct(payload: {
  product_group_id: string;
  product_name: string;
  role_ids: string[];
}) {
  const response = await api.post('/products', payload);
  return response.data
}

export const fetchProductInfo = async(product_id: string): Promise<Product> => {
  const response = await api.get(`/products/${product_id}`);
  return response.data;
}

export const addProductRole = async(product_id: string, role_id: string) => {
  const data = {"role_id" : role_id};
  const response = await api.put(`/products/${product_id}/roles`, data);
  return response;
}

export const removeProductRole = async(product_id: string, role_id: string) => {
  const response = await api.delete(`/products/${product_id}/roles/${role_id}`);
  return response;
}


export const updateProductStatus = async(product_id: string, status: string) => {
  const data = {"status" : status};
  const response = await api.put(`/products/${product_id}`, data);
  return response;
}

export const mapProductToProductGroup = async(product_id: string, product_group_id: string) => {
  const response = await api.put(`/product-groups/${product_group_id}/products/${product_id}`)
  return response;
}

export const removeProductFromProductGroup = async(product_id: string, product_group_id: string) => {
  const response = await api.delete(`/product-groups/${product_group_id}/products/${product_id}`)
  return response;
}