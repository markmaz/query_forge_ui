import api from "./api";

/**
 * Fetches the given number of random articles from the QueryForge website.
 *
 * @param numArticles - The number of news articles to fetch
 * @returns A promise that resolves to the user's data if successful.
 * @throws Will log an error if the API call fails.
 */
export const fetchNewsArticles = async (articles: number) => {
  try {
    const response = await api.get(`/news/${articles}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching user information: ", error);
  }
};
