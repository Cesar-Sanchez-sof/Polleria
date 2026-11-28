-- Datos ficticios en español para los casos del benchmark de 2026.
-- Ejecutar solo en una base de desarrollo/pruebas. El script es transaccional e idempotente.
-- Requiere al menos un empleado activo y un usuario activo relacionado con un empleado.

BEGIN;

DO $seed$
DECLARE
    v_month integer;
    v_month_start date;
    v_employee_id integer;
    v_user_id integer;
    v_supplier_id integer;
    v_customer_id integer;
    v_cash_register_id integer;
    v_cash_session_id integer;
    v_cash_payment_id integer;
    v_card_payment_id integer;
    v_raw_product_id integer;
    v_food_product_id integer;
    v_table_id integer;
    v_takeout_order_id integer;
    v_table_order_id integer;
    v_purchase_order_id integer;
    v_pending_order_id integer;
    v_purchase_item_id integer;
    v_sales_item_id integer;
    v_invoice_id integer;
    v_transformation_id integer;
    v_consumed_item_id integer;
    v_produced_item_id integer;
    v_period_id integer;
    v_entry_id integer;
    v_unbalanced_entry_id integer;
    v_asset_account_id integer;
    v_liability_account_id integer;
    v_revenue_account_id integer;
    v_account_code varchar(10);
