import type { Metadata } from "next";
import { getBranding } from "@/lib/services/branding.service";
import { LoginForm } from "./login-form";

// La marca puede cambiarse desde Configuración → Personalización: no se prerenderiza.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getBranding();
  return { title: `Iniciar sesión | ${content.fullName}` };
}

export default async function LoginPage() {
  const { content, assets } = await getBranding();
  return <LoginForm brand={content} logoUrl={assets.logo} />;
}
