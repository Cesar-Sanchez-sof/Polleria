"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Crop,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Check,
  X,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedDataUrl: string) => void;
  title?: string;
  description?: string;
}

export function ImageCropperModal({
  isOpen,
  onClose,
  imageSrc,
  onCropComplete,
  title = "Recortar Código QR",
  description = "Ajusta y enfoca el código QR oficial de Yape eliminando bordes innecesarios.",
}: ImageCropperModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [minZoom, setMinZoom] = useState<number>(0.5);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const CANVAS_SIZE = 360;
  const CROP_SIZE = 270;
  const CENTER = CANVAS_SIZE / 2;

  // Cargar imagen
  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImage(img);
      // Calcular zoom inicial para que el lado menor cubra el recuadro de recorte
      const fitZoom = Math.max(CROP_SIZE / img.width, CROP_SIZE / img.height);
      const calculatedMinZoom = fitZoom * 0.7;
      setMinZoom(calculatedMinZoom);
      setZoom(fitZoom);
      setOffset({ x: 0, y: 0 });
      setRotation(0);
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  // Dibujar en el canvas principal
  const drawMainCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Fondo oscuro suave
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Dibujar imagen con transformaciones
    ctx.save();
    ctx.translate(CENTER + offset.x, CENTER + offset.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);
    ctx.drawImage(image, -image.width / 2, -image.height / 2, image.width, image.height);
    ctx.restore();

    // Dibujar máscara oscura alrededor del área de recorte
    const cropX = CENTER - CROP_SIZE / 2;
    const cropY = CENTER - CROP_SIZE / 2;

    ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
    // Top
    ctx.fillRect(0, 0, CANVAS_SIZE, cropY);
    // Bottom
    ctx.fillRect(0, cropY + CROP_SIZE, CANVAS_SIZE, CANVAS_SIZE - (cropY + CROP_SIZE));
    // Left
    ctx.fillRect(0, cropY, cropX, CROP_SIZE);
    // Right
    ctx.fillRect(cropX + CROP_SIZE, cropY, CANVAS_SIZE - (cropX + CROP_SIZE), CROP_SIZE);

    // Cuadrícula interior (regla de tercios)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const third = CROP_SIZE / 3;
    ctx.moveTo(cropX + third, cropY);
    ctx.lineTo(cropX + third, cropY + CROP_SIZE);
    ctx.moveTo(cropX + third * 2, cropY);
    ctx.lineTo(cropX + third * 2, cropY + CROP_SIZE);
    ctx.moveTo(cropX, cropY + third);
    ctx.lineTo(cropX + CROP_SIZE, cropY + third);
    ctx.moveTo(cropX, cropY + third * 2);
    ctx.lineTo(cropX + CROP_SIZE, cropY + third * 2);
    ctx.stroke();

    // Marco exterior de recorte (Borde violeta/morado Yape)
    ctx.strokeStyle = "#9333ea";
    ctx.lineWidth = 2;
    ctx.strokeRect(cropX, cropY, CROP_SIZE, CROP_SIZE);

    // Esquinas reforzadas (Corner brackets)
    const bracketSize = 18;
    ctx.strokeStyle = "#c084fc";
    ctx.lineWidth = 4;
    ctx.beginPath();
    // Top-left
    ctx.moveTo(cropX, cropY + bracketSize);
    ctx.lineTo(cropX, cropY);
    ctx.lineTo(cropX + bracketSize, cropY);
    // Top-right
    ctx.moveTo(cropX + CROP_SIZE - bracketSize, cropY);
    ctx.lineTo(cropX + CROP_SIZE, cropY);
    ctx.lineTo(cropX + CROP_SIZE, cropY + bracketSize);
    // Bottom-left
    ctx.moveTo(cropX, cropY + CROP_SIZE - bracketSize);
    ctx.lineTo(cropX, cropY + CROP_SIZE);
    ctx.lineTo(cropX + bracketSize, cropY + CROP_SIZE);
    // Bottom-right
    ctx.moveTo(cropX + CROP_SIZE - bracketSize, cropY + CROP_SIZE);
    ctx.lineTo(cropX + CROP_SIZE, cropY + CROP_SIZE);
    ctx.lineTo(cropX + CROP_SIZE, cropY + CROP_SIZE - bracketSize);
    ctx.stroke();
  }, [image, zoom, offset, rotation]);

  // Dibujar preview en miniatura
  const drawPreview = useCallback(() => {
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas || !image) return;
    const ctx = previewCanvas.getContext("2d");
    if (!ctx) return;

    const PREVIEW_SIZE = 96;
    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    ctx.save();
    const scaleRatio = PREVIEW_SIZE / CROP_SIZE;
    ctx.translate(PREVIEW_SIZE / 2 + offset.x * scaleRatio, PREVIEW_SIZE / 2 + offset.y * scaleRatio);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom * scaleRatio, zoom * scaleRatio);
    ctx.drawImage(image, -image.width / 2, -image.height / 2, image.width, image.height);
    ctx.restore();
  }, [image, zoom, offset, rotation]);

  useEffect(() => {
    drawMainCanvas();
    drawPreview();
  }, [drawMainCanvas, drawPreview]);

  // Handlers de arrastre (Pan)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignorar
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((prev) => Math.min(Math.max(prev + delta, minZoom), minZoom * 5));
  };

  const handleCenter = () => {
    setOffset({ x: 0, y: 0 });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleFit = () => {
    if (!image) return;
    const fitZoom = Math.max(CROP_SIZE / image.width, CROP_SIZE / image.height);
    setZoom(fitZoom);
    setOffset({ x: 0, y: 0 });
  };

  const handleConfirmCrop = () => {
    if (!image) return;
    const exportCanvas = document.createElement("canvas");
    const EXPORT_SIZE = 640;
    exportCanvas.width = EXPORT_SIZE;
    exportCanvas.height = EXPORT_SIZE;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);

    const scaleRatio = EXPORT_SIZE / CROP_SIZE;
    ctx.translate(EXPORT_SIZE / 2 + offset.x * scaleRatio, EXPORT_SIZE / 2 + offset.y * scaleRatio);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom * scaleRatio, zoom * scaleRatio);
    ctx.drawImage(image, -image.width / 2, -image.height / 2, image.width, image.height);

    const croppedBase64 = exportCanvas.toDataURL("image/png");
    onCropComplete(croppedBase64);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden max-h-[95vh]">
        {/* Cabecera */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-purple-50/60 dark:bg-purple-950/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground leading-tight">{title}</h3>
              <p className="text-[11px] text-muted-foreground">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo / Canvas */}
        <div className="p-4 flex flex-col items-center gap-3 overflow-y-auto">
          <div className="relative rounded-2xl overflow-hidden border border-slate-700 shadow-md touch-none select-none bg-slate-950">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onWheel={handleWheel}
              className="cursor-grab active:cursor-grabbing w-[300px] h-[300px] sm:w-[360px] sm:h-[360px] block"
              title="Arrastra para mover la imagen. Usa la rueda del ratón o el deslizador para hacer zoom."
            />
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/80 bg-black/60 backdrop-blur-xs px-2.5 py-0.5 rounded-full pointer-events-none">
              🖐️ Arrastra para encuadrar el QR
            </span>
          </div>

          {/* Controles de Zoom y Ajuste */}
          <div className="w-full flex flex-col gap-2.5 max-w-sm pt-1">
            <div className="flex items-center gap-3">
              <ZoomOut className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                type="range"
                min={minZoom}
                max={minZoom * 5}
                step={(minZoom * 4) / 100}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <ZoomIn className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-[10.5px] font-mono text-muted-foreground w-10 text-right shrink-0">
                {Math.round((zoom / minZoom) * 100)}%
              </span>
            </div>

            {/* Botones de acción rápida */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCenter}
                  className="h-7 text-[11px] px-2 rounded-lg cursor-pointer"
                  title="Recentrar imagen"
                >
                  <Maximize2 className="w-3 h-3 mr-1" />
                  Centrar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFit}
                  className="h-7 text-[11px] px-2 rounded-lg cursor-pointer"
                  title="Ajustar al marco"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Ajustar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRotate}
                  className="h-7 text-[11px] px-2 rounded-lg cursor-pointer"
                  title="Rotar 90 grados"
                >
                  <RotateCw className="w-3 h-3 mr-1" />
                  90°
                </Button>
              </div>

              {/* Mini Preview */}
              <div className="flex items-center gap-2 pl-2 border-l border-border shrink-0">
                <canvas
                  ref={previewCanvasRef}
                  width={96}
                  height={96}
                  className="w-8 h-8 rounded-md border border-purple-200 bg-white object-contain shadow-2xs shrink-0"
                />
                <span className="text-[10px] text-muted-foreground hidden sm:inline">
                  Vista Previa
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer / Acciones */}
        <div className="p-3.5 border-t border-border bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs h-9 rounded-xl font-semibold cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirmCrop}
            className="text-xs h-9 px-4 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Aplicar Recorte al QR</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
