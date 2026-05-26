// src/features/query-forge/ui/HomePage.tsx
import React from "react";
import WelcomeBanner, { WelcomeBannerProps } from "./components/WelcomBanner";
import RecentQueriesWidget, { RecentQueriesWidgetProps } from "./components/RecentQueriesWidget";
import NewQueryActions, { NewQueryActionsProps } from "./components/NewQueryActions";
import ActivityPulseWidget, { ActivityPulseWidgetProps } from "./components/ActivityPulseWidget";
import ActivitySummary, { ActivitySummaryProps } from "./components/ActivitiesSummary";
import HelpGettingStarted, { HelpGettingStartedProps } from "./components/HelpGettingStarted";
import EnvironmentStatus, {
  type EnvironmentStatusProps,
} from "./components/EnvironmentStatus";

export type HomePageProps = {
  welcome: WelcomeBannerProps;
  recent: RecentQueriesWidgetProps;
  actions: NewQueryActionsProps;
  pulse?: ActivityPulseWidgetProps;
  activity?: ActivitySummaryProps;
  help?: HelpGettingStartedProps;
  env?: EnvironmentStatusProps;
};

export const HomePage: React.FC<HomePageProps> = ({
  welcome,
  recent,
  actions,
  pulse,
  activity,
  help,
  env,
}) => {
  return (
    <div className="container-fluid py-3">
      <div className="row g-3">
        <div className="col-12">
          <WelcomeBanner {...welcome} />
        </div>

        <div className="col-12 col-xl-7">
          <RecentQueriesWidget {...recent} />
        </div>

        <div className="col-12 col-xl-5">
          <NewQueryActions {...actions} />
        </div>

        {pulse ? (
          <div className="col-12">
            <ActivityPulseWidget {...pulse} />
          </div>
        ) : null}

        <div className="col-12 col-xl-4">
          {activity ? <ActivitySummary {...activity} /> : null}
        </div>

        <div className="col-12 col-xl-4">
          {help ? <HelpGettingStarted {...help} /> : null}
        </div>

        <div className="col-12 col-xl-4">
          <EnvironmentStatus {...(env ?? {})} />
        </div>
      </div>
    </div>
  );
};

export default HomePage;
