-- =====================================================================
-- SCRIPT SQL DE POBLACIÓN INICIAL - POLLERÍA ERP
-- Ejecutar en el SQL Editor de Neon PostgreSQL (https://console.neon.tech)
-- =====================================================================

-- 1. CLIENTE GENÉRICO (Para ventas en caja y tickets sin DNI obligatorio)
INSERT INTO cliente (nro_doc, nombre, apellido, telefono, tipo_persona, estado)
VALUES ('00000000', 'CLIENTES VARIOS', '', '000000000', 'Natural', true)
ON CONFLICT (tipo_persona, nro_doc) DO NOTHING;

-- 2. TIPOS DE PAGO DISPONIBLES EN CAJA Y MOZO
INSERT INTO tipo_pago (nombre, estado) VALUES
('Efectivo', true),
('Yape', true),
('Plin', true),
('Tarjeta / POS', true),
('Transferencia', true)
ON CONFLICT DO NOTHING;

-- 3. MESAS DEL SALÓN (12 mesas con diferentes capacidades)
INSERT INTO mesa (numero, aforo, estado) VALUES
(1, 2, true),
(2, 2, true),
(3, 4, true),
(4, 4, true),
(5, 4, true),
(6, 4, true),
(7, 6, true),
(8, 6, true),
(9, 6, true),
(10, 8, true),
(11, 8, true),
(12, 10, true)
ON CONFLICT (numero) DO UPDATE SET estado = true, aforo = EXCLUDED.aforo;

-- 4. CARTA COMPLETA DE PLATOS Y BEBIDAS
INSERT INTO plato (nombre, descripcion, precio, estado) VALUES
('1/4 Pollo a la Brasa', '1/4 de pollo a la brasa tradicional con papas fritas crocantes, ensalada clásica y cremas caseras.', 21.90, true),
('1/2 Pollo a la Brasa', '1/2 pollo a la brasa jugoso con papas fritas familiares, ensalada y cremas.', 39.90, true),
('1 Pollo a la Brasa Entero', '1 pollo entero a la brasa con porción familiar de papas fritas, ensalada grande y cremas surtidas.', 72.90, true),
('Mostrito Brasa Clásico', '1/4 de pollo a la brasa acompañado de arroz chaufa al wok, papas fritas y cremas.', 24.90, true),
('Mostrito Especial', '1/4 de pollo a la brasa + chaufa especial + papas + huevo frito montado y plátano frito.', 27.50, true),
('Porción de Papas Fritas', 'Papas amarillas crocantes seleccionadas con sal marina.', 12.00, true),
('Tequeños Brasa (8 unidades)', 'Tequeños rellenos de pollo a la brasa y queso, con crema de palta artesanal.', 16.00, true),
('Porción de Arroz Chaufa de Pollo', 'Arroz chaufa salteado al wok con trozos de pollo, cebolla china y sillao.', 14.00, true),
('Ensalada Clásica Familiar', 'Lechuga orgánica fresca, rodajas de tomate, pepino, palta y vinagreta clásica.', 10.00, true),
('Inca Kola 1.5L', 'Gaseosa Inca Kola en botella no retornable.', 10.00, true),
('Coca Cola 1.5L', 'Gaseosa Coca Cola en botella no retornable.', 10.00, true),
('Jarra de Chicha Morada 1L', 'Chicha morada casera preparada con maíz morado, piña, manzana y canela.', 12.00, true),
('Jarra de Maracuyá 1L', 'Refresco natural de maracuyá helada.', 12.00, true),
('Agua Mineral 600ml', 'Agua mineral sin gas personal.', 4.00, true)
ON CONFLICT DO NOTHING;
