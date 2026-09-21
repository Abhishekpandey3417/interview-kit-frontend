"use client";

import {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import api from "../utils/api";

type User = {
    id: string;
    name: string;
    email: string;
};

type AuthContextType = {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (
        name: string,
        email: string,
        password: string
    ) => Promise<void>;
    logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data } = await api.get("/auth/me");

                if (data.success) {
                    setUser(data.user);
                }
            } catch (error) {
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = async (email: string, password: string) => {
        const { data } = await api.post("/auth/login", {
            email,
            password,
        });

        if (data.token) {
            localStorage.setItem("token", data.token);
        }

        setUser(data.user);
    };

    const register = async (
        name: string,
        email: string,
        password: string
    ) => {
        const { data } = await api.post("/auth/register", {
            name,
            email,
            password,
        });

        if (data.token) {
            localStorage.setItem("token", data.token);
        }

        setUser(data.user);
    };

    const logout = async () => {
        try {
            await api.post("/auth/logout");
        } catch (error) {
            console.error("Logout failed", error);
        }

        localStorage.removeItem("token");
        setUser(null);
        window.location.href = "/auth/login";
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                register,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);

    if (!ctx) {
        throw new Error("useAuth must be used within AuthProvider");
    }

    return ctx;
};