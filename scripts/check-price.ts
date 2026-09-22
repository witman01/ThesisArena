import { priceLabel } from '../src/lib/assets';
for (const n of [0.00000182, 0.0015, 0.2245, 1.0, 112.87, 68420.5, 0]) {
  console.log(String(n).padEnd(12), priceLabel(n));
}

export {};
