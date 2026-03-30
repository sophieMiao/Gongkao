import { useState, useEffect, createContext, useContext } from 'react';

// 模拟用户数据
const mockUser = {
  id: '1',
  open_id: 'ou_b267210a662373b530d3a2af309d451b',
  name: '张三',
  avatar: undefined,
  department: '技术部',
};

// Auth Context
const AuthContext = createContext<{
  user: any;
  login: (code: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}>({
  user: null,
  login: async () => {},
  logout: () => {},
  loading: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 检查本地存储的 token
    const token = localStorage.getItem('access_token');
    if (token) {
      // 验证 token 并获取用户信息
      setUser(mockUser);
    }
  }, []);

  const login = async (code: string) => {
    setLoading(true);
    try {
      // TODO: 调用 authApi.login
      // const res = await authApi.login(code);
      // setUser(res.data.user);
      // localStorage.setItem('access_token', res.data.access_token);
      setUser(mockUser); // 模拟登录
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
