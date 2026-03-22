// store/userSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { jwtDecode } from 'jwt-decode';
import { getAccessToken } from '../../../shared/runtime/accessTokenStore';
import { fetchUserInfo } from '../../../shared/services/users';

type RoleName = string;
type RolesByFeature = Record<string, RoleName[]>;

interface UserState {
  user: any;                 // your API payload
  rolesByFeature: RolesByFeature;
  capabilities: string[];    // `${feature}:${role}` lowercased
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

const initialState: UserState = {
  user: null,
  rolesByFeature: {},
  capabilities: [],
  loading: false,
  initialized: false,
  error: null,
};

const normalizeText = (value: unknown): string => String(value ?? '').toLowerCase().trim();

const FEATURE_KEYS = [
  'catalog',
  'workspaces',
  'forge_match',
  'forge_insights',
  'query_studio',
  'skills',
  'planner',
  'semantic',
  'ingestion',
  'exports',
  'vector',
  'ai',
  'system',
] as const;

type TokenClaims = {
  roles?: unknown;
};

function addCapability(
  rolesByFeature: Record<string, string[]>,
  capabilities: string[],
  feature: string,
  role: string
) {
  const normalizedFeature = normalizeText(feature);
  const normalizedRole = normalizeText(role);
  if (!normalizedFeature || !normalizedRole) return;

  const existingRoles = rolesByFeature[normalizedFeature] ?? [];
  if (!existingRoles.includes(normalizedRole)) {
    rolesByFeature[normalizedFeature] = [...existingRoles, normalizedRole];
  }

  const capability = `${normalizedFeature}:${normalizedRole}`;
  if (!capabilities.includes(capability)) {
    capabilities.push(capability);
  }
}

function extractProfileRoleNames(user: any): string[] {
  const values = new Set<string>();

  const directRoleNames = Array.isArray(user?.rbac_role_names) ? user.rbac_role_names : [];
  directRoleNames.forEach((roleName: unknown) => {
    const normalized = normalizeText(roleName);
    if (normalized) values.add(normalized);
  });

  const roleObjects = Array.isArray(user?.rbac_roles) ? user.rbac_roles : [];
  roleObjects.forEach((role: any) => {
    const normalized = normalizeText(role?.role_name);
    if (normalized) values.add(normalized);
  });

  const effectiveRoleObjects = Array.isArray(user?.effective_roles) ? user.effective_roles : [];
  effectiveRoleObjects.forEach((role: any) => {
    const normalized =
      typeof role === 'string'
        ? normalizeText(role)
        : normalizeText(role?.role_name);
    if (normalized) values.add(normalized);
  });

  return [...values];
}

function extractTokenRoleNames(): string[] {
  const token = getAccessToken();
  if (!token) return [];

  try {
    const decoded = jwtDecode<TokenClaims>(token);
    if (!Array.isArray(decoded.roles)) return [];
    return decoded.roles
      .map((roleName) => normalizeText(roleName))
      .filter((roleName): roleName is string => roleName.length > 0);
  } catch {
    return [];
  }
}

function applyCanonicalRole(
  roleName: string,
  rolesByFeature: Record<string, string[]>,
  capabilities: string[]
) {
  const normalizedRoleName = normalizeText(roleName);
  if (!normalizedRoleName) return;

  if (normalizedRoleName === 'super_admin' || normalizedRoleName === 'workspace_admin') {
    FEATURE_KEYS.forEach((feature) => {
      addCapability(rolesByFeature, capabilities, feature, 'admin');
      addCapability(rolesByFeature, capabilities, feature, 'user');
    });
    return;
  }

  if (normalizedRoleName === 'library_admin') {
    addCapability(rolesByFeature, capabilities, 'query_studio', 'user');
    return;
  }

  const [feature, role] = normalizedRoleName.split(':', 2);
  if (!feature || !role) return;

  addCapability(rolesByFeature, capabilities, feature, role);
  if (role === 'admin') {
    addCapability(rolesByFeature, capabilities, feature, 'user');
  }
}

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
function normalizeRoles(user: any): { rolesByFeature: Record<string, string[]>; capabilities: string[] } {
  const rolesByFeature: Record<string, string[]> = {};
  const capabilities: string[] = [];

  const canonicalRoleNames = new Set<string>([
    ...extractProfileRoleNames(user),
    ...extractTokenRoleNames(),
  ]);

  canonicalRoleNames.forEach((roleName) => {
    applyCanonicalRole(roleName, rolesByFeature, capabilities);
  });

  return { rolesByFeature, capabilities };
}

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    logoutUser: (state) => {
      state.user = null;
      state.rolesByFeature = {};
      state.capabilities = [];
      state.loading = false;
      state.error = null;
    },
    // optional: allow replacing the user (e.g., profile refresh)
    setUser: (state, action: PayloadAction<any>) => {
      state.user = action.payload;
      const norm = normalizeRoles(action.payload);
      state.rolesByFeature = norm.rolesByFeature;
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
        state.rolesByFeature = norm.rolesByFeature;
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
