"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

export default function LoginPage() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usuario, password }),
      });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      const datos = await res.json().catch(() => ({}));
      setError(datos.error ?? "Credenciales inválidas. Verifique su usuario y contraseña.");
    } catch {
      setError("No se pudo conectar con el servidor. Intente nuevamente.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen w-full m-0 p-0 flex flex-col lg:grid lg:grid-cols-12 bg-background text-foreground font-sans selection:bg-red-700 selection:text-white transition-colors">
      {/* =================================================================== */}
      {/* COLUMNA IZQUIERDA: 100% PRIVADA - SOLO LOGO Y PLATILLO DE LOS BETOS */}
      {/* =================================================================== */}
      <section className="hidden lg:flex lg:col-span-6 xl:col-span-6 2xl:col-span-5 flex-col justify-between p-8 xl:p-14 bg-gradient-to-b from-zinc-950 via-zinc-900 to-neutral-950 text-white relative overflow-hidden border-r border-zinc-800">
        {/* Resplandores cálidos de fondo */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-0 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Encabezado sutil superior */}
        <div className="relative z-10 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400/80">
            Punto de Venta & Operaciones
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Sistema en Línea
          </span>
        </div>

        {/* Centro de Marca: Logo Oficial con su Platillo Emblemático */}
        <div className="relative z-10 my-auto py-8 flex flex-col items-center text-center space-y-6">
          <div className="w-60 h-60 xl:w-72 xl:h-72 rounded-3xl bg-white p-4 shadow-2xl shadow-black/60 ring-4 ring-white/10 flex items-center justify-center transition-transform hover:scale-[1.02] duration-300">
            <img
              src="/Los_Betos_Logo.jpg"
              alt="Pollería Los Betos"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="space-y-2 max-w-sm">
            <h1 className="text-3xl xl:text-4xl font-black text-white uppercase tracking-wider leading-none">
              Los Betos
            </h1>
            <p className="text-sm font-bold text-amber-400 uppercase tracking-widest">
              Pollería & Brasas
            </p>
            <p className="text-xs text-zinc-400 font-medium pt-1">
              Tradición, sabor y excelencia gastronómica
            </p>
          </div>
        </div>

        {/* Pie de página Izquierdo: Información Institucional Mínima */}
        <div className="relative z-10 pt-4 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
          <span>Pollería Los Betos &copy; {new Date().getFullYear()}</span>
          <span className="inline-flex items-center gap-1 text-zinc-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Acceso Privado & Seguro
          </span>
        </div>
      </section>

      {/* =================================================================== */}
      {/* COLUMNA DERECHA: FORMULARIO DE ACCESO (100% LIMPIO Y PRIVADO)      */}
      {/* =================================================================== */}
      <section className="flex-1 lg:col-span-6 xl:col-span-6 2xl:col-span-7 flex flex-col justify-between p-6 sm:p-10 md:p-12 lg:p-14 min-h-screen bg-slate-50 dark:bg-zinc-950 overflow-y-auto">
        {/* Barra Superior con Selector de Tema */}
        <header className="w-full flex items-center justify-between sm:justify-end mb-4 sm:mb-6">
          {/* Logo visible solo en Móviles y Tablets */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="h-12 w-12 rounded-2xl bg-white p-1.5 shadow-sm flex items-center justify-center shrink-0 border border-slate-200 dark:border-zinc-800">
              <img
                src="/Los_Betos_Logo.jpg"
                alt="Pollería Los Betos"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wider text-slate-900 dark:text-white uppercase block leading-none">
                Los Betos
              </span>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Pollería & Brasas
              </span>
            </div>
          </div>
          <ThemeToggle />
        </header>

        {/* Tarjeta Central del Formulario */}
        <div className="w-full max-w-md mx-auto my-auto space-y-6">
          <div className="text-center sm:text-left space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Iniciar Sesión
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Ingresa tus credenciales autorizadas para acceder al sistema.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-5">
            <form onSubmit={enviar} className="space-y-4">
              {/* Campo Usuario */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="usuario"
                  className="text-xs font-bold text-slate-700 dark:text-slate-300 block"
                >
                  Usuario o Correo Electrónico
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <Input
                    id="usuario"
                    autoComplete="username"
                    placeholder="Usuario o correo asignado"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    required
                    className="pl-10 h-11 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus-visible:ring-red-600 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Campo Contraseña con Toggle Ocultar/Ver */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-xs font-bold text-slate-700 dark:text-slate-300 block"
                >
                  Contraseña
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 pr-10 h-11 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus-visible:ring-red-600 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Mensaje de Error */}
              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300 animate-in fade-in"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Botón de Enviar */}
              <Button
                type="submit"
                disabled={cargando}
                className="w-full h-11 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs shadow-md shadow-red-700/20 hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {cargando ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Validando Credenciales...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Ingresar al Sistema</span>
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Footer Derecho */}
        <footer className="w-full text-center py-3 text-slate-500 dark:text-zinc-500 space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Acceso restringido para el personal autorizado</span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500">
            Pollería Los Betos &copy; {new Date().getFullYear()} • Todos los derechos reservados
          </p>
        </footer>
      </section>
    </div>
  );
}