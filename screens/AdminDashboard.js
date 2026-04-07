import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, FlatList, Image, Modal,
  StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "../lib/supabase";
import { Picker } from "@react-native-picker/picker";
import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

// ----- SAFE DATE FORMATTER (fixes crash #4) -----
const formatDate = (date) => {
  if (!date) return "--";
  return new Date(new Date(date).getTime() + 5.5 * 3600000).toLocaleString();
};

export default function AdminDashboard({ logoutToUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState("visitor");
  const [visitorData, setVisitorData] = useState([]);
  const [goodsData, setGoodsData] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [newApproval, setNewApproval] = useState("");
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [searchVisitor, setSearchVisitor] = useState("");
  const [searchGoods, setSearchGoods] = useState("");
  const [selectedEntryImages, setSelectedEntryImages] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [activeVisitorsCount, setActiveVisitorsCount] = useState(0);
  const [showActiveList, setShowActiveList] = useState(false);
  const [activeVisitorsList, setActiveVisitorsList] = useState([]);
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return alert(error.message);
    setLoggedIn(true);
    fetchData(date);
    fetchApprovals();
    fetchActiveVisitorsCount();
  };

  const fetchData = async (selectedDate) => {
    const formatted = selectedDate.toISOString().split("T")[0];
    const { data: visitors } = await supabase
      .from("profiles")
      .select("*")
      .eq("date", formatted)
      .order("in_time", { ascending: false });
    setVisitorData(visitors || []);

    const { data: goods } = await supabase
      .from("goods_entries")
      .select("*")
      .eq("date", formatted)
      .order("timestamp", { ascending: false });
    setGoodsData(goods || []);
  };

  const fetchApprovals = async () => {
    const { data } = await supabase.from("approval_references").select("*").order("name");
    setApprovals(data || []);
  };

  const fetchActiveVisitorsCount = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .is("out_time", null);
    setActiveVisitorsCount(data?.length || 0);
    setActiveVisitorsList(data || []);
  };

  const onChangeDate = (event, selectedDate) => {
    setShowPicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      fetchData(selectedDate);
    }
  };

  const deleteEntry = async (item, table, imageUrls) => {
    Alert.alert("Confirm Delete", `Delete this entry?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            if (imageUrls?.length) {
              const filePaths = imageUrls.map(url => url.split("/photos/")[1]);
              await supabase.storage.from("photos").remove(filePaths);
            }
            await supabase.from(table).delete().eq("id", item.id);
            fetchData(date);
            fetchActiveVisitorsCount();
            Alert.alert("Success", "Entry deleted");
          } catch (err) { Alert.alert("Error", err.message); }
        }
      }
    ]);
  };

  const updateItem = async () => {
    await supabase.from("profiles").update({
      name: editItem.name,
      phone: editItem.phone,
      city: editItem.city,
      purpose: editItem.purpose,
      entry_type: editItem.entry_type,
    }).eq("id", editItem.id);
    setEditItem(null);
    fetchData(date);
    Alert.alert("Success", "Visitor updated");
  };

  const updateGoodsItem = async () => {
    await supabase.from("goods_entries").update({
      item_description: editItem.item_description,
      quantity: editItem.quantity,
      movement_type: editItem.movement_type,
      vendor_person_name: editItem.vendor_person_name,
      vehicle_number: editItem.vehicle_number,
      approval_reference: editItem.approval_reference,
    }).eq("id", editItem.id);
    setEditItem(null);
    fetchData(date);
    Alert.alert("Success", "Goods entry updated");
  };

  const addApproval = async () => {
    if (!newApproval.trim()) return Alert.alert("Enter a name");
    const { error } = await supabase.from("approval_references").insert({ name: newApproval.trim() });
    if (error) Alert.alert(error.message);
    else {
      setNewApproval("");
      fetchApprovals();
      Alert.alert("Success", "Approval reference added");
    }
  };

  const deleteApproval = async (id) => {
    Alert.alert("Confirm", "Delete this approval reference?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          await supabase.from("approval_references").delete().eq("id", id);
          fetchApprovals();
        }
      }
    ]);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLoggedIn(false);
    logoutToUser();
  };

  const filteredVisitors = visitorData.filter(v => v.name.toLowerCase().includes(searchVisitor.toLowerCase()));
  const filteredGoods = goodsData.filter(g => g.item_description.toLowerCase().includes(searchGoods.toLowerCase()));

  if (!loggedIn) {
    return (
      <View style={styles.loginContainer}>
        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>Admin Login</Text>
          <TextInput placeholder="Email" placeholderTextColor="#999" value={email} onChangeText={setEmail} style={styles.loginInput} />
          <TextInput placeholder="Password" placeholderTextColor="#999" secureTextEntry value={password} onChangeText={setPassword} style={styles.loginInput} />
          <TouchableOpacity style={styles.loginBtn} onPress={login} disabled={loading}>
            <Text style={styles.loginBtnText}>{loading ? "Logging in..." : "Login"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.switchBtn} onPress={logoutToUser}>
            <Text style={styles.switchText}>← Back to Visitor Page</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
          <Text style={styles.dateBtnText}>{date.toISOString().split("T")[0]}</Text>
        </TouchableOpacity>
        {showPicker && <DateTimePicker value={date} mode="date" onChange={onChangeDate} />}
        <TouchableOpacity style={styles.activeCountBtn} onPress={() => setShowActiveList(true)}>
          <Text style={styles.activeCountText}>👥 Active: {activeVisitorsCount}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, activeTab === "visitor" && styles.activeTab]} onPress={() => setActiveTab("visitor")}>
          <Text style={[styles.tabText, activeTab === "visitor" && styles.activeTabText]}>Visitor Entries</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "goods" && styles.activeTab]} onPress={() => setActiveTab("goods")}>
          <Text style={[styles.tabText, activeTab === "goods" && styles.activeTabText]}>Goods Entries</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "approvals" && styles.activeTab]} onPress={() => setActiveTab("approvals")}>
          <Text style={[styles.tabText, activeTab === "approvals" && styles.activeTabText]}>Approvals</Text>
        </TouchableOpacity>
      </View>

      {activeTab === "visitor" && (
        <>
          <TextInput placeholder="🔍 Search by name..." placeholderTextColor="#999" value={searchVisitor} onChangeText={setSearchVisitor} style={styles.searchInput} />
          <FlatList
            data={filteredVisitors}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ paddingBottom: 80 }}
            renderItem={({ item }) => (
              <View style={styles.adminCard}>
                {/* ✅ FIX #3: No nested FlatList – using .map() */}
                <View style={{ flexDirection: "row", marginBottom: 8 }}>
                  {item.image_urls?.map((img, idx) => (
                    <TouchableOpacity key={idx} onPress={() => setSelectedEntryImages(item.image_urls)}>
                      <Image source={{ uri: img }} style={styles.adminThumbnail} />
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.adminDetails}>
                  <Text style={styles.adminName}>{item.name} <Text style={styles.adminBadge}>({item.entry_type})</Text></Text>
                  <Text style={styles.adminText}>📞 {item.phone} | 🏙️ {item.city}</Text>
                  <Text style={styles.adminText}>🎯 {item.purpose}</Text>
                  {/* ✅ FIX #4: safe date formatting */}
                  <Text style={styles.adminText}>⏰ IN: {formatDate(item.in_time)}</Text>
                  <Text style={styles.adminText}>🚪 OUT: {formatDate(item.out_time)}</Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => setEditItem(item)}>
                      <Text style={styles.actionBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteEntry(item, "profiles", item.image_urls)}>
                      <Text style={styles.actionBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          />
        </>
      )}

      {activeTab === "goods" && (
        <>
          <TextInput placeholder="🔍 Search by item..." placeholderTextColor="#999" value={searchGoods} onChangeText={setSearchGoods} style={styles.searchInput} />
          <FlatList
            data={filteredGoods}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ paddingBottom: 80 }}
            renderItem={({ item }) => (
              <View style={styles.adminCard}>
                <View style={{ flexDirection: "row", marginBottom: 8 }}>
                  {item.image_urls?.map((img, idx) => (
                    <TouchableOpacity key={idx} onPress={() => setSelectedEntryImages(item.image_urls)}>
                      <Image source={{ uri: img }} style={styles.adminThumbnail} />
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.adminDetails}>
                  <Text style={styles.adminName}>{item.item_description} <Text style={styles.adminBadge}>(Qty: {item.quantity})</Text></Text>
                  <Text style={styles.adminText}>🔄 Movement: {item.movement_type} | 🚛 Vehicle: {item.vehicle_number}</Text>
                  <Text style={styles.adminText}>👤 Vendor: {item.vendor_person_name}</Text>
                  <Text style={styles.adminText}>✅ Approval: {item.approval_reference}</Text>
                  <Text style={styles.adminText}>⏰ Time: {formatDate(item.timestamp)}</Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => setEditItem(item)}>
                      <Text style={styles.actionBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteEntry(item, "goods_entries", item.image_urls)}>
                      <Text style={styles.actionBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          />
        </>
      )}

      {activeTab === "approvals" && (
        <ScrollView style={styles.approvalContainer}>
          <Text style={styles.approvalTitle}>Manage Approval References</Text>
          <View style={styles.addRow}>
            <TextInput placeholder="New reference name" placeholderTextColor="#999" value={newApproval} onChangeText={setNewApproval} style={styles.approvalInput} />
            <TouchableOpacity style={styles.addBtn} onPress={addApproval}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {approvals.map(ap => (
            <View key={ap.id} style={styles.approvalItem}>
              <Text style={styles.approvalName}>{ap.name}</Text>
              <TouchableOpacity onPress={() => deleteApproval(ap.id)}>
                <Text style={styles.deleteApprovalText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>Logout</Text>
      </TouchableOpacity>

      {/* ✅ FIX #1: Image Modal safe condition */}
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
            <Text style={styles.closeCarouselText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Active Visitors Modal */}
      <Modal visible={showActiveList} transparent={false} animationType="slide">
        <View style={styles.activeModalContainer}>
          <Text style={styles.activeModalTitle}>Active Visitors (Not Checked OUT)</Text>
          <FlatList
            data={activeVisitorsList}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.activeVisitorItem}>
                <Text style={styles.activeVisitorName}>{item.name}</Text>
                <Text style={styles.activeVisitorDetail}>📞 {item.phone}</Text>
                <Text style={styles.activeVisitorDetail}>⏰ IN: {formatDate(item.in_time)}</Text>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
          <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowActiveList(false)}>
            <Text style={styles.closeModalBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ✅ FIX #5: Edit Modal – safe null check */}
      <Modal visible={editItem !== null && activeTab === "visitor"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.editModalCard}>
            <Text style={styles.editModalTitle}>Edit Visitor</Text>
            <TextInput value={editItem?.name} onChangeText={t => setEditItem({ ...editItem, name: t })} style={styles.editInput} placeholder="Name" />
            <TextInput value={editItem?.phone} onChangeText={t => setEditItem({ ...editItem, phone: t })} style={styles.editInput} placeholder="Phone" keyboardType="phone-pad" />
            <TextInput value={editItem?.city} onChangeText={t => setEditItem({ ...editItem, city: t })} style={styles.editInput} placeholder="City" />
            <TextInput value={editItem?.purpose} onChangeText={t => setEditItem({ ...editItem, purpose: t })} style={styles.editInput} placeholder="Purpose" />
            <View style={styles.pickerWrapper}>
              <Picker selectedValue={editItem?.entry_type} onValueChange={val => setEditItem({ ...editItem, entry_type: val })}>
                <Picker.Item label="Visitor" value="visitor" />
                <Picker.Item label="Employee" value="employee" />
                <Picker.Item label="Vendor" value="vendor" />
              </Picker>
            </View>
            <TouchableOpacity style={styles.saveEditBtn} onPress={updateItem}>
              <Text style={styles.saveEditBtnText}>Save Changes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelEditBtn} onPress={() => setEditItem(null)}>
              <Text style={styles.cancelEditBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Modal for Goods */}
      <Modal visible={editItem !== null && activeTab === "goods"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.editModalCard}>
            <Text style={styles.editModalTitle}>Edit Goods Entry</Text>
            <TextInput value={editItem?.item_description} onChangeText={t => setEditItem({ ...editItem, item_description: t })} style={styles.editInput} placeholder="Item description" />
            <TextInput value={String(editItem?.quantity)} onChangeText={t => setEditItem({ ...editItem, quantity: parseInt(t) || 0 })} keyboardType="numeric" style={styles.editInput} placeholder="Quantity" />
            <View style={styles.pickerWrapper}>
              <Picker selectedValue={editItem?.movement_type} onValueChange={val => setEditItem({ ...editItem, movement_type: val })}>
                <Picker.Item label="Inward" value="Inward" />
                <Picker.Item label="Outward" value="Outward" />
              </Picker>
            </View>
            <TextInput value={editItem?.vendor_person_name} onChangeText={t => setEditItem({ ...editItem, vendor_person_name: t })} style={styles.editInput} placeholder="Vendor name" />
            <TextInput value={editItem?.vehicle_number} onChangeText={t => setEditItem({ ...editItem, vehicle_number: t })} style={styles.editInput} placeholder="Vehicle number" />
            <View style={styles.pickerWrapper}>
              {/* ✅ FIX #6: fallback value */}
              <Picker
                selectedValue={editItem?.approval_reference || approvals[0]?.name}
                onValueChange={val => setEditItem({ ...editItem, approval_reference: val })}
              >
                {approvals.map(ap => <Picker.Item key={ap.id} label={ap.name} value={ap.name} />)}
              </Picker>
            </View>
            <TouchableOpacity style={styles.saveEditBtn} onPress={updateGoodsItem}>
              <Text style={styles.saveEditBtnText}>Save Changes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelEditBtn} onPress={() => setEditItem(null)}>
              <Text style={styles.cancelEditBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  topBar: { flexDirection: "row", justifyContent: "space-between", padding: 16, backgroundColor: "#fff", elevation: 3, marginTop: 10, marginHorizontal: 12, borderRadius: 12 },
  dateBtn: { backgroundColor: "#3498db", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 25 },
  dateBtnText: { color: "#fff", fontWeight: "bold" },
  activeCountBtn: { backgroundColor: "#e67e22", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 25 },
  activeCountText: { fontWeight: "bold", color: "#fff" },
  tabBar: { flexDirection: "row", backgroundColor: "#2c3e50", paddingVertical: 10, marginHorizontal: 12, marginTop: 12, borderRadius: 30, overflow: "hidden" },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 30 },
  activeTab: { backgroundColor: "#e67e22" },
  tabText: { color: "#ecf0f1", fontWeight: "600" },
  activeTabText: { color: "#fff" },
  searchInput: { margin: 12, padding: 14, borderWidth: 1, borderColor: "#ddd", borderRadius: 12, backgroundColor: "#fff", fontSize: 16 },
  adminCard: { backgroundColor: "#fff", margin: 12, padding: 15, borderRadius: 16, elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1 },
  adminThumbnail: { width: 80, height: 80, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: "#ecf0f1" },
  adminDetails: { flex: 1 },
  adminName: { fontSize: 18, fontWeight: "bold", color: "#2c3e50", marginBottom: 6 },
  adminBadge: { fontSize: 14, fontWeight: "normal", color: "#7f8c8d" },
  adminText: { fontSize: 14, color: "#7f8c8d", marginBottom: 4 },
  actionRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  editBtn: { backgroundColor: "#f39c12", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, alignItems: "center" },
  deleteBtn: { backgroundColor: "#e74c3c", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, alignItems: "center" },
  actionBtnText: { color: "#fff", fontWeight: "bold" },
  logoutBtn: { position: "absolute", bottom: 20, left: 20, right: 20, backgroundColor: "#c0392b", padding: 16, borderRadius: 12, alignItems: "center", elevation: 5 },
  logoutBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  loginContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#2c3e50" },
  loginCard: { width: "85%", backgroundColor: "#fff", padding: 30, borderRadius: 20, elevation: 10 },
  loginTitle: { fontSize: 28, fontWeight: "bold", textAlign: "center", marginBottom: 25, color: "#2c3e50" },
  loginInput: { borderWidth: 1, borderColor: "#110e0e", padding: 14, marginBottom: 15, borderRadius: 12, fontSize: 16 },
  loginBtn: { backgroundColor: "#3498db", padding: 14, borderRadius: 12, alignItems: "center", marginBottom: 12 },
  loginBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  switchBtn: { backgroundColor: "#95a5a6", padding: 14, borderRadius: 12, alignItems: "center" },
  switchText: { color: "#fff", fontWeight: "bold" },
  approvalContainer: { padding: 20, backgroundColor: "#f8f9fa", flex: 1 },
  approvalTitle: { fontSize: 22, fontWeight: "bold", color: "#2c3e50", marginBottom: 20, textAlign: "center" },
  addRow: { flexDirection: "row", marginBottom: 20, gap: 12 },
  approvalInput: { flex: 1, borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 12, backgroundColor: "#fff" },
  addBtn: { backgroundColor: "#27ae60", paddingHorizontal: 20, borderRadius: 12, justifyContent: "center" },
  addBtnText: { color: "#fff", fontWeight: "bold" },
  approvalItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 15, backgroundColor: "#fff", borderRadius: 12, marginBottom: 10, elevation: 2 },
  approvalName: { fontSize: 16, color: "#2c3e50" },
  deleteApprovalText: { color: "#e74c3c", fontWeight: "bold" },
  carouselContainer: { flex: 1, backgroundColor: "#000" },
  closeCarousel: { position: "absolute", top: 40, right: 20, backgroundColor: "rgba(0,0,0,0.6)", padding: 12, borderRadius: 30 },
  closeCarouselText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  activeModalContainer: { flex: 1, backgroundColor: "#2c3e50", paddingTop: 50, paddingHorizontal: 20 },
  activeModalTitle: { fontSize: 24, fontWeight: "bold", color: "#fff", textAlign: "center", marginBottom: 20 },
  activeVisitorItem: { backgroundColor: "#fff", padding: 15, borderRadius: 12, marginBottom: 10 },
  activeVisitorName: { fontSize: 16, fontWeight: "bold", color: "#2c3e50" },
  activeVisitorDetail: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },
  closeModalBtn: { backgroundColor: "#e67e22", padding: 14, borderRadius: 12, alignItems: "center", marginTop: 20, marginBottom: 30 },
  closeModalBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.7)" },
  editModalCard: { width: "90%", backgroundColor: "#fff", borderRadius: 20, padding: 20, elevation: 10 },
  editModalTitle: { fontSize: 22, fontWeight: "bold", marginBottom: 20, textAlign: "center", color: "#2c3e50" },
  editInput: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 16 },
  pickerWrapper: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, marginBottom: 12, overflow: "hidden" },
  saveEditBtn: { backgroundColor: "#27ae60", padding: 14, borderRadius: 10, alignItems: "center", marginTop: 10 },
  saveEditBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  cancelEditBtn: { backgroundColor: "#95a5a6", padding: 14, borderRadius: 10, alignItems: "center", marginTop: 10 },
  cancelEditBtnText: { fontWeight: "bold", color: "#fff" },
});