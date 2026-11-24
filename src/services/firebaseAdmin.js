import { auth } from "../firebase/config";

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID;

export const createUserViaAPI = async (userData) => {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Нет авторизации");

  const response = await fetch(
    `https://us-central1-${PROJECT_ID}.cloudfunctions.net/createUser`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify(userData),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Ошибка создания пользователя");
  }
  return data.result;
};