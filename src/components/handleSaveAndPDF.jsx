import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const handleSaveAndPDF = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Save Header to Supabase
    if (user) {
      const { data: savedInvoice, error: invErr } = await supabase
        .from('invoices')
        .insert([
          {
            vendor_id: user.id,
            invoice_no: invoiceNo,
            customer_name: customerName || 'Walk-in Customer',
            customer_address: address,
            customer_phone: phone,
            taxable_amount: taxableValue,
            total_tax: totalTax,
            total_amount: totalAmount,
            received_amount: parseFloat(receivedAmount) || 0.00,
          },
        ])
        .select()
        .single();

      if (invErr) throw invErr;

      // 2. Save Items to Supabase
      if (savedInvoice) {
        const itemRows = items.map((i) => ({
          invoice_id: savedInvoice.id,
          vendor_id: user.id,
          description: i.description || 'Item',
          hsn_code: i.hsn,
          qty: parseFloat(i.qty) || 1,
          rate: parseFloat(i.rate) || 0,
          amount: (parseFloat(i.qty) || 1) * (parseFloat(i.rate) || 0),
        }));

        await supabase.from('invoice_items').insert(itemRows);
      }
    }

    // 3. Render HTML & Print PDF
    const invoiceData = {
      invoiceNo,
      invoiceDate,
      customerName,
      address,
      phone,
      shipToSame,
      items,
      receivedAmount,
      bankDetails,
    };

    const html = generateInvoiceHTML(invoiceData, vendorProfile);
    const { uri } = await Print.printToFileAsync({ html });

    // 4. Sanitize invoice number for filename
    const sanitizedNo = invoiceNo.replace(/[^a-zA-Z0-9]/g, '_');
    const destinationPath = `${FileSystem.cacheDirectory}${sanitizedNo}.pdf`;

    // 5. Copy file locally
    await FileSystem.copyAsync({
      from: uri,
      to: destinationPath,
    });

    // 6. Convert local file path to Android Content Provider URI
    let shareableUri = destinationPath;
    if (Platform.OS === 'android') {
      shareableUri = await FileSystem.getContentUriAsync(destinationPath);
    }

    // 7. Open Share Drawer safely
    await Sharing.shareAsync(shareableUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Invoice ${invoiceNo}`,
      UTI: 'com.adobe.pdf',
    });

  } catch (err) {
    Alert.alert('Save Error', err.message || 'Failed to process invoice.');
  }
};