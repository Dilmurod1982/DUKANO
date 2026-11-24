// src/lib/numberFormat.js

// Приводит ввод пользователя к строке вида "1 234,56"
// Разрешает: цифры, один разделитель (. или ,), максимум 2 знака после
// Группирует целую часть пробелами
export function formatNumberInput(raw) {
    if (raw === '' || raw == null) return ''
  
    // нормализуем: убираем всё, кроме цифр и одного разделителя
    let s = String(raw).replace(/\s+/g, '').replace(',', '.')
    // оставляем только цифры и первую точку
    const firstDot = s.indexOf('.')
    if (firstDot !== -1) {
      const intPart = s.slice(0, firstDot).replace(/[^\d]/g, '')
      const decPart = s.slice(firstDot + 1).replace(/[^\d]/g, '').slice(0, 2)
      s = intPart + '.' + decPart
    } else {
      s = s.replace(/[^\d]/g, '')
    }
  
    if (s === '' || s === '.') return ''
  
    const [intRaw, decRaw] = s.split('.')
    const intFormatted = intRaw
      ? Number(intRaw).toLocaleString('ru-RU') // пробелы между разрядами
      : '0'
  
    // если пользователь ввёл точку — показываем её и дробную часть
    if (firstDot !== -1) {
      return `${intFormatted},${decRaw || ''}`
    }
    return intFormatted
  }
  
  // Парсит строку с группировкой в число: "1 234,56" → 1234.56
  export function parseNumberInput(str) {
    if (str === '' || str == null) return NaN
    const cleaned = String(str)
      .replace(/\s+/g, '')
      .replace(',', '.')
    const n = Number(cleaned)
    return isNaN(n) ? NaN : n
  }
  
  // Форматирует число для readonly-полей: 1234.5 → "1 234,50"
  export function formatNumberDisplay(n) {
    if (n === '' || n == null || isNaN(Number(n))) return ''
    return Number(n).toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }