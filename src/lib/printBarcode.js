// src/lib/printBarcode.js
import JsBarcode from 'jsbarcode'

/**
 * Открывает новое окно с этикетками EAN-13 для печати на A4.
 * @param {Object} item — { name, barcode, qty, salePrice }
 * @param {Object} opts — { labelsCount, currency }
 */
export function printBarcodeLabels(item, opts = {}) {
  const { labelsCount = Math.min(Number(item.qty) || 1, 100), currency = 'UZS' } = opts
  const price = item.salePrice != null ? Number(item.salePrice) : null

  // Контейнер для этикеток
  const wrapper = document.createElement('div')
  wrapper.className = 'labels-grid'

  for (let i = 0; i < labelsCount; i++) {
    const label = document.createElement('div')
    label.className = 'label-card'

    const nameEl = document.createElement('div')
    nameEl.className = 'label-name'
    nameEl.textContent = item.name || ''

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'label-barcode')

    const priceEl = document.createElement('div')
    priceEl.className = 'label-price'
    priceEl.textContent = price != null
      ? `${price.toLocaleString('ru-RU')} ${currency}`
      : ''

    label.appendChild(nameEl)
    label.appendChild(svg)
    label.appendChild(priceEl)
    wrapper.appendChild(label)

    // Рисуем штрихкод после вставки в DOM
    JsBarcode(svg, item.barcode, {
      format: 'EAN13',
      width: 2,
      height: 60,
      displayValue: true,
      fontSize: 14,
      margin: 4,
    })
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Печать штрихкодов</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 0;
    }
    .labels-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6mm;
    }
    .label-card {
      border: 1px dashed #999;
      border-radius: 4px;
      padding: 4mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .label-name {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 2mm;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }
    .label-barcode svg, .label-barcode {
      max-width: 100%;
    }
    .label-price {
      font-size: 12px;
      margin-top: 1mm;
      font-weight: 700;
    }
    @media print {
      .label-card { border: none; }
    }
  </style>
</head>
<body>${wrapper.outerHTML}</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    alert('Разрешите всплывающие окна для печати штрихкодов')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  win.onload = () => {
    win.print()
  }
  // на случай, если onload уже прошёл
  setTimeout(() => {
    try { win.print() } catch { /* noop */ }
  }, 300)
}