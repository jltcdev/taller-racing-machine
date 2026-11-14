CREATE SEQUENCE public.work_order_numbers START 981;
GRANT USAGE ON SEQUENCE public.work_order_numbers TO authenticated;
GRANT ALL ON SEQUENCE public.work_order_numbers TO service_role;
CREATE TABLE public.work_orders (
 user_id uuid NOT NULL DEFAULT auth.uid(),
 number text NOT NULL DEFAULT lpad(nextval('public.work_order_numbers')::text,4,'0'),
 data jsonb NOT NULL,
 version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,number)
);
GRANT SELECT,INSERT,UPDATE ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_orders_read ON public.work_orders FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY own_orders_insert ON public.work_orders FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY own_orders_update ON public.work_orders FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE TABLE public.order_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 order_number text NOT NULL,
 action text NOT NULL,
 details text[] NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,order_number) REFERENCES public.work_orders(user_id,number)
);
GRANT SELECT ON public.order_history TO authenticated;
GRANT ALL ON public.order_history TO service_role;
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_history_read ON public.order_history FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE INDEX order_history_lookup ON public.order_history(user_id,order_number,created_at DESC);
CREATE FUNCTION public.trace_order_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changes text[] := '{}'; k text; label text;
BEGIN
 IF TG_OP='UPDATE' THEN
  FOREACH k IN ARRAY ARRAY['owner','bike','technician','report','inspection','accessories','items'] LOOP
   IF OLD.data->k IS DISTINCT FROM NEW.data->k THEN
    label := CASE k WHEN 'owner' THEN 'Datos del cliente' WHEN 'bike' THEN 'Datos de la motocicleta' WHEN 'technician' THEN 'Técnico encargado' WHEN 'report' THEN 'Reporte del cliente' WHEN 'inspection' THEN 'Novedades de ingreso' WHEN 'accessories' THEN 'Inventario al recibir' ELSE 'Repuestos y servicios' END;
    changes := array_append(changes,label);
   END IF;
  END LOOP;
  NEW.version := OLD.version+1;
 ELSE changes := ARRAY['Ingreso de la orden']; END IF;
 NEW.updated_at := now();
 INSERT INTO public.order_history(user_id,order_number,action,details) VALUES(NEW.user_id,NEW.number,CASE WHEN TG_OP='INSERT' THEN 'Orden creada' ELSE 'Orden actualizada' END,changes);
 RETURN NEW;
END $$;
CREATE TRIGGER trace_work_order AFTER INSERT OR UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.trace_order_change();
CREATE FUNCTION public.save_work_order(p_data jsonb,p_number text DEFAULT NULL,p_version integer DEFAULT NULL) RETURNS public.work_orders LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE result public.work_orders;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión para guardar'; END IF;
 IF p_number IS NULL THEN
  INSERT INTO public.work_orders(data) VALUES(p_data) RETURNING * INTO result;
 ELSE
  SELECT * INTO result FROM public.work_orders WHERE user_id=auth.uid() AND number=p_number FOR UPDATE;
  IF FOUND THEN
   IF p_version IS DISTINCT FROM result.version THEN RAISE EXCEPTION 'La orden cambió en otro dispositivo. Recarga antes de guardar.'; END IF;
   UPDATE public.work_orders SET data=p_data,version=version+1,updated_at=now() WHERE user_id=auth.uid() AND number=p_number RETURNING * INTO result;
  ELSE
   INSERT INTO public.work_orders(number,data) VALUES(p_number,p_data) RETURNING * INTO result;
  END IF;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_work_order(jsonb,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_work_order(jsonb,text,integer) TO authenticated;
CREATE FUNCTION public.record_order_pdf(p_number text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.work_orders WHERE user_id=auth.uid() AND number=p_number) THEN RAISE EXCEPTION 'Orden no disponible'; END IF;
 INSERT INTO public.order_history(user_id,order_number,action,details) VALUES(auth.uid(),p_number,'PDF generado',ARRAY['Archivo preparado para descarga']);
END $$;
REVOKE ALL ON FUNCTION public.record_order_pdf(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_order_pdf(text) TO authenticated;
REVOKE ALL ON FUNCTION public.trace_order_change() FROM PUBLIC,anon,authenticated;