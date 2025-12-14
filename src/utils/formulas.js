const RU_TO_EN = {
  'СУММ': 'SUM',
  'СРЗНАЧ': 'AVERAGE',
  'МИН': 'MIN',
  'МАКС': 'MAX',
  'СЧЁТ': 'COUNT',
  'СЧЕТ': 'COUNT',
}

const EN_TO_RU = Object.fromEntries(Object.entries(RU_TO_EN).map(([ru, en]) => [en, ru]))

export function sanitizeRuFormula(input = '') {
  if (!input) return ''
  return input.replace(/^=\s*/, '=').replace(/,/g, ',').toUpperCase()
}

export function ruFormulaToEn(input = '') {
  if (!input || typeof input !== 'string') return input
  if (!input.trim().startsWith('=')) return input
  const sanitized = sanitizeRuFormula(input)
  return sanitized.replace(/([А-ЯЁ]+)/g, (match) => RU_TO_EN[match] ?? match)
}

export function enFormulaToRu(input = '') {
  if (!input || typeof input !== 'string') return input
  if (!input.trim().startsWith('=')) return input
  return input.replace(/([A-Z]+)/g, (match) => EN_TO_RU[match] ?? match)
}

export function looksLikeFormula(value) {
  return typeof value === 'string' && value.trim().startsWith('=')
}

export function normalizeRussianFormula(value) {
  if (!looksLikeFormula(value)) return value
  return sanitizeRuFormula(value)
}
