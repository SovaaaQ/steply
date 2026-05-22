import { useAppData } from "../app/providers";

export function useAuth() {
  const {
    token,
    user,
    handleAuth,
    login,
    register,
    logout
  } = useAppData();

  return {
    token,
    user,
    handleAuth,
    login,
    register,
    logout
  };
}
