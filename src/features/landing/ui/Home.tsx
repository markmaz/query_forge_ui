// src/features/query-forge/ui/HomePage.tsx
import React from "react";
import WelcomeBanner, { WelcomeBannerProps } from "./components/WelcomBanner";
import RecentQueriesWidget, { RecentQueriesWidgetProps } from "./components/RecentQueriesWidget";
import NewQueryActions, { NewQueryActionsProps } from "./components/NewQueryActions";
import TemplatesWidget, { TemplatesWidgetProps } from "./components/TemplatesWidget";
import ActivitySummary, { ActivitySummaryProps } from "./components/ActivitiesSummary";
import HelpGettingStarted, { HelpGettingStartedProps } from "./components/HelpGettingStarted";
import EnvironmentStatus, {
  type EnvironmentStatusProps,
} from "./components/EnvironmentStatus";

export type HomePageProps = {
  welcome: WelcomeBannerProps;
  recent: RecentQueriesWidgetProps;
  actions: NewQueryActionsProps;
  templates?: TemplatesWidgetProps;
  activity?: ActivitySummaryProps;
  help?: HelpGettingStartedProps;
  env?: EnvironmentStatusProps;
};

export const HomePage: React.FC<HomePageProps> = ({
  welcome,
  recent,
  actions,
  templates,
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

        {templates ? (
          <div className="col-12">
            <TemplatesWidget {...templates} />
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
