const API_URL = import.meta.env.VITE_API_URL;

export async function login(email: string, password: string) {
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Login failed");
  }
  return res.json(); // { access_token, token_type }
}

export async function signup(
  email: string,
  password: string,
  name: string,
  role: "owner" | "customer",
) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, role }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Signup failed");
  }
  return res.json(); // the created user (UserRead shape)
}

export async function getServices() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/services/`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res) {
    throw new Error("Failed to load services");
  }
  return res.json();
}
