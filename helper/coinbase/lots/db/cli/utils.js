/**
 * @param totals {{totalCostBasis: number, totalProceeds: number, shortTerm: number, longTerm: number}}
 * @param {string} asset
 * @returns {{"Total Cost Basis": number, "Total Proceeds": number, "Short-Term Gains": number, "Long-Term Gains": number}}
 */
export function coinbaseTransactionsFormatLotTotals(totals, asset = '') {
  const formated = {};
  if (asset) {
    formated['asset'] = asset;
  }

  formated['Total Cost Basis'] = +totals.totalCostBasis.toFixed(2);
  formated['Total Proceeds'] = +totals.totalProceeds.toFixed(2);
  formated['Short-Term Gains'] = +totals.shortTerm.toFixed(2);
  formated['Long-Term Gains'] = +totals.longTerm.toFixed(2);

  return formated;
}

/**
 * @param {Lot[]} lots
 * @returns {{totalCostBasis: number, totalProceeds: number, shortTerm: number, longTerm: number}}
 */
export function coinbaseTransactionsGetLotTotals(lots) {
  let totalCostBasis = 0;
  let totalProceeds = 0;
  let shortTerm = 0;
  let longTerm = 0;

  for (const lot of lots) {
    totalCostBasis += lot.basis;
    totalProceeds += lot.proceeds;
    if (lot.term === 'short') {
      shortTerm += lot.gain;
    } else {
      longTerm += lot.gain;
    }
  }

  return {
    totalCostBasis,
    totalProceeds,
    shortTerm,
    longTerm,
  };
}
