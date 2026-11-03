import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { supabase } from './src/config/supabase';
import AuthScreen from './src/components/AuthScreen';
import InvoiceWorkstation from './src/components/InvoiceWorkstation';
import ProductCatalogScreen from './src/screens/ProductCatalogScreen';
import InvoiceHistoryScreen from './src/screens/InvoiceHistoryScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import AccountScreen from './src/screens/AccountScreen';

const Tab = createBottomTabNavigator();
const TAB_ICONS = {
  ControlPanel: '🛠️', GlobalLedger: '📚', AdminAccount: '👤',
  Workstation: '🧾', Catalog: '📦', History: '📒', Reports: '📊', Account: '👤',
};

export default function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState('VENDOR');
  const [vendorProfile, setVendorProfile] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id);
      else setLoading(false);
    });

    // Listen for sign-in / sign-out events
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id);
      else {
        setVendorProfile({});
        setUserRole('VENDOR');
        setLoading(false);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId) => {
    try {
      // 1. Fetch user status via RPC to bypass RLS restrictions
      const { data: statusData, error: rpcErr } = await supabase.rpc('check_user_status', {
        user_id: userId,
      });

      if (!rpcErr && statusData && statusData.length > 0) {
        setUserRole(statusData[0].role || 'VENDOR');
      }

      // 2. Fetch profile configuration details
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        setVendorProfile(data);
        if (data.role) setUserRole(data.role);
      }
    } catch (err) {
      console.log('Profile Load Error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  // Display Login/Signup screen if not authenticated
  if (!session) {
    return <AuthScreen onLoginSuccess={() => setLoading(true)} />;
  }

  const isAdmin = userRole === 'ADMIN';

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 18, color }}>{TAB_ICONS[route.name] || '•'}</Text>
          ),
          headerStyle: { backgroundColor: '#1e293b' },
          headerTintColor: '#fff',
          headerRight: () => (
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          ),
          tabBarStyle: { backgroundColor: '#0f172a', borderColor: '#334155' },
          tabBarActiveTintColor: '#38bdf8',
          tabBarInactiveTintColor: '#94a3b8',
        })}
      >
        {isAdmin ? (
          /* ==================== CONTROLLER ADMIN INTERFACE ==================== */
          <>
            <Tab.Screen
              name="ControlPanel"
              component={AdminDashboardScreen}
              options={{ title: 'Controller Panel' }}
            />
            <Tab.Screen
              name="GlobalLedger"
              options={{ title: 'All Vendor Invoices' }}
            >
              {() => <InvoiceHistoryScreen isAdmin={true} />}
            </Tab.Screen>

            <Tab.Screen name="AdminAccount" options={{ title: 'Account' }}>
              {() => <AccountScreen vendorProfile={vendorProfile} />}
            </Tab.Screen>
          </>
        ) : (
          /* ==================== VENDOR OPERATIONAL INTERFACE ==================== */
          <>
            <Tab.Screen
              name="Workstation"
              options={{ title: 'Invoice Builder' }}
            >
              {() => <InvoiceWorkstation vendorProfile={vendorProfile} />}
            </Tab.Screen>

            <Tab.Screen
              name="Catalog"
              component={ProductCatalogScreen}
              options={{ title: 'Inventory' }}
            />

            <Tab.Screen
              name="History"
              options={{ title: 'Ledger' }}
            >
              {() => <InvoiceHistoryScreen vendorProfile={vendorProfile} />}
            </Tab.Screen>

            <Tab.Screen name="Reports" options={{ title: 'Reports' }}>
              {() => <ReportsScreen vendorProfile={vendorProfile} />}
            </Tab.Screen>

            <Tab.Screen name="Account" options={{ title: 'Account' }}>
              {() => <AccountScreen vendorProfile={vendorProfile} />}
            </Tab.Screen>
          </>
        )}
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loaderContainer: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  logoutBtn: { marginRight: 14, backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  logoutText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});