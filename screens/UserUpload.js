import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, Image, Alert, StyleSheet,
  FlatList, TouchableOpacity, Modal, ScrollView
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabase";
import { Picker } from "@react-native-picker/picker";
import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

// ----- SAFE DATE FORMATTER -----
const formatDate = (date) => {
  if (!date) return "--";
  return new Date(new Date(date).getTime() + 5.5 * 3600000).toLocaleString();
};

const uploadImages = async (localUris) => {
  const urls = [];

  for (const uri of localUris) {
    try {
      const fileName = `${Date.now()}_${Math.random()}.jpg`;

      // ✅ Convert to ArrayBuffer (WORKS in Expo)
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error } = await supabase.storage
        .from("photos")
        .upload(fileName, arrayBuffer, {
          contentType: "image/jpeg",
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from("photos")
        .getPublicUrl(fileName);

      urls.push(data.publicUrl);

    } catch (err) {
      console.error("Upload error:", err);
      throw new Error(`Image upload failed: ${err.message}`);
    }
  }

  return urls;
};

// ... rest of your component remains exactly the same

export default function UserUpload({ goToAdmin = () => {} }) {
  const [activeTab, setActiveTab] = useState("visitor");
  const [loading, setLoading] = useState(false);
  const [visitorEntries, setVisitorEntries] = useState([]);
  const [goodsEntries, setGoodsEntries] = useState([]);
  const [searchVisitor, setSearchVisitor] = useState("");
  const [searchGoods, setSearchGoods] = useState("");
  const [selectedEntryImages, setSelectedEntryImages] = useState(null);
  const [approvalOptions, setApprovalOptions] = useState([]);

  // Visitor form
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorCity, setVisitorCity] = useState("");
  const [visitorEntryType, setVisitorEntryType] = useState("visitor");
  const [visitorPurpose, setVisitorPurpose] = useState("");
  const [visitorImages, setVisitorImages] = useState([]);

  // Goods form
  const [goodsItem, setGoodsItem] = useState("");
  const [goodsQuantity, setGoodsQuantity] = useState("");
  const [goodsMovement, setGoodsMovement] = useState("Inward");
  const [goodsVendor, setGoodsVendor] = useState("");
  const [goodsVehicle, setGoodsVehicle] = useState("");
  const [goodsApproval, setGoodsApproval] = useState("");
  const [goodsImages, setGoodsImages] = useState([]);

  // ----- Image picking helpers -----
  const pickMultipleImages = async (setImages) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Gallery permission required");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.5,
    });
    if (!result.canceled) {
      const uris = result.assets.map(asset => asset.uri);
      setImages(prev => [...prev, ...uris]);
    }
  };

  const takePhoto = async (setImages) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert("Camera permission required");
