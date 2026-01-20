import { ProductRole } from "./ProductRole"

export interface Product{
    product_name: string,
    product_id: string,
    status: string,
    last_update: string| null |undefined,
    roles: ProductRole[]

}

export interface ProductResponse{
    products: Product[],
    next_cursor: string | null;
    prev_cursor: string | null;
}