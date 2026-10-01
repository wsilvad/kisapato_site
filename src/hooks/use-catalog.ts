import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fallbackCategories, fallbackProducts, type Category, type Product } from "@/lib/catalog";

export function useProducts(includeInactive = false) {
  return useQuery({
    queryKey: ["products", includeInactive],
    queryFn: async () => {
      let query = supabase.from("products").select("*, categories(name, slug), product_images(url, is_primary, sort_order)").order("created_at");
      if (!includeInactive) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      return await Promise.all((data ?? []).map(async (item) => {
        const category = item.categories as { name: string; slug: string } | null;
        const images = (item.product_images as Array<{ url: string; is_primary: boolean; sort_order: number }> | null) ?? [];
        const image = [...images].sort((a,b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
        let image_url: string | undefined;
        if (image?.url) {
          const { data: signed } = await supabase.storage.from("catalog-images").createSignedUrl(image.url, 3600);
          image_url = signed?.signedUrl;
        }
        return { ...item, category_name: category?.name, category_slug: category?.slug, ...(image_url ? { image_url } : {}) } as Product;
      }));
    },
    initialData: fallbackProducts,
  });
}

export function useCategories(includeInactive = false) {
  return useQuery({
    queryKey: ["categories", includeInactive],
    queryFn: async () => {
      let query = supabase.from("categories").select("*").order("sort_order");
      if (!includeInactive) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Category[];
    },
    initialData: fallbackCategories,
  });
}