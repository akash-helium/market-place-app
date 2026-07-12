import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, ApiError, getApiBaseUrl } from "../../src/api/client";
import type { Category, Subcategory } from "../../src/api/types";
import { useAuth } from "../../src/auth/AuthContext";
import { Button, ErrorText, Field, Label, Title } from "../../src/components/ui";
import { colors, font, radius, space } from "../../src/theme";

export default function AddProductScreen() {
  const router = useRouter();
  const { token, me } = useAuth();
  const [mode, setMode] = useState<"one" | "bulk">("one");
  const [categories, setCategories] = useState<Category[]>([]);
  const [subs, setSubs] = useState<Subcategory[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [title, setTitle] = useState("");
  const [packSize, setPackSize] = useState("30 kg");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("40");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    const data = await api<{ categories: Category[] }>("/api/categories");
    setCategories(data.categories);
  }, []);

  const loadSubs = useCallback(async (catId: number) => {
    const data = await api<{ subcategories: Subcategory[] }>(
      `/api/categories/${catId}/subcategories`
    );
    setSubs(data.subcategories);
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!categoryId) {
      setSubs([]);
      setSubcategoryId(null);
      return;
    }
    void loadSubs(categoryId).then(() => setSubcategoryId(null));
  }, [categoryId, loadSubs]);

  async function addCategory() {
    const name = newCategory.trim();
    if (!name) {
      setError("Type a category name first");
      return;
    }
    if (!me?.shopId) {
      setError("Set up your shop first (Profile)");
      return;
    }
    setAddingCat(true);
    setError(null);
    try {
      const data = await api<{ id: number; name: string }>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      await loadCategories();
      setCategoryId(data.id);
      setNewCategory("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add category");
    } finally {
      setAddingCat(false);
    }
  }

  async function addSubcategory() {
    const name = newSubcategory.trim();
    if (!categoryId) {
      setError("Pick or add a category first");
      return;
    }
    if (!name) {
      setError("Type a subcategory name first");
      return;
    }
    setAddingSub(true);
    setError(null);
    try {
      const data = await api<{ id: number; name: string }>(
        `/api/categories/${categoryId}/subcategories`,
        { method: "POST", body: JSON.stringify({ name }) }
      );
      await loadSubs(categoryId);
      setSubcategoryId(data.id);
      setNewSubcategory("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add subcategory");
    } finally {
      setAddingSub(false);
    }
  }

  async function submitOne() {
    if (!me?.shopId) {
      setError("Set up your shop first (Profile)");
      return;
    }
    if (!categoryId || !title.trim()) {
      setError("Category and title required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        categoryId,
        subcategoryId: subcategoryId ?? undefined,
        title: title.trim(),
        packSize,
        inStock: true,
        stockUnits: Number(stock) || undefined,
      };
      if (price.trim()) body.priceRupees = Number(price);
      const data = await api<{ productId: number; message: string }>("/api/products", {
        method: "POST",
        body: JSON.stringify(body),
      });
      Alert.alert("Live", data.message, [
        { text: "List another", onPress: () => setTitle("") },
        { text: "Done", onPress: () => router.replace(`/product/${data.productId}`) },
      ]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not list product");
    } finally {
      setLoading(false);
    }
  }

  async function downloadTemplate() {
    const url = `${getApiBaseUrl()}/api/products/bulk/template`;
    Alert.alert("Template", `Open this URL on your computer to download:\n${url}`);
  }

  async function uploadBulk() {
    if (!me?.shopId) {
      setError("Set up your shop first");
      return;
    }
    const pick = await DocumentPicker.getDocumentAsync({
      type: [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
        "application/vnd.ms-excel",
      ],
      copyToCacheDirectory: true,
    });
    if (pick.canceled || !pick.assets?.[0]) return;
    const asset = pick.assets[0];
    setLoading(true);
    setError(null);
    setBulkResult(null);
    try {
      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: asset.name ?? "price-list.xlsx",
        type: asset.mimeType ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      } as unknown as Blob);
      const res = await fetch(`${getApiBaseUrl()}/api/products/bulk`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const json = await res.json();
      if (!json.ok) throw new ApiError(json.error || "Upload failed", res.status);
      const d = json.data as { totalRows: number; listed: number; failed: number };
      setBulkResult(`${d.listed} of ${d.totalRows} listed${d.failed ? ` · ${d.failed} failed` : ""}`);
      await loadCategories();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Bulk upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Title style={{ fontSize: 22 }}>List a product</Title>
      </View>

      <View style={styles.seg}>
        <Pressable
          style={[styles.segItem, mode === "one" && styles.segActive]}
          onPress={() => setMode("one")}
        >
          <Text style={[styles.segText, mode === "one" && styles.segTextActive]}>Add one</Text>
        </Pressable>
        <Pressable
          style={[styles.segItem, mode === "bulk" && styles.segActive]}
          onPress={() => setMode("bulk")}
        >
          <Text style={[styles.segText, mode === "bulk" && styles.segTextActive]}>Bulk upload</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        {mode === "one" ? (
          <>
            <Label>Category</Label>
            <Text style={styles.hint}>Tap an existing one, or add your own below.</Text>
            <View style={styles.pills}>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  style={[styles.pill, categoryId === c.id && styles.pillOn]}
                >
                  <Text style={[styles.pillText, categoryId === c.id && styles.pillTextOn]}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.addRow}>
              <Field
                well
                style={{ flex: 1, marginTop: 0 }}
                value={newCategory}
                onChangeText={setNewCategory}
                placeholder="New category (e.g. Besan)"
                onSubmitEditing={addCategory}
              />
              <Pressable
                style={[styles.addBtn, addingCat && { opacity: 0.6 }]}
                onPress={addCategory}
                disabled={addingCat}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </Pressable>
            </View>

            <Label>Subcategory</Label>
            <Text style={styles.hint}>Optional — pick one or create a new subtype.</Text>
            {categoryId ? (
              <>
                <View style={styles.pills}>
                  {subs.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => setSubcategoryId(s.id)}
                      style={[styles.pill, subcategoryId === s.id && styles.pillOn]}
                    >
                      <Text
                        style={[styles.pillText, subcategoryId === s.id && styles.pillTextOn]}
                      >
                        {s.name}
                      </Text>
                    </Pressable>
                  ))}
                  {subs.length === 0 ? (
                    <Text style={styles.emptySubs}>No subtypes yet for this category</Text>
                  ) : null}
                </View>
                <View style={styles.addRow}>
                  <Field
                    well
                    style={{ flex: 1, marginTop: 0 }}
                    value={newSubcategory}
                    onChangeText={setNewSubcategory}
                    placeholder="New subcategory (e.g. Chitra)"
                    onSubmitEditing={addSubcategory}
                  />
                  <Pressable
                    style={[styles.addBtn, addingSub && { opacity: 0.6 }]}
                    onPress={addSubcategory}
                    disabled={addingSub}
                  >
                    <Ionicons name="add" size={22} color="#fff" />
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={styles.emptySubs}>Select a category first to add subtypes</Text>
            )}

            <Label>Title</Label>
            <Field well value={title} onChangeText={setTitle} placeholder="Chitra Pila Badshah" />
            <Label>Pack size</Label>
            <Field well value={packSize} onChangeText={setPackSize} />
            <Label>Price (₹) — blank = N/A</Label>
            <Field
              well
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="12600"
            />
            <Label>Stock units</Label>
            <Field well value={stock} onChangeText={setStock} keyboardType="number-pad" />
            <ErrorText>{error}</ErrorText>
            <Button title="Publish" onPress={submitOne} loading={loading} />
          </>
        ) : (
          <>
            <Text style={styles.bulkHint}>
              Upload the shop price list Excel (ITEMS / TRADEMARK / WEIGHT / PRICE) or the HarvestHub
              template. New category and subcategory names in the file are created automatically.
            </Text>
            <View style={styles.uploadWell}>
              <Text style={styles.uploadTitle}>Drop your .xlsx or CSV</Text>
              <Text style={styles.uploadMeta}>Max 10 MB · same format as the godown rate sheet</Text>
            </View>
            <Button title="Choose file & upload" onPress={uploadBulk} loading={loading} />
            <Button title="Download template" onPress={downloadTemplate} variant="ghost" />
            {bulkResult ? <Text style={styles.result}>{bulkResult}</Text> : null}
            <ErrorText>{error}</ErrorText>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  back: { fontSize: 22, color: colors.ink, width: 32 },
  seg: {
    marginHorizontal: space.lg,
    marginTop: 14,
    flexDirection: "row",
    backgroundColor: colors.rail,
    borderRadius: 16,
    padding: 4,
  },
  segItem: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 12 },
  segActive: {
    backgroundColor: colors.surface,
    shadowColor: "#141419",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  segText: { fontFamily: font.semibold, color: colors.muted },
  segTextActive: { color: colors.ink, fontFamily: font.bold },
  wrap: { padding: space.lg, paddingBottom: 48 },
  hint: {
    fontFamily: font.medium,
    color: colors.muted,
    fontSize: 13,
    marginBottom: 10,
    marginTop: -4,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  pillOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pillText: { fontFamily: font.semibold, color: colors.muted, fontSize: 13 },
  pillTextOn: { color: colors.accent },
  addRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  emptySubs: {
    fontFamily: font.medium,
    color: colors.muted,
    fontSize: 13,
    marginBottom: 8,
  },
  bulkHint: { fontFamily: font.medium, color: colors.muted, marginBottom: 14, lineHeight: 20 },
  uploadWell: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 28,
    backgroundColor: colors.well,
    alignItems: "center",
  },
  uploadTitle: { fontFamily: font.bold, color: colors.ink, fontSize: 16 },
  uploadMeta: { marginTop: 6, fontFamily: font.medium, color: colors.muted, fontSize: 13 },
  result: { marginTop: 14, fontFamily: font.bold, color: colors.accent },
});
