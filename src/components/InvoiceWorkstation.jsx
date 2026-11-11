import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Print from 'expo-print';
//import * as Sharing from 'expo-sharing';
import { supabase } from '../config/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { generateInvoiceHTML } from '../utils/generateInvoiceHTML';
import { calcInvoice, formatDate, toISODate, financialYearLabel } from '../utils/tax';
import DatePickerField from './DatePickerField';
import { savePdfToDevice } from '../utils/savePdfToDevice';

export default function InvoiceWorkstation({ vendorProfile: vendorProfileProp = {} }) {
  // Invoice date chosen on the calendar, kept as 'YYYY-MM-DD' (defaults to today).
  const [invoiceDate, setInvoiceDate] = useState(toISODate(new Date()));
  // Prefix + running number come from the database; the financial-year part follows the chosen date.
  const [invBase, setInvBase] = useState(null);
  const invoiceNo = invBase ? `${invBase.prefix}/${financialYearLabel(invoiceDate)}/${invBase.seq}` : '';
  // Live copy of the vendor profile so changes made by the Controller
  // (company name, address, phone, bank, invoice prefix...) show up immediately.
  const [vendorProfile, setVendorProfile] = useState(vendorProfileProp || {});

  useEffect(() => {
    setVendorProfile(vendorProfileProp || {});
  }, [vendorProfileProp]);

  useFocusEffect(
    useCallback(() => {
      const id = vendorProfileProp?.id;
      if (!id) return;
      supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data }) => {
          if (data) setVendorProfile(data);
        });
    }, [vendorProfileProp?.id])
  );

  useEffect(() => {
    if (vendorProfile?.id) {
      generateVendorInvoiceNumber();
    }
  }, [vendorProfile]);

  const generateVendorInvoiceNumber = async () => {
    try {
      // Query Supabase for the latest invoice belonging specifically to this vendor
      const { data, error } = await supabase
        .from('invoices')
        .select('invoice_no')
        .eq('vendor_id', vendorProfile.id)
        .order('created_at', { ascending: false })
        .limit(1);

      let nextSeq = parseInt(vendorProfile.invoice_start_no, 10) || 1001;
      if (data && data.length > 0) {
        // Extract the last number or increment
        const lastNo = data[0].invoice_no;
        const parts = lastNo.split('/');
        const currentNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(currentNum)) {
          nextSeq = Math.max(currentNum + 1, nextSeq);
        }
      }

      // Create a unique prefix using the vendor's business initials or ID snippet
      const prefix = vendorProfile.invoice_prefix || (vendorProfile.business_name || 'MB')
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 3);

      setInvBase({ prefix, seq: nextSeq });
    } catch (err) {
      console.log('Error generating unique invoice number:', err.message);
      // Fallback unique ID
      setInvBase({ prefix: 'INV', seq: Math.floor(1000 + Math.random() * 9000) });
    }
  };
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  
  const [shipAddress, setShipAddress] = useState('');
  const [receivedAmount, setReceivedAmount] = useState('0.00');

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingText, setProcessingText] = useState('Saving invoice...');

  const [catalog, setCatalog] = useState([]);
  const [pastInvoiceItems, setPastInvoiceItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [activeRowId, setActiveRowId] = useState(null);

  const [items, setItems] = useState([
    { id: 1, description: '', hsn: '', gst: '', qty: '1', rate: '0.00' },
  ]);

  useEffect(() => {
    fetchVendorCatalogAndHistory();
  }, [vendorProfile?.id]);

  const fetchVendorCatalogAndHistory = async () => {
    try {
      const vendorId = vendorProfile?.id;
      if (!vendorId) return;

      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId);
      if (prodData) setCatalog(prodData);

      const { data: itemData } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('vendor_id', vendorId);

      if (itemData && itemData.length > 0) {
        const uniqueItems = Array.from(new Set(itemData.map((i) => i.description)))
          .map((desc) => itemData.find((i) => i.description === desc));
        setPastInvoiceItems(uniqueItems);
      }
    } catch (err) {
      console.log('Error fetching suggestions:', err.message);
    }
  };

  const openSearchModal = (rowId) => {
    fetchVendorCatalogAndHistory(); // pick up products added in the Catalog tab since this page loaded
    setActiveRowId(rowId);
    setSearchQuery('');
    setModalVisible(true);
  };

  const nameOf = (p) => (p.item_name || p.name || p.description || '').trim();

  // Catalog product with the same name (case-insensitive), if any
  const findCatalogMatch = (name) => {
    const key = (name || '').trim().toLowerCase();
    if (!key) return null;
    return catalog.find((c) => nameOf(c).toLowerCase() === key) || null;
  };

  const gstText = (v) => (v != null && parseFloat(v) > 0 ? String(parseFloat(v)) : '');

  const handleSelectProduct = (picked) => {
    // If the pick came from past invoices, still use the catalog's saved details for that name
    const product = findCatalogMatch(nameOf(picked)) || picked;
    const itemName = product.item_name || product.name || product.description || '';
    const itemHsn = product.hsn_code || product.hsn || product.product_code || '';
    const itemPrice = String(product.unit_price || product.price || product.rate || '0.00');

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === activeRowId
          ? {
              ...item,
              description: itemName,
              hsn: itemHsn,
              rate: itemPrice,
              gst: gstText(product.gst_percent),
            }
          : item
      )
    );
    setModalVisible(false);
  };

  const combinedSuggestions = [...catalog, ...pastInvoiceItems].filter((p, index, self) => {
    const name = (p.item_name || p.name || p.description || '').toLowerCase();
    const code = (p.hsn_code || p.hsn || p.product_code || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    
    return (
      (name.includes(query) || code.includes(query)) &&
      index === self.findIndex((t) => (t.item_name || t.name || t.description || '').toLowerCase() === name)
    );
  });

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: Date.now(), description: '', hsn: '', gst: '', qty: '1', rate: '0.00' },
    ]);
  };

  // Remove a product row. The last remaining row is cleared instead, so the invoice always has one row.
  const removeItemNow = (id) => {
    setItems((prev) =>
      prev.length <= 1
        ? [{ id: Date.now(), description: '', hsn: '', gst: '', qty: '1', rate: '0.00' }]
        : prev.filter((item) => item.id !== id)
    );
  };

  const handleRemoveItem = (item) => {
    // Empty rows go straight away; rows with a product ask first to avoid accidental taps.
    if (!item.description) return removeItemNow(item.id);
    Alert.alert('Remove product', `Remove "${item.description}" from this invoice?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeItemNow(item.id) },
    ]);
  };

  const handleUpdateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'description') {
          // Typed name matches a catalog product -> fill only the fields still empty
          const match = findCatalogMatch(value);
          if (match) {
            if (!updated.gst) updated.gst = gstText(match.gst_percent);
            if (!updated.hsn) updated.hsn = match.hsn_code || match.hsn || '';
            const price = parseFloat(match.price || match.unit_price || match.rate);
            if (!(parseFloat(updated.rate) > 0) && price > 0) updated.rate = String(price);
          }
        }
        return updated;
      })
    );
  };

  const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
  const { taxable: taxableValue, tax: totalTax, total: totalAmount, byRate } = calcInvoice(items);
  const numberToWords = (num) => {
    if (isNaN(num) || num === 0) return 'Zero Rupees';
    return `${Math.round(num).toLocaleString('en-IN')} Rupees Only`;
  };

  const bankDetails = {
    name: vendorProfile.bank_name || vendorProfile.business_name || '',
    ifsc: vendorProfile.ifsc_code || '',
    accNo: vendorProfile.account_no || vendorProfile.account_number || '',
  };

const handleSaveAndPDF = async () => {
    try {
      const vendorId = vendorProfile?.id;
      if (!vendorId) {
        Alert.alert('Error', 'Vendor profile ID not found. Please log in again.');
        return;
      }

      setIsProcessing(true);
      setProcessingText('Saving invoice to database...');

      // 1. Save Header Record to Supabase
      const invoicePayload = {
        vendor_id: vendorId,
        invoice_no: invoiceNo,
        invoice_date: invoiceDate,
        customer_name: customerName || 'Walk-in Customer',
        customer_address: address || '',
        customer_phone: phone || '',
        taxable_amount: taxableValue,
        total_tax: totalTax,
        total_amount: totalAmount,
        received_amount: parseFloat(receivedAmount) || 0.00,
      };

      const { data: savedInvoice, error: invErr } = await supabase
        .from('invoices')
        .insert([invoicePayload])
        .select()
        .single();

      if (invErr) {
        throw new Error(`Database Error (Invoices): ${invErr.message}`);
      }

      // 2. Save Line Items to 'invoice_items'
      if (savedInvoice && savedInvoice.id) {
        const itemRows = items.map((i, idx) => ({
          line_no: idx + 1,
          invoice_id: savedInvoice.id,
          vendor_id: vendorId,
          description: i.description || 'Item',
          hsn_code: i.hsn || '',
          gst_percent: parseFloat(i.gst) || 0,
          qty: parseFloat(i.qty) || 1,
          rate: parseFloat(i.rate) || 0,
          amount: (parseFloat(i.qty) || 1) * (parseFloat(i.rate) || 0),
        }));
        
        const { error: lineErr } = await supabase.from('invoice_items').insert(itemRows);
        if (lineErr) {
          throw new Error(`Database Error (Items): ${lineErr.message}`);
        }
      }

      // 3. Render HTML
      setProcessingText('Creating PDF...');
      const invoiceData = {
        invoiceNo,
        invoiceDate: formatDate(invoiceDate), // PDF shows DD-MM-YYYY of the picked date
        customerName,
        address,
        phone,
        shippingAddress: shipAddress,
        items,
        receivedAmount,
        bankDetails,
      };

      const html = generateInvoiceHTML(invoiceData, vendorProfile);

      // 4. Build the PDF file and save it straight into the phone's storage
      const { uri } = await Print.printToFileAsync({ html });
      const safeNo = String(invoiceNo).replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${safeNo}_${formatDate(invoiceDate)}`;

      // Hide the loading overlay before Android may show the one-time folder picker
      setIsProcessing(false);
      try {
        const result = await savePdfToDevice(uri, fileName);
        if (result.saved && result.where === 'device') {
          Alert.alert('PDF Saved', `${fileName}.pdf was saved to your phone storage.`);
        } else if (!result.saved) {
          Alert.alert('Invoice saved', 'The invoice is saved, but no folder was chosen so the PDF was not stored. Download it again from the Ledger.');
        }
      } catch (saveErr) {
        // The invoice is already in the database, so do not let a storage problem cause a duplicate save.
        Alert.alert('Invoice saved', 'The PDF could not be written to storage: ' + saveErr.message + '. Download it again from the Ledger.');
      }

      // 5. AUTO-REFRESH & RESET FORM FOR NEW INVOICE
      setCustomerName('');
      setAddress('');
      setPhone('');
      setShipAddress('');
      setReceivedAmount('0.00');
      setItems([
        { id: Date.now(), description: '', hsn: '', gst: '', qty: '1', rate: '0.00' },
      ]);
      // Generate a fresh new invoice number for the next bill
      // (You can also trigger a state update for invoiceNo if managed via state)
      generateVendorInvoiceNumber();
      
    } catch (err) {
      setIsProcessing(false);
      console.error('Save & PDF Error:', err);
      Alert.alert('Save Error', err.message || 'An unexpected error occurred while saving.');
    }
  };
  return (
    <ScrollView style={styles.container}>
      <View style={styles.topHeader}>
        <Text style={styles.topHeaderTitle}>Billing Page </Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAndPDF} disabled={isProcessing}>
          <Text style={styles.saveBtnText}>Save & Download PDF</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.boldTitle}>TAX INVOICE</Text>
          <Text style={styles.subText}>ORIGINAL FOR RECIPIENT</Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.rowBetween}>
          <View style={{ flex: 1.2, paddingRight: 8 }}>
            <Text style={styles.vendorName}>
              {vendorProfile.business_name || 'Your Business Name'}
            </Text>
            <Text style={styles.smallText}>
              {vendorProfile.address || 'Address not set (ask Controller)'}
            </Text>
            <Text style={styles.smallText}>
              <Text style={{ fontWeight: 'bold' }}>GSTIN: </Text>
              {vendorProfile.gstin || 'N/A'}
            </Text>
            <Text style={styles.smallText}>
              <Text style={{ fontWeight: 'bold' }}>Contact: </Text>
              {vendorProfile.phone || 'N/A'}
            </Text>
          </View>

          <View style={styles.verticalDivider} />

          <View style={{ flex: 0.8, paddingLeft: 8 }}>
            <Text style={styles.fieldLabel}>Invoice No. (Auto)</Text>
            <TextInput style={styles.readOnlyInput} value={invoiceNo} editable={false} />
            <Text style={[styles.fieldLabel, { marginTop: 6 }]}>Invoice Date</Text>
            <DatePickerField value={invoiceDate} onChange={setInvoiceDate} />
          </View>
        </View>
        <View style={styles.divider} />

        {/* Bill To & Ship To Sections */}
        <View style={styles.rowBetween}>
          <View style={styles.billBox}>
            <Text style={styles.boxTitle}>BILL TO</Text>
            <TextInput
              style={styles.boxInput}
              placeholder="Customer Name"
              placeholderTextColor="#94a3b8"
              value={customerName}
              onChangeText={setCustomerName}
            />
            <TextInput
              style={styles.boxInput}
              placeholder="Address"
              placeholderTextColor="#94a3b8"
              value={address}
              onChangeText={setAddress}
            />
            <TextInput
              style={styles.boxInput}
              placeholder="Customer Phone Number"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <View style={styles.shipBox}>
            <View style={styles.rowBetween}>
              <Text style={styles.boxTitle}>SHIP TO</Text>
              <TouchableOpacity
                style={styles.sameAsBtn}
                onPress={() => setShipAddress(address)}
              >
                <Text style={styles.sameAsBtnText}>Same as Bill To</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.boxInput, { height: 72, textAlignVertical: 'top' }]}
              placeholder="Shipping Address"
              placeholderTextColor="#94a3b8"
              multiline={true}
              value={shipAddress}
              onChangeText={setShipAddress}
            />
          </View>
        </View>

        {/* Line Items Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { width: 25 }]}>#</Text>
          <Text style={[styles.th, { flex: 2 }]}>Product Name</Text>
          <Text style={[styles.th, { width: 45 }]}>HSN</Text>
          <Text style={[styles.th, { width: 38 }]}>GST%</Text>
          <Text style={[styles.th, { width: 35 }]}>QTY</Text>
          <Text style={[styles.th, { flex: 1 }]}>RATE</Text>
          <Text style={[styles.th, { width: 55, textAlign: 'right' }]}>AMOUNT (incl gst %)</Text>
          <View style={{ width: 30 }} />
        </View>

        {items.map((item, index) => {
          const itemAmount = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
          return (
            <View key={item.id} style={styles.tableRow}>
              <Text style={{ width: 25, textAlign: 'center', fontSize: 11, fontWeight: 'bold' }}>{index + 1}</Text>
              <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[styles.tdInput, { flex: 1 }]}
                  placeholder="Enter the product name"
                  placeholderTextColor="#94a3b8"
                  value={item.description}
                  onChangeText={(val) => handleUpdateItem(item.id, 'description', val)}
                />
                <TouchableOpacity onPress={() => openSearchModal(item.id)} style={styles.searchBtn}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>🔍</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.tdInput, { width: 45 }]}
                placeholder="HSN"
                placeholderTextColor="#94a3b8"
                value={item.hsn}
                onChangeText={(val) => handleUpdateItem(item.id, 'hsn', val)}
              />
              <TextInput
                style={[styles.tdInput, { width: 38 }]}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#94a3b8"
                value={item.gst}
                onChangeText={(val) => handleUpdateItem(item.id, 'gst', val)}
              />
              <TextInput
                style={[styles.tdInput, { width: 35 }]}
                keyboardType="numeric"
                placeholder="Qty"
                placeholderTextColor="#94a3b8"
                value={item.qty}
                onChangeText={(val) => handleUpdateItem(item.id, 'qty', val)}
              />
              <TextInput
                style={[styles.tdInput, { flex: 1 }]}
                keyboardType="numeric"
                placeholder="Rate"
                placeholderTextColor="#94a3b8"
                value={item.rate}
                onChangeText={(val) => handleUpdateItem(item.id, 'rate', val)}
              />
              <Text style={styles.amountText}>{itemAmount.toFixed(2)}</Text>
              <TouchableOpacity onPress={() => handleRemoveItem(item)} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
                <Text style={styles.deleteBtnText}>🗑</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity style={styles.addItemBtn} onPress={handleAddItem}>
          <Text style={styles.addItemBtnText}>+ Add Item Row</Text>
        </TouchableOpacity>

        <View style={styles.rowBetweenSummary}>
          <Text style={styles.summaryBoldText}>TOTAL QTY: {totalQty}</Text>
          <Text style={styles.summaryBoldText}>Total Amount : ₹{totalAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.receivedRow}>
          <Text style={styles.summaryBoldText}>RECEIVED AMOUNT</Text>
          <TextInput
            style={styles.receivedInput}
            keyboardType="numeric"
            value={receivedAmount}
            onChangeText={setReceivedAmount}
          />
        </View>
        <View style={styles.divider} />

        {/* Tax Breakdown Table (grouped by each item's GST %) */}
        <View style={styles.taxTable}>
          <View style={styles.taxHeaderRow}>
            <Text style={[styles.taxTh, { width: 50 }]}>GST %</Text>
            <Text style={[styles.taxTh, { flex: 1 }]}>Taxable Value</Text>
            <Text style={[styles.taxTh, { flex: 1 }]}>CGST</Text>
            <Text style={[styles.taxTh, { flex: 1 }]}>SGST</Text>
            <Text style={[styles.taxTh, { width: 70, textAlign: 'right' }]}>Total Tax Amount </Text>
          </View>
          {byRate.map((r) => (
            <View key={r.rate} style={styles.taxRow}>
              <Text style={[styles.taxTd, { width: 50 }]}>{r.rate}%</Text>
              <Text style={[styles.taxTd, { flex: 1 }]}>{r.taxable.toFixed(2)}</Text>
              <Text style={[styles.taxTd, { flex: 1 }]}>{(r.tax / 2).toFixed(2)}</Text>
              <Text style={[styles.taxTd, { flex: 1 }]}>{(r.tax / 2).toFixed(2)}</Text>
              <Text style={[styles.taxTd, { width: 70, textAlign: 'right', fontWeight: 'bold' }]}>₹{r.tax.toFixed(2)}</Text>
            </View>
          ))}
          <View style={[styles.taxRow, { backgroundColor: '#f1f5f9' }]}>
            <Text style={[styles.taxTd, { width: 50, fontWeight: 'bold' }]}>Total</Text>
            <Text style={[styles.taxTd, { flex: 1, fontWeight: 'bold' }]}>{taxableValue.toFixed(2)}</Text>
            <Text style={[styles.taxTd, { flex: 1, fontWeight: 'bold' }]}>{(totalTax / 2).toFixed(2)}</Text>
            <Text style={[styles.taxTd, { flex: 1, fontWeight: 'bold' }]}>{(totalTax / 2).toFixed(2)}</Text>
            <Text style={[styles.taxTd, { width: 70, textAlign: 'right', fontWeight: 'bold' }]}>₹{totalTax.toFixed(2)}</Text>
          </View>
        </View>

        {/* Amount in Words */}
        <View style={styles.wordsBox}>
          <Text style={styles.wordsTitle}>Total Amount (in words)</Text>
          <Text style={styles.wordsValue}>{numberToWords(totalAmount)}</Text>
        </View>
        <View style={styles.divider} />

        {/* Bank Details & Authorised Signatory */}
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.boldTitle}>Bank Details</Text>
            <Text style={styles.smallText}>Name: {bankDetails.name}</Text>
            <Text style={styles.smallText}>IFSC Code: {bankDetails.ifsc}</Text>
            <Text style={styles.smallText}>Account No: {bankDetails.accNo}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
            <Text style={styles.smallText}>Authorised Signatory For</Text>
            <Text style={[styles.smallText, { fontWeight: 'bold' }]} numberOfLines={1}>{vendorProfile.business_name || 'Your Business Name'}</Text>
          </View>
        </View>
      </View>

      {/* Processing Loader Overlay */}
      <Modal visible={isProcessing} transparent animationType="fade">
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.processingTitle}>Please Wait</Text>
            <Text style={styles.processingSubText}>{processingText}</Text>
          </View>
        </View>
      </Modal>

      {/* Suggestion Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Product From Catalog </Text>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search product name or HSN..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <FlatList
              data={combinedSuggestions}
              keyExtractor={(p, index) => p.id?.toString() || index.toString()}
              renderItem={({ item }) => {
                const name = item.item_name || item.name || item.description;
                const hsn = item.hsn_code || item.hsn || 'N/A';
                const price = item.unit_price || item.price || item.rate || '0.00';
                return (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => handleSelectProduct(item)}
                  >
                    <View>
                      <Text style={{ fontWeight: 'bold', color: '#fff' }}>{name}</Text>
                      <Text style={{ fontSize: 11, color: '#94a3b8' }}>HSN: {hsn}</Text>
                    </View>
                    <Text style={{ fontWeight: 'bold', color: '#38bdf8' }}>₹{price}</Text>
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  topHeader: { backgroundColor: '#801515', padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topHeaderTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#059669', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  saveBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  card: { backgroundColor: '#e2e8f0', margin: 10, borderRadius: 6, padding: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  boldTitle: { fontWeight: 'bold', fontSize: 14 },
  subText: { fontSize: 11, color: '#444' },
  divider: { height: 1, backgroundColor: '#94a3b8', marginVertical: 8 },
  verticalDivider: { width: 1, backgroundColor: '#94a3b8', marginHorizontal: 6 },
  vendorName: { fontWeight: 'bold', fontSize: 13 },
  smallText: { fontSize: 11, color: '#333' },
  fieldLabel: { fontSize: 10, fontWeight: 'bold', color: '#334155' },
  readOnlyInput: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', color: '#991b1b', fontWeight: 'bold', fontSize: 11, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  billBox: { borderRightWidth: 1, borderColor: '#94a3b8', paddingRight: 8, flex: 1 },
  shipBox: { paddingLeft: 8, flex: 1 },
  boxTitle: { fontWeight: 'bold', fontSize: 11, marginBottom: 4 },
  boxInput: { borderWidth: 1, borderColor: '#94a3b8', backgroundColor: '#fff', fontSize: 11, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, marginBottom: 4, color: '#000' },
  sameAsBtn: { backgroundColor: '#0284c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 4 },
  sameAsBtnText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#cbd5e1', paddingVertical: 6, paddingHorizontal: 4, marginTop: 10, borderRadius: 4 },
  th: { fontSize: 10, fontWeight: 'bold', color: '#333' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
  tdInput: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', fontSize: 11, padding: 4, borderRadius: 3, marginHorizontal: 2, color: '#000' },
  searchBtn: { backgroundColor: '#0284c7', padding: 6, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 26, height: 26, marginLeft: 4, borderRadius: 4, backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center' },
  deleteBtnText: { fontSize: 13 },
  amountText: { width: 55, textAlign: 'right', fontSize: 11, fontWeight: 'bold', color: '#000' },
  addItemBtn: { backgroundColor: '#334155', padding: 8, borderRadius: 6, alignItems: 'center', marginTop: 8 },
  addItemBtnText: { color: '#38bdf8', fontWeight: 'bold', fontSize: 12 },
  rowBetweenSummary: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  summaryBoldText: { fontWeight: 'bold', fontSize: 12, color: '#000' },
  receivedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  receivedInput: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', width: 100, padding: 4, fontSize: 12, borderRadius: 4, textAlign: 'right', color: '#000', fontWeight: 'bold' },
  taxTable: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, overflow: 'hidden', backgroundColor: '#fff', marginVertical: 6 },
  taxHeaderRow: { flexDirection: 'row', backgroundColor: '#cbd5e1', paddingVertical: 4, paddingHorizontal: 6 },
  taxTh: { fontSize: 9, fontWeight: 'bold', color: '#333' },
  taxRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, alignItems: 'center' },
  taxTd: { fontSize: 10, color: '#333' },
  wordsBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, padding: 6, marginVertical: 4 },
  wordsTitle: { fontSize: 10, fontWeight: 'bold', color: '#444' },
  wordsValue: { fontSize: 12, fontWeight: 'bold', color: '#000', marginTop: 2 },
  processingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  processingCard: { backgroundColor: '#1e293b', padding: 24, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155', width: '80%' },
  processingTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 12 },
  processingSubText: { color: '#94a3b8', fontSize: 12, marginTop: 6, textAlign: 'center' },
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '70%' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  modalSearchInput: { backgroundColor: '#0f172a', color: '#fff', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#334155', marginBottom: 12 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
  modalCloseBtn: { backgroundColor: '#ef4444', padding: 12, borderRadius: 6, alignItems: 'center', marginTop: 12 },
});