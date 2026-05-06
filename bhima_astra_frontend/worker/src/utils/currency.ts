export const formatINR = (amount: number | string) => {
  const numericVal = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g, "")) : amount;
  if (isNaN(numericVal)) return typeof amount === 'string' && amount.startsWith('₹') ? amount : amount;
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: numericVal % 1 === 0 ? 0 : 2
  }).format(numericVal);
};
