import React, { useState } from "react";
import { View } from "react-native";
import UserUpload from "./screens/UserUpload";
import AdminDashboard from "./screens/AdminDashboard";

export default function App() {
  const [screen, setScreen] = useState("user");

  return (
    <View style={{ flex: 1, backgroundColor: "#f2f2f2"  }}>
      {screen === "user" ? (
        <UserUpload goToAdmin={() => setScreen("admin")} />
      ) : (
        <AdminDashboard logoutToUser={() => setScreen("user")} />
      )}
    </View>
  );
}