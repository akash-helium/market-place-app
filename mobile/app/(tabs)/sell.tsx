import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Subtitle, Title } from "../../src/components/ui";
import { colors, space } from "../../src/theme";

export default function SellScreen() {
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <Title>Sell on HarvestHub</Title>
      <Subtitle>List one product or manage orders from buyers.</Subtitle>
      <Button title="Add one product" onPress={() => router.push("/sell/add")} />
      <Button title="Seller order book" onPress={() => router.push({ pathname: "/orders", params: { as: "seller" } })} variant="ghost" />
      <Button title="Buyer queries" onPress={() => router.push("/queries")} variant="ghost" />
      <Text style={styles.hint}>Need a shop first? Profile → Edit shop.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: space.lg },
  hint: { marginTop: space.lg, color: colors.muted, fontSize: 13 },
});
