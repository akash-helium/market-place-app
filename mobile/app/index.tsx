import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/auth/AuthContext";
import { colors } from "../src/theme";

export default function Index() {
  const { ready, token, me } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  if (!token) return <Redirect href="/(auth)/phone" />;
  if (me && !me.onboarded) return <Redirect href="/(onboarding)/shop-setup" />;
  return <Redirect href="/(tabs)" />;
}
