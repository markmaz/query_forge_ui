import api from "./api";
import { ProductGroup } from "../../entities/ProductGroup";

export const fetchProductGroups = async (
  status: string,
): Promise<ProductGroup[]> => {
  const response = await api.get('/product-groups', {
    params: {
      status: status !== 'All' ? status : undefined,
    },
  });

  return response.data;
};

export const createProductGroup = async (group_name: string): Promise<ProductGroup> => {
  const payload = {"product_group_name": group_name};
  const response = await api.post('/product-groups', payload);

  return response.data;
}

export const deleteProductGroup = async (product_group_id: string) => {
  const response = await api.delete(`product-groups/${product_group_id}`);
  return response;
}