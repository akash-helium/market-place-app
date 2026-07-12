import * as ImagePicker from "expo-image-picker";
import { api } from "../api/client";

export async function pickAndUploadImage(
  aspect: [number, number] = [1, 1]
): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect,
    quality: 0.85,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
  const type = asset.mimeType ?? "image/jpeg";
  const form = new FormData();
  form.append("file", {
    uri: asset.uri,
    name,
    type,
  } as unknown as Blob);

  const data = await api<{ url: string }>("/api/uploads", {
    method: "POST",
    formData: form,
  });
  return data.url;
}
