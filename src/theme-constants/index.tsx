import ConfigDB from "../config/ThemePalette";

const AUTH_FORGOT_PATH = "/auth/forgot";

export const Href: string = AUTH_FORGOT_PATH;
export const ThemePrimary: string = "var(--theme-default)";
export const Primary = ConfigDB.color.primaryColor || "var(--theme-default)";
export const Secondary = ConfigDB.color.secondaryColor || "var(--theme-secondary)";

//auth
export const DoNotHaveAccount: string = "Don't have account?";
export const CreateAccount: string = "Create Account";
export const EmailAddress: string = "Email address";
export const ForgotPassword: string = "Forgot password?";
export const Password: string = "Password";
export const RememberPassword: string = "Remember password";
export const SignIn: string = "Sign in";
export const SignInAccount: string = "Sign in to account";
export const SignInWith: string = "Or Sign in with";
export const TwitterLink: string = "Twitter";
export const FacebookLink: string = "Facebook";
export const LinkedIn: string = "LinkedIn";
export const AgreeWith: string = "Agree with";
export const CreateYourAccount: string = "Create your account";
export const PrivacyPolicy: string = "Privacy Policy";
export const YourName: string = "Your Name";
export const EnterYourPassword: string = "Enter your Password";
export const Unlock: string = "UNLOCK";
export const ResetYourPassword: string = "Reset Your Password";
export const EnterYourMobileNumber: string = "Enter Your Mobile Number";
export const Resend: string = " Resend ";
export const EnterOtp: string = "Enter OTP";
export const CreateYourPassword: string = "Create Your Password";
export const NewPassword: string = "New Password";
export const RetypePassword: string = "Retype Password";
export const MAINTENANCE: string = "MAINTENANCE";
export const SignUpAccount: string = "Sign up to account";
export const EnterDetails: string = "Enter your email & password to login";
export const Finish: string = "Finish";
export const Phone: string = "Phone";
export const Birthday: string = "Birthday:";
export const Done: string = "Done";
export const Send: string = "Send";
export const ConfirmPassword: string = "Confirm Password";
export const FirstName: string = "First name";
export const LastName: string = "Last name";
export const City: string = "City";
export const State: string = "State";
export const Country: string = "Country";

//layout
export const Pinned: string = "Pinned";
export const CartTitle: string = "Cart";
export const Back: string = "Back";
export const Checkout: string = "Checkout";
export const EmptyCart: string = "Oops! Your cart empty!!!";
export const ViewCart: string = "View Cart";
export const OrderTotal: string = "Order Total :";
export const Bookmarks: string = "Bookmark";
export const AddNewBookmark: string = "Add New Bookmark";
export const CheckAll: string = "Check all";
export const NotificationTitle: string = "Notifications";
export const MessageTitle: string = "Message";
export const Cancel: string = "Cancel";
export const ConfigurationTitle: string = "Configuration";
export const CopyTextButton: string = "Copy Text";
export const LayoutTypeTitle: string = "Layout Type";
export const SidebarIconTitle: string = "Sidebar Icon";
export const ApplyButton: string = "Apply";
export const UnlimitedColorTitle: string = "Unlimited Color";
export const LightLayoutTitle: string = "Light layout";
export const DarkLayoutTitle: string = "Dark layout";
export const MixLayoutTitle: string = "Mix Layout";
export const SidebarTypeTitle: string = "Sidebar Type";
export const LogOut: string = "Log out";

//Pages
export const Pages: string = "Home";
export const SamplePageTitle: string = "Sample Page";
export const SampleCardTitle: string = "Sample Card";
export const SettingPageTitle: string = "Settings";
export const SettingsCardTitle: string = "Workspace Settings";
