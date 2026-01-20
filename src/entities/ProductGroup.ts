import { StringLiteral } from "typescript";
import { Product } from "./Products";

export interface ProductGroup{
    product_group_name: string;
    product_group_id: string;
    status: string;
    last_update: string;
    products: Product[] | []
}