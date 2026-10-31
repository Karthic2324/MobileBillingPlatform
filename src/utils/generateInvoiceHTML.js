export const generateInvoiceHTML = (invoiceData, vendorProfile = {}) => {
  const {
    invoiceNo,
    invoiceDate,
    customerName,
    address,
    phone,
    items = [],
    bankDetails = {},
  } = invoiceData;

  const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
  const subtotal = items.reduce((sum, item) => sum + ((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0)), 0);
  const cgst = subtotal * 0.09;
  const sgst = subtotal * 0.09;
  const grandTotal = subtotal + cgst + sgst;

  const numberToWords = (num) => {
    if (!num || num === 0) return 'Zero Rupees';
    return `${grandTotal.toFixed(2)} Rupees Only`;
  };

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; color: #111; font-size: 13px; line-height: 1.4; }
      .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px; }
      .title { font-size: 18px; font-weight: bold; }
      .sub-header { display: flex; justify-content: space-between; margin-top: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
      .vendor-info { width: 55%; }
      .invoice-meta { width: 40%; text-align: right; }
      .bill-to { border: 1px solid #000; padding: 8px; margin-top: 10px; width: 45%; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      th, td { border: 1px solid #aaa; padding: 6px; text-align: left; }
      th { background-color: #f0f0f0; }
      .right { text-align: right; }
      .tax-table { margin-top: 15px; }
      .words-box { border: 1px solid #000; padding: 8px; margin-top: 15px; font-weight: bold; }
      .footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
    </style>
  </head>
  <body>
    <div class="header">
      <span class="title">TAX INVOICE</span>
      <span>ORIGINAL FOR RECIPIENT</span>
    </div>

    <div class="sub-header">
      <div class="vendor-info">
        <h3>${vendorProfile.business_name || 'My Business'}</h3>
        <p>${vendorProfile.address || 'Business Address'}</p>
        <p><strong>GSTIN:</strong> ${vendorProfile.gstin || 'N/A'}</p>
        <p><strong>Contact:</strong> ${vendorProfile.phone || 'N/A'}</p>
      </div>
      <div class="invoice-meta">
        <p><strong>Invoice No. (Auto):</strong> ${invoiceNo}</p>
        <p><strong>Invoice Date:</strong> ${invoiceDate}</p>
      </div>
    </div>

    <div class="bill-to">
      <strong>BILL TO</strong>
      <p>${customerName || 'Customer Name'}</p>
      <p>${address || 'Customer Address'}</p>
      <p>${phone || 'Customer Phone'}</p>
    </div>

    <table>
      <thead>
        <tr>
          <th>S.NO</th>
          <th>ITEMS</th>
          <th>HSN</th>
          <th class="right">QTY</th>
          <th class="right">RATE</th>
          <th class="right">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${item.description || 'Item Description'}</td>
            <td>${item.hsn || '-'}</td>
            <td class="right">${item.qty}</td>
            <td class="right">${parseFloat(item.rate || 0).toFixed(2)}</td>
            <td class="right">${((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0)).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="display: flex; justify-content: space-between; margin-top: 10px; font-weight: bold;">
      <span>TOTAL QTY: ${totalQty}</span>
      <span>TOTAL: ₹${grandTotal.toFixed(2)}</span>
    </div>

    <table class="tax-table">
      <thead>
        <tr>
          <th>HSN/SAC</th>
          <th class="right">Taxable Value</th>
          <th class="right">CGST (9%)</th>
          <th class="right">SGST (9%)</th>
          <th class="right">Total Tax</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>N/A</td>
          <td class="right">₹${subtotal.toFixed(2)}</td>
          <td class="right">₹${cgst.toFixed(2)}</td>
          <td class="right">₹${sgst.toFixed(2)}</td>
          <td class="right">₹${(cgst + sgst).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div class="words-box">
      Total Amount (in words): ${numberToWords(grandTotal)}
    </div>

    <div class="footer">
      <div>
        <strong>Bank Details</strong><br/>
        Name: ${bankDetails.name || vendorProfile.business_name || 'N/A'}<br/>
        IFSC Code: ${bankDetails.ifsc || 'N/A'}<br/>
        Account No: ${bankDetails.accNo || 'N/A'}
      </div>
      <div style="text-align: right;">
        <br/><br/>
        <strong>Authorised Signatory For</strong><br/>
        ${vendorProfile.business_name || 'My Business'}
      </div>
    </div>
  </body>
  </html>
  `;
};