BEGIN
    SELECT id INTO v_employee_id
    FROM employee
    WHERE active = true
    ORDER BY id
    LIMIT 1;

    SELECT id INTO v_user_id
    FROM app_user
    WHERE active = true
    ORDER BY id
    LIMIT 1;

    IF v_employee_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION
            'Se necesita al menos un empleado activo y un usuario activo. Ejecuta primero los datos iniciales del sistema.';
    END IF;

    INSERT INTO supplier (ruc, business_name, contact_person, address, phone, email, active)
    VALUES ('20999999991', 'Avícola Buen Sabor de Prueba', 'Rosa Huamán', 'Mercado Central, Lima', '900111222', 'ventas@avicolaprueba.pe', true)
    ON CONFLICT (ruc) DO NOTHING;
    SELECT id INTO v_supplier_id FROM supplier WHERE ruc = '20999999991';

    INSERT INTO customer (document_number, first_name, last_name, phone, person_type, active)
    VALUES ('99999991', 'Cliente', 'de Prueba', '900111223', 'Natural', true)
    ON CONFLICT (person_type, document_number) DO NOTHING;
    SELECT id INTO v_customer_id
    FROM customer
    WHERE person_type = 'Natural' AND document_number = '99999991';

    INSERT INTO payment_type (name, active)
    SELECT 'Efectivo', true
    WHERE NOT EXISTS (SELECT 1 FROM payment_type WHERE name = 'Efectivo');
    INSERT INTO payment_type (name, active)
    SELECT 'Tarjeta', true
    WHERE NOT EXISTS (SELECT 1 FROM payment_type WHERE name = 'Tarjeta');
    SELECT id INTO v_cash_payment_id FROM payment_type WHERE name = 'Efectivo' ORDER BY id LIMIT 1;
    SELECT id INTO v_card_payment_id FROM payment_type WHERE name = 'Tarjeta' ORDER BY id LIMIT 1;

    INSERT INTO cash_register (name, code, description, active)
    VALUES ('Caja de Prueba', 'BENCH-CAJA-26', 'Caja ficticia para el benchmark', true)
    ON CONFLICT (code) DO NOTHING;
    SELECT id INTO v_cash_register_id FROM cash_register WHERE code = 'BENCH-CAJA-26';

    INSERT INTO dining_table (number, capacity, active)
    VALUES (99, 4, true)
    ON CONFLICT (number) DO NOTHING;
    SELECT id INTO v_table_id FROM dining_table WHERE number = 99;

    INSERT INTO product (
        name, description, type, affectation_igv, unit_of_measure, current_stock,
        minimum_stock, last_cost, average_cost, price, sellable, active
    )
    SELECT 'Pollo entero de prueba', 'Producto ficticio para evaluar ventas e inventario.',
           'RawMaterial', 'Excluded', 'unidad', 500, 20, 12, 12, NULL, false, true
    WHERE NOT EXISTS (SELECT 1 FROM product WHERE name = 'Pollo entero de prueba');
    SELECT id INTO v_raw_product_id FROM product WHERE name = 'Pollo entero de prueba' ORDER BY id LIMIT 1;

    INSERT INTO product (
        name, description, type, affectation_igv, unit_of_measure, current_stock,
        minimum_stock, last_cost, average_cost, price, sellable, active
    )
    SELECT 'Pollo a la brasa de prueba', 'Plato ficticio para evaluar pedidos y ventas.',
           'FinishedProduct', 'Included', 'unidad', 300, 10, 25, 25, 55, true, true
    WHERE NOT EXISTS (SELECT 1 FROM product WHERE name = 'Pollo a la brasa de prueba');
    SELECT id INTO v_food_product_id FROM product WHERE name = 'Pollo a la brasa de prueba' ORDER BY id LIMIT 1;

    INSERT INTO accounting_account (code, name, type, active)
    VALUES
        ('201001', 'Obligaciones de prueba', 'Pasivo', true),
        ('401001', 'Ventas de prueba', 'Ingreso', true)
    ON CONFLICT (code) DO NOTHING;

    SELECT id INTO v_liability_account_id FROM accounting_account WHERE code = '201001';
    SELECT id INTO v_revenue_account_id FROM accounting_account WHERE code = '401001';

    FOR v_month IN 1..10 LOOP
        v_month_start := make_date(2026, v_month, 1);
        v_account_code := v_month::text || '09001';

        INSERT INTO accounting_account (code, name, type, active)
        VALUES (
            v_account_code,
            'Cuenta de activo de prueba del mes ' || v_month,
            'Activo',
            true
        )
        ON CONFLICT (code) DO NOTHING;
        SELECT id INTO v_asset_account_id
        FROM accounting_account
        WHERE code = v_account_code;

        SELECT id INTO v_cash_session_id
        FROM cash_session
        WHERE notes_opening = 'BENCH26-' || lpad(v_month::text, 2, '0')
        LIMIT 1;

        IF v_cash_session_id IS NULL THEN
            INSERT INTO cash_session (
                cash_register_id, opened_by_id, closed_by_id, opened_at, closed_at,
                initial_amount, sales_cash, sales_other, total_sales, expected_amount,
                counted_amount, difference, status, notes_opening, notes_closing
            )
            VALUES (
                v_cash_register_id, v_user_id, v_user_id,
                v_month_start + interval '1 day',
                v_month_start + interval '28 days',
                300, 850, 420, 1270, 1150, 1145, -5, 'CLOSED',
                'BENCH26-' || lpad(v_month::text, 2, '0'),
                'Cierre ficticio de prueba'
            )
            RETURNING id INTO v_cash_session_id;
        END IF;

        INSERT INTO cash_movement (session_id, type, amount, reason, created_at)
        SELECT v_cash_session_id, 'INCOME', 120, 'BENCH26 ingreso por venta ficticia', v_month_start + interval '10 days'
        WHERE NOT EXISTS (
            SELECT 1 FROM cash_movement
            WHERE session_id = v_cash_session_id AND reason = 'BENCH26 ingreso por venta ficticia'
        );
        INSERT INTO cash_movement (session_id, type, amount, reason, created_at)
        SELECT v_cash_session_id, 'EXPENSE', 45, 'BENCH26 compra de insumos ficticia', v_month_start + interval '12 days'
        WHERE NOT EXISTS (
            SELECT 1 FROM cash_movement
            WHERE session_id = v_cash_session_id AND reason = 'BENCH26 compra de insumos ficticia'
        );

        INSERT INTO sales_order (code, order_type, ordered_at, status)
        VALUES (
            'BENCH26-' || lpad(v_month::text, 2, '0') || '-M',
            'Mesa', v_month_start + interval '5 days', 'Closed'
        )
        ON CONFLICT (code) DO NOTHING;
        SELECT id INTO v_table_order_id
        FROM sales_order
        WHERE code = 'BENCH26-' || lpad(v_month::text, 2, '0') || '-M';

        INSERT INTO sales_order (code, order_type, ordered_at, status)
        VALUES (
            'BENCH26-' || lpad(v_month::text, 2, '0') || '-L',
            'Llevar', v_month_start + interval '8 days', 'Closed'
        )
        ON CONFLICT (code) DO NOTHING;
        SELECT id INTO v_takeout_order_id
        FROM sales_order
        WHERE code = 'BENCH26-' || lpad(v_month::text, 2, '0') || '-L';

        INSERT INTO order_table (table_id, order_id, notes)
        SELECT v_table_id, v_table_order_id, 'Pedido ficticio del benchmark'
        WHERE NOT EXISTS (
            SELECT 1 FROM order_table
            WHERE table_id = v_table_id AND order_id = v_table_order_id
        );

        INSERT INTO order_item (order_id, product_id, quantity, unit_price, subtotal, dish_status, notes)
        SELECT v_table_order_id, v_food_product_id, 2, 55, 110, 'Served', 'Pedido ficticio del benchmark'
        WHERE NOT EXISTS (
            SELECT 1 FROM order_item
            WHERE order_id = v_table_order_id AND product_id = v_food_product_id
        );
        SELECT id INTO v_sales_item_id
        FROM order_item
        WHERE order_id = v_table_order_id AND product_id = v_food_product_id
        ORDER BY id LIMIT 1;

        INSERT INTO order_item (order_id, product_id, quantity, unit_price, subtotal, dish_status, notes)
        SELECT v_takeout_order_id, v_food_product_id, 1, 55, 55, 'Served', 'Pedido para llevar ficticio'
        WHERE NOT EXISTS (
            SELECT 1 FROM order_item
            WHERE order_id = v_takeout_order_id AND product_id = v_food_product_id
        );

        INSERT INTO sales_invoice (
            order_id, customer_id, voucher_type, series, number, issued_at, subtotal,
            igv, total_amount, status, cash_session_id
        )
        VALUES (
            v_table_order_id, v_customer_id, 'Boleta', 'B026', 990000 + v_month,
            v_month_start + 5, 93.22, 16.78, 110, 'Issued', v_cash_session_id
        )
        ON CONFLICT (voucher_type, series, number) DO NOTHING;
        SELECT id INTO v_invoice_id
        FROM sales_invoice
        WHERE voucher_type = 'Boleta' AND series = 'B026' AND number = 990000 + v_month;

        INSERT INTO sales_payment (sales_invoice_id, payment_type_id, amount, paid_at)
        SELECT v_invoice_id, v_cash_payment_id, 70, v_month_start + interval '5 days'
        WHERE NOT EXISTS (
            SELECT 1 FROM sales_payment
            WHERE sales_invoice_id = v_invoice_id AND payment_type_id = v_cash_payment_id
        );
        INSERT INTO sales_payment (sales_invoice_id, payment_type_id, amount, paid_at)
        SELECT v_invoice_id, v_card_payment_id, 40, v_month_start + interval '5 days'
        WHERE NOT EXISTS (
            SELECT 1 FROM sales_payment
            WHERE sales_invoice_id = v_invoice_id AND payment_type_id = v_card_payment_id
        );

        INSERT INTO sales_invoice (
            order_id, customer_id, voucher_type, series, number, issued_at, subtotal,
            igv, total_amount, status, cash_session_id
        )
        VALUES (
            v_takeout_order_id, v_customer_id, 'Factura', 'F026', 980000 + v_month,
            v_month_start + 8, 46.61, 8.39, 55, 'Issued', v_cash_session_id
        )
        ON CONFLICT (voucher_type, series, number) DO NOTHING;
        SELECT id INTO v_invoice_id
        FROM sales_invoice
        WHERE voucher_type = 'Factura' AND series = 'F026' AND number = 980000 + v_month;

        INSERT INTO sales_payment (sales_invoice_id, payment_type_id, amount, paid_at)
        SELECT v_invoice_id, v_card_payment_id, 55, v_month_start + interval '8 days'
        WHERE NOT EXISTS (
            SELECT 1 FROM sales_payment
            WHERE sales_invoice_id = v_invoice_id AND payment_type_id = v_card_payment_id
        );

        INSERT INTO purchase_order (
            supplier_id, employee_id, received_by_id, order_number, issued_at, expected_at,
            received_at, status, subtotal, igv, total, notes
        )
        VALUES (
            v_supplier_id, v_employee_id, v_employee_id,
            'BENCH26-' || lpad(v_month::text, 2, '0') || '-A',
            v_month_start + 3, v_month_start + 8, v_month_start + interval '8 days',
            'FullyReceived', 200, 36, 236, 'Compra ficticia del benchmark'
        )
        ON CONFLICT (order_number) DO NOTHING;
        SELECT id INTO v_purchase_order_id
        FROM purchase_order
        WHERE order_number = 'BENCH26-' || lpad(v_month::text, 2, '0') || '-A';

        INSERT INTO purchase_order (
            supplier_id, employee_id, received_by_id, order_number, issued_at, expected_at,
            received_at, status, subtotal, igv, total, notes
        )
        VALUES (
            v_supplier_id, v_employee_id, NULL,
            'BENCH26-' || lpad(v_month::text, 2, '0') || '-B',
            v_month_start + 15, v_month_start + 22, v_month_start + interval '22 days',
            'Pending', 80, 14.4, 94.4, 'Orden pendiente ficticia del benchmark'
        )
        ON CONFLICT (order_number) DO NOTHING;
        SELECT id INTO v_pending_order_id
        FROM purchase_order
        WHERE order_number = 'BENCH26-' || lpad(v_month::text, 2, '0') || '-B';

        INSERT INTO purchase_order_item (
            purchase_order_id, product_id, quantity_ordered, quantity_received, unit_price,
            affectation_igv_applied, subtotal_line, igv_line, final_amount_line, observation
        )
        SELECT v_purchase_order_id, v_raw_product_id, 20, 20, 10,
               'Excluded', 200, 36, 236, 'Insumo de prueba recibido'
        WHERE NOT EXISTS (
            SELECT 1 FROM purchase_order_item
            WHERE purchase_order_id = v_purchase_order_id AND product_id = v_raw_product_id
        );
        SELECT id INTO v_purchase_item_id
        FROM purchase_order_item
        WHERE purchase_order_id = v_purchase_order_id AND product_id = v_raw_product_id
        ORDER BY id LIMIT 1;

        INSERT INTO purchase_order_item (
            purchase_order_id, product_id, quantity_ordered, quantity_received, unit_price,
            affectation_igv_applied, subtotal_line, igv_line, final_amount_line, observation
        )
        SELECT v_pending_order_id, v_raw_product_id, 8, NULL, 10,
               'Excluded', 80, 14.4, 94.4, 'Insumo pendiente de recepción'
        WHERE NOT EXISTS (
            SELECT 1 FROM purchase_order_item
            WHERE purchase_order_id = v_pending_order_id AND product_id = v_raw_product_id
        );

        INSERT INTO purchase_invoice (
            supplier_id, purchase_order_id, voucher_type, series, number, issued_at,
            subtotal, igv, total_amount, active
        )
        VALUES (
            v_supplier_id, v_purchase_order_id, 'Factura', 'F026', 990000 + v_month,
            v_month_start + 3, 200, 36, 236, true
        )
        ON CONFLICT (supplier_id, voucher_type, series, number) DO NOTHING;
        SELECT id INTO v_invoice_id
        FROM purchase_invoice
        WHERE supplier_id = v_supplier_id AND voucher_type = 'Factura'
          AND series = 'F026' AND number = 990000 + v_month;

        INSERT INTO purchase_payment (purchase_invoice_id, payment_type_id, amount, paid_at)
        SELECT v_invoice_id, v_cash_payment_id, 100, v_month_start + interval '9 days'
        WHERE NOT EXISTS (
            SELECT 1 FROM purchase_payment
            WHERE purchase_invoice_id = v_invoice_id AND payment_type_id = v_cash_payment_id
        );

        INSERT INTO informal_purchase (
            product_id, employee_id, purchase_type, expense_category, item_description,
            quantity, amount_paid, date, informal_place_or_vendor, reason, annulled
        )
        SELECT NULL, v_employee_id, 'OperatingExpense', 'CleaningSupplies',
               'Detergente y artículos de limpieza', 1, 38, v_month_start + 11,
               'Bodega del barrio', 'Compra ficticia para pruebas', false
        WHERE NOT EXISTS (
            SELECT 1 FROM informal_purchase
            WHERE employee_id = v_employee_id
              AND item_description = 'Detergente y artículos de limpieza'
              AND date = v_month_start + 11
        );

        INSERT INTO inventory_movement (
            product_id, purchase_order_item_id, movement_type, quantity, unit_cost, reason, moved_at
        )
        SELECT v_raw_product_id, v_purchase_item_id, 'Purchase', 20, 10,
               'Compra de prueba del benchmark', v_month_start + interval '8 days'
        WHERE NOT EXISTS (
            SELECT 1 FROM inventory_movement
            WHERE purchase_order_item_id = v_purchase_item_id AND movement_type = 'Purchase'
        );

        INSERT INTO inventory_movement (
            product_id, order_item_id, movement_type, quantity, unit_cost, reason, moved_at
        )
        SELECT v_food_product_id, v_sales_item_id, 'Sale', 2, 25,
               'Venta de prueba del benchmark', v_month_start + interval '5 days'
        WHERE NOT EXISTS (
            SELECT 1 FROM inventory_movement
            WHERE order_item_id = v_sales_item_id AND movement_type = 'Sale'
        );
        INSERT INTO inventory_movement (product_id, movement_type, quantity, unit_cost, reason, moved_at)
        SELECT v_raw_product_id, 'Shrinkage', 1, 10, 'Merma de prueba del benchmark', v_month_start + interval '14 days'
        WHERE NOT EXISTS (
            SELECT 1 FROM inventory_movement
            WHERE product_id = v_raw_product_id AND movement_type = 'Shrinkage'
              AND reason = 'Merma de prueba del benchmark' AND moved_at::date = v_month_start + 14
        );
        INSERT INTO inventory_movement (product_id, movement_type, quantity, unit_cost, reason, moved_at)
        SELECT v_raw_product_id, 'Adjustment', 3, 10, 'Ajuste de prueba del benchmark', v_month_start + interval '16 days'
        WHERE NOT EXISTS (
            SELECT 1 FROM inventory_movement
            WHERE product_id = v_raw_product_id AND movement_type = 'Adjustment'
              AND reason = 'Ajuste de prueba del benchmark' AND moved_at::date = v_month_start + 16
        );

        SELECT id INTO v_transformation_id
        FROM transformation
        WHERE notes = 'BENCH26 transformación ' || lpad(v_month::text, 2, '0')
        LIMIT 1;
        IF v_transformation_id IS NULL THEN
            INSERT INTO transformation (employee_id, date, notes, annulled)
            VALUES (
                v_employee_id, v_month_start + interval '18 days',
                'BENCH26 transformación ' || lpad(v_month::text, 2, '0'), false
            )
            RETURNING id INTO v_transformation_id;
        END IF;

        INSERT INTO transformation_item (transformation_id, product_id, item_type, quantity, unit_cost)
        SELECT v_transformation_id, v_raw_product_id, 'Consumo', 5, 10
        WHERE NOT EXISTS (
            SELECT 1 FROM transformation_item
            WHERE transformation_id = v_transformation_id AND product_id = v_raw_product_id
              AND item_type = 'Consumo'
        )
        RETURNING id INTO v_consumed_item_id;
        IF v_consumed_item_id IS NULL THEN
            SELECT id INTO v_consumed_item_id FROM transformation_item
            WHERE transformation_id = v_transformation_id AND product_id = v_raw_product_id
              AND item_type = 'Consumo' ORDER BY id LIMIT 1;
        END IF;

        INSERT INTO transformation_item (transformation_id, product_id, item_type, quantity, unit_cost)
        SELECT v_transformation_id, v_food_product_id, 'Producido', 2, 25
        WHERE NOT EXISTS (
            SELECT 1 FROM transformation_item
            WHERE transformation_id = v_transformation_id AND product_id = v_food_product_id
              AND item_type = 'Producido'
        )
        RETURNING id INTO v_produced_item_id;
        IF v_produced_item_id IS NULL THEN
            SELECT id INTO v_produced_item_id FROM transformation_item
            WHERE transformation_id = v_transformation_id AND product_id = v_food_product_id
              AND item_type = 'Producido' ORDER BY id LIMIT 1;
        END IF;

        INSERT INTO accounting_period (start_date, end_date, status)
        SELECT v_month_start + 14, v_month_start + 19, 'OPEN'
        WHERE NOT EXISTS (
            SELECT 1 FROM accounting_period
            WHERE start_date = v_month_start + 14 AND end_date = v_month_start + 19
              AND status = 'OPEN'
        );
        SELECT id INTO v_period_id
        FROM accounting_period
        WHERE start_date = v_month_start + 14 AND end_date = v_month_start + 19
          AND status = 'OPEN'
        ORDER BY id LIMIT 1;

        INSERT INTO journal_entry (
            entry_date, period_id, description, book, responsible, status, code, observation
        )
        VALUES (
            v_month_start + 20, v_period_id, 'Asiento equilibrado ficticio de prueba',
            'Diario de prueba', 'Equipo de pruebas', true,
            'BENCH26-' || lpad(v_month::text, 2, '0') || '-01', 'Datos ficticios del benchmark'
        )
        ON CONFLICT (code) DO NOTHING;
        SELECT id INTO v_entry_id FROM journal_entry
        WHERE code = 'BENCH26-' || lpad(v_month::text, 2, '0') || '-01';

        INSERT INTO journal_entry_detail (entry_id, account_id, description, debit, credit)
        SELECT v_entry_id, v_asset_account_id, 'Ingreso ficticio en caja', 100, 0
        WHERE NOT EXISTS (
            SELECT 1 FROM journal_entry_detail
            WHERE entry_id = v_entry_id AND account_id = v_asset_account_id
        );
        INSERT INTO journal_entry_detail (entry_id, account_id, description, debit, credit)
        SELECT v_entry_id, v_revenue_account_id, 'Venta ficticia', 0, 100
        WHERE NOT EXISTS (
            SELECT 1 FROM journal_entry_detail
            WHERE entry_id = v_entry_id AND account_id = v_revenue_account_id
        );

        INSERT INTO journal_entry (
            entry_date, period_id, description, book, responsible, status, code, observation
        )
        VALUES (
            v_month_start + 22, v_period_id, 'Asiento descuadrado ficticio de prueba',
            'Diario de prueba', 'Equipo de pruebas', true,
            'BENCH26-' || lpad(v_month::text, 2, '0') || '-02',
            'Descuadre intencional para probar el caso de control'
        )
        ON CONFLICT (code) DO NOTHING;
        SELECT id INTO v_unbalanced_entry_id FROM journal_entry
        WHERE code = 'BENCH26-' || lpad(v_month::text, 2, '0') || '-02';

        INSERT INTO journal_entry_detail (entry_id, account_id, description, debit, credit)
        SELECT v_unbalanced_entry_id, v_asset_account_id, 'Debe ficticio', 100, 0
        WHERE NOT EXISTS (
            SELECT 1 FROM journal_entry_detail
            WHERE entry_id = v_unbalanced_entry_id AND account_id = v_asset_account_id
        );
        INSERT INTO journal_entry_detail (entry_id, account_id, description, debit, credit)
        SELECT v_unbalanced_entry_id, v_liability_account_id, 'Haber ficticio', 0, 80
        WHERE NOT EXISTS (
            SELECT 1 FROM journal_entry_detail
            WHERE entry_id = v_unbalanced_entry_id AND account_id = v_liability_account_id
        );
    END LOOP;
END
$seed$;

COMMIT;
