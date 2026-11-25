import { useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function BarcodeScannerModal({ onClose, onScan }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 150 }, // горизонтальная рамка подходит для штрихкодов
        formatsToSupport: [0], // 0 = EAN_13
      },
      false
    );

    scanner.render(
      (decodedText) => {
        scanner.clear();
        onScan(decodedText);
      },
      (error) => {
        // игнорируем ошибки распознавания в процессе
      }
    );

    return () => {
      scanner.clear().catch(() => {});
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
        <div id="reader" className="w-full" />
        <p className="text-xs text-gray-500 mt-2 text-center">
          Наведите камеру на штрихкод товара
        </p>
      </div>
    </div>
  );
}
