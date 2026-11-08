declare module "react-grid-layout" {
  import { ComponentType } from "react";
  export function useContainerWidth(): { width: number; containerRef: any; mounted: boolean };
  const ReactGridLayout: ComponentType<any>;
  export default ReactGridLayout;
}
