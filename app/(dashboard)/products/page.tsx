"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type DeleteRequest = {
  status: "none" | "pending" | "approved" | "rejected";
  requestedById: string | null;
  requestedByName: string | null;
  requestedAt: string | null;
  requiredApprovalCount: number;
  approvalCount: number;
  canReview: boolean;
  approvals: Array<{
    partnerId: string;
    partnerName: string;
    decision: "approved" | "rejected";
    comment: string | null;
    decidedAt: string;
  }>;
};

type Product = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  deleteRequest?: DeleteRequest;
};

type Variant = {
  id: string;
  productId: string;
  sku: string;
  color: string;
  size: string;
  stockQty: number;
  sellingPrice: number;
  deleteRequest?: DeleteRequest;
};

type FieldErrors = {
  name?: string;
  category?: string;
  productId?: string;
  color?: string;
  sizes?: string;
  sellingPrice?: string;
};

function currency(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(value);
}

async function readJsonResponse<T>(response: Response) {
  const body = await response.text();
  if (!body) {
    return null as T | null;
  }
  return JSON.parse(body) as T;
}

function normalizeSizes(sizesText: string) {
  return Array.from(
    new Set(
      sizesText
        .split(",")
        .map((size) => size.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

const PRODUCTS_PER_PAGE = 8;

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);

  const [activeListTab, setActiveListTab] = useState<"products" | "variants">(
    "products",
  );
  const [showProductFilters, setShowProductFilters] = useState(false);
  const [showVariantFilters, setShowVariantFilters] = useState(false);

  const [productFilterText, setProductFilterText] = useState("");
  const [productFilterCategory, setProductFilterCategory] = useState("all");
  const [productFilterStock, setProductFilterStock] = useState<
    "all" | "in-stock" | "zero-stock"
  >("all");
  const [productFilterDeleteStatus, setProductFilterDeleteStatus] = useState<
    "all" | "none" | "pending" | "approved" | "rejected"
  >("all");
  const [productPage, setProductPage] = useState(1);

  const [variantFilterText, setVariantFilterText] = useState("");
  const [variantFilterProductId, setVariantFilterProductId] = useState("all");
  const [variantFilterStock, setVariantFilterStock] = useState<
    "all" | "in-stock" | "zero-stock"
  >("all");
  const [variantFilterDeleteStatus, setVariantFilterDeleteStatus] = useState<
    "all" | "none" | "pending" | "approved" | "rejected"
  >("all");
  const [variantPage, setVariantPage] = useState(1);

  const [productErrors, setProductErrors] = useState<FieldErrors>({});
  const [variantErrors, setVariantErrors] = useState<FieldErrors>({});
  const [productForm, setProductForm] = useState({
    name: "",
    category: "",
    description: "",
  });
  const [variantForm, setVariantForm] = useState({
    productId: "",
    color: "",
    sizesText: "",
    sellingPrice: 0,
  });

  const [isNameDropdownOpen, setIsNameDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);

  const ignoreNextNameBlurRef = useRef(false);
  const ignoreNextCategoryBlurRef = useRef(false);
  const ignoreNextColorBlurRef = useRef(false);

  const nameSuggestions = useMemo(
    () =>
      Array.from(
        new Set(products.map((product) => product.name.trim()).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right)),
    [products],
  );

  const categorySuggestions = useMemo(
    () =>
      Array.from(
        new Set(products.map((product) => product.category.trim()).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right)),
    [products],
  );

  const colorSuggestions = useMemo(() => {
    if (!variantForm.productId) {
      return [] as string[];
    }

    return Array.from(
      new Set(
        variants
          .filter((variant) => variant.productId === variantForm.productId)
          .map((variant) => variant.color.trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));
  }, [variantForm.productId, variants]);

  const normalizedName = productForm.name.trim().toLocaleLowerCase();
  const filteredNameSuggestions = nameSuggestions.filter((name) => {
    if (!normalizedName) {
      return true;
    }
    return name.toLocaleLowerCase().includes(normalizedName);
  });

  const normalizedCategory = productForm.category.trim().toLocaleLowerCase();
  const filteredCategorySuggestions = categorySuggestions.filter((category) => {
    if (!normalizedCategory) {
      return true;
    }
    return category.toLocaleLowerCase().includes(normalizedCategory);
  });

  const normalizedColor = variantForm.color.trim().toLocaleLowerCase();
  const filteredColorSuggestions = colorSuggestions.filter((color) => {
    if (!normalizedColor) {
      return true;
    }
    return color.toLocaleLowerCase().includes(normalizedColor);
  });

  const productStockById = useMemo(() => {
    const map = new Map<string, number>();
    for (const variant of variants) {
      map.set(
        variant.productId,
        (map.get(variant.productId) ?? 0) + variant.stockQty,
      );
    }
    return map;
  }, [variants]);

  const productNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) {
      map.set(product.id, product.name);
    }
    return map;
  }, [products]);

  const productCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set(products.map((product) => product.category.trim()).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right)),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = productFilterText.trim().toLocaleLowerCase();

    return products.filter((product) => {
      const stock = productStockById.get(product.id) ?? 0;
      const deleteStatus = product.deleteRequest?.status ?? "none";

      if (productFilterCategory !== "all" && product.category !== productFilterCategory) {
        return false;
      }
      if (productFilterStock === "in-stock" && stock <= 0) {
        return false;
      }
      if (productFilterStock === "zero-stock" && stock > 0) {
        return false;
      }
      if (
        productFilterDeleteStatus !== "all" &&
        deleteStatus !== productFilterDeleteStatus
      ) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      const description = product.description ?? "";
      return (
        product.name.toLocaleLowerCase().includes(normalizedQuery) ||
        product.category.toLocaleLowerCase().includes(normalizedQuery) ||
        description.toLocaleLowerCase().includes(normalizedQuery)
      );
    });
  }, [
    productFilterCategory,
    productFilterDeleteStatus,
    productFilterStock,
    productFilterText,
    productStockById,
    products,
  ]);

  const filteredVariants = useMemo(() => {
    const normalizedQuery = variantFilterText.trim().toLocaleLowerCase();

    return variants.filter((variant) => {
      const deleteStatus = variant.deleteRequest?.status ?? "none";

      if (variantFilterProductId !== "all" && variant.productId !== variantFilterProductId) {
        return false;
      }
      if (variantFilterStock === "in-stock" && variant.stockQty <= 0) {
        return false;
      }
      if (variantFilterStock === "zero-stock" && variant.stockQty > 0) {
        return false;
      }
      if (
        variantFilterDeleteStatus !== "all" &&
        deleteStatus !== variantFilterDeleteStatus
      ) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      const productName = productNameById.get(variant.productId) ?? "";
      return (
        variant.sku.toLocaleLowerCase().includes(normalizedQuery) ||
        variant.color.toLocaleLowerCase().includes(normalizedQuery) ||
        variant.size.toLocaleLowerCase().includes(normalizedQuery) ||
        productName.toLocaleLowerCase().includes(normalizedQuery)
      );
    });
  }, [
    productNameById,
    variantFilterDeleteStatus,
    variantFilterProductId,
    variantFilterStock,
    variantFilterText,
    variants,
  ]);

  const totalProductPages = Math.max(
    Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE),
    1,
  );
  const currentProductPage = Math.min(productPage, totalProductPages);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentProductPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
  }, [currentProductPage, filteredProducts]);

  const totalVariantPages = Math.max(
    Math.ceil(filteredVariants.length / PRODUCTS_PER_PAGE),
    1,
  );
  const currentVariantPage = Math.min(variantPage, totalVariantPages);

  const paginatedVariants = useMemo(() => {
    const startIndex = (currentVariantPage - 1) * PRODUCTS_PER_PAGE;
    return filteredVariants.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
  }, [currentVariantPage, filteredVariants]);

  async function loadData() {
    const [productsResponse, variantsResponse] = await Promise.all([
      fetch("/api/products", { cache: "no-store" }),
      fetch("/api/variants?search=", { cache: "no-store" }),
    ]);

    if (!productsResponse.ok || !variantsResponse.ok) {
      toast.error("Unable to load products right now.");
      return;
    }

    const productsPayload = await readJsonResponse<{ products?: Product[] }>(
      productsResponse,
    );
    const variantsPayload = await readJsonResponse<{ variants?: Variant[] }>(
      variantsResponse,
    );

    setProducts(productsPayload?.products ?? []);
    setVariants(variantsPayload?.variants ?? []);
  }

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/products", { cache: "no-store" }),
      fetch("/api/variants?search=", { cache: "no-store" }),
    ])
      .then(async ([productsResponse, variantsResponse]) => {
        if (!productsResponse.ok || !variantsResponse.ok) {
          if (!cancelled) {
            toast.error("Unable to load products right now.");
          }
          return;
        }

        const productsPayload = await readJsonResponse<{ products?: Product[] }>(
          productsResponse,
        );
        const variantsPayload = await readJsonResponse<{ variants?: Variant[] }>(
          variantsResponse,
        );

        if (!cancelled) {
          setProducts(productsPayload?.products ?? []);
          setVariants(variantsPayload?.variants ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Unable to load products right now.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function validateProductForm() {
    const nextErrors: FieldErrors = {};

    if (!productForm.name.trim()) {
      nextErrors.name = "This field is required.";
    }
    if (!productForm.category.trim()) {
      nextErrors.category = "This field is required.";
    }

    return nextErrors;
  }

  function validateVariantForm() {
    const nextErrors: FieldErrors = {};

    if (!variantForm.productId.trim()) {
      nextErrors.productId = "This field is required.";
    }
    if (!variantForm.color.trim()) {
      nextErrors.color = "This field is required.";
    }
    if (normalizeSizes(variantForm.sizesText).length === 0) {
      nextErrors.sizes = "Provide at least one size.";
    }
    if (variantForm.sellingPrice <= 0) {
      nextErrors.sellingPrice = "Selling price is required.";
    }

    return nextErrors;
  }

  async function submitProduct() {
    const nextErrors = validateProductForm();
    setProductErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fill in the required product fields.");
      return;
    }

    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: productForm.name.trim(),
        category: productForm.category.trim(),
        description: productForm.description.trim(),
      }),
    });

    const payload = await readJsonResponse<{ error?: string }>(response);

    if (!response.ok) {
      toast.error(payload?.error ?? "Product create failed.");
      return;
    }

    toast.success("Product created.");
    setProductForm({ name: "", category: "", description: "" });
    setProductErrors({});
    await loadData();
  }

  async function deleteProduct(productId: string) {
    const response = await fetch("/api/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });

    const payload = await readJsonResponse<{ error?: string }>(response);

    if (!response.ok) {
      toast.error(payload?.error ?? "Delete request failed.");
      return;
    }

    toast.success("Delete request submitted for partner review.");
    await loadData();
  }

  async function reviewDeleteProduct(
    productId: string,
    decision: "approved" | "rejected",
  ) {
    const response = await fetch("/api/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, decision }),
    });

    const payload = await readJsonResponse<{ error?: string; status?: string }>(
      response,
    );

    if (!response.ok) {
      toast.error(payload?.error ?? "Delete review failed.");
      return;
    }

    if (payload?.status === "approved") {
      toast.success("Delete request approved and product deleted.");
    } else if (payload?.status === "rejected") {
      toast.success("Delete request rejected.");
    } else {
      toast.success("Delete review recorded.");
    }

    if (variantForm.productId === productId && payload?.status === "approved") {
      setVariantForm((current) => ({ ...current, productId: "", color: "" }));
    }

    await loadData();
  }

  async function submitVariant() {
    const nextErrors = validateVariantForm();
    setVariantErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fill in the required variant fields.");
      return;
    }

    const response = await fetch("/api/variants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: variantForm.productId,
        color: variantForm.color.trim(),
        sizes: normalizeSizes(variantForm.sizesText),
        sellingPrice: variantForm.sellingPrice,
      }),
    });

    const payload = await readJsonResponse<{ error?: string; createdCount?: number }>(
      response,
    );

    if (!response.ok) {
      toast.error(payload?.error ?? "Variant create failed.");
      return;
    }

    setVariantForm((current) => ({
      ...current,
      color: "",
      sizesText: "",
      sellingPrice: 0,
    }));
    setVariantErrors({});
    toast.success(`Variant created (${payload?.createdCount ?? 0} size(s)).`);
    await loadData();
  }

  async function deleteVariant(variantId: string) {
    const response = await fetch("/api/variants", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId }),
    });

    const payload = await readJsonResponse<{ error?: string }>(response);

    if (!response.ok) {
      toast.error(payload?.error ?? "Variant delete request failed.");
      return;
    }

    toast.success("Variant delete request submitted for partner review.");
    await loadData();
  }

  async function reviewDeleteVariant(
    variantId: string,
    decision: "approved" | "rejected",
  ) {
    const response = await fetch("/api/variants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, decision }),
    });

    const payload = await readJsonResponse<{ error?: string; status?: string }>(
      response,
    );

    if (!response.ok) {
      toast.error(payload?.error ?? "Variant delete review failed.");
      return;
    }

    if (payload?.status === "approved") {
      toast.success("Variant delete approved and variant deleted.");
    } else if (payload?.status === "rejected") {
      toast.success("Variant delete rejected.");
    } else {
      toast.success("Variant delete review recorded.");
    }

    await loadData();
  }

  const productStartIndex =
    filteredProducts.length === 0
      ? 0
      : (currentProductPage - 1) * PRODUCTS_PER_PAGE + 1;
  const productEndIndex =
    filteredProducts.length === 0
      ? 0
      : Math.min(currentProductPage * PRODUCTS_PER_PAGE, filteredProducts.length);

  return (
    <div className="space-y-6">
      <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-[var(--stroke-soft)]">
        <h2 className="text-2xl font-semibold tracking-tight">Product catalog</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
          Create products and add color variants with multiple sizes in one action.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-[var(--stroke-soft)]">
          <h3 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            Create product
          </h3>

          <div className="mt-4 space-y-4">

          <div className="relative">
            <label className="mb-1 block text-sm text-[var(--text-secondary)]">
              Product name
            </label>
            <input
              className="field"
              placeholder="Product name"
              value={productForm.name}
              onBlur={() => {
                if (ignoreNextNameBlurRef.current) {
                  ignoreNextNameBlurRef.current = false;
                  return;
                }
                window.setTimeout(() => setIsNameDropdownOpen(false), 120);
              }}
              onChange={(event) => {
                setProductForm((current) => ({ ...current, name: event.target.value }));
                setProductErrors((current) => ({ ...current, name: undefined }));
                setIsNameDropdownOpen(true);
              }}
              onFocus={() => setIsNameDropdownOpen(true)}
            />
            {isNameDropdownOpen && filteredNameSuggestions.length > 0 ? (
              <div className="absolute z-10 mt-2 grid w-full gap-1 rounded-[1.2rem] border border-(--stroke-soft) bg-white p-2 shadow-lg">
                {filteredNameSuggestions.map((name) => (
                  <button
                    key={name}
                    className="rounded-xl px-3 py-2 text-left text-sm hover:bg-(--surface-accent-soft)"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      ignoreNextNameBlurRef.current = true;
                      setProductForm((current) => ({ ...current, name }));
                      setProductErrors((current) => ({ ...current, name: undefined }));
                      setIsNameDropdownOpen(false);
                    }}
                    type="button"
                  >
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
            {productErrors.name ? (
              <p className="mt-2 text-sm text-red-600">{productErrors.name}</p>
            ) : null}
          </div>

          <div className="relative">
            <label className="mb-1 block text-sm text-[var(--text-secondary)]">Category</label>
            <input
              className="field"
              placeholder="Category"
              value={productForm.category}
              onBlur={() => {
                if (ignoreNextCategoryBlurRef.current) {
                  ignoreNextCategoryBlurRef.current = false;
                  return;
                }
                window.setTimeout(() => setIsCategoryDropdownOpen(false), 120);
              }}
              onChange={(event) => {
                setProductForm((current) => ({
                  ...current,
                  category: event.target.value,
                }));
                setProductErrors((current) => ({ ...current, category: undefined }));
                setIsCategoryDropdownOpen(true);
              }}
              onFocus={() => setIsCategoryDropdownOpen(true)}
            />
            {isCategoryDropdownOpen && filteredCategorySuggestions.length > 0 ? (
              <div className="absolute z-10 mt-2 grid w-full gap-1 rounded-[1.2rem] border border-(--stroke-soft) bg-white p-2 shadow-lg">
                {filteredCategorySuggestions.map((category) => (
                  <button
                    key={category}
                    className="rounded-xl px-3 py-2 text-left text-sm hover:bg-(--surface-accent-soft)"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      ignoreNextCategoryBlurRef.current = true;
                      setProductForm((current) => ({ ...current, category }));
                      setProductErrors((current) => ({ ...current, category: undefined }));
                      setIsCategoryDropdownOpen(false);
                    }}
                    type="button"
                  >
                    {category}
                  </button>
                ))}
              </div>
            ) : null}
            {productErrors.category ? (
              <p className="mt-2 text-sm text-red-600">{productErrors.category}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm text-[var(--text-secondary)]">
              Description
            </label>
            <textarea
              className="field min-h-28"
              placeholder="Description"
              value={productForm.description}
              onChange={(event) =>
                setProductForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </div>

          <button
            className="btn-primary w-full sm:w-auto"
            onClick={submitProduct}
            type="button"
          >
            Create product
          </button>
          </div>
        </section>

        <section className="rounded-[1.8rem] bg-[var(--surface-accent)] p-6 text-white lg:mt-4">
          <h3 className="text-xl font-semibold tracking-tight">Create variant</h3>

          <div className="mt-4 space-y-4">
            <label className="mb-1 block text-sm text-white/80">Product</label>
            <select
              className="field text-[var(--text-primary)]"
              value={variantForm.productId}
              onChange={(event) => {
                const nextProductId = event.target.value;
                setVariantForm((current) => ({
                  ...current,
                  productId: nextProductId,
                  color: "",
                }));
                setVariantErrors((current) => ({
                  ...current,
                  productId: undefined,
                  color: undefined,
                }));
                setIsColorDropdownOpen(false);
              }}
            >
              <option value="">Pick product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            {variantErrors.productId ? (
              <p className="mt-2 text-sm text-red-200">{variantErrors.productId}</p>
            ) : null}

          <div className="relative">
            <label className="mb-1 block text-sm text-white/80">Color</label>
            <input
              className="field text-[var(--text-primary)]"
              placeholder="Color"
              value={variantForm.color}
              onBlur={() => {
                if (ignoreNextColorBlurRef.current) {
                  ignoreNextColorBlurRef.current = false;
                  return;
                }
                window.setTimeout(() => setIsColorDropdownOpen(false), 120);
              }}
              onChange={(event) => {
                setVariantForm((current) => ({ ...current, color: event.target.value }));
                setVariantErrors((current) => ({ ...current, color: undefined }));
                setIsColorDropdownOpen(true);
              }}
              onFocus={() => setIsColorDropdownOpen(true)}
            />
            {isColorDropdownOpen && filteredColorSuggestions.length > 0 ? (
              <div className="absolute z-10 mt-2 grid w-full gap-1 rounded-[1.2rem] border border-(--stroke-soft) bg-white p-2 shadow-lg">
                {filteredColorSuggestions.map((color) => (
                  <button
                    key={color}
                    className="rounded-xl px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-(--surface-accent-soft)"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      ignoreNextColorBlurRef.current = true;
                      setVariantForm((current) => ({ ...current, color }));
                      setVariantErrors((current) => ({ ...current, color: undefined }));
                      setIsColorDropdownOpen(false);
                    }}
                    type="button"
                  >
                    {color}
                  </button>
                ))}
              </div>
            ) : null}
            {variantErrors.color ? (
              <p className="mt-2 text-sm text-red-200">{variantErrors.color}</p>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-white/80">
                Sizes (comma separated)
              </label>
              <input
                className="field text-[var(--text-primary)]"
                placeholder="S, M, L"
                value={variantForm.sizesText}
                onChange={(event) => {
                  setVariantForm((current) => ({
                    ...current,
                    sizesText: event.target.value,
                  }));
                  setVariantErrors((current) => ({ ...current, sizes: undefined }));
                }}
              />
              {variantErrors.sizes ? (
                <p className="mt-2 text-sm text-red-200">{variantErrors.sizes}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm text-white/80">Selling price</label>
              <input
                className="field text-[var(--text-primary)]"
                type="number"
                min={0}
                placeholder="Selling price"
                value={variantForm.sellingPrice}
                onChange={(event) => {
                  setVariantForm((current) => ({
                    ...current,
                    sellingPrice: Number(event.target.value) || 0,
                  }));
                  setVariantErrors((current) => ({
                    ...current,
                    sellingPrice: undefined,
                  }));
                }}
              />
              {variantErrors.sellingPrice ? (
                <p className="mt-2 text-sm text-red-200">{variantErrors.sellingPrice}</p>
              ) : null}
            </div>
          </div>

          </div>

          <button
            className="btn-secondary mt-3 w-full sm:w-auto"
            onClick={submitVariant}
            type="button"
          >
            Create variant
          </button>
        </section>
      </div>

      <section className="space-y-6 rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-[var(--stroke-soft)]">
        <div className="space-y-3">
          <h3 className="text-xl font-semibold tracking-tight">Catalog records</h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-2xl bg-(--surface-accent-soft) p-1">
              <button
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeListTab === "products"
                    ? "bg-[var(--surface-accent)] text-white"
                    : "text-[var(--text-secondary)]"
                }`}
                onClick={() => setActiveListTab("products")}
                type="button"
              >
                Products
              </button>
              <button
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeListTab === "variants"
                    ? "bg-[var(--surface-accent)] text-white"
                    : "text-[var(--text-secondary)]"
                }`}
                onClick={() => setActiveListTab("variants")}
                type="button"
              >
                Live variants
              </button>
            </div>
            <button
              className="btn-secondary"
              onClick={() =>
                activeListTab === "products"
                  ? setShowProductFilters((current) => !current)
                  : setShowVariantFilters((current) => !current)
              }
              type="button"
            >
              {activeListTab === "products"
                ? showProductFilters
                  ? "Hide filters"
                  : "Show filters"
                : showVariantFilters
                  ? "Hide filters"
                  : "Show filters"}
            </button>
          </div>
        </div>

        {activeListTab === "products" ? (
          <>
            {showProductFilters ? (
              <div className="grid gap-3 rounded-2xl border border-[var(--stroke-soft)] p-4 sm:grid-cols-2">
                <input
                  className="field sm:col-span-2"
                  placeholder="Search by name, category, or description"
                  value={productFilterText}
                  onChange={(event) => {
                    setProductFilterText(event.target.value);
                    setProductPage(1);
                  }}
                />
                <select
                  className="field"
                  value={productFilterCategory}
                  onChange={(event) => {
                    setProductFilterCategory(event.target.value);
                    setProductPage(1);
                  }}
                >
                  <option value="all">All categories</option>
                  {productCategoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <select
                  className="field"
                  value={productFilterStock}
                  onChange={(event) => {
                    setProductFilterStock(
                      event.target.value as "all" | "in-stock" | "zero-stock",
                    );
                    setProductPage(1);
                  }}
                >
                  <option value="all">All stock states</option>
                  <option value="in-stock">In stock only</option>
                  <option value="zero-stock">Zero stock only</option>
                </select>
                <select
                  className="field sm:col-span-2"
                  value={productFilterDeleteStatus}
                  onChange={(event) => {
                    setProductFilterDeleteStatus(
                      event.target.value as
                        | "all"
                        | "none"
                        | "pending"
                        | "approved"
                        | "rejected",
                    );
                    setProductPage(1);
                  }}
                >
                  <option value="all">All delete states</option>
                  <option value="none">No request</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            ) : null}

            {filteredProducts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--stroke-soft)] p-6 text-center text-sm text-[var(--text-secondary)]">
                No products matched your filters.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[var(--stroke-soft)]">
                <table className="w-full text-sm">
                  <thead className="border-b border-[var(--stroke-soft)] bg-[var(--surface-accent-soft)]">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Product Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Category</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Description</th>
                      <th className="px-4 py-3 text-center font-semibold text-[var(--text-primary)]">Stock</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Status</th>
                      <th className="px-4 py-3 text-center font-semibold text-[var(--text-primary)]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--stroke-soft)]">
                    {paginatedProducts.map((product) => {
                      const stock = productStockById.get(product.id) ?? 0;
                      const deleteRequest = product.deleteRequest;
                      const isDeletePending = deleteRequest?.status === "pending";
                      const showProductRequestButton = !isDeletePending;

                      return (
                        <tr key={product.id} className="hover:bg-[var(--surface-accent-soft)]/50 transition">
                          <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{product.name}</td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">{product.category}</td>
                          <td className="px-4 py-3 text-[var(--text-secondary)] max-w-xs truncate" title={product.description?.trim()}>
                            {product.description?.trim() || "—"}
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-[var(--text-primary)]">{stock}</td>
                          <td className="px-4 py-3">
                            {deleteRequest?.status && deleteRequest.status !== "none" ? (
                              <div className="inline-block rounded-full bg-[var(--surface-accent-soft)] px-2 py-1">
                                <span className="text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">
                                  {deleteRequest.status} ({deleteRequest.approvalCount}/{deleteRequest.requiredApprovalCount})
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-[var(--text-secondary)]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {showProductRequestButton ? (
                              <button
                                className="btn-secondary text-xs py-1 px-2"
                                disabled={stock > 0}
                                title={stock > 0 ? "Can only delete when stock is 0" : ""}
                                onClick={() => void deleteProduct(product.id)}
                                type="button"
                              >
                                Delete
                              </button>
                            ) : deleteRequest?.canReview ? (
                              <div className="flex gap-1 justify-center flex-wrap">
                                <button
                                  className="btn-primary text-xs py-1 px-2"
                                  onClick={() => void reviewDeleteProduct(product.id, "approved")}
                                  type="button"
                                >
                                  Approve
                                </button>
                                <button
                                  className="btn-secondary text-xs py-1 px-2"
                                  onClick={() => void reviewDeleteProduct(product.id, "rejected")}
                                  type="button"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-[var(--text-secondary)]">Pending</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--stroke-soft)] px-4 py-3 text-sm text-[var(--text-secondary)]">
              <p>
                {filteredProducts.length === 0 ? "No products" : `Showing ${productStartIndex}-${productEndIndex} of ${filteredProducts.length}`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="btn-secondary"
                  disabled={currentProductPage === 1}
                  onClick={() => setProductPage((current) => Math.max(current - 1, 1))}
                  type="button"
                >
                  Previous
                </button>
                <span>
                  Page {currentProductPage} / {totalProductPages}
                </span>
                <button
                  className="btn-secondary"
                  disabled={currentProductPage >= totalProductPages}
                  onClick={() =>
                    setProductPage((current) => Math.min(current + 1, totalProductPages))
                  }
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
            </>
        ) : (
          <div className="space-y-4">
            {showVariantFilters ? (
              <div className="grid gap-3 rounded-2xl border border-[var(--stroke-soft)] p-4 sm:grid-cols-2">
                <input
                  className="field sm:col-span-2"
                  placeholder="Search by SKU, product, color, or size"
                  value={variantFilterText}
                  onChange={(event) => {
                    setVariantFilterText(event.target.value);
                    setVariantPage(1);
                  }}
                />
                <select
                  className="field"
                  value={variantFilterProductId}
                  onChange={(event) => {
                    setVariantFilterProductId(event.target.value);
                    setVariantPage(1);
                  }}
                >
                  <option value="all">All products</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                <select
                  className="field"
                  value={variantFilterStock}
                  onChange={(event) => {
                    setVariantFilterStock(
                      event.target.value as "all" | "in-stock" | "zero-stock",
                    );
                    setVariantPage(1);
                  }}
                >
                  <option value="all">All stock states</option>
                  <option value="in-stock">In stock only</option>
                  <option value="zero-stock">Zero stock only</option>
                </select>
                <select
                  className="field sm:col-span-2"
                  value={variantFilterDeleteStatus}
                  onChange={(event) => {
                    setVariantFilterDeleteStatus(
                      event.target.value as
                        | "all"
                        | "none"
                        | "pending"
                        | "approved"
                        | "rejected",
                    );
                    setVariantPage(1);
                  }}
                >
                  <option value="all">All delete states</option>
                  <option value="none">No request</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            ) : null}

            {filteredVariants.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--stroke-soft)] p-6 text-center text-sm text-[var(--text-secondary)]">
                No live variants matched your filters.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[var(--stroke-soft)]">
                <table className="w-full text-sm">
                  <thead className="border-b border-[var(--stroke-soft)] bg-[var(--surface-accent-soft)]">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">SKU</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Product</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Color</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Size</th>
                      <th className="px-4 py-3 text-center font-semibold text-[var(--text-primary)]">Stock</th>
                      <th className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">Selling Price</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Status</th>
                      <th className="px-4 py-3 text-center font-semibold text-[var(--text-primary)]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--stroke-soft)]">
                    {paginatedVariants.map((variant) => {
                      const productName =
                        productNameById.get(variant.productId) ?? "Unknown product";
                      const deleteRequest = variant.deleteRequest;
                      const isDeletePending = deleteRequest?.status === "pending";
                      const showVariantRequestButton = !isDeletePending;

                      return (
                        <tr key={variant.id} className="hover:bg-[var(--surface-accent-soft)]/50 transition">
                          <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{variant.sku}</td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">{productName}</td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">{variant.color}</td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">{variant.size}</td>
                          <td className="px-4 py-3 text-center font-medium text-[var(--text-primary)]">{variant.stockQty}</td>
                          <td className="px-4 py-3 text-right text-[var(--text-primary)] font-medium">{currency(variant.sellingPrice)}</td>
                          <td className="px-4 py-3">
                            {deleteRequest?.status && deleteRequest.status !== "none" ? (
                              <div className="inline-block rounded-full bg-[var(--surface-accent-soft)] px-2 py-1">
                                <span className="text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">
                                  {deleteRequest.status} ({deleteRequest.approvalCount}/{deleteRequest.requiredApprovalCount})
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-[var(--text-secondary)]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {showVariantRequestButton ? (
                              <button
                                className="btn-secondary text-xs py-1 px-2"
                                disabled={variant.stockQty > 0}
                                title={variant.stockQty > 0 ? "Can only delete when stock is 0" : ""}
                                onClick={() => void deleteVariant(variant.id)}
                                type="button"
                              >
                                Delete
                              </button>
                            ) : deleteRequest?.canReview ? (
                              <div className="flex gap-1 justify-center flex-wrap">
                                <button
                                  className="btn-primary text-xs py-1 px-2"
                                  onClick={() => void reviewDeleteVariant(variant.id, "approved")}
                                  type="button"
                                >
                                  Approve
                                </button>
                                <button
                                  className="btn-secondary text-xs py-1 px-2"
                                  onClick={() => void reviewDeleteVariant(variant.id, "rejected")}
                                  type="button"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-[var(--text-secondary)]">Pending</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--stroke-soft)] px-4 py-3 text-sm text-[var(--text-secondary)]">
              <p>
                {filteredVariants.length === 0 ? "No variants" : `Showing ${filteredVariants.length === 0 ? 0 : (currentVariantPage - 1) * PRODUCTS_PER_PAGE + 1}-${Math.min(currentVariantPage * PRODUCTS_PER_PAGE, filteredVariants.length)} of ${filteredVariants.length}`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="btn-secondary"
                  disabled={currentVariantPage === 1}
                  onClick={() => setVariantPage((current) => Math.max(current - 1, 1))}
                  type="button"
                >
                  Previous
                </button>
                <span className="text-xs">
                  Page {currentVariantPage} / {totalVariantPages}
                </span>
                <button
                  className="btn-secondary"
                  disabled={currentVariantPage >= totalVariantPages}
                  onClick={() =>
                    setVariantPage((current) => Math.min(current + 1, totalVariantPages))
                  }
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
