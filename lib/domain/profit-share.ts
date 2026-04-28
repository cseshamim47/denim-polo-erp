function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePartnerProfitShares(input: {
  totalProfitPool: number;
  partners: Array<{
    partnerId: string;
    partnerName: string;
    totalInvestment: number;
  }>;
}) {
  const totalInvested = roundCurrency(
    input.partners.reduce((sum, partner) => sum + partner.totalInvestment, 0),
  );

  return {
    totalInvested,
    shares: input.partners.map((partner) => {
      if (totalInvested <= 0) {
        return {
          partnerId: partner.partnerId,
          partnerName: partner.partnerName,
          totalInvestment: roundCurrency(partner.totalInvestment),
          profitSharePercent: 0,
          profitShareAmount: 0,
        };
      }

      const profitSharePercent = roundCurrency(
        (partner.totalInvestment / totalInvested) * 100,
      );

      return {
        partnerId: partner.partnerId,
        partnerName: partner.partnerName,
        totalInvestment: roundCurrency(partner.totalInvestment),
        profitSharePercent,
        profitShareAmount: roundCurrency(
          (input.totalProfitPool * profitSharePercent) / 100,
        ),
      };
    }),
  };
}
