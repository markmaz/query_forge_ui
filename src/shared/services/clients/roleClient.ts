import api from "../api";

export const roleClient = {
  fetchRoles() {
    return api.get("/roles");
  },
};

