import { Settings, User } from "react-feather";
import { routes } from "../../navigation/routes";
import { BookmarkedItems, CartList, Languages, MessageList, Notifications, ProfileItems } from "../../../domain-model/Layout";

export const notifications: Notifications[] = [
  { id: 1, avatar: "avtar/2.jpg", text: "You have new finical page design.", time: "Today 11:45pm" },
  { id: 2, avatar: "avtar/17.jpg", text: "Congrats! you all task for today.", time: "Today 01:05pm" },
  { id: 3, avatar: "avtar/18.jpg", text: "You have new in landing page design.", time: "Today 06:55pm" },
  { id: 4, avatar: "avtar/19.jpg", text: "Congrats! you all task for today.", time: "Today 06:55pm" },
];

export const bookMarks: BookmarkedItems[] = [
  { id: 1, icon: "sample-page", title: "Sample Page", url: routes.HomePage },
];

export const messages: MessageList[] = [
  { image: "user/3.jpg", title: "Helen Walter", text: "Do you want to go see movie?" },
  { image: "user/6.jpg", title: "Jason Borne", text: "Thank you for rating us." },
  { image: "user/10.jpg", title: "Sarah Loren", text: "What`s project report update?" },
];

export const carts: CartList[] = [
  { id: 1, image: "05.jpg", name: "Women's Track Suit", price: 65.0, quantity: 8 },
  { id: 2, image: "02.jpg", name: "Women Top", price: 50.0, quantity: 10 },
];

export const languages: Languages[] = [
  { value: "en", icon: "us", name: "English" },
  { value: "du", icon: "de", name: "German" },
  { value: "es", icon: "es", name: "Spanish" },
  { value: "fr", icon: "fr", name: "French" },
  { value: "pt", icon: "pt", name: "Portuguese" },
  { value: "cn", icon: "cn", name: "Chinese" },
  { value: "ae", icon: "ae", name: "Arabic" },
];

export const profileList: ProfileItems[] = [
  { id: 1, link: routes.SettingsAccountView, icon: <User />, text: "Account" },
  { id: 2, link: routes.SettingsView, icon: <Settings />, text: "Settings" },
  {
    id: 3,
    link: routes.UsermanagementView,
    icon: <User />,
    text: "User Management",
    guard: (caps) => caps.some((capability) => capability.endsWith(":admin")),
  }
];
