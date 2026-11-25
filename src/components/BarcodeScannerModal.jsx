// src/components/BarcodeScannerModal.jsx
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function BarcodeScannerModal({ onClose, onScan }) {
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);
  const scannerRef = useRef(null);
  const containerId = "barcode-reader-container";

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      // 1. Проверка HTTPS / mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError(
          "Браузер не поддерживает доступ к камере. Откройте сайт по HTTPS или на localhost."
        );
        setStarting(false);
        return;
      }

      try {
        // 2. Создаём сканер (не Scanner, а Html5Qrcode — больше контроля)
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        // 3. Запускаем с задней камерой
        await scanner.start(
          { facingMode: "environment" }, // задняя камера на телефоне
          {
            fps: 10,
            qrbox: { width: 280, height: 160 },
            // EAN_13 + QR + Code128 — на всякий случай
            formatsToSupport: undefined,
          },
          (decodedText) => {
            // успешное сканирование
            if (!mounted) return;
            stopAndClose(decodedText);
          },
          (err) => {
            // ошибки распознавания в процессе — игнорируем
            // console.warn('scan err:', err)
          }
        );
        if (mounted) setStarting(false);
      } catch (e) {
        console.error("[scanner] start error:", e);
        if (!mounted) return;
        setError(
          "Не удалось открыть камеру: " +
            (e?.message || e?.name || "неизвестная ошибка") +
            ". Проверьте разрешение и HTTPS."
        );
        setStarting(false);
      }
    };

    const stopAndClose = async (decodedText) => {
      try {
        if (scannerRef.current) {
          await scannerRef.current.stop();
          scannerRef.current.clear();
          scannerRef.current = null;
        }
      } catch {}
      onScan(decodedText);
    };

    start();

    return () => {
      mounted = false;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {});
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-card p-4 w-full max-w-sm">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Сканировать штрихкод</h3>
          <button onClick={onClose} className="text-gray-500 text-xl">
            ✕
          </button>
        </div>

        {starting && !error && (
          <p className="text-sm text-gray-500 text-center py-6">
            Запуск камеры...
          </p>
        )}

        {error && (
          <p className="text-sm text-red-500 text-center py-4">{error}</p>
        )}

        <div
          id={containerId}
          className="w-full"
          style={{ minHeight: error ? 0 : 260 }}
        />

        {!error && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Наведите камеру на штрихкод товара
          </p>
        )}
      </div>
    </div>
  );
}
