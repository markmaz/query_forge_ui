# QueryForge UI

## Semantic Registry + Planner Admin

### Required env vars
- `VITE_API_URL`: API base URL (for example `http://localhost:8000/api/v1`).

### Header injection
- `Authorization: Bearer <token>` is injected from access token storage.
- `X-Workspace-Id` is injected from selected workspace in Redux.
- `X-User-Id` is injected from signed-in user profile (when available).

### Routes
- `/semantic/concepts`
- `/semantic/aliases`
- `/semantic/value-aliases`
- `/semantic/concept-column-maps`
- `/semantic/planner`
- `/admin/prompt-feedback`
- `/admin/feedback-learning`

### Behavior notes
- Read/list pages are available to authenticated users.
- Mutation actions (create/edit/delete/seed/rebuild) are hidden when user has no `admin` role capability.
- Planner supports both `/semantic/suggest-columns` and `/semantic/plan` with cancellation.
- The Feedback Learning admin console is a reviewer surface for:
  - candidate approval and rejection
  - semantic/domain override visibility and deactivation
  - promotion audit visibility
- Intended operator flow in the UI:
  1. open `/admin/feedback-learning`
  2. review candidate filters and queue state
  3. inspect candidate detail before approval or rejection
  4. confirm override creation through the overrides tab
  5. inspect promotion history through the promotion-audits tab
- The Feedback Learning page calls these backend endpoints:
  - `GET /api/v1/feedback-learning/candidates`
  - `GET /api/v1/feedback-learning/candidates/:id`
  - `POST /api/v1/feedback-learning/candidates/:id/approve`
  - `POST /api/v1/feedback-learning/candidates/:id/reject`
  - `POST /api/v1/feedback-learning/candidates/bulk-approve`
  - `POST /api/v1/feedback-learning/candidates/bulk-reject`
  - `GET /api/v1/feedback-learning/semantic-overrides`
  - `GET /api/v1/feedback-learning/domain-overrides`
  - `POST /api/v1/feedback-learning/semantic-overrides/:id/deactivate`
  - `POST /api/v1/feedback-learning/domain-overrides/:id/deactivate`
  - `GET /api/v1/feedback-learning/promotion-audits`
- These routes assume the standard frontend auth/runtime contract:
  - bearer token in access-token storage
  - `X-Workspace-Id` for the active workspace
  - admin-capable user state initialized before route entry
- The page is exposed in navigation at:
  - `System Admin`
  - `Data Foundation`
  - `Feedback Learning`
- Docker and Nginx behavior:
  - the UI continues to call `/api/v1/*` on the browser origin
  - Nginx should proxy `/api/*` to the backend API host/container
  - no special browser routing is required for `/admin/feedback-learning` beyond the normal SPA route handling

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### Similarity Gate

- `npm run similarity:report`
  - Reports similarity metrics vs baseline source tree.
  - Baseline path defaults to `../workboard-ui/src`.
  - Override with `SIMILARITY_BASELINE_SRC=/custom/path/src`.
- `npm run similarity:check`
  - Enforces thresholds from `similarity-thresholds.json`.
  - Exits non-zero when thresholds are exceeded.

The GitHub workflow `.github/workflows/similarity-gate.yml` uses:
- Repo variable `SIMILARITY_BASELINE_REPO` (required, e.g. `org/workboard-ui`)
- Repo variable `SIMILARITY_BASELINE_REF` (optional, defaults to `main`)
- Secret `SIMILARITY_BASELINE_TOKEN` (optional, use for private cross-repo checkout)

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
