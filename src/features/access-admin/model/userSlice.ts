// store/userSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { jwtDecode } from 'jwt-decode';
import { getAccessToken } from '../../../shared/runtime/accessTokenStore';
import { fetchUserInfo } from '../../../shared/services/users';

type RoleName = string;
type RolesByProduct = Record<string, RoleName[]>;

interface UserState {
  user: any;                 // your API payload
  rolesByProduct: RolesByProduct;
  capabilities: string[];    // `${product}:${role}` lowercased
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

const initialState: UserState = {
  user: null,
  rolesByProduct: {},
  capabilities: [],
  loading: false,
  initialized: false,
  error: null,
};

export const fetchUserProfile = createAsyncThunk(
  'user/fetchUserProfile',
  async (_: void, { rejectWithValue }) => {
    try {
      const token = getAccessToken();
      if (!token) return rejectWithValue("Missing access token");
      const decoded: any = jwtDecode(token);
      const data = await fetchUserInfo(decoded.sub);
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

// --- helper to normalize roles from your payload shape
function normalizeRoles(user: any): { rolesByProduct: Record<string, string[]>; capabilities: string[] } {
  const rolesByProduct: Record<string, string[]> = {};
  const capabilities: string[] = [];

  const products = Array.isArray(user?.products) ? user.products : [];
  for (const p of products) {
    const product = String(p?.product_name || '').toLowerCase().trim();

    // Build roles as a typed string[]
    const roles: string[] = (Array.isArray(p?.roles) ? p.roles : [])
      .map((r: any) => String(r?.role?.role_name ?? '').toLowerCase().trim())
      .filter((v: string): v is string => v.length > 0);

    if (product && roles.length) {
      // Dedupe with explicit generic so TS keeps string[]
      const unique: string[] = [...new Set<string>(roles)];
      rolesByProduct[product] = unique;
      for (const role of unique) {
        capabilities.push(`${product}:${role}`);
      }
    }
  }

  return { rolesByProduct, capabilities };
}

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    logoutUser: (state) => {
      state.user = null;
      state.rolesByProduct = {};
      state.capabilities = [];
      state.loading = false;
      state.error = null;
    },
    // optional: allow replacing the user (e.g., profile refresh)
    setUser: (state, action: PayloadAction<any>) => {
      state.user = action.payload;
      const norm = normalizeRoles(action.payload);
      state.rolesByProduct = norm.rolesByProduct;
      state.capabilities = norm.capabilities;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.user = action.payload;
        const norm = normalizeRoles(action.payload);
        state.rolesByProduct = norm.rolesByProduct;
        state.capabilities = norm.capabilities;
        state.loading = false;
        state.initialized = true;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.error = (action.payload as string) ?? 'Failed to load profile';
        state.loading = false;
        state.initialized = true;
      });
  },
});

export const { logoutUser, setUser } = userSlice.actions;
export default userSlice.reducer;
