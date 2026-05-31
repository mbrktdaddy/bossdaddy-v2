import type { CategorySlug } from './categories'

/** A suggested spec key for a category. `hint` seeds the value input's placeholder. */
export interface SpecTemplateField {
  label: string
  hint?: string
}

// Universal fallback for products with no category (or an unlisted one). Kept
// small — just the attributes almost everything shares.
const UNIVERSAL: SpecTemplateField[] = [
  { label: 'Dimensions', hint: 'e.g. 12 × 8 × 4 in' },
  { label: 'Weight', hint: 'e.g. 2.1 lbs' },
  { label: 'Material', hint: 'e.g. anodized aluminum' },
  { label: 'Warranty', hint: 'e.g. 2-year limited' },
]

// Suggested canonical spec keys per top-level category. These SEED the Product
// Facts panel so specs line up across products in a comparison table. They are
// suggestions only — the admin edits, removes, or adds free-form extras. The
// AI autofill is told these labels so its output aligns to the same keys.
export const SPEC_TEMPLATES: Record<CategorySlug, SpecTemplateField[]> = {
  'kids-family': [
    { label: 'Age range', hint: 'e.g. 0–48 mo' },
    { label: 'Weight capacity', hint: 'e.g. 50 lbs' },
    { label: 'Weight', hint: 'e.g. 17 lbs' },
    { label: 'Dimensions', hint: 'folded / unfolded' },
    { label: 'Material', hint: 'e.g. polyester, aluminum frame' },
    { label: 'Machine washable', hint: 'Yes / No' },
    { label: 'Warranty', hint: 'e.g. 1-year' },
  ],
  'tools-diy': [
    { label: 'Power source', hint: 'corded / 20V battery / pneumatic' },
    { label: 'Voltage', hint: 'e.g. 20V MAX' },
    { label: 'Torque', hint: 'e.g. 1,800 in-lbs' },
    { label: 'Speed', hint: 'e.g. 0–2,000 RPM' },
    { label: 'Chuck / blade size', hint: 'e.g. 1/2 in' },
    { label: 'Battery included', hint: 'Yes / No' },
    { label: 'Weight', hint: 'e.g. 3.4 lbs' },
    { label: 'Warranty', hint: 'e.g. 3-year' },
  ],
  'grilling-cooking': [
    { label: 'Fuel type', hint: 'gas / charcoal / pellet / electric' },
    { label: 'Cooking area', hint: 'e.g. 500 sq in' },
    { label: 'Heat output', hint: 'e.g. 30,000 BTU' },
    { label: 'Material', hint: 'e.g. cast iron, stainless steel' },
    { label: 'Burners', hint: 'e.g. 3' },
    { label: 'Dimensions', hint: 'e.g. 48 × 24 × 45 in' },
    { label: 'Warranty', hint: 'e.g. 5-year' },
  ],
  'outdoors-adventure': [
    { label: 'Capacity', hint: 'e.g. 4-person / 65L' },
    { label: 'Packed size', hint: 'e.g. 24 × 8 in' },
    { label: 'Weight', hint: 'e.g. 6 lbs 2 oz' },
    { label: 'Material', hint: 'e.g. ripstop nylon' },
    { label: 'Water resistance', hint: 'e.g. 3,000mm' },
    { label: 'Seasonality', hint: '3-season / 4-season' },
    { label: 'Warranty', hint: 'e.g. lifetime' },
  ],
  'tech-edc': [
    { label: 'Battery life', hint: 'e.g. 30 hrs' },
    { label: 'Connectivity', hint: 'e.g. Bluetooth 5.3, USB-C' },
    { label: 'Water resistance', hint: 'e.g. IP67' },
    { label: 'Dimensions', hint: 'e.g. 2.8 × 1.1 in' },
    { label: 'Weight', hint: 'e.g. 1.6 oz' },
    { label: 'Material', hint: 'e.g. titanium' },
    { label: 'Warranty', hint: 'e.g. 1-year' },
  ],
  'vehicles-garage': [
    { label: 'Fitment', hint: 'universal / specific models' },
    { label: 'Material', hint: 'e.g. powder-coated steel' },
    { label: 'Load rating', hint: 'e.g. 2,000 lbs' },
    { label: 'Dimensions', hint: 'e.g. 60 × 20 in' },
    { label: 'Install difficulty', hint: 'bolt-on / drill required' },
    { label: 'Weight', hint: 'e.g. 22 lbs' },
    { label: 'Warranty', hint: 'e.g. 3-year' },
  ],
  'health-wellness': [
    { label: 'Type', hint: 'capsule / powder / device' },
    { label: 'Serving / dose', hint: 'e.g. 2 caps daily' },
    { label: 'Key ingredients', hint: 'e.g. creatine monohydrate 5g' },
    { label: 'Servings per container', hint: 'e.g. 30' },
    { label: 'Material', hint: 'for gear — e.g. EVA foam' },
    { label: 'Dimensions', hint: 'for gear' },
    { label: 'Warranty', hint: 'e.g. 1-year' },
  ],
  'home-lifestyle': [
    { label: 'Dimensions', hint: 'e.g. 84 × 38 × 36 in' },
    { label: 'Weight capacity', hint: 'e.g. 600 lbs' },
    { label: 'Material', hint: 'e.g. solid oak, polyester blend' },
    { label: 'Assembly required', hint: 'Yes / No' },
    { label: 'Care', hint: 'e.g. spot clean' },
    { label: 'Color options', hint: 'e.g. 5' },
    { label: 'Warranty', hint: 'e.g. 10-year' },
  ],
}

/** Template for a category slug, or the universal fallback. */
export function getSpecTemplate(category: string | null | undefined): SpecTemplateField[] {
  if (!category) return UNIVERSAL
  return SPEC_TEMPLATES[category as CategorySlug] ?? UNIVERSAL
}
