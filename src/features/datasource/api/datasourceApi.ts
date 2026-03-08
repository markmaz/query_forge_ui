import api from "../../../shared/services/api";

export type Datasource = {
  name: string;
  type: string;
};

export async function fetchDatasources(): Promise<Datasource[]> {
  const res = await api.get<Datasource[]>("/datasources");
  return res.data;
}
