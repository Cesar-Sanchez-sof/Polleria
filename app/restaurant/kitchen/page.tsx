"use client";

export default function KitchenPage() {
  return (
    <div className="pl-0 md:pl-64 min-h-screen flex flex-col bg-(--color-background) w-full min-w-0 overflow-x-hidden">
      <main className="relative flex-1 min-h-0 w-full">
        <iframe
          src="/restauranteCocina.html"
          title="Cocina y KDS"
          className="absolute inset-0 w-full h-full border-0"
        />
      </main>
    </div>
  );
}
