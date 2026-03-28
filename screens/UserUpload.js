import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Image,
  Alert,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../lib/supabase";
import { Buffer } from "buffer";

export default function UserUpload({ goToAdmin = () => {} }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [purpose, setPurpose] = useState("");
  const [image, setImage] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false); 

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert("Camera permission required");

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      aspect: [4, 4],
      quality: 0.3, 
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const handlePhoneChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, ""); 
    if (cleaned.length <= 10) setPhone(cleaned);
  };

  const checkDuplicate = async () => {
    const today = new Date().toISOString().split("T")[0];

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("phone", phone)
      .eq("date", today)
      .is("out_time", null);

    return data.length > 0;
  };

  const uploadData = async () => {
    if (loading) return; 

    if (!name || !phone || !city || !purpose || !image) {
      return Alert.alert("Fill all fields");
    }

    if (phone.length !== 10) {
      return Alert.alert("Phone must be exactly 10 digits");
    }

    setLoading(true);

    const exists = await checkDuplicate();
    if (exists) {
      setLoading(false);
      return Alert.alert("Already checked IN. Please OUT first.");
    }

    try {
      const now = new Date();

      const imageName = `${Date.now()}.jpg`;
      const base64 = await FileSystem.readAsStringAsync(image, {
        encoding: "base64",
      });
      const binary = Buffer.from(base64, "base64");

      await supabase.storage.from("photos").upload(imageName, binary);

      const { data: publicUrl } = supabase.storage
        .from("photos")
        .getPublicUrl(imageName);

      await supabase.from("profiles").insert([
        {
          name,
          phone,
          city,
          purpose,
          image_url: publicUrl.publicUrl,
          date: now.toISOString().split("T")[0],
          in_time: now.toISOString(),
          out_time: null,
        },
      ]);

      fetchToday();

      setName("");
      setPhone("");
      setCity("");
      setPurpose("");
      setImage(null);
      setLoading(false);

      Alert.alert("Entry Saved");
    } catch (e) {
      setLoading(false);
      Alert.alert("Error", e.message);
    }
  };

  const fetchToday = async () => {
    const today = new Date().toISOString().split("T")[0];

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("date", today)
      .order("in_time", { ascending: false });

    setEntries(data || []);
  };

  const handleOut = async (id) => {
    await supabase
      .from("profiles")
      .update({ out_time: new Date().toISOString() })
      .eq("id", id);

    fetchToday();
  };

  useEffect(() => {
    fetchToday();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={styles.container}>
            <Text style={styles.title}>Visitor Entry</Text>

            {/* 📸 PHOTO BUTTON FIRST */}
            <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
              <Text style={{ color: "#fff" }}>Take Photo</Text>
            </TouchableOpacity>

            <TextInput
              placeholder="Name"
              placeholderTextColor="#0f0e0e"
              value={name}
              onChangeText={setName}
              style={styles.input}
            />

            <TextInput
              placeholder="Phone (10 digits)"
              placeholderTextColor="#0f0e0e"
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="number-pad"
              style={styles.input}
            />

            <TextInput
              placeholder="City"
              placeholderTextColor="#0f0e0e"
              value={city}
              onChangeText={setCity}
              style={styles.input}
            />
            <TextInput
              placeholder="Purpose"
              placeholderTextColor="#0f0e0e"
              value={purpose}
              onChangeText={setPurpose}
              style={styles.input}
            />

            {/* 📸 IMAGE BELOW PURPOSE */}
            {image && <Image source={{ uri: image }} style={styles.image} />}

            {/* 🔵 SUBMIT BUTTON */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && { backgroundColor: "gray" }]}
              onPress={uploadData}
              disabled={loading}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>
                {loading ? "Submitting..." : "Submit (IN)"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.subtitle}>Today's Entries</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Image source={{ uri: item.image_url }} style={styles.smallImg} />

            <View style={{ flex: 1 }}>
              <Text>{item.name}</Text>
              <Text>{item.city}</Text>
              <Text>
                IN:{" "}
                {new Date(
                  new Date(item.in_time).getTime() + 5.5 * 60 * 60 * 1000,
                ).toLocaleString()}
              </Text>
              <Text>
                OUT:{" "}
                {item.out_time
                  ? new Date(
                      new Date(item.out_time).getTime() + 5.5 * 60 * 60 * 1000,
                    ).toLocaleString()
                  : "--"}
              </Text>
            </View>

            {!item.out_time && (
              <Button title="OUT" onPress={() => handleOut(item.id)} />
            )}
          </View>
        )}
      />
      <TouchableOpacity style={styles.adminBtn} onPress={goToAdmin}>
        <Text style={styles.adminText}>Admin Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 10 },
  subtitle: { marginTop: 20, fontSize: 18 },

  input: {
    borderWidth: 1,
    marginVertical: 8,
    padding: 10,
    borderRadius: 8,
  },

  adminBtn: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },

  adminText: {
    color: "#fff",
    fontWeight: "bold",
  },

  photoBtn: {
    backgroundColor: "#007bff",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },

  submitBtn: {
    backgroundColor: "#007bff",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },

  image: {
    width: 200,
    height: 200,
    marginVertical: 10,
    alignSelf: "center",
    borderRadius: 10,
  },

  smallImg: {
    width: 60,
    height: 60,
    marginRight: 10,
    borderRadius: 8,
  },

  item: {
    flexDirection: "row",
    margin: 10,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
  },
});
