CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

ALTER POLICY "Public views active categories" ON public.categories USING (is_active OR private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Admins manage categories" ON public.categories USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Public views active products" ON public.products USING (is_active OR private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Admins manage products" ON public.products USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Public views variants" ON public.product_variants USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (p.is_active OR private.has_role(auth.uid(), 'admin'))));
ALTER POLICY "Admins manage variants" ON public.product_variants USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Public views product images" ON public.product_images USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (p.is_active OR private.has_role(auth.uid(), 'admin'))));
ALTER POLICY "Admins manage product images" ON public.product_images USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Public views active campaigns" ON public.campaigns USING ((is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now())) OR private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Admins manage campaigns" ON public.campaigns USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Public views active showcases" ON public.showcases USING (is_active OR private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Admins manage showcases" ON public.showcases USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.has_role(uuid, public.app_role);