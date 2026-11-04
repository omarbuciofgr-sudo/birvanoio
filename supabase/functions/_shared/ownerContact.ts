export function contactFound(data?: { phones?: Array<{ number?: string }>; emails?: Array<{ address?: string }> } | null) {
  return {
    phone: (data?.phones ?? []).some(p => typeof p.number === 'string' && p.number.replace(/\D/g, '').length >= 7),
    email: (data?.emails ?? []).some(e => typeof e.address === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.address)),
  };
}

export function lookupCharge(found: { phone: boolean; email: boolean }, freeRemaining: number, unitCost: number) {
  if (!found.phone && !found.email) return { freeUsed: 0, credits: 0 };
  return freeRemaining > 0 ? { freeUsed: 1, credits: 0 } : { freeUsed: 0, credits: unitCost };
}