const result = await ImagePicker.launchCameraAsync({
  mediaTypes: ['images'],
  quality: 0.5
});    if (!result.canceled) setImages(prev => [...prev, result.assets[0].uri]);
  };

  const removeImage = (uri, setImages) => {
    setImages(prev => prev.filter(img => img !== uri));
  };

  // ----- Visitor -----
  const fetchVisitorToday = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("date", today)
      .order("in_time", { ascending: false });
    setVisitorEntries(data || []);
  };

  const checkDuplicateVisitor = async (phone) => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("phone", phone)
      .eq("date", today)
      .is("out_time", null);
    return data.length > 0;
  };

  const submitVisitor = async () => {
    if (loading) return;
    if (!visitorName || !visitorPhone || !visitorCity || !visitorPurpose || visitorImages.length === 0) {
      return Alert.alert("Fill all fields and add at least one photo");
    }
    if (visitorPhone.length !== 10) return Alert.alert("Phone must be 10 digits");
    setLoading(true);
    const exists = await checkDuplicateVisitor(visitorPhone);
    if (exists) {
      setLoading(false);
      return Alert.alert("Already checked IN. Please OUT first.");
    }
    try {
      const now = new Date();
      const imageUrls = await uploadImages(visitorImages);
      await supabase.from("profiles").insert([{
        name: visitorName,
        phone: visitorPhone,
        city: visitorCity,
        entry_type: visitorEntryType,
        purpose: visitorPurpose,
        image_urls: imageUrls,
        date: now.toISOString().split("T")[0],
        in_time: now.toISOString(),
        out_time: null,
      }]);
      setVisitorName(""); setVisitorPhone(""); setVisitorCity("");
      setVisitorPurpose(""); setVisitorImages([]);
      fetchVisitorToday();
      Alert.alert("Success", "Visitor entry saved");
    } catch (e) { 
      Alert.alert("Error", e.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleVisitorOut = async (id) => {
    Alert.alert("Confirm OUT", "Mark this visitor as OUT?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes", onPress: async () => {
          await supabase.from("profiles").update({ out_time: new Date().toISOString() }).eq("id", id);
          fetchVisitorToday();
        }
      }
    ]);
  };

  // ----- Goods -----
  const fetchGoodsToday = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("goods_entries")
      .select("*")
      .eq("date", today)
      .order("timestamp", { ascending: false });
    setGoodsEntries(data || []);
  };

  const fetchApprovalOptions = async () => {
    const { data } = await supabase.from("approval_references").select("name");
    setApprovalOptions(data?.map(item => item.name) || []);
    if (data?.length && !goodsApproval) setGoodsApproval(data[0].name);
  };

  const submitGoods = async () => {
    if (loading) return;
    if (!goodsItem || !goodsQuantity || !goodsVendor || !goodsVehicle || !goodsApproval || goodsImages.length === 0) {
      return Alert.alert("Fill all fields and add at least one photo");
    }
    setLoading(true);
    try {
      const now = new Date();
      const imageUrls = await uploadImages(goodsImages);
      await supabase.from("goods_entries").insert([{
        item_description: goodsItem,
        quantity: parseInt(goodsQuantity),
        movement_type: goodsMovement,
        vendor_person_name: goodsVendor,
        vehicle_number: goodsVehicle,
        approval_reference: goodsApproval,
        image_urls: imageUrls,
        timestamp: now.toISOString(),
        date: now.toISOString().split("T")[0],
        out_time: null,
      }]);
      setGoodsItem(""); setGoodsQuantity(""); setGoodsVendor("");
      setGoodsVehicle(""); setGoodsImages([]);
      fetchGoodsToday();
      Alert.alert("Success", "Goods entry saved");
    } catch (e) { 
      Alert.alert("Error", e.message); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    fetchVisitorToday();
    fetchGoodsToday();
    fetchApprovalOptions();
  }, []);

  // ----- Render helpers -----
  const renderImagePreview = (images, setImages) => (
    <FlatList
      horizontal
      data={images}
      keyExtractor={(_, idx) => idx.toString()}
      renderItem={({ item }) => (
        <View style={styles.previewImageContainer}>
          <Image source={{ uri: item }} style={styles.previewImage} />
          <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeImage(item, setImages)}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      style={styles.previewList}
    />
  );

  const filteredVisitors = visitorEntries.filter(e => e.name.toLowerCase().includes(searchVisitor.toLowerCase()));
  const filteredGoods = goodsEntries.filter(e => e.item_description.toLowerCase().includes(searchGoods.toLowerCase()));

  return (
<View style={{ flex: 1, paddingTop: 30 }}>
        <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "visitor" && styles.activeTab]}
          onPress={() => setActiveTab("visitor")}
        >
          <Text style={[styles.tabText, activeTab === "visitor" && styles.activeTabText]}>👥 Visitor Entry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "goods" && styles.activeTab]}
          onPress={() => setActiveTab("goods")}
        >
          <Text style={[styles.tabText, activeTab === "goods" && styles.activeTabText]}>📦 Goods Tracking</Text>
        </TouchableOpacity>
      </View>

      <FlatList
      keyboardShouldPersistTaps="handled"
        data={activeTab === "visitor" ? filteredVisitors : filteredGoods}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          activeTab === "visitor" ? (
            <View style={styles.container}>
              <Text style={styles.title}>Visitor Entry</Text>
              <View style={styles.photoRow}>
                <TouchableOpacity style={styles.photoBtn} onPress={() => takePhoto(setVisitorImages)}>
                  <Text style={styles.photoBtnText}>📷 Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoBtn} onPress={() => pickMultipleImages(setVisitorImages)}>
                  <Text style={styles.photoBtnText}>🖼️ Gallery</Text>
                </TouchableOpacity>
              </View>
              {renderImagePreview(visitorImages, setVisitorImages)}
              <TextInput placeholder="Full Name" placeholderTextColor="#999" value={visitorName} onChangeText={setVisitorName} style={styles.input} />
              <TextInput placeholder="Phone (10 digits)" placeholderTextColor="#999" value={visitorPhone} onChangeText={(t) => setVisitorPhone(t.replace(/[^0-9]/g, "").slice(0, 10))} keyboardType="number-pad" style={styles.input} />
              <TextInput placeholder="City" placeholderTextColor="#999" value={visitorCity} onChangeText={setVisitorCity} style={styles.input} />
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>Entry Type:</Text>
                <Picker selectedValue={visitorEntryType} onValueChange={setVisitorEntryType} style={styles.picker}>
                  <Picker.Item label="Visitor" value="visitor" />
                  <Picker.Item label="Employee" value="employee" />
                  <Picker.Item label="Vendor" value="vendor" />
                </Picker>
              </View>
              <TextInput placeholder="Purpose of Visit" placeholderTextColor="#999" value={visitorPurpose} onChangeText={setVisitorPurpose} style={styles.input} />
              <TouchableOpacity style={styles.submitBtn} onPress={submitVisitor} disabled={loading}>
                <Text style={styles.submitBtnText}>{loading ? "Submitting..." : "✅ Check IN"}</Text>
              </TouchableOpacity>
              <Text style={styles.subtitle}>Today's Visitors</Text>
              <TextInput placeholder="Search by name..." placeholderTextColor="#999" value={searchVisitor} onChangeText={setSearchVisitor} style={styles.searchInput} />
            </View>
          ) : (
            <View style={styles.container}>
              <Text style={styles.title}>Goods Tracking</Text>
              <View style={styles.photoRow}>
                <TouchableOpacity style={styles.photoBtn} onPress={() => takePhoto(setGoodsImages)}>
                  <Text style={styles.photoBtnText}>📷 Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoBtn} onPress={() => pickMultipleImages(setGoodsImages)}>
                  <Text style={styles.photoBtnText}>🖼️ Gallery</Text>
                </TouchableOpacity>
              </View>
              {renderImagePreview(goodsImages, setGoodsImages)}
              <TextInput placeholder="Item Description" placeholderTextColor="#999" value={goodsItem} onChangeText={setGoodsItem} style={styles.input} />
              <TextInput placeholder="Quantity" placeholderTextColor="#999" value={goodsQuantity} onChangeText={setGoodsQuantity} keyboardType="numeric" style={styles.input} />
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>Movement Type:</Text>
                <Picker selectedValue={goodsMovement} onValueChange={setGoodsMovement} style={styles.picker}>
                  <Picker.Item label="Inward" value="Inward" />
                  <Picker.Item label="Outward" value="Outward" />
                </Picker>
              </View>
              <TextInput placeholder="Vendor / Person Name" placeholderTextColor="#999" value={goodsVendor} onChangeText={setGoodsVendor} style={styles.input} />
              <TextInput placeholder="Vehicle Number" placeholderTextColor="#999" value={goodsVehicle} onChangeText={setGoodsVehicle} style={styles.input} />
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>Approval Reference:</Text>
                <Picker selectedValue={goodsApproval} onValueChange={setGoodsApproval} style={styles.picker}>
                  {approvalOptions.map(opt => <Picker.Item key={opt} label={opt} value={opt} />)}
                </Picker>
              </View>
              <TouchableOpacity style={styles.submitBtn} onPress={submitGoods} disabled={loading}>
                <Text style={styles.submitBtnText}>{loading ? "Submitting..." : "📦 Submit Entry"}</Text>
              </TouchableOpacity>
              <Text style={styles.subtitle}>Today's Goods Entries</Text>
              <TextInput placeholder="Search by item..." placeholderTextColor="#999" value={searchGoods} onChangeText={setSearchGoods} style={styles.searchInput} />
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.entryCard}>
            <View style={styles.thumbnailRow}>
              <View style={{ flexDirection: "row" }}>
                {item.image_urls?.map((imgUrl, idx) => (
                  <TouchableOpacity key={idx} onPress={() => setSelectedEntryImages(item.image_urls)}>
                    <Image source={{ uri: imgUrl }} style={styles.thumbnail} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.entryDetails}>
              {activeTab === "visitor" ? (
                <>
                  <Text style={styles.entryTitle}>{item.name} <Text style={styles.entryBadge}>({item.entry_type})</Text></Text>
                  <Text style={styles.entryText}>📍 {item.city} | 🎯 {item.purpose}</Text>
                  <Text style={styles.entryText}>⏰ IN: {formatDate(item.in_time)}</Text>
                  <Text style={styles.entryText}>🚪 OUT: {formatDate(item.out_time)}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.entryTitle}>{item.item_description} <Text style={styles.entryBadge}>(Qty: {item.quantity})</Text></Text>
                  <Text style={styles.entryText}>🔄 Movement: {item.movement_type} | 🚛 Vehicle: {item.vehicle_number}</Text>
                  <Text style={styles.entryText}>👤 Vendor: {item.vendor_person_name}</Text>
                  <Text style={styles.entryText}>✅ Approval: {item.approval_reference}</Text>
                  <Text style={styles.entryText}>⏰ Time: {formatDate(item.timestamp)}</Text>
                </>
              )}
            </View>
            {activeTab === "visitor" && !item.out_time && (
              <TouchableOpacity style={styles.outBtn} onPress={() => handleVisitorOut(item.id)}>
                <Text style={styles.outBtnText}>OUT</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      <TouchableOpacity style={styles.adminBtn} onPress={goToAdmin}>
        <Text style={styles.adminText}>🔐 Admin Login</Text>
      </TouchableOpacity>

      {/* Image Modal with safe condition */}
      <Modal visible={Array.isArray(selectedEntryImages) && selectedEntryImages.length > 0} transparent={false} animationType="slide">
        <View style={styles.carouselContainer}>
          <FlatList
            data={selectedEntryImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, idx) => idx.toString()}
            style={{ flex: 1 }}
            renderItem={({ item }) => (
              <View style={{ width, height, justifyContent: "center", alignItems: "center" }}>
                <Image source={{ uri: item }} style={{ width, height }} resizeMode="contain" />
              </View>
            )}
          />
          <TouchableOpacity style={styles.closeCarousel} onPress={() => setSelectedEntryImages(null)}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "bold" }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f8f9fa" },
  title: { fontSize: 28, fontWeight: "bold", color: "#2c3e50", marginBottom: 20, textAlign: "center" },
  subtitle: { marginTop: 20, fontSize: 20, fontWeight: "600", color: "#34495e", marginBottom: 10 },
  tabBar: { flexDirection: "row", backgroundColor: "#2c3e50", paddingVertical: 12, elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 25, marginHorizontal: 8 },
  activeTab: { backgroundColor: "#e67e22" },
  tabText: { color: "#ecf0f1", fontWeight: "600", fontSize: 14 },
  activeTabText: { color: "#fff" },
  photoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 15, gap: 12 },
  photoBtn: { backgroundColor: "#3498db", padding: 12, borderRadius: 12, flex: 1, alignItems: "center", elevation: 2 },
  photoBtnText: { color: "#c9cc0f", fontWeight: "bold", fontSize: 14 },
  input: { borderWidth: 1, borderColor: "#ddd", backgroundColor: "#fff", marginVertical: 8, padding: 14, borderRadius: 12, fontSize: 16, color: "#2c3e50" },
  searchInput: { borderWidth: 1, borderColor: "#ddd", backgroundColor: "#fff", padding: 12, borderRadius: 12, marginTop: 8, fontSize: 16 },
  submitBtn: { backgroundColor: "#27ae60", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 15, elevation: 3 },
  submitBtnText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  previewList: { marginVertical: 10 },
  previewImageContainer: { marginRight: 12, position: "relative" },
  previewImage: { width: 90, height: 90, borderRadius: 12, borderWidth: 1, borderColor: "#ddd" },
  removeImgBtn: { position: "absolute", top: -6, right: -6, backgroundColor: "#e74c3c", borderRadius: 15, width: 24, height: 24, alignItems: "center", justifyContent: "center", elevation: 3 },
  adminBtn: { position: "absolute", bottom: 20, left: 20, right: 20, backgroundColor: "#2c3e50", padding: 16, borderRadius: 12, alignItems: "center", elevation: 5 },
  adminText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  entryCard: { backgroundColor: "#fff", marginHorizontal: 16, marginVertical: 8, padding: 12, borderRadius: 16, elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1 },
  thumbnailRow: { marginBottom: 10 },
  thumbnail: { width: 70, height: 70, borderRadius: 10, marginRight: 8, borderWidth: 1, borderColor: "#ecf0f1" },
  entryDetails: { flex: 1 },
  entryTitle: { fontSize: 16, fontWeight: "bold", color: "#2c3e50", marginBottom: 4 },
  entryBadge: { fontSize: 12, fontWeight: "normal", color: "#7f8c8d" },
  entryText: { fontSize: 13, color: "#7f8c8d", marginBottom: 2 },
  outBtn: { backgroundColor: "#e67e22", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, marginLeft: 10, alignSelf: "center", elevation: 2 },
  outBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  pickerContainer: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, marginVertical: 8, backgroundColor: "#fff", overflow: "hidden" },
  pickerLabel: { paddingHorizontal: 12, paddingTop: 8, fontSize: 14, color: "#7f8c8d" },
  picker: { height: 55, width: "100%", color: "#080808" },
  carouselContainer: { flex: 1, backgroundColor: "#000" },
  closeCarousel: { position: "absolute", top: 40, right: 20, backgroundColor: "rgba(0,0,0,0.6)", padding: 12, borderRadius: 30, zIndex: 10 },
});