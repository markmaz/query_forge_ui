import api from "./api";

export const fetchRoles = async () => {
  try {
    const response = await api.get(`/roles/`);
    return response.data;
  } catch (error) {
    console.error("Error fetching role information: ", error);
  }
};
