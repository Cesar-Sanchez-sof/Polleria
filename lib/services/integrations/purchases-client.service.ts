// Client side service to fetch purchases without voucher from the API

export async function getPurchasesWithoutVoucher() {
  const resp = await fetch('/api/purchases/without-voucher', {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    credentials: 'include',
  });
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(`Error fetching purchases without voucher: ${error}`);
  }
  const data = await resp.json();
  return data;
}
