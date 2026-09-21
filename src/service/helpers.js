import { axiosInstance } from "../service/auth.service.js";

export function setToken(token) {
  localStorage.setItem("token", token);
  axiosInstance.defaults.headers["Authorization"] = `Bearer ${token}`;
}

export function removeToken() {
  localStorage.removeItem("token");
  axiosInstance.defaults.headers["Authorization"] = "";
}

export function getToken() {
  return localStorage.getItem("token");
}

export function logout() {
  removeToken();
  axiosInstance.defaults.headers["Authorization"] = "";
  localStorage.removeItem("verified");
}