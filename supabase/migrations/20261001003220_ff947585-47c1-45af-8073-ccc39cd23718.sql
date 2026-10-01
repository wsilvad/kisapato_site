CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.product_badge AS ENUM ('Lançamento', 'Promoção', 'Destaque');

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text,
  avatar_url text,
  phone text,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users create own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'Categoria',
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public views active categories" ON public.categories FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  care_instructions text,
  brand text,
  gender text NOT NULL,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  compare_at_price numeric(12,2),
  badge public.product_badge,
  reference text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public views active products" ON public.products FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku text NOT NULL UNIQUE,
  size integer NOT NULL,
  color text NOT NULL,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public views variants" ON public.product_variants FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (p.is_active OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Admins manage variants" ON public.product_variants FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt_text text,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public views product images" ON public.product_images FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (p.is_active OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Admins manage product images" ON public.product_images FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eyebrow text,
  title text NOT NULL,
  body text,
  button_label text,
  button_url text,
  desktop_image_url text,
  mobile_image_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campaigns TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public views active campaigns" ON public.campaigns FOR SELECT TO anon, authenticated USING ((is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now())) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage campaigns" ON public.campaigns FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.showcases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  selection_rule text NOT NULL DEFAULT 'Destaque',
  item_limit integer NOT NULL DEFAULT 4 CHECK (item_limit BETWEEN 1 AND 24),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.showcases TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.showcases TO authenticated;
GRANT ALL ON public.showcases TO service_role;
ALTER TABLE public.showcases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public views active showcases" ON public.showcases FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage showcases" ON public.showcases FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER variants_updated BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER campaigns_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER showcases_updated BEFORE UPDATE ON public.showcases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.categories (name, slug, kind, sort_order) VALUES
('Feminino','feminino','Gênero',1),('Masculino','masculino','Gênero',2),('Infantil','infantil','Gênero',3),
('Tênis','tenis','Categoria',4),('Sandálias','sandalias','Categoria',5),('Sapatos','sapatos','Categoria',6),
('Botas','botas','Categoria',7),('Rasteiras e chinelos','rasteiras-e-chinelos','Categoria',8),('Bolsas e acessórios','bolsas-e-acessorios','Categoria',9);

