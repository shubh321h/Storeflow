import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';

import { AuthProvider, useAuth } from './context/AuthContext';
import { BusinessProvider, useBusiness } from './context/BusinessContext';
import { getDB } from './lib/database';
import { COLORS } from './lib/theme';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import BusinessSetupScreen from './screens/BusinessSetupScreen';
import HomeScreen from './screens/HomeScreen';
import ProductsScreen from './screens/ProductsScreen';
import BillingScreen from './screens/BillingScreen';
import CustomersScreen from './screens/CustomersScreen';
import MoreScreen from './screens/MoreScreen';
import CollectPaymentScreen from './screens/CollectPaymentScreen';
import ExpensesScreen from './screens/ExpensesScreen';
import BarcodeScannerScreen from './screens/BarcodeScannerScreen';
import SalesHistoryScreen from './screens/SalesHistoryScreen';
import SuppliersScreen from './screens/SuppliersScreen';
import BusinessSettingsScreen from './screens/BusinessSettingsScreen';
import InvoiceShareScreen from './screens/InvoiceShareScreen';
import CustomerDetailScreen from './screens/CustomerDetailScreen';
import SupplierDetailScreen from './screens/SupplierDetailScreen';
import PurchaseScreen from './screens/PurchaseScreen';
import TransactionHistoryScreen from './screens/TransactionHistoryScreen';
import ReportsScreen from './screens/ReportsScreen';
import SettingsScreen from './screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

function AuthNavigator() {
  const [screen, setScreen] = useState('login');
  return (
    <View style={{ flex: 1 }}>
      {screen === 'login' && <LoginScreen onNavigate={setScreen} />}
      {screen === 'register' && <RegisterScreen onNavigate={setScreen} />}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string = 'home';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Billing') iconName = focused ? 'receipt' : 'receipt-outline';
          else if (route.name === 'Products') iconName = focused ? 'cube' : 'cube-outline';
          else if (route.name === 'Customers') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'More') iconName = focused ? 'grid' : 'grid-outline';
          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarStyle: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingBottom: 8, paddingTop: 8, height: 64 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Billing" component={BillingScreen} />
      <Tab.Screen name="Products" component={ProductsScreen} />
      <Tab.Screen name="Customers" component={CustomersScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, isLoading: authLoading } = useAuth();
  const { business, isLoading: businessLoading, loadBusinesses } = useBusiness();
  const [hasBusiness, setHasBusiness] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkBusiness() {
      if (user) {
        const businesses = await loadBusinesses(user.id);
        setHasBusiness(businesses.length > 0);
      }
      setChecking(false);
    }
    checkBusiness();
  }, [user]);

  if (authLoading || businessLoading || checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) return <AuthNavigator />;
  if (!hasBusiness) return <BusinessSetupScreen onComplete={() => setHasBusiness(true)} />;

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainTabs} />
      <RootStack.Screen name="CollectPayment" component={CollectPaymentScreen} />
      <RootStack.Screen name="Expenses" component={ExpensesScreen} />
      <RootStack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} />
      <RootStack.Screen name="SalesHistory" component={SalesHistoryScreen} />
      <RootStack.Screen name="Suppliers" component={SuppliersScreen} />
      <RootStack.Screen name="BusinessSettings" component={BusinessSettingsScreen} />
      <RootStack.Screen name="InvoiceShare" component={InvoiceShareScreen} />
      <RootStack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
      <RootStack.Screen name="SupplierDetail" component={SupplierDetailScreen} />
      <RootStack.Screen name="Purchase" component={PurchaseScreen} />
      <RootStack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
      <RootStack.Screen name="Reports" component={ReportsScreen} />
      <RootStack.Screen name="Settings" component={SettingsScreen} />
    </RootStack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ ...Ionicons.font });
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    async function initDb() {
      await getDB();
      setDbReady(true);
    }
    initDb();
  }, []);

  if (!fontsLoaded || !dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#1B6B4B" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <BusinessProvider>
        <NavigationContainer>
          <StatusBar style="dark" backgroundColor="#F8FAFC" />
          <AppNavigator />
        </NavigationContainer>
      </BusinessProvider>
    </AuthProvider>
  );
}
