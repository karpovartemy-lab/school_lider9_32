const RU_TO_EN = {
  СУММ: 'SUM',
  СРЗНАЧ: 'AVERAGE',
  МИН: 'MIN',
  МАКС: 'MAX',
  'СЧЁТ': 'COUNT',
  СЧЕТ: 'COUNT',
}

function normalizeFunctionName(name) {
  return RU_TO_EN[name.toUpperCase()] ?? name
}

export function normalizeRussianFormula(input) {
  if (typeof input !== 'string') {
    return { ru: input, en: input, isFormula: false }
  }
  const trimmed = input.trim()
  if (!trimmed.startsWith('=')) {
    return { ru: trimmed, en: trimmed, isFormula: false }
  }

  const body = trimmed.slice(1)
  const match = body.match(/^[^ (]+/)
  if (!match) {
    return { ru: trimmed, en: trimmed, isFormula: true }
  }
  const funcName = match[0]
  const english = normalizeFunctionName(funcName)
  const enFormula = `=${english}${body.slice(funcName.length)}`
  return { ru: trimmed, en: enFormula, isFormula: true }
}
