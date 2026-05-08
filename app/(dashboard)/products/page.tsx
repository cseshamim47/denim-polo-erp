"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronsUpDownIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

type UpdateRequest = {
  status: "none" | "pending" | "approved" | "rejected";
  requestedById: string | null;
  requestedByName: string | null;
  requestedAt: string | null;
  requiredApprovalCount: number;
  approvalCount: number;
  canReview: boolean;
  proposal: {
    color: string | null;
    size: string | null;
    sellingPrice: number | null;
  };
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
  stockQty?: number;
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
  updateRequest?: UpdateRequest;
};

type FieldErrors = {
  name?: string;
  category?: string;
  productId?: string;
  color?: string;
  sizes?: string;
  sellingPrice?: string;
};

type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

const stockFilterOptions = [
  { value: "all", label: "All stock states" },
  { value: "in-stock", label: "In stock only" },
  { value: "zero-stock", label: "Zero stock only" },
] as const;

const deleteStatusOptions = [
  { value: "all", label: "All delete states" },
  { value: "none", label: "No request" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

function getRequestBadgeClassName(
  status: "none" | "pending" | "approved" | "rejected",
) {
  if (status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogVariants, setCatalogVariants] = useState<Variant[]>([]);
  const [productPagination, setProductPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    pageSize: PRODUCTS_PER_PAGE,
    totalPages: 1,
  });
  const [variantPagination, setVariantPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    pageSize: PRODUCTS_PER_PAGE,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [openField, setOpenField] = useState<string | null>(null);

  const [activeListTab, setActiveListTab] = useState<"products" | "variants">(
    "variants",
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
  const [productNameSearch, setProductNameSearch] = useState("");
  const [productCategorySearch, setProductCategorySearch] = useState("");
  const [variantColorSearch, setVariantColorSearch] = useState("");
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updatingVariant, setUpdatingVariant] = useState<Variant | null>(null);
  const [updateSellingPriceInput, setUpdateSellingPriceInput] = useState("");
  const [updateSellingPriceError, setUpdateSellingPriceError] = useState<
    string | null
  >(null);

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
        new Set(
          products.map((product) => product.category.trim()).filter(Boolean),
        ),
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
        new Set(
          products.map((product) => product.category.trim()).filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [products],
  );

  const paginatedProducts = catalogProducts;
  const paginatedVariants = catalogVariants;
  const totalProductPages = productPagination.totalPages;
  const currentProductPage = productPagination.page;
  const totalVariantPages = variantPagination.totalPages;
  const currentVariantPage = variantPagination.page;

  async function loadCatalogRecords() {
    const productParams = new URLSearchParams({
      page: String(productPage),
      pageSize: String(PRODUCTS_PER_PAGE),
      search: productFilterText,
      stock: productFilterStock,
      deleteStatus: productFilterDeleteStatus,
    });

    if (productFilterCategory !== "all") {
      productParams.set("category", productFilterCategory);
    }

    const variantParams = new URLSearchParams({
      page: String(variantPage),
      pageSize: String(PRODUCTS_PER_PAGE),
      search: variantFilterText,
      stock: variantFilterStock,
      deleteStatus: variantFilterDeleteStatus,
    });

    if (variantFilterProductId !== "all") {
      variantParams.set("productId", variantFilterProductId);
    }

    const [productsResponse, variantsResponse] = await Promise.all([
      fetch(`/api/products?${productParams.toString()}`, { cache: "no-store" }),
      fetch(`/api/variants?${variantParams.toString()}`, { cache: "no-store" }),
    ]);

    if (!productsResponse.ok || !variantsResponse.ok) {
      toast.error("Unable to load catalog records right now.");
      return;
    }

    const productsPayload = await readJsonResponse<{
      products?: Product[];
      pagination?: PaginationMeta;
    }>(productsResponse);
    const variantsPayload = await readJsonResponse<{
      variants?: Variant[];
      pagination?: PaginationMeta;
    }>(variantsResponse);

    setCatalogProducts(productsPayload?.products ?? []);
    setCatalogVariants(variantsPayload?.variants ?? []);
    setProductPagination(
      productsPayload?.pagination ?? {
        total: productsPayload?.products?.length ?? 0,
        page: 1,
        pageSize: PRODUCTS_PER_PAGE,
        totalPages: 1,
      },
    );
    setVariantPagination(
      variantsPayload?.pagination ?? {
        total: variantsPayload?.variants?.length ?? 0,
        page: 1,
        pageSize: PRODUCTS_PER_PAGE,
        totalPages: 1,
      },
    );
  }

  async function loadData() {
    setIsLoading(true);

    try {
      const [productsResponse, variantsResponse] = await Promise.all([
        fetch("/api/products?forOptions=1", { cache: "no-store" }),
        fetch("/api/variants?forOptions=1", { cache: "no-store" }),
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
      await loadCatalogRecords();
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/products?forOptions=1", { cache: "no-store" }),
      fetch("/api/variants?forOptions=1", { cache: "no-store" }),
    ])
      .then(async ([productsResponse, variantsResponse]) => {
        if (!productsResponse.ok || !variantsResponse.ok) {
          if (!cancelled) {
            toast.error("Unable to load products right now.");
            setIsLoading(false);
          }
          return;
        }

        const productsPayload = await readJsonResponse<{
          products?: Product[];
        }>(productsResponse);
        const variantsPayload = await readJsonResponse<{
          variants?: Variant[];
        }>(variantsResponse);

        if (!cancelled) {
          setProducts(productsPayload?.products ?? []);
          setVariants(variantsPayload?.variants ?? []);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Unable to load products right now.");
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const productParams = new URLSearchParams({
      page: String(productPage),
      pageSize: String(PRODUCTS_PER_PAGE),
      search: productFilterText,
      stock: productFilterStock,
      deleteStatus: productFilterDeleteStatus,
    });

    if (productFilterCategory !== "all") {
      productParams.set("category", productFilterCategory);
    }

    const variantParams = new URLSearchParams({
      page: String(variantPage),
      pageSize: String(PRODUCTS_PER_PAGE),
      search: variantFilterText,
      stock: variantFilterStock,
      deleteStatus: variantFilterDeleteStatus,
    });

    if (variantFilterProductId !== "all") {
      variantParams.set("productId", variantFilterProductId);
    }

    Promise.all([
      fetch(`/api/products?${productParams.toString()}`, { cache: "no-store" }),
      fetch(`/api/variants?${variantParams.toString()}`, { cache: "no-store" }),
    ])
      .then(async ([productsResponse, variantsResponse]) => {
        if (!productsResponse.ok || !variantsResponse.ok) {
          if (!cancelled) {
            toast.error("Unable to load catalog records right now.");
          }
          return;
        }

        const productsPayload = await readJsonResponse<{
          products?: Product[];
          pagination?: PaginationMeta;
        }>(productsResponse);
        const variantsPayload = await readJsonResponse<{
          variants?: Variant[];
          pagination?: PaginationMeta;
        }>(variantsResponse);

        if (!cancelled) {
          setCatalogProducts(productsPayload?.products ?? []);
          setCatalogVariants(variantsPayload?.variants ?? []);
          setProductPagination(
            productsPayload?.pagination ?? {
              total: productsPayload?.products?.length ?? 0,
              page: 1,
              pageSize: PRODUCTS_PER_PAGE,
              totalPages: 1,
            },
          );
          setVariantPagination(
            variantsPayload?.pagination ?? {
              total: variantsPayload?.variants?.length ?? 0,
              page: 1,
              pageSize: PRODUCTS_PER_PAGE,
              totalPages: 1,
            },
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Unable to load catalog records right now.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    productPage,
    variantPage,
    productFilterText,
    productFilterCategory,
    productFilterStock,
    productFilterDeleteStatus,
    variantFilterText,
    variantFilterProductId,
    variantFilterStock,
    variantFilterDeleteStatus,
  ]);

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

    const payload = await readJsonResponse<{
      error?: string;
      createdCount?: number;
    }>(response);

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

  function openVariantUpdateModal(variant: Variant) {
    setUpdatingVariant(variant);
    setUpdateSellingPriceInput(String(variant.sellingPrice));
    setUpdateSellingPriceError(null);
    setIsUpdateModalOpen(true);
  }

  function closeVariantUpdateModal() {
    setIsUpdateModalOpen(false);
    setUpdatingVariant(null);
    setUpdateSellingPriceInput("");
    setUpdateSellingPriceError(null);
  }

  async function requestVariantUpdate() {
    if (!updatingVariant) {
      return;
    }

    const nextSellingPrice = Number(updateSellingPriceInput);

    if (!Number.isFinite(nextSellingPrice) || nextSellingPrice < 0) {
      setUpdateSellingPriceError("Enter a valid selling price.");
      return;
    }

    const response = await fetch("/api/variants", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variantId: updatingVariant.id,
        sellingPrice: nextSellingPrice,
      }),
    });

    const payload = await readJsonResponse<{ error?: string; status?: string }>(
      response,
    );

    if (!response.ok) {
      toast.error(payload?.error ?? "Variant update request failed.");
      return;
    }

    closeVariantUpdateModal();

    if (payload?.status === "updated") {
      toast.success("Variant updated.");
    } else {
      toast.success("Variant update request submitted for partner review.");
    }

    await loadData();
  }

  async function reviewUpdateVariant(
    variantId: string,
    decision: "approved" | "rejected",
  ) {
    const response = await fetch("/api/variants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestType: "update", variantId, decision }),
    });

    const payload = await readJsonResponse<{ error?: string; status?: string }>(
      response,
    );

    if (!response.ok) {
      toast.error(payload?.error ?? "Variant update review failed.");
      return;
    }

    if (payload?.status === "approved") {
      toast.success("Variant update approved and applied.");
    } else if (payload?.status === "rejected") {
      toast.success("Variant update rejected.");
    } else {
      toast.success("Variant update review recorded.");
    }

    await loadData();
  }

  const productStartIndex =
    productPagination.total === 0
      ? 0
      : (currentProductPage - 1) * productPagination.pageSize + 1;
  const productEndIndex =
    productPagination.total === 0
      ? 0
      : Math.min(
          currentProductPage * productPagination.pageSize,
          productPagination.total,
        );
  const variantStartIndex =
    variantPagination.total === 0
      ? 0
      : (currentVariantPage - 1) * variantPagination.pageSize + 1;
  const variantEndIndex =
    variantPagination.total === 0
      ? 0
      : Math.min(
          currentVariantPage * variantPagination.pageSize,
          variantPagination.total,
        );

  return (
    <div className="space-y-6">
      <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <h2 className="text-2xl font-semibold tracking-tight">
          Product catalog
        </h2>
        <p className="mt-3 text-sm leading-7 text-(--text-secondary)">
          Create products and add color variants with multiple sizes in one
          action.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            Create product
          </h3>

          <div className="mt-4 space-y-4">
            <Popover
              open={openField === "product-name"}
              onOpenChange={(open) => {
                setOpenField(open ? "product-name" : null);
                if (open) {
                  setProductNameSearch("");
                }
              }}
            >
              <label className="mb-1 block text-sm text-(--text-secondary)">
                Product name
              </label>
              <PopoverTrigger asChild>
                <button
                  className="field flex items-center justify-between"
                  type="button"
                >
                  <span>{productForm.name.trim() || "Product name"}</span>
                  <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command>
                  <CommandInput
                    placeholder="Search or enter product name..."
                    value={productNameSearch}
                    onValueChange={(value) => {
                      setProductNameSearch(value);
                    }}
                  />
                  <CommandList>
                    <CommandEmpty>
                      Type a new product name or pick one below.
                    </CommandEmpty>
                    <CommandGroup>
                      {productNameSearch.trim() &&
                      !nameSuggestions.some(
                        (name) => name === productNameSearch.trim(),
                      ) ? (
                        <CommandItem
                          value={productNameSearch}
                          onSelect={() => {
                            setProductForm((current) => ({
                              ...current,
                              name: productNameSearch.trim(),
                            }));
                            setProductErrors((current) => ({
                              ...current,
                              name: undefined,
                            }));
                            setOpenField(null);
                          }}
                        >
                          Use &quot;{productNameSearch.trim()}&quot;
                        </CommandItem>
                      ) : null}
                      {nameSuggestions.map((name) => (
                        <CommandItem
                          key={name}
                          value={name}
                          data-checked={
                            productForm.name === name ? "true" : undefined
                          }
                          onSelect={() => {
                            setProductForm((current) => ({
                              ...current,
                              name,
                            }));
                            setProductErrors((current) => ({
                              ...current,
                              name: undefined,
                            }));
                            setOpenField(null);
                          }}
                        >
                          {name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
              {productErrors.name ? (
                <p className="mt-2 text-sm text-red-600">
                  {productErrors.name}
                </p>
              ) : null}
            </Popover>

            <Popover
              open={openField === "product-category"}
              onOpenChange={(open) => {
                setOpenField(open ? "product-category" : null);
                if (open) {
                  setProductCategorySearch("");
                }
              }}
            >
              <label className="mb-1 block text-sm text-(--text-secondary)">
                Category
              </label>
              <PopoverTrigger asChild>
                <button
                  className="field flex items-center justify-between"
                  type="button"
                >
                  <span>{productForm.category.trim() || "Category"}</span>
                  <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command>
                  <CommandInput
                    placeholder="Search or enter category..."
                    value={productCategorySearch}
                    onValueChange={(value) => {
                      setProductCategorySearch(value);
                    }}
                  />
                  <CommandList>
                    <CommandEmpty>
                      Type a new category or pick one below.
                    </CommandEmpty>
                    <CommandGroup>
                      {productCategorySearch.trim() &&
                      !categorySuggestions.some(
                        (category) => category === productCategorySearch.trim(),
                      ) ? (
                        <CommandItem
                          value={productCategorySearch}
                          onSelect={() => {
                            setProductForm((current) => ({
                              ...current,
                              category: productCategorySearch.trim(),
                            }));
                            setProductErrors((current) => ({
                              ...current,
                              category: undefined,
                            }));
                            setOpenField(null);
                          }}
                        >
                          Use &quot;{productCategorySearch.trim()}&quot;
                        </CommandItem>
                      ) : null}
                      {categorySuggestions.map((category) => (
                        <CommandItem
                          key={category}
                          value={category}
                          data-checked={
                            productForm.category === category
                              ? "true"
                              : undefined
                          }
                          onSelect={() => {
                            setProductForm((current) => ({
                              ...current,
                              category,
                            }));
                            setProductErrors((current) => ({
                              ...current,
                              category: undefined,
                            }));
                            setOpenField(null);
                          }}
                        >
                          {category}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
              {productErrors.category ? (
                <p className="mt-2 text-sm text-red-600">
                  {productErrors.category}
                </p>
              ) : null}
            </Popover>

            <div>
              <label className="mb-1 block text-sm text-(--text-secondary)">
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

        <section className="relative rounded-[1.8rem] bg-(--surface-accent) p-6 text-white lg:mt-4">
          <h3 className="text-xl font-semibold tracking-tight">
            Create variant
          </h3>

          {isLoading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[1.8rem] bg-black/15 backdrop-blur-[1px]">
              <Spinner className="text-white" label="Loading catalog data..." />
            </div>
          ) : null}

          <div className="mt-4 space-y-4">
            <label className="mb-1 block text-sm text-white/80">Product</label>
            <Popover
              open={openField === "variant-product"}
              onOpenChange={(open) =>
                setOpenField(open ? "variant-product" : null)
              }
            >
              <PopoverTrigger asChild>
                <button
                  className="field flex items-center justify-between text-foreground"
                  type="button"
                >
                  <span>
                    {variantForm.productId
                      ? (products.find(
                          (product) => product.id === variantForm.productId,
                        )?.name ?? "Pick product")
                      : "Pick product"}
                  </span>
                  <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Search product..." />
                  <CommandList>
                    <CommandEmpty>No product found.</CommandEmpty>
                    <CommandGroup>
                      {products.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={`${product.name} ${product.category}`}
                          data-checked={
                            variantForm.productId === product.id
                              ? "true"
                              : undefined
                          }
                          onSelect={() => {
                            setVariantForm((current) => ({
                              ...current,
                              productId: product.id,
                              color: "",
                            }));
                            setVariantErrors((current) => ({
                              ...current,
                              productId: undefined,
                              color: undefined,
                            }));
                            setOpenField(null);
                          }}
                        >
                          {product.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {variantErrors.productId ? (
              <p className="mt-2 text-sm text-red-200">
                {variantErrors.productId}
              </p>
            ) : null}

            <Popover
              open={openField === "variant-color"}
              onOpenChange={(open) => {
                setOpenField(open ? "variant-color" : null);
                if (open) {
                  setVariantColorSearch("");
                }
              }}
            >
              <label className="mb-1 block text-sm text-white/80">Color</label>
              <PopoverTrigger asChild>
                <button
                  className="field flex items-center justify-between text-foreground"
                  type="button"
                >
                  <span>{variantForm.color.trim() || "Color"}</span>
                  <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command>
                  <CommandInput
                    placeholder="Search or enter color..."
                    value={variantColorSearch}
                    onValueChange={(value) => {
                      setVariantColorSearch(value);
                    }}
                  />
                  <CommandList>
                    <CommandEmpty>
                      Type a new color or pick one below.
                    </CommandEmpty>
                    <CommandGroup>
                      {variantColorSearch.trim() &&
                      !colorSuggestions.some(
                        (color) => color === variantColorSearch.trim(),
                      ) ? (
                        <CommandItem
                          value={variantColorSearch}
                          onSelect={() => {
                            setVariantForm((current) => ({
                              ...current,
                              color: variantColorSearch.trim(),
                            }));
                            setVariantErrors((current) => ({
                              ...current,
                              color: undefined,
                            }));
                            setOpenField(null);
                          }}
                        >
                          Use &quot;{variantColorSearch.trim()}&quot;
                        </CommandItem>
                      ) : null}
                      {colorSuggestions.map((color) => (
                        <CommandItem
                          key={color}
                          value={color}
                          data-checked={
                            variantForm.color === color ? "true" : undefined
                          }
                          onSelect={() => {
                            setVariantForm((current) => ({
                              ...current,
                              color,
                            }));
                            setVariantErrors((current) => ({
                              ...current,
                              color: undefined,
                            }));
                            setOpenField(null);
                          }}
                        >
                          {color}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
              {variantErrors.color ? (
                <p className="mt-2 text-sm text-red-200">
                  {variantErrors.color}
                </p>
              ) : null}
            </Popover>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-white/80">
                  Sizes (comma separated)
                </label>
                <input
                  className="field text-foreground"
                  placeholder="S, M, L"
                  value={variantForm.sizesText}
                  onChange={(event) => {
                    setVariantForm((current) => ({
                      ...current,
                      sizesText: event.target.value,
                    }));
                    setVariantErrors((current) => ({
                      ...current,
                      sizes: undefined,
                    }));
                  }}
                />
                {variantErrors.sizes ? (
                  <p className="mt-2 text-sm text-red-200">
                    {variantErrors.sizes}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/80">
                  Selling price
                </label>
                <input
                  className="field text-foreground"
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
                  <p className="mt-2 text-sm text-red-200">
                    {variantErrors.sellingPrice}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <button
            className="btn-secondary mt-3 w-full sm:w-auto"
            disabled={isLoading}
            onClick={submitVariant}
            type="button"
          >
            Create variant
          </button>
        </section>
      </div>

      <section className="relative space-y-6 rounded-[1.8rem] bg-white/80 p-4 ring-1 ring-(--stroke-soft) sm:p-6">
        {isLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[1.8rem] bg-white/70 backdrop-blur-[1px]">
            <Spinner label="Loading catalog records..." />
          </div>
        ) : null}

        <div className="space-y-3">
          <h3 className="text-xl font-semibold tracking-tight">
            Catalog records
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-2xl bg-(--surface-accent-soft) p-1">
              <button
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeListTab === "products"
                    ? "bg-(--surface-accent) text-white"
                    : "text-(--text-secondary)"
                }`}
                onClick={() => setActiveListTab("products")}
                type="button"
              >
                Products
              </button>
              <button
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeListTab === "variants"
                    ? "bg-(--surface-accent) text-white"
                    : "text-(--text-secondary)"
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
              <div className="grid gap-3 rounded-2xl border border-(--stroke-soft) p-4 sm:grid-cols-2">
                <input
                  className="field sm:col-span-2"
                  placeholder="Search by name, category, or description"
                  value={productFilterText}
                  onChange={(event) => {
                    setProductFilterText(event.target.value);
                    setProductPage(1);
                  }}
                />
                <Popover
                  open={openField === "product-filter-category"}
                  onOpenChange={(open) =>
                    setOpenField(open ? "product-filter-category" : null)
                  }
                >
                  <PopoverTrigger asChild>
                    <button
                      className="field flex items-center justify-between"
                      type="button"
                    >
                      <span>
                        {productFilterCategory === "all"
                          ? "All categories"
                          : productFilterCategory}
                      </span>
                      <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Search category..." />
                      <CommandList>
                        <CommandEmpty>No category found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="All categories"
                            data-checked={
                              productFilterCategory === "all"
                                ? "true"
                                : undefined
                            }
                            onSelect={() => {
                              setProductFilterCategory("all");
                              setProductPage(1);
                              setOpenField(null);
                            }}
                          >
                            All categories
                          </CommandItem>
                          {productCategoryOptions.map((category) => (
                            <CommandItem
                              key={category}
                              value={category}
                              data-checked={
                                productFilterCategory === category
                                  ? "true"
                                  : undefined
                              }
                              onSelect={() => {
                                setProductFilterCategory(category);
                                setProductPage(1);
                                setOpenField(null);
                              }}
                            >
                              {category}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Popover
                  open={openField === "product-filter-stock"}
                  onOpenChange={(open) =>
                    setOpenField(open ? "product-filter-stock" : null)
                  }
                >
                  <PopoverTrigger asChild>
                    <button
                      className="field flex items-center justify-between"
                      type="button"
                    >
                      <span>
                        {stockFilterOptions.find(
                          (option) => option.value === productFilterStock,
                        )?.label ?? "All stock states"}
                      </span>
                      <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Search stock state..." />
                      <CommandList>
                        <CommandEmpty>No stock option found.</CommandEmpty>
                        <CommandGroup>
                          {stockFilterOptions.map((option) => (
                            <CommandItem
                              key={option.value}
                              value={option.label}
                              data-checked={
                                productFilterStock === option.value
                                  ? "true"
                                  : undefined
                              }
                              onSelect={() => {
                                setProductFilterStock(option.value);
                                setProductPage(1);
                                setOpenField(null);
                              }}
                            >
                              {option.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Popover
                  open={openField === "product-filter-delete"}
                  onOpenChange={(open) =>
                    setOpenField(open ? "product-filter-delete" : null)
                  }
                >
                  <PopoverTrigger asChild>
                    <button
                      className="field sm:col-span-2 flex items-center justify-between"
                      type="button"
                    >
                      <span>
                        {deleteStatusOptions.find(
                          (option) =>
                            option.value === productFilterDeleteStatus,
                        )?.label ?? "All delete states"}
                      </span>
                      <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Search delete status..." />
                      <CommandList>
                        <CommandEmpty>No status found.</CommandEmpty>
                        <CommandGroup>
                          {deleteStatusOptions.map((option) => (
                            <CommandItem
                              key={option.value}
                              value={option.label}
                              data-checked={
                                productFilterDeleteStatus === option.value
                                  ? "true"
                                  : undefined
                              }
                              onSelect={() => {
                                setProductFilterDeleteStatus(option.value);
                                setProductPage(1);
                                setOpenField(null);
                              }}
                            >
                              {option.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            ) : null}

            {productPagination.total === 0 ? (
              <p className="rounded-2xl border border-dashed border-(--stroke-soft) p-6 text-center text-sm text-(--text-secondary)">
                No products matched your filters.
              </p>
            ) : (
              <>
                <div className="grid gap-3 md:hidden">
                  {paginatedProducts.map((product) => {
                    const stock = productStockById.get(product.id) ?? 0;
                    const deleteRequest = product.deleteRequest;
                    const isDeletePending = deleteRequest?.status === "pending";
                    const showProductRequestButton = !isDeletePending;

                    return (
                      <article
                        key={product.id}
                        className="rounded-2xl border border-(--stroke-soft) bg-white/90 p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-foreground">
                              {product.name}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.08em] text-(--text-secondary)">
                              {product.category}
                            </p>
                          </div>
                          <span className="rounded-full bg-(--surface-accent-soft) px-2 py-1 text-xs font-semibold text-(--text-secondary)">
                            Stock {stock}
                          </span>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-(--text-secondary)">
                          {product.description?.trim() || "No description"}
                        </p>

                        <div className="mt-3">
                          {deleteRequest?.status &&
                          deleteRequest.status !== "none" ? (
                            <div className="inline-block rounded-full bg-(--surface-accent-soft) px-2 py-1">
                              <span className="text-xs uppercase tracking-widest font-semibold text-(--text-secondary)">
                                {deleteRequest.status} (
                                {deleteRequest.approvalCount}/
                                {deleteRequest.requiredApprovalCount})
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-(--text-secondary)">
                              No request
                            </span>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {showProductRequestButton ? (
                            <button
                              className="btn-secondary w-full"
                              disabled={stock > 0}
                              title={
                                stock > 0
                                  ? "Can only delete when stock is 0"
                                  : ""
                              }
                              onClick={() => void deleteProduct(product.id)}
                              type="button"
                            >
                              Delete
                            </button>
                          ) : deleteRequest?.canReview ? (
                            <>
                              <button
                                className="btn-primary flex-1"
                                onClick={() =>
                                  void reviewDeleteProduct(
                                    product.id,
                                    "approved",
                                  )
                                }
                                type="button"
                              >
                                Approve
                              </button>
                              <button
                                className="btn-secondary flex-1"
                                onClick={() =>
                                  void reviewDeleteProduct(
                                    product.id,
                                    "rejected",
                                  )
                                }
                                type="button"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-(--text-secondary)">
                              Pending
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="hidden overflow-hidden rounded-2xl border border-(--stroke-soft) md:block">
                  <Table>
                    <TableHeader className="bg-(--surface-accent-soft)">
                      <TableRow className="hover:bg-(--surface-accent-soft)">
                        <TableHead className="font-semibold">
                          Product Name
                        </TableHead>
                        <TableHead className="font-semibold">
                          Category
                        </TableHead>
                        <TableHead className="font-semibold">
                          Description
                        </TableHead>
                        <TableHead className="text-center font-semibold">
                          Stock
                        </TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="text-center font-semibold">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedProducts.map((product) => {
                        const stock = productStockById.get(product.id) ?? 0;
                        const deleteRequest = product.deleteRequest;
                        const isDeletePending =
                          deleteRequest?.status === "pending";
                        const showProductRequestButton = !isDeletePending;

                        return (
                          <TableRow
                            key={product.id}
                            className="hover:bg-(--surface-accent-soft)/50"
                          >
                            <TableCell className="font-medium text-foreground">
                              {product.name}
                            </TableCell>
                            <TableCell className="text-(--text-secondary)">
                              {product.category}
                            </TableCell>
                            <TableCell
                              className="max-w-xs truncate text-(--text-secondary)"
                              title={product.description?.trim()}
                            >
                              {product.description?.trim() || "â€”"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className="min-w-12 justify-center border-slate-200 bg-slate-50 text-slate-700"
                              >
                                {stock}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {deleteRequest?.status &&
                              deleteRequest.status !== "none" ? (
                                <Badge
                                  variant="outline"
                                  className={getRequestBadgeClassName(
                                    deleteRequest.status,
                                  )}
                                >
                                  {deleteRequest.status} (
                                  {deleteRequest.approvalCount}/
                                  {deleteRequest.requiredApprovalCount})
                                </Badge>
                              ) : (
                                <span className="text-xs text-(--text-secondary)">
                                  â€”
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {showProductRequestButton ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={stock > 0}
                                  title={
                                    stock > 0
                                      ? "Can only delete when stock is 0"
                                      : ""
                                  }
                                  onClick={() => void deleteProduct(product.id)}
                                  type="button"
                                >
                                  Delete
                                </Button>
                              ) : deleteRequest?.canReview ? (
                                <div className="flex gap-1 justify-center flex-wrap">
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      void reviewDeleteProduct(
                                        product.id,
                                        "approved",
                                      )
                                    }
                                    type="button"
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      void reviewDeleteProduct(
                                        product.id,
                                        "rejected",
                                      )
                                    }
                                    type="button"
                                  >
                                    Reject
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-(--text-secondary)">
                                  Pending
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--stroke-soft) px-4 py-3 text-sm text-(--text-secondary)">
              <p>
                {productPagination.total === 0
                  ? "No products"
                  : `Showing ${productStartIndex}-${productEndIndex} of ${productPagination.total}`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="btn-secondary"
                  disabled={currentProductPage === 1}
                  onClick={() =>
                    setProductPage((current) => Math.max(current - 1, 1))
                  }
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
                    setProductPage((current) =>
                      Math.min(current + 1, totalProductPages),
                    )
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
              <div className="grid gap-3 rounded-2xl border border-(--stroke-soft) p-4 sm:grid-cols-2">
                <input
                  className="field sm:col-span-2"
                  placeholder="Search by SKU, product, color, or size"
                  value={variantFilterText}
                  onChange={(event) => {
                    setVariantFilterText(event.target.value);
                    setVariantPage(1);
                  }}
                />
                <Popover
                  open={openField === "variant-filter-product"}
                  onOpenChange={(open) =>
                    setOpenField(open ? "variant-filter-product" : null)
                  }
                >
                  <PopoverTrigger asChild>
                    <button
                      className="field flex items-center justify-between"
                      type="button"
                    >
                      <span>
                        {variantFilterProductId === "all"
                          ? "All products"
                          : (products.find(
                              (product) =>
                                product.id === variantFilterProductId,
                            )?.name ?? "All products")}
                      </span>
                      <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Search product..." />
                      <CommandList>
                        <CommandEmpty>No product found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="All products"
                            data-checked={
                              variantFilterProductId === "all"
                                ? "true"
                                : undefined
                            }
                            onSelect={() => {
                              setVariantFilterProductId("all");
                              setVariantPage(1);
                              setOpenField(null);
                            }}
                          >
                            All products
                          </CommandItem>
                          {products.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={`${product.name} ${product.category}`}
                              data-checked={
                                variantFilterProductId === product.id
                                  ? "true"
                                  : undefined
                              }
                              onSelect={() => {
                                setVariantFilterProductId(product.id);
                                setVariantPage(1);
                                setOpenField(null);
                              }}
                            >
                              {product.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Popover
                  open={openField === "variant-filter-stock"}
                  onOpenChange={(open) =>
                    setOpenField(open ? "variant-filter-stock" : null)
                  }
                >
                  <PopoverTrigger asChild>
                    <button
                      className="field flex items-center justify-between"
                      type="button"
                    >
                      <span>
                        {stockFilterOptions.find(
                          (option) => option.value === variantFilterStock,
                        )?.label ?? "All stock states"}
                      </span>
                      <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Search stock state..." />
                      <CommandList>
                        <CommandEmpty>No stock option found.</CommandEmpty>
                        <CommandGroup>
                          {stockFilterOptions.map((option) => (
                            <CommandItem
                              key={option.value}
                              value={option.label}
                              data-checked={
                                variantFilterStock === option.value
                                  ? "true"
                                  : undefined
                              }
                              onSelect={() => {
                                setVariantFilterStock(option.value);
                                setVariantPage(1);
                                setOpenField(null);
                              }}
                            >
                              {option.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Popover
                  open={openField === "variant-filter-delete"}
                  onOpenChange={(open) =>
                    setOpenField(open ? "variant-filter-delete" : null)
                  }
                >
                  <PopoverTrigger asChild>
                    <button
                      className="field sm:col-span-2 flex items-center justify-between"
                      type="button"
                    >
                      <span>
                        {deleteStatusOptions.find(
                          (option) =>
                            option.value === variantFilterDeleteStatus,
                        )?.label ?? "All delete states"}
                      </span>
                      <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Search delete status..." />
                      <CommandList>
                        <CommandEmpty>No status found.</CommandEmpty>
                        <CommandGroup>
                          {deleteStatusOptions.map((option) => (
                            <CommandItem
                              key={option.value}
                              value={option.label}
                              data-checked={
                                variantFilterDeleteStatus === option.value
                                  ? "true"
                                  : undefined
                              }
                              onSelect={() => {
                                setVariantFilterDeleteStatus(option.value);
                                setVariantPage(1);
                                setOpenField(null);
                              }}
                            >
                              {option.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            ) : null}

            {variantPagination.total === 0 ? (
              <p className="rounded-2xl border border-dashed border-(--stroke-soft) p-6 text-center text-sm text-(--text-secondary)">
                No live variants matched your filters.
              </p>
            ) : (
              <>
                <div className="grid gap-3 md:hidden">
                  {paginatedVariants.map((variant) => {
                    const productName =
                      productNameById.get(variant.productId) ??
                      "Unknown product";
                    const deleteRequest = variant.deleteRequest;
                    const updateRequest = variant.updateRequest;
                    const isDeletePending = deleteRequest?.status === "pending";
                    const isUpdatePending =
                      updateRequest?.status === "pending" ||
                      (updateRequest?.status === "none" &&
                        Boolean(updateRequest.requestedById));
                    const showVariantRequestButton = !isDeletePending;

                    return (
                      <article
                        key={variant.id}
                        className="rounded-2xl border border-(--stroke-soft) bg-white/90 p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {variant.sku}
                            </p>
                            <p className="mt-1 text-xs text-(--text-secondary)">
                              {productName}
                            </p>
                          </div>
                          <span className="rounded-full bg-(--surface-accent-soft) px-2 py-1 text-xs font-semibold text-(--text-secondary)">
                            Stock {variant.stockQty}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <p className="text-(--text-secondary)">
                            Color:{" "}
                            <span className="font-medium text-foreground">
                              {variant.color}
                            </span>
                          </p>
                          <p className="text-(--text-secondary)">
                            Size:{" "}
                            <span className="font-medium text-foreground">
                              {variant.size}
                            </span>
                          </p>
                          <p className="col-span-2 text-(--text-secondary)">
                            Price:{" "}
                            <span className="font-semibold text-foreground">
                              {currency(variant.sellingPrice)}
                            </span>
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {updateRequest?.status &&
                          updateRequest.status !== "none" ? (
                            <span className="rounded-full bg-(--surface-accent-soft) px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-(--text-secondary)">
                              update {updateRequest.status} (
                              {updateRequest.approvalCount}/
                              {updateRequest.requiredApprovalCount})
                            </span>
                          ) : null}
                          {deleteRequest?.status &&
                          deleteRequest.status !== "none" ? (
                            <span className="rounded-full bg-(--surface-accent-soft) px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-(--text-secondary)">
                              delete {deleteRequest.status} (
                              {deleteRequest.approvalCount}/
                              {deleteRequest.requiredApprovalCount})
                            </span>
                          ) : null}
                          {(!updateRequest?.status ||
                            updateRequest.status === "none") &&
                          (!deleteRequest?.status ||
                            deleteRequest.status === "none") ? (
                            <span className="text-xs text-(--text-secondary)">
                              No request
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {isUpdatePending ? (
                            updateRequest?.canReview ? (
                              <>
                                <button
                                  className="btn-primary flex-1"
                                  onClick={() =>
                                    void reviewUpdateVariant(
                                      variant.id,
                                      "approved",
                                    )
                                  }
                                  type="button"
                                >
                                  Approve update
                                </button>
                                <button
                                  className="btn-secondary flex-1"
                                  onClick={() =>
                                    void reviewUpdateVariant(
                                      variant.id,
                                      "rejected",
                                    )
                                  }
                                  type="button"
                                >
                                  Reject update
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-(--text-secondary)">
                                Update pending
                              </span>
                            )
                          ) : (
                            <button
                              className="btn-secondary w-full"
                              onClick={() => openVariantUpdateModal(variant)}
                              type="button"
                            >
                              Request update
                            </button>
                          )}

                          {showVariantRequestButton ? (
                            <button
                              className="btn-secondary w-full"
                              disabled={variant.stockQty > 0}
                              title={
                                variant.stockQty > 0
                                  ? "Can only delete when stock is 0"
                                  : ""
                              }
                              onClick={() => void deleteVariant(variant.id)}
                              type="button"
                            >
                              Delete
                            </button>
                          ) : deleteRequest?.canReview ? (
                            <>
                              <button
                                className="btn-primary flex-1"
                                onClick={() =>
                                  void reviewDeleteVariant(
                                    variant.id,
                                    "approved",
                                  )
                                }
                                type="button"
                              >
                                Approve delete
                              </button>
                              <button
                                className="btn-secondary flex-1"
                                onClick={() =>
                                  void reviewDeleteVariant(
                                    variant.id,
                                    "rejected",
                                  )
                                }
                                type="button"
                              >
                                Reject delete
                              </button>
                            </>
                          ) : isDeletePending ? (
                            <span className="text-xs text-(--text-secondary)">
                              Delete pending
                            </span>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="hidden overflow-hidden rounded-2xl border border-(--stroke-soft) md:block">
                  <Table>
                    <TableHeader className="bg-(--surface-accent-soft)">
                      <TableRow className="hover:bg-(--surface-accent-soft)">
                        <TableHead className="font-semibold">SKU</TableHead>
                        <TableHead className="font-semibold">Product</TableHead>
                        <TableHead className="font-semibold">Color</TableHead>
                        <TableHead className="font-semibold">Size</TableHead>
                        <TableHead className="text-center font-semibold">
                          Stock
                        </TableHead>
                        <TableHead className="text-right font-semibold">
                          Selling Price
                        </TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="text-center font-semibold">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedVariants.map((variant) => {
                        const productName =
                          productNameById.get(variant.productId) ??
                          "Unknown product";
                        const deleteRequest = variant.deleteRequest;
                        const updateRequest = variant.updateRequest;
                        const isDeletePending =
                          deleteRequest?.status === "pending";
                        const isUpdatePending =
                          updateRequest?.status === "pending" ||
                          (updateRequest?.status === "none" &&
                            Boolean(updateRequest.requestedById));
                        const showVariantRequestButton = !isDeletePending;

                        return (
                          <TableRow
                            key={variant.id}
                            className="hover:bg-(--surface-accent-soft)/50"
                          >
                            <TableCell className="font-medium text-foreground">
                              {variant.sku}
                            </TableCell>
                            <TableCell className="text-(--text-secondary)">
                              {productName}
                            </TableCell>
                            <TableCell className="text-(--text-secondary)">
                              {variant.color}
                            </TableCell>
                            <TableCell className="text-(--text-secondary)">
                              {variant.size}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className="min-w-12 justify-center border-slate-200 bg-slate-50 text-slate-700"
                              >
                                {variant.stockQty}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium text-foreground">
                              {currency(variant.sellingPrice)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {updateRequest?.status &&
                                updateRequest.status !== "none" ? (
                                  <Badge
                                    variant="outline"
                                    className={getRequestBadgeClassName(
                                      updateRequest.status,
                                    )}
                                  >
                                    update {updateRequest.status} (
                                    {updateRequest.approvalCount}/
                                    {updateRequest.requiredApprovalCount})
                                  </Badge>
                                ) : null}
                                {deleteRequest?.status &&
                                deleteRequest.status !== "none" ? (
                                  <Badge
                                    variant="outline"
                                    className={getRequestBadgeClassName(
                                      deleteRequest.status,
                                    )}
                                  >
                                    delete {deleteRequest.status} (
                                    {deleteRequest.approvalCount}/
                                    {deleteRequest.requiredApprovalCount})
                                  </Badge>
                                ) : null}
                                {(!updateRequest?.status ||
                                  updateRequest.status === "none") &&
                                (!deleteRequest?.status ||
                                  deleteRequest.status === "none") ? (
                                  <span className="text-xs text-(--text-secondary)">
                                    â€”
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-2">
                                {isUpdatePending ? (
                                  updateRequest?.canReview ? (
                                    <div className="flex gap-1 justify-center flex-wrap">
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          void reviewUpdateVariant(
                                            variant.id,
                                            "approved",
                                          )
                                        }
                                        type="button"
                                      >
                                        Approve update
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          void reviewUpdateVariant(
                                            variant.id,
                                            "rejected",
                                          )
                                        }
                                        type="button"
                                      >
                                        Reject update
                                      </Button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-(--text-secondary)">
                                      Update pending
                                    </span>
                                  )
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      openVariantUpdateModal(variant)
                                    }
                                    type="button"
                                  >
                                    Request update
                                  </Button>
                                )}

                                {showVariantRequestButton ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={variant.stockQty > 0}
                                    title={
                                      variant.stockQty > 0
                                        ? "Can only delete when stock is 0"
                                        : ""
                                    }
                                    onClick={() =>
                                      void deleteVariant(variant.id)
                                    }
                                    type="button"
                                  >
                                    Delete
                                  </Button>
                                ) : deleteRequest?.canReview ? (
                                  <div className="flex gap-1 justify-center flex-wrap">
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        void reviewDeleteVariant(
                                          variant.id,
                                          "approved",
                                        )
                                      }
                                      type="button"
                                    >
                                      Approve delete
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        void reviewDeleteVariant(
                                          variant.id,
                                          "rejected",
                                        )
                                      }
                                      type="button"
                                    >
                                      Reject delete
                                    </Button>
                                  </div>
                                ) : isDeletePending ? (
                                  <span className="text-xs text-(--text-secondary)">
                                    Delete pending
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--stroke-soft) px-4 py-3 text-sm text-(--text-secondary)">
              <p>
                {variantPagination.total === 0
                  ? "No variants"
                  : `Showing ${variantStartIndex}-${variantEndIndex} of ${variantPagination.total}`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="btn-secondary"
                  disabled={currentVariantPage === 1}
                  onClick={() =>
                    setVariantPage((current) => Math.max(current - 1, 1))
                  }
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
                    setVariantPage((current) =>
                      Math.min(current + 1, totalVariantPages),
                    )
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

      <Dialog
        open={isUpdateModalOpen && Boolean(updatingVariant)}
        onOpenChange={(open) => {
          if (!open) {
            closeVariantUpdateModal();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request variant update</DialogTitle>
            <DialogDescription>
              {updatingVariant
                ? `${updatingVariant.sku} - ${updatingVariant.color} / ${updatingVariant.size}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="block text-sm text-(--text-secondary)">
              New selling price
            </label>
            <input
              className="field"
              type="number"
              min={0}
              value={updateSellingPriceInput}
              onChange={(event) => {
                setUpdateSellingPriceInput(event.target.value);
                setUpdateSellingPriceError(null);
              }}
            />
            {updateSellingPriceError ? (
              <p className="text-sm text-red-600">{updateSellingPriceError}</p>
            ) : null}
          </div>

          <DialogFooter className="mt-2 border-none bg-transparent p-0">
            <button
              className="btn-secondary"
              onClick={closeVariantUpdateModal}
              type="button"
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => void requestVariantUpdate()}
              type="button"
            >
              Submit update request
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
