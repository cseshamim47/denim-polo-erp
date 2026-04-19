import { Model, model, models, Schema } from "mongoose";

export interface Product {
  name: string;
  category: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<Product>(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
);

productSchema.index({ category: 1, name: 1 }, { unique: true });

const ProductModel =
  (models.Product as Model<Product>) ||
  model<Product>("Product", productSchema);

export default ProductModel;
