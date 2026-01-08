export const SUBSCRIPTION_PLANS = {
  starter: {
    name: "Starter",
    price_id: "price_1S2CWh2K2aKgw8lLCdXw308I",
    product_id: "prod_Sy8oNsv68aRpBk",
    price: 150,
    leads: 100,
    leadsPerWeek: 25,
    description: "Perfect for new agents getting started",
    features: [
      "100 verified FRBO leads per month",
      "Weekly drops of 25 leads",
      "Email & phone contact info",
      "Basic CRM access",
      "Email support",
    ],
  },
  growth: {
    name: "Growth",
    price_id: "price_1S2CXU2K2aKgw8lLECNC45o2",
    product_id: "prod_Sy8pZhkm06t4j9",
    price: 450,
    leads: 300,
    leadsPerWeek: 75,
    description: "For growing teams scaling their outreach",
    features: [
      "300 verified FRBO leads per month",
      "Weekly drops of 75 leads",
      "Email & phone contact info",
      "Full CRM access",
      "SMS & email outreach tools",
      "Priority support",
    ],
    popular: true,
  },
  pro: {
    name: "Pro",
    price_id: "price_1S2Cbh2K2aKgw8lLT6EwAWBz",
    product_id: "prod_Sy8tYLi8cYuun3",
    price: 800,
    leads: 600,
    leadsPerWeek: 150,
    description: "Maximum volume for high-performing teams",
    features: [
      "600 verified FRBO leads per month",
      "Weekly drops of 150 leads",
      "Email & phone contact info",
      "Full CRM access",
      "SMS, email & call outreach tools",
      "Dedicated account manager",
      "API access",
    ],
  },
} as const;

export type PlanKey = keyof typeof SUBSCRIPTION_PLANS;

export function getPlanByProductId(productId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(SUBSCRIPTION_PLANS)) {
    if (plan.product_id === productId) {
      return key as PlanKey;
    }
  }
  return null;
}

export function getPlanByPriceId(priceId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(SUBSCRIPTION_PLANS)) {
    if (plan.price_id === priceId) {
      return key as PlanKey;
    }
  }
  return null;
}
