import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { supabase } from '../config/supabase';

export default function ProductCatalogScreen() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productCode, setProductCode] = useState('');
  const [name, setName] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [price, setPrice] = useState('');
  const [gstPercent, setGstPercent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!productCode || !name || !price) {
      Alert.alert('Validation Error', 'Please provide Product Code, Name, and Price.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('products').insert([
        {
          vendor_id: user.id,
          product_code: productCode,
          name,
          hsn_code: hsnCode,
          price: parseFloat(price) || 0.00,
          gst_percent: parseFloat(gstPercent) || 0,
        },
      ]);

      if (error) throw error;

      Alert.alert('Success', 'Product added to catalog!');
      setProductCode('');
      setName('');
      setHsnCode('');
      setPrice('');
      setGstPercent('');
      fetchProducts();
    } catch (err) {
      Alert.alert('Error Adding Product', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      fetchProducts();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Product Catalog Management</Text>

      {/* Add Product Form */}
      <View style={styles.formCard}>
        <Text style={styles.cardTitle}>Add New Product</Text>
        <TextInput
          style={styles.input}
          placeholder="Product Code (e.g. 1001)"
          placeholderTextColor="#94a3b8"
          value={productCode}
          onChangeText={setProductCode}
        />
        <TextInput
          style={styles.input}
          placeholder="Item Name (e.g. LED Headlight Bulb)"
          placeholderTextColor="#94a3b8"
          value={name}
          onChangeText={setName}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="HSN Code"
            placeholderTextColor="#94a3b8"
            value={hsnCode}
            onChangeText={setHsnCode}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Unit Price (₹)"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            value={price}
            onChangeText={setPrice}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="GST % (e.g. 5, 12, 18, 28 - leave blank for 0)"
          placeholderTextColor="#94a3b8"
          keyboardType="numeric"
          value={gstPercent}
          onChangeText={setGstPercent}
        />

        <TouchableOpacity style={styles.addBtn} onPress={handleAddProduct} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.addBtnText}>Save Product</Text>}
        </TouchableOpacity>
      </View>

      {/* Product List */}
      <Text style={[styles.cardTitle, { marginTop: 16, marginBottom: 8 }]}>Catalog Inventory</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#38bdf8" />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                <Text style={styles.itemSub}>Code: {item.product_code} | HSN: {item.hsn_code || 'N/A'} | GST: {parseFloat(item.gst_percent || 0)}%</Text>
              </View>
              <Text style={styles.itemPrice}>₹{parseFloat(item.price).toFixed(2)}</Text>
              <TouchableOpacity onPress={() => handleDeleteProduct(item.id)} style={styles.deleteBtn}>
                <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 14 },
  headerTitle: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  formCard: { backgroundColor: '#1e293b', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  cardTitle: { color: '#38bdf8', fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 6, color: '#fff', padding: 8, fontSize: 13, marginBottom: 8 },
  addBtn: { backgroundColor: '#059669', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 4 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  itemCard: { backgroundColor: '#1e293b', padding: 10, borderRadius: 6, flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  itemTitle: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  itemSub: { color: '#94a3b8', fontSize: 11 },
  itemPrice: { color: '#34d399', fontWeight: 'bold', fontSize: 14, marginRight: 10 },
  deleteBtn: { padding: 4 },
});