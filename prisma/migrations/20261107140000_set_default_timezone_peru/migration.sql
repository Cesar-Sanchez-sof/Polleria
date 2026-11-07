-- Configura la zona horaria predeterminada de la base de datos a Trujillo, La Libertad, Perú (America/Lima, UTC-5)
-- Esto asegura que todas las funciones de base de datos como now(), CURRENT_TIMESTAMP y los valores por defecto se resuelvan en la hora peruana.
DO $$
BEGIN
  BEGIN
    ALTER DATABASE CURRENT SET timezone TO 'America/Lima';
  EXCEPTION WHEN OTHERS THEN
    -- En entornos donde ALTER DATABASE no esté disponible por permisos del usuario
    NULL;
  END;
END $$;

SET timezone TO 'America/Lima';
