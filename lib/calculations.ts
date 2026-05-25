import { WEIGHT_PER_UNIT, MAX_BAGS_PER_PALLET } from './constants'

export interface QuantityInputs {
  qty_70kg: number
  qty_35kg: number
  qty_24kg: number
}

export interface ShipmentCalculations {
  total_pallets: number
  total_weight: number
  breakdown: {
    pallets_70kg: number
    pallets_35kg: number
    pallets_24kg: number
    weight_70kg: number
    weight_35kg: number
    weight_24kg: number
  }
}

export function calculateShipment(quantities: QuantityInputs): ShipmentCalculations {
  const { qty_70kg, qty_35kg, qty_24kg } = quantities

  // Pallet fractions
  const pallets_70kg = qty_70kg / MAX_BAGS_PER_PALLET.kg70
  const pallets_35kg = qty_35kg / MAX_BAGS_PER_PALLET.kg35
  const pallets_24kg = qty_24kg / MAX_BAGS_PER_PALLET.kg24

  // Total pallets (ceiling of sum of fractions)
  const total_pallets = Math.ceil(pallets_70kg + pallets_35kg + pallets_24kg) || 0

  // Weight calculations
  const weight_70kg = qty_70kg * WEIGHT_PER_UNIT.kg70
  const weight_35kg = qty_35kg * WEIGHT_PER_UNIT.kg35
  const weight_24kg = qty_24kg * WEIGHT_PER_UNIT.kg24
  const total_weight = Math.round((weight_70kg + weight_35kg + weight_24kg) * 100) / 100

  return {
    total_pallets,
    total_weight,
    breakdown: {
      pallets_70kg,
      pallets_35kg,
      pallets_24kg,
      weight_70kg: Math.round(weight_70kg * 100) / 100,
      weight_35kg: Math.round(weight_35kg * 100) / 100,
      weight_24kg: Math.round(weight_24kg * 100) / 100,
    },
  }
}

export function validateQuantities(quantities: QuantityInputs): string | null {
  const { qty_70kg, qty_35kg, qty_24kg } = quantities
  if (qty_70kg < 0 || qty_35kg < 0 || qty_24kg < 0) {
    return 'Quantities cannot be negative'
  }
  if (qty_70kg + qty_35kg + qty_24kg === 0) {
    return 'At least one product quantity is required'
  }
  if (!Number.isInteger(qty_70kg) || !Number.isInteger(qty_35kg) || !Number.isInteger(qty_24kg)) {
    return 'Quantities must be whole numbers'
  }
  return null
}

// Example calculations for reference:
// 10 bags 70kg = 1 pallet (10/10 = 1.0, ceil = 1)
// 15 bags 70kg = 2 pallets (15/10 = 1.5, ceil = 2)
// 6 bags 70kg + 6 bags 35kg = 2 pallets (0.6 + 0.5 = 1.1, ceil = 2)
