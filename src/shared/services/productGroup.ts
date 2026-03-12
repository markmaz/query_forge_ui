import { ProductGroup } from "../../domain-model/ProductGroup";
import { productGroupClient } from "./clients/productGroupClient";

function statusParam(status: string) {
  return status !== "All" ? status : undefined;
}

function createPayload(group_name: string) {
  return { product_group_name: group_name };
}

export const fetchProductGroups = async (status: string): Promise<ProductGroup[]> => {
  const response = await productGroupClient.fetchProductGroups({
    status: statusParam(status),
  });

  return response.data;
};

export const createProductGroup = async (
  group_name: string
): Promise<ProductGroup> => {
  const response = await productGroupClient.createProductGroup(createPayload(group_name));
  return response.data;
};

export const deleteProductGroup = async (product_group_id: string) => {
  return productGroupClient.deleteProductGroup(product_group_id);
};
