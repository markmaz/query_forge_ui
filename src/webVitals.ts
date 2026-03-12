import { ReportHandler } from 'web-vitals';

const webVitals = (onPerfEntry?: ReportHandler) => {
  if (typeof onPerfEntry !== "function") {
    return;
  }

  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS(onPerfEntry);
    getFID(onPerfEntry);
    getFCP(onPerfEntry);
    getLCP(onPerfEntry);
    getTTFB(onPerfEntry);
  });
};

export default webVitals;