INSERT INTO public.products (category_id,name,slug,description,care_instructions,brand,gender,price,compare_at_price,badge,reference) VALUES
((SELECT id FROM public.categories WHERE slug='sapatos'),'Mule couro trançado','mule-couro-trancado','Mule elegante em couro com trama artesanal.','Limpar com pano macio e seco.','Marca A','Feminino',289.90,NULL,'Lançamento','KS-1001'),
((SELECT id FROM public.categories WHERE slug='tenis'),'Tênis casual couro branco','tenis-casual-couro-branco','Tênis casual em couro, leve e versátil.','Limpar com pano úmido.','Marca B','Masculino',349.90,NULL,'Lançamento','KS-1002'),
((SELECT id FROM public.categories WHERE slug='sandalias'),'Sandália infantil velcro','sandalia-infantil-velcro','Sandália confortável com fechamento seguro.','Lavar à mão e secar à sombra.','Marca C','Infantil',129.90,NULL,'Lançamento','KS-1003'),
((SELECT id FROM public.categories WHERE slug='sapatos'),'Scarpin salto bloco','scarpin-salto-bloco','Scarpin de bico fino com salto bloco confortável.','Guardar em local arejado.','Marca D','Feminino',219.90,279.90,'Promoção','KS-1004'),
((SELECT id FROM public.categories WHERE slug='sapatos'),'Sapato social oxford','sapato-social-oxford','Oxford clássico em couro legítimo.','Usar produtos específicos para couro.','Marca B','Masculino',459.90,NULL,'Destaque','KS-1005'),
((SELECT id FROM public.categories WHERE slug='rasteiras-e-chinelos'),'Rasteira tiras finas','rasteira-tiras-finas','Rasteira delicada para dias leves.','Limpar com pano macio.','Marca E','Feminino',99.90,139.90,'Promoção','KS-1006'),
((SELECT id FROM public.categories WHERE slug='tenis'),'Tênis infantil luz de LED','tenis-infantil-luz-de-led','Tênis infantil divertido com luzes na sola.','Não mergulhar em água.','Marca C','Infantil',189.90,NULL,'Destaque','KS-1007'),
((SELECT id FROM public.categories WHERE slug='botas'),'Bota cano curto camurça','bota-cano-curto-camurca','Bota de cano curto com acabamento macio.','Escovar suavemente a camurça.','Marca A','Feminino',399.90,NULL,'Lançamento','KS-1008'),
((SELECT id FROM public.categories WHERE slug='sapatos'),'Mocassim couro legítimo','mocassim-couro-legitimo','Mocassim em couro de construção flexível.','Usar hidratante para couro.','Marca F','Masculino',319.90,389.90,'Promoção','KS-1009'),
((SELECT id FROM public.categories WHERE slug='tenis'),'Tênis esportivo corrida','tenis-esportivo-corrida','Amortecimento responsivo para corrida diária.','Secar à sombra.','Marca C','Masculino',379.90,NULL,'Destaque','KS-1010'),
((SELECT id FROM public.categories WHERE slug='sapatos'),'Sapatilha infantil laço','sapatilha-infantil-laco','Sapatilha delicada com laço frontal.','Limpar com pano úmido.','Marca E','Infantil',89.90,NULL,NULL,'KS-1011'),
((SELECT id FROM public.categories WHERE slug='sandalias'),'Sandália salto fino','sandalia-salto-fino','Sandália sofisticada para ocasiões especiais.','Guardar na embalagem.','Marca D','Feminino',259.90,NULL,'Lançamento','KS-1012'),
((SELECT id FROM public.categories WHERE slug='bolsas-e-acessorios'),'Bolsa estruturada clássica','bolsa-estruturada-classica','Bolsa estruturada com alça removível.','Guardar preenchida em local seco.','Marca A','Feminino',329.90,NULL,'Destaque','KS-1013'),
((SELECT id FROM public.categories WHERE slug='bolsas-e-acessorios'),'Carteira masculina couro','carteira-masculina-couro','Carteira compacta em couro legítimo.','Limpar com pano seco.','Marca F','Masculino',149.90,NULL,'Lançamento','KS-1014');

INSERT INTO public.product_variants (product_id,sku,size,color,stock)
SELECT p.id, p.reference || '-' || s || '-' || c, s, c, CASE WHEN (s % 4)=0 THEN 0 ELSE 6 END
FROM public.products p
CROSS JOIN LATERAL unnest(CASE WHEN p.gender='Feminino' THEN ARRAY[34,35,36,37,38,39] WHEN p.gender='Masculino' THEN ARRAY[38,39,40,41,42,43,44] ELSE ARRAY[28,29,30,31,32,33,34] END) s
CROSS JOIN LATERAL unnest(ARRAY[CASE WHEN p.gender='Masculino' THEN 'Preto' ELSE 'Caramelo' END,'Branco']) c;

INSERT INTO public.campaigns (eyebrow,title,body,button_label,button_url,sort_order) VALUES ('NOVA COLEÇÃO · PRIMAVERA','Passos que combinam com você','Calçados para toda a família, das marcas que você confia, com retirada grátis na loja.','VER LANÇAMENTOS','/produtos?ordem=mais-recentes',1);
INSERT INTO public.showcases (title,selection_rule,item_limit,sort_order) VALUES ('Lançamentos','Lançamento',4,1),('Destaques','Destaque',4,2);

CREATE INDEX products_category_idx ON public.products(category_id);
CREATE INDEX variants_product_idx ON public.product_variants(product_id);
CREATE INDEX images_product_idx ON public.product_images(product_id);