import React, { useState } from "react";
import {
  View, Text, TextInput, Button,
  FlatList, Image, Modal,
  StyleSheet, TouchableOpacity
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "../lib/supabase";

export default function AdminDashboard({ logoutToUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  const [data, setData] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [editItem, setEditItem] = useState(null);

  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const login = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return alert(error.message);

    setLoggedIn(true);
    fetchData(new Date());
  };

  const fetchData = async (selectedDate = date) => {
    const formatted = selectedDate.toISOString().split("T")[0];

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("date", formatted)
      .order("in_time", { ascending: false });

    setData(data || []);
  };

  const onChangeDate = (event, selectedDate) => {
    setShowPicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      fetchData(selectedDate);
    }
  };

const deleteItem = async (item) => {
  try {
    const filePath = item.image_url.split("/photos/")[1];

    console.log("Deleting:", filePath);

    const { error: storageError } = await supabase
      .storage
      .from("photos")
      .remove([filePath]);

    if (storageError) {
      console.log("Storage error:", storageError.message);
      alert(storageError.message);
    }

    await supabase.from("profiles").delete().eq("id", item.id);

    fetchData(date);

  } catch (err) {
    console.log("Error:", err.message);
  }
};

  const updateItem = async () => {
    await supabase
      .from("profiles")
      .update({
        name: editItem.name,
        phone: editItem.phone,
        city: editItem.city,
        purpose: editItem.purpose,
      })
      .eq("id", editItem.id);

    setEditItem(null);
    fetchData(date);
  };
const getFileName = (url) => {
  return url.split("/").pop();
};
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLoggedIn(false);
    logoutToUser(); 
  };

  if (!loggedIn) {
    return (
      <View style={{ flex: 1 }}>
      <View style={styles.loginContainer}>
        <View style={styles.card}>
          <Text style={styles.title}>Admin Login</Text>

          <TextInput
            placeholder="Email"
           placeholderTextColor="#0f0e0e"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />

          <TextInput
            placeholder="Password"
            placeholderTextColor="#0f0e0e"
            secureTextEntry
            secureTextEntrycolor="#0f0e0e"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />

          <TouchableOpacity style={styles.loginBtn} onPress={login}>
            <Text style={{ color: "#fff", fontWeight: "bold" }}>Login</Text>
          </TouchableOpacity>
          
        </View>
      </View>
      <TouchableOpacity
  style={styles.switchBtn}
  onPress={logoutToUser}
>
  <Text style={styles.switchText}>Go to Visitor Page</Text>
</TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {}
      <View style={styles.topSection}>
        <TouchableOpacity
          style={styles.dateBtn}
          onPress={() => setShowPicker(true)}
        >
          <Text style={styles.dateText}>
            {date.toISOString().split("T")[0]}
          </Text>
        </TouchableOpacity>

        {showPicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="calendar"
            onChange={onChangeDate}
          />
        )}

        <Text style={styles.countText}>
          Total Entries: {data.length}
        </Text>
      </View>

      {/* 📋 LIST */}
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <TouchableOpacity onPress={() => setSelectedImage(item.image_url)}>
              <Image source={{ uri: item.image_url }} style={styles.image} />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text>{item.phone}</Text>
              <Text>{item.city}</Text>
              <Text>{item.purpose}</Text>
              <Text>IN: {new Date(new Date(item.in_time).getTime() + (5.5 * 60 * 60 * 1000)).toLocaleString()}</Text>
              <Text>
                OUT: {item.out_time
                  ? new Date(new Date(item.out_time).getTime() + (5.5 * 60 * 60 * 1000)).toLocaleString()
                  : "--"}
              </Text>

              <View style={styles.row}>
                <Button title="Edit" onPress={() => setEditItem(item)} />
                <Button title="Delete" color="red" onPress={() => deleteItem(item)} />
              </View>
            </View>
          </View>
        )}
      />

      {/* 🔐 LOGOUT BUTTON */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={{ color: "#fff", fontWeight: "bold" }}>Logout</Text>
      </TouchableOpacity>

      {/* 🖼 IMAGE MODAL */}
      <Modal visible={!!selectedImage} transparent>
        <View style={styles.modalBg}>
          <Image source={{ uri: selectedImage }} style={styles.fullImage} />
          <Button title="Close" onPress={() => setSelectedImage(null)} />
        </View>
      </Modal>

      {/* ✏️ EDIT MODAL */}
      <Modal visible={!!editItem} transparent>
        {editItem && (
          <View style={styles.modalBg}>
            <View style={styles.editCard}>
              <Text style={styles.title}>Edit Entry</Text>

              <TextInput
                value={editItem.name}
                onChangeText={(t) => setEditItem({ ...editItem, name: t })}
                style={styles.input}
              />

              <TextInput
                value={editItem.phone}
                onChangeText={(t) => setEditItem({ ...editItem, phone: t })}
                style={styles.input}
              />

              <TextInput
                value={editItem.city}
                onChangeText={(t) => setEditItem({ ...editItem, city: t })}
                style={styles.input}
              />

              <TextInput
                value={editItem.purpose}
                onChangeText={(t) => setEditItem({ ...editItem, purpose: t })}
                style={styles.input}
              />

              <Button title="Save" onPress={updateItem} />
              <Button title="Cancel" onPress={() => setEditItem(null)} />
            </View>
          </View>
        )}
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f2f2" },

  topSection: { padding: 15, marginTop: 20 },

  countText: { marginTop: 10, fontWeight: "bold" },

  loginContainer: {
    flex: 1, justifyContent: "center", alignItems: "center"
  },

  card: {
    width: "85%", backgroundColor: "#fff",
    padding: 25, borderRadius: 15
  },

  title: {
    fontSize: 22, fontWeight: "bold",
    textAlign: "center", marginBottom: 20
  },

  input: {
    borderWidth: 1, padding: 10,
    marginBottom: 15, borderRadius: 10
  },

  switchBtn: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
},

switchText: {
    color: "#fff",
    fontWeight: "bold",
},

  loginBtn: {
    backgroundColor: "#007bff",
    padding: 12, borderRadius: 10,
    alignItems: "center"
  },

  dateBtn: {
    backgroundColor: "#007bff",
    padding: 10, borderRadius: 10,
    alignItems: "center"
  },

  dateText: { color: "#fff", fontWeight: "bold" },

  item: {
    flexDirection: "row",
    backgroundColor: "#fff",
    margin: 10, padding: 10,
    borderRadius: 10
  },

  image: {
    width: 90, height: 90,
    marginRight: 10, borderRadius: 10
  },

  name: { fontWeight: "bold", fontSize: 16 },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10
  },

  logoutBtn: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "red",
    padding: 15,
    borderRadius: 10,
    alignItems: "center"
  },

  modalBg: {
    flex: 1, justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)"
  },

  fullImage: {
    width: "90%", height: "70%",
    resizeMode: "contain"
  },

  editCard: {
    width: "90%", backgroundColor: "#fff",
    padding: 20, borderRadius: 15
  },
});