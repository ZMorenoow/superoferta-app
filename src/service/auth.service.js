import axios from "axios";
import { getToken, setToken } from "../service/helpers.js";
const BASE_URL = "http://localhost:3000/auth";

export const axiosInstance = axios.create({ baseURL: BASE_URL });

const token = getToken();

if (token) {
    setToken(token);
}

export function login({ correo, contrasena }) {
    return axiosInstance
        .post(`${BASE_URL}/login`, { correo, contrasena })
        .then((response) => {
            if (response.data.token) {
                setToken(response.data.token);
            }
            return response.data;
        })
        .catch((error) => ({
            error: true,
            name: error.response.data.message.name || "Error",
            message: error.response.data?.error?.msg || "Error",
        }));
}

export function register({ nombre, apellido, correo, telefono, direccion, contrasena }) {
    return axiosInstance
        .post(`${BASE_URL}/register`, { nombre, apellido, correo, telefono, direccion, contrasena })
        .then((response) => {
            return response.data;
        })
        .catch((error) => ({
            error: true,
            name: error.response.data?.error?.name || "Error",
            message: error.response.data?.error?.msg || "Error",
        }));
}

export async function getMe() {
    try {
        const token = getToken();

        if (!token) {
            throw new Error("No token available");
        }

        const response = await axiosInstance.get("/me", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    } catch (error) {
        return {
            error: true,
            message: error.response?.data?.message || "Error al obtener los datos del usuario",
        };
    }
}