// src/lib/barcode.js

// Генерирует 13-значный EAN-13-совместимый штрихкод с корректной контрольной цифрой.
// Префикс "20" — внутреннее использование (не пересекается с реальными производителями).
export function generateEAN13() {
    // 12 случайных цифр: 2 — префикс, 10 — случайные
    let digits = '20'
    for (let i = 0; i < 10; i++) {
      digits += Math.floor(Math.random() * 10)
    }
  
    // контрольная цифра
    let sum = 0
    for (let i = 0; i < 12; i++) {
      const d = Number(digits[i])
      sum += i % 2 === 0 ? d : d * 3
    }
    const check = (10 - (sum % 10)) % 10
    return digits + check
  }
  
  // Проверка, что строка — валидный EAN-13 (только цифры + контрольная цифра)
  export function isValidEAN13(code) {
    if (!/^\d{13}$/.test(code)) return false
    let sum = 0
    for (let i = 0; i < 12; i++) {
      const d = Number(code[i])
      sum += i % 2 === 0 ? d : d * 3
    }
    const check = (10 - (sum % 10)) % 10
    return check === Number(code[12])
  }