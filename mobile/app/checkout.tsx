import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api, ApiError } from "../src/api/client";
import { Button, ErrorText, Field, Label, Title } from "../src/components/ui";
import { colors, space } from "../src/theme";

export default function CheckoutScreen() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{
        orders: { orderId: number; orderNumber: string }[];
        payments: { orderId: number }[];
      }>("/api/orders/checkout", {
        method: "POST",
        body: JSON.stringify({
          deliveryAddress: address.trim(),
          deliveryPincode: pincode.trim(),
        }),
      });

      // Dev mock payment for each order
      for (const p of data.payments) {
        await api("/api/payments/mock/confirm", {
          method: "POST",
          body: JSON.stringify({ orderId: p.orderId }),
        });
      }

      Alert.alert("Order placed", data.orders.map((o) => o.orderNumber).join(", "), [
        {
          text: "View orders",
          onPress: () => router.replace("/orders"),
        },
      ]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Title>Checkout</Title>
      <Text style={styles.hint}>Dev mode uses mock payment — no real charge.</Text>
      <Label>Delivery address</Label>
      <Field value={address} onChangeText={setAddress} placeholder="MI Road, Jaipur" />
      <Label>Pincode</Label>
      <Field
        value={pincode}
        onChangeText={setPincode}
        placeholder="302001"
        keyboardType="number-pad"
        maxLength={6}
      />
      <ErrorText>{error}</ErrorText>
      <Button
        title="Pay & place order"
        onPress={pay}
        loading={loading}
        disabled={address.trim().length < 3 || pincode.length < 6}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: space.lg },
  hint: { marginTop: 8, color: colors.muted, marginBottom: 8 },
